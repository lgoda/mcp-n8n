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
  updateWorkflowInputSchema,
  updateWorkflowOutputSchema
} from "../schemas/workflowSchemas.js";
import type { N8nClient } from "../services/n8nClient.js";
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
      description: "Get one n8n workflow by ID with cleaned fields.",
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
        description: "Safely update selected workflow fields using controlled merge.",
        inputSchema: updateWorkflowInputSchema
      },
      async (input) => updateWorkflowHandler(input, deps)
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
