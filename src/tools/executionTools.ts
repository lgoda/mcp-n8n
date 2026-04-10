import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  getExecutionInputSchema,
  getExecutionOutputSchema,
  listExecutionsInputSchema,
  listExecutionsOutputSchema
} from "../schemas/executionSchemas.js";
import type { N8nClient } from "../services/n8nClient.js";
import { errorToolResult, okToolResult } from "../utils/toolResults.js";

interface ExecutionToolsDeps {
  n8nClient: Pick<N8nClient, "listExecutions" | "getExecution">;
}

export const listExecutionsHandler = async (
  input: unknown,
  deps: ExecutionToolsDeps
) => {
  try {
    const parsedInput = listExecutionsInputSchema.parse(input ?? {});
    const executions = await deps.n8nClient.listExecutions(parsedInput);
    const payload = listExecutionsOutputSchema.parse({
      data: executions.data.map((execution) => ({
        id: execution.id,
        workflowId: execution.workflowId,
        workflowName: execution.workflowName,
        status: execution.status,
        mode: execution.mode,
        startedAt: execution.startedAt,
        stoppedAt: execution.stoppedAt
      })),
      nextCursor: executions.nextCursor
    });

    return okToolResult(payload);
  } catch (error) {
    return errorToolResult(error);
  }
};

export const getExecutionHandler = async (
  input: unknown,
  deps: ExecutionToolsDeps
) => {
  try {
    const parsedInput = getExecutionInputSchema.parse(input);
    const execution = await deps.n8nClient.getExecution(parsedInput.executionId);
    const payload = getExecutionOutputSchema.parse(execution);

    return okToolResult(payload);
  } catch (error) {
    return errorToolResult(error);
  }
};

export const registerExecutionTools = (server: McpServer, deps: ExecutionToolsDeps): void => {
  server.registerTool(
    "list_executions",
    {
      title: "List Executions",
      description: "List n8n executions with optional workflow, status and limit filters.",
      inputSchema: listExecutionsInputSchema
    },
    async (input) => listExecutionsHandler(input, deps)
  );

  server.registerTool(
    "get_execution",
    {
      title: "Get Execution",
      description: "Get a specific n8n execution by ID with cleaned output fields.",
      inputSchema: getExecutionInputSchema
    },
    async (input) => getExecutionHandler(input, deps)
  );
};
