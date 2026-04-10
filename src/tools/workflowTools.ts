import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  activateWorkflowInputSchema,
  activationOutputSchema,
  createWorkflowInputSchema,
  createWorkflowOutputSchema,
  deactivateWorkflowInputSchema,
  getWorkflowInputSchema,
  getWorkflowOutputSchema,
  listWorkflowsInputSchema,
  listWorkflowsOutputSchema,
  updateWorkflowNodeParameterInputSchema,
  updateWorkflowNodeParameterOutputSchema,
  updateWorkflowInputSchema,
  updateWorkflowOutputSchema
} from "../schemas/workflowSchemas.js";
import type { N8nClient } from "../services/n8nClient.js";
import { AppError } from "../utils/errors.js";
import { mergeWorkflowUpdate } from "../utils/safeMerge.js";
import { errorToolResult, okToolResult } from "../utils/toolResults.js";

interface WorkflowToolsDeps {
  n8nClient: Pick<
    N8nClient,
    | "listWorkflows"
    | "getWorkflow"
    | "createWorkflow"
    | "updateWorkflow"
    | "activateWorkflow"
    | "deactivateWorkflow"
  >;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseParameterPath = (path: string): string[] => {
  const normalized = path.replace(/\[(\d+)\]/g, ".$1");
  const segments = normalized.split(".").map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) {
    throw new AppError("VALIDATION_ERROR", "parameterPath cannot be empty", 400);
  }
  return segments;
};

const setValueAtPath = (
  root: Record<string, unknown>,
  path: string,
  value: string | number | boolean | null
): void => {
  const segments = parseParameterPath(path);
  let cursor: unknown = root;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];
    if (segment === undefined || nextSegment === undefined) {
      throw new AppError("VALIDATION_ERROR", "parameterPath is invalid", 400);
    }
    const currentIsArrayIndex = /^\d+$/.test(segment);
    const nextShouldBeArray = /^\d+$/.test(nextSegment);

    if (currentIsArrayIndex) {
      if (!Array.isArray(cursor)) {
        throw new AppError("VALIDATION_ERROR", "parameterPath does not match parameter structure", 400, {
          segment
        });
      }
      const arrayIndex = Number(segment);
      const currentArrayValue = cursor[arrayIndex];
      if (currentArrayValue === undefined || currentArrayValue === null) {
        cursor[arrayIndex] = nextShouldBeArray ? [] : {};
      }
      cursor = cursor[arrayIndex];
      continue;
    }

    if (!isRecord(cursor)) {
      throw new AppError("VALIDATION_ERROR", "parameterPath does not match parameter structure", 400, {
        segment
      });
    }

    const currentObjectValue = cursor[segment];
    if (currentObjectValue === undefined || currentObjectValue === null) {
      cursor[segment] = nextShouldBeArray ? [] : {};
    }
    cursor = cursor[segment];
  }

  const lastSegment = segments[segments.length - 1];
  if (lastSegment === undefined) {
    throw new AppError("VALIDATION_ERROR", "parameterPath is invalid", 400);
  }
  const lastIsIndex = /^\d+$/.test(lastSegment);

  if (lastIsIndex) {
    if (!Array.isArray(cursor)) {
      throw new AppError("VALIDATION_ERROR", "parameterPath does not match parameter structure", 400, {
        segment: lastSegment
      });
    }
    cursor[Number(lastSegment)] = value;
    return;
  }

  if (!isRecord(cursor)) {
    throw new AppError("VALIDATION_ERROR", "parameterPath does not match parameter structure", 400, {
      segment: lastSegment
    });
  }

  cursor[lastSegment] = value;
};

export const listWorkflowsHandler = async (
  input: unknown,
  deps: WorkflowToolsDeps
) => {
  try {
    const parsedInput = listWorkflowsInputSchema.parse(input ?? {});
    const workflows = await deps.n8nClient.listWorkflows(parsedInput);
    const payload = listWorkflowsOutputSchema.parse({
      data: workflows.data.map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        active: workflow.active,
        updatedAt: workflow.updatedAt
      })),
      nextCursor: workflows.nextCursor
    });

    return okToolResult(payload);
  } catch (error) {
    return errorToolResult(error);
  }
};

export const getWorkflowHandler = async (
  input: unknown,
  deps: WorkflowToolsDeps
) => {
  try {
    const parsedInput = getWorkflowInputSchema.parse(input);
    const workflow = await deps.n8nClient.getWorkflow(parsedInput.workflowId);
    const payload = getWorkflowOutputSchema.parse({
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      updatedAt: workflow.updatedAt
    });

    return okToolResult(payload);
  } catch (error) {
    return errorToolResult(error);
  }
};

export const createWorkflowHandler = async (
  input: unknown,
  deps: WorkflowToolsDeps
) => {
  try {
    const parsedInput = createWorkflowInputSchema.parse(input);
    const workflow = await deps.n8nClient.createWorkflow(parsedInput);
    const payload = createWorkflowOutputSchema.parse({
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      created: true
    });

    return okToolResult(payload);
  } catch (error) {
    return errorToolResult(error);
  }
};

export const updateWorkflowHandler = async (
  input: unknown,
  deps: WorkflowToolsDeps
) => {
  try {
    const parsedInput = updateWorkflowInputSchema.parse(input);
    const existing = await deps.n8nClient.getWorkflow(parsedInput.workflowId);

    const mergedPayload = mergeWorkflowUpdate(existing, {
      name: parsedInput.name,
      nodes: parsedInput.nodes,
      connections: parsedInput.connections,
      settings: parsedInput.settings
    });

    const updated = await deps.n8nClient.updateWorkflow(parsedInput.workflowId, mergedPayload);
    const payload = updateWorkflowOutputSchema.parse(updated);

    return okToolResult(payload);
  } catch (error) {
    return errorToolResult(error);
  }
};

export const updateWorkflowNodeParameterHandler = async (
  input: unknown,
  deps: WorkflowToolsDeps
) => {
  try {
    const parsedInput = updateWorkflowNodeParameterInputSchema.parse(input);
    const existing = await deps.n8nClient.getWorkflow(parsedInput.workflowId);
    const updatedNodes = structuredClone(existing.nodes);
    const node = updatedNodes.find((currentNode) => currentNode.name === parsedInput.nodeName);

    if (!node) {
      throw new AppError("NOT_FOUND", "Workflow node not found", 404, {
        workflowId: parsedInput.workflowId,
        nodeName: parsedInput.nodeName
      });
    }

    const nodeParameters = isRecord(node.parameters) ? node.parameters : {};
    setValueAtPath(nodeParameters, parsedInput.parameterPath, parsedInput.value);
    node.parameters = nodeParameters;

    await deps.n8nClient.updateWorkflow(parsedInput.workflowId, {
      name: existing.name,
      nodes: updatedNodes,
      connections: existing.connections,
      settings: existing.settings
    });

    const payload = updateWorkflowNodeParameterOutputSchema.parse({
      workflowId: parsedInput.workflowId,
      nodeName: parsedInput.nodeName,
      parameterPath: parsedInput.parameterPath,
      value: parsedInput.value,
      updated: true
    });

    return okToolResult(payload);
  } catch (error) {
    return errorToolResult(error);
  }
};

export const activateWorkflowHandler = async (
  input: unknown,
  deps: WorkflowToolsDeps
) => {
  try {
    const parsedInput = activateWorkflowInputSchema.parse(input);
    const workflow = await deps.n8nClient.activateWorkflow(parsedInput.workflowId);
    const payload = activationOutputSchema.parse({
      workflowId: workflow.id,
      active: workflow.active,
      message: "Workflow activated"
    });

    return okToolResult(payload);
  } catch (error) {
    return errorToolResult(error);
  }
};

export const deactivateWorkflowHandler = async (
  input: unknown,
  deps: WorkflowToolsDeps
) => {
  try {
    const parsedInput = deactivateWorkflowInputSchema.parse(input);
    const workflow = await deps.n8nClient.deactivateWorkflow(parsedInput.workflowId);
    const payload = activationOutputSchema.parse({
      workflowId: workflow.id,
      active: workflow.active,
      message: "Workflow deactivated"
    });

    return okToolResult(payload);
  } catch (error) {
    return errorToolResult(error);
  }
};

export const registerWorkflowTools = (
  server: McpServer,
  deps: WorkflowToolsDeps,
  options?: { enableWriteTools?: boolean }
): void => {
  const enableWriteTools = options?.enableWriteTools ?? true;

  server.registerTool(
    "list_workflows",
    {
      title: "List Workflows",
      description: "List n8n workflows with optional pagination and active-state filter.",
      inputSchema: listWorkflowsInputSchema
    },
    async (input) => listWorkflowsHandler(input, deps)
  );

    server.registerTool(
      "get_workflow",
      {
        title: "Get Workflow",
        description:
          "Get one n8n workflow by ID with cleaned fields. Use this before update operations when node details are needed.",
        inputSchema: getWorkflowInputSchema
      },
      async (input) => getWorkflowHandler(input, deps)
    );

  if (enableWriteTools) {
    server.registerTool(
      "create_workflow",
      {
        title: "Create Workflow",
        description: "Create a new n8n workflow.",
        inputSchema: createWorkflowInputSchema
      },
      async (input) => createWorkflowHandler(input, deps)
    );

    server.registerTool(
      "update_workflow",
      {
        title: "Update Workflow",
        description:
          "Safely update top-level workflow fields using controlled merge. Prefer update_workflow_node_parameter for single-node parameter edits.",
        inputSchema: updateWorkflowInputSchema
      },
      async (input) => updateWorkflowHandler(input, deps)
    );

    server.registerTool(
      "update_workflow_node_parameter",
      {
        title: "Update Workflow Node Parameter",
        description:
          "Preferred tool for single-node parameter edits. Use this for requests like changing wait amount, delay, limits, or flags on one node, without sending full nodes array.",
        inputSchema: updateWorkflowNodeParameterInputSchema
      },
      async (input) => updateWorkflowNodeParameterHandler(input, deps)
    );

    server.registerTool(
      "activate_workflow",
      {
        title: "Activate Workflow",
        description: "Activate an existing n8n workflow.",
        inputSchema: activateWorkflowInputSchema
      },
      async (input) => activateWorkflowHandler(input, deps)
    );

    server.registerTool(
      "deactivate_workflow",
      {
        title: "Deactivate Workflow",
        description: "Deactivate an existing n8n workflow.",
        inputSchema: deactivateWorkflowInputSchema
      },
      async (input) => deactivateWorkflowHandler(input, deps)
    );
  }
};
