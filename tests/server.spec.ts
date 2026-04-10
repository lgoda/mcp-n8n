import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";

import { createApp } from "../src/server.js";

let server: HttpServer | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  server = undefined;
});

describe("server", () => {
  it("returns health payload", async () => {
    const app = createApp({
      appConfig: {
        N8N_API_URL: "https://n8n.example.com",
        N8N_API_KEY: "test-key",
        PORT: 0,
        MCP_SERVER_NAME: "n8n-mcp-server",
        MCP_SERVER_VERSION: "0.1.0",
        LOG_LEVEL: "info"
      },
      enableWriteTools: false
    });

    server = app.listen(0);

    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("n8n-mcp-server");
    expect(body.version).toBe("0.1.0");
  });
});
