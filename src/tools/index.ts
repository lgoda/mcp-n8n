import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { N8nClient } from "../services/n8nClient.js";
import { registerExecutionTools } from "./executionTools.js";
import { registerWorkflowTools } from "./workflowTools.js";

interface RegisterToolsDeps {
  n8nClient: N8nClient;
  enableWriteTools?: boolean;
}

export const registerTools = (server: McpServer, deps: RegisterToolsDeps): void => {
  registerWorkflowTools(
    server,
    { n8nClient: deps.n8nClient },
    { enableWriteTools: deps.enableWriteTools }
  );
  registerExecutionTools(server, { n8nClient: deps.n8nClient });
};
