import { createServer, type Server as HttpServer } from "node:http";

import express, { type Express, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { loadConfig, type AppConfig } from "./config.js";
import { N8nClient } from "./services/n8nClient.js";
import { registerTools } from "./tools/index.js";
import { toPublicError } from "./utils/errors.js";
import { createLogger } from "./utils/logger.js";

export interface CreateAppOptions {
  appConfig?: AppConfig;
  enableWriteTools?: boolean;
}

const buildMcpServer = (serverConfig: AppConfig, enableWriteTools: boolean): McpServer => {
  const mcpServer = new McpServer({
    name: serverConfig.MCP_SERVER_NAME,
    version: serverConfig.MCP_SERVER_VERSION
  });

  const logger = createLogger(serverConfig.LOG_LEVEL);
  const n8nClient = new N8nClient({
    baseUrl: serverConfig.N8N_API_URL,
    apiKey: serverConfig.N8N_API_KEY,
    logger
  });

  // TODO: Replace this static flag with auth-aware policy checks (role/scope-based).
  registerTools(mcpServer, { n8nClient, enableWriteTools });

  return mcpServer;
};

export const createApp = (options?: CreateAppOptions): Express => {
  const app = express();
  const serverConfig = options?.appConfig ?? loadConfig();
  const logger = createLogger(serverConfig.LOG_LEVEL);

  // TODO: Add OAuth/auth middleware before exposing this server in multi-tenant/public environments.
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: serverConfig.MCP_SERVER_NAME,
      version: serverConfig.MCP_SERVER_VERSION,
      timestamp: new Date().toISOString()
    });
  });

  app.all("/mcp", async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const mcpSessionId = req.header("mcp-session-id") ?? null;
    const mcpProtocolVersion = req.header("mcp-protocol-version") ?? null;
    const acceptHeader = req.header("accept") ?? null;
    const contentTypeHeader = req.header("content-type") ?? null;

    logger.debug("MCP request received", {
      method: req.method,
      mcpSessionId,
      mcpProtocolVersion,
      accept: acceptHeader,
      contentType: contentTypeHeader
    });

    const mcpServer = buildMcpServer(serverConfig, options?.enableWriteTools ?? true);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      const publicError = toPublicError(error);
      logger.error("MCP request failed", {
        method: req.method,
        mcpSessionId,
        mcpProtocolVersion,
        code: publicError.code,
        statusCode: publicError.statusCode,
        message: publicError.message
      });

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id: null
        });
      }
    } finally {
      await transport.close().catch(() => undefined);
      await mcpServer.close().catch(() => undefined);
      logger.debug("MCP request completed", {
        method: req.method,
        durationMs: Date.now() - startedAt,
        responseHeadersSent: res.headersSent,
        responseStatusCode: res.statusCode
      });
    }
  });

  return app;
};

export const startServer = async (options?: CreateAppOptions): Promise<HttpServer> => {
  const serverConfig = options?.appConfig ?? loadConfig();
  const logger = createLogger(serverConfig.LOG_LEVEL);
  const app = createApp(options);

  const httpServer = createServer(app);

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(serverConfig.PORT, () => resolve());
  });

  logger.info("MCP server listening", {
    port: serverConfig.PORT,
    name: serverConfig.MCP_SERVER_NAME,
    version: serverConfig.MCP_SERVER_VERSION
  });

  return httpServer;
};
