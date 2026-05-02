import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  getExecutionInputSchema,
  getExecutionNodeDataInputSchema,
  getExecutionNodeDataOutputSchema,
  getExecutionOutputSchema,
  listExecutionsInputSchema,
  listExecutionsOutputSchema
} from "../schemas/executionSchemas.js";
import type { N8nClient } from "../services/n8nClient.js";
import { AppError } from "../utils/errors.js";
import { errorToolResult, okToolResult } from "../utils/toolResults.js";

interface ExecutionToolsDeps {
  n8nClient: Pick<N8nClient, "listExecutions" | "getExecution">;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getRunDataMap = (executionData: Record<string, unknown>): Record<string, unknown> | undefined => {
  const resultData = executionData.resultData;
  if (!isRecord(resultData)) {
    return undefined;
  }

  const runData = resultData.runData;
  return isRecord(runData) ? runData : undefined;
};

const toNodeRunOutput = (nodeRuns: unknown[]): Array<{
  runIndex: number;
  hasError: boolean;
  errorMessage?: string;
  input?: unknown;
  output?: unknown;
}> => {
  return nodeRuns.map((run, runIndex) => {
    if (!isRecord(run)) {
      return {
        runIndex,
        hasError: false,
        output: run
      };
    }

    const runError = run.error;
    const errorMessage =
      isRecord(runError) && typeof runError.message === "string"
        ? runError.message
        : typeof runError === "string"
          ? runError
          : undefined;

    const runData = run.data;
    const output = isRecord(runData) ? runData.main : undefined;
    const input = run.source;

    return {
      runIndex,
      hasError: errorMessage !== undefined,
      errorMessage,
      input,
      output
    };
  });
};

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

export const getExecutionNodeDataHandler = async (
  input: unknown,
  deps: ExecutionToolsDeps
) => {
  try {
    const parsedInput = getExecutionNodeDataInputSchema.parse(input);
    const execution = await deps.n8nClient.getExecution(parsedInput.executionId);

    if (!execution.data || !isRecord(execution.data)) {
      throw new AppError("NOT_FOUND", "Execution data is not available", 404, {
        errorType: "EXECUTION_DATA_NOT_AVAILABLE",
        hint: "Ensure n8n is configured to save execution data for this workflow run."
      });
    }

    const runDataMap = getRunDataMap(execution.data);
    if (!runDataMap) {
      throw new AppError("NOT_FOUND", "Execution runData not available", 404, {
        errorType: "EXECUTION_NODE_DATA_NOT_AVAILABLE",
        hint: "This execution does not include node-level runData."
      });
    }

    const nodeRunsRaw = runDataMap[parsedInput.nodeName];
    if (!Array.isArray(nodeRunsRaw)) {
      throw new AppError("NOT_FOUND", "Execution node not found in runData", 404, {
        errorType: "EXECUTION_NODE_NOT_FOUND",
        executionId: parsedInput.executionId,
        nodeName: parsedInput.nodeName,
        hint: "Use get_execution to inspect available node names in runData."
      });
    }

    const runs = toNodeRunOutput(nodeRunsRaw);
    const payload = getExecutionNodeDataOutputSchema.parse({
      executionId: parsedInput.executionId,
      nodeName: parsedInput.nodeName,
      runs,
      hasAnyError: runs.some((run) => run.hasError)
    });

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

  server.registerTool(
    "get_execution_node_data",
    {
      title: "Get Execution Node Data",
      description:
        "Get node-level execution data for one node in one execution (runs, input/output, and node errors). Use this for debugging partial failures when workflow status is success.",
      inputSchema: getExecutionNodeDataInputSchema
    },
    async (input) => getExecutionNodeDataHandler(input, deps)
  );
};
