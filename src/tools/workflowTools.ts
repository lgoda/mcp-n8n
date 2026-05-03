import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  activateWorkflowInputSchema,
  activationOutputSchema,
  cloneWorkflowInputSchema,
  cloneWorkflowOutputSchema,
  createWorkflowInputSchema,
  createWorkflowOutputSchema,
  deactivateWorkflowInputSchema,
  getWorkflowInputSchema,
  getWorkflowNodeInputSchema,
  getWorkflowNodeOutputSchema,
  getWorkflowOutputSchema,
  listWorkflowsInputSchema,
  listWorkflowsOutputSchema,
  updateWorkflowNodeParameterInputSchema,
  updateWorkflowNodeParameterOutputSchema,
  updateWorkflowNodeParametersInputSchema,
  updateWorkflowNodeParametersOutputSchema,
  updateWorkflowInputSchema,
  updateWorkflowOutputSchema,
  validateWorkflowInputSchema,
  validateWorkflowOutputSchema
} from "../schemas/workflowSchemas.js";
import type { N8nClient } from "../services/n8nClient.js";
import type { WorkflowNode } from "../types/n8n.js";
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

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true
} as const;

const NODE_PARAM_UPDATE_RELATED_TOOLS = [
  "update_workflow_node_parameter",
  "get_workflow_node",
  "update_workflow"
];

const PARTIAL_UPDATE_RELATED_TOOLS = [
  "update_workflow_node_parameter",
  "update_workflow_node_parameters",
  "get_workflow",
  "update_workflow"
];

const ACTIVE_UPDATE_RELATED_TOOLS = [
  "deactivate_workflow",
  "update_workflow",
  "update_workflow_node_parameter",
  "update_workflow_node_parameters"
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const deepMergeJson = (
  target: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> => {
  const result: Record<string, unknown> = structuredClone(target);

  for (const [key, patchValue] of Object.entries(patch)) {
    const currentValue = result[key];
    if (isRecord(currentValue) && isRecord(patchValue)) {
      result[key] = deepMergeJson(currentValue, patchValue);
      continue;
    }
    result[key] = patchValue;
  }

  return result;
};

const parseParameterPath = (path: string): string[] => {
  const normalized = path.replace(/\[(\d+)\]/g, ".$1");
  const segments = normalized.split(".").map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) {
    throw new AppError("VALIDATION_ERROR", "parameterPath cannot be empty", 400, {
      errorType: "INVALID_PARAMETER_PATH",
      hint: "Provide a non-empty path like 'amount' or 'options.retry.maxRetries'."
    });
  }
  return segments;
};

const setValueAtPath = (
  root: Record<string, unknown>,
  path: string,
  value: unknown
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
          errorType: "INVALID_PARAMETER_PATH",
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
        errorType: "INVALID_PARAMETER_PATH",
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
        errorType: "INVALID_PARAMETER_PATH",
        segment: lastSegment
      });
    }
    cursor[Number(lastSegment)] = value;
    return;
  }

  if (!isRecord(cursor)) {
    throw new AppError("VALIDATION_ERROR", "parameterPath does not match parameter structure", 400, {
      errorType: "INVALID_PARAMETER_PATH",
      segment: lastSegment
    });
  }

  cursor[lastSegment] = value;
};

const findNodeByNameOrId = (
  nodes: WorkflowNode[],
  nodeNameOrId: string
): WorkflowNode | undefined => {
  const byId = nodes.find((node) => node.id === nodeNameOrId);
  if (byId) {
    return byId;
  }

  return nodes.find((node) => node.name === nodeNameOrId);
};

const resolveNodeSelector = (input: {
  nodeNameOrId?: string;
  nodeName?: string;
  nodeId?: string;
}): string => input.nodeNameOrId ?? input.nodeId ?? input.nodeName ?? "";

const enforceActiveWorkflowUpdatePolicy = async (
  workflowId: string,
  isActive: boolean,
  options: {
    allowActiveWorkflowUpdate?: boolean;
    deactivateBeforeUpdate?: boolean;
  },
  deps: WorkflowToolsDeps
): Promise<void> => {
  if (!isActive) {
    return;
  }

  if (options.deactivateBeforeUpdate === true) {
    await deps.n8nClient.deactivateWorkflow(workflowId);
    return;
  }

  if (options.allowActiveWorkflowUpdate === true) {
    return;
  }

  throw new AppError(
    "VALIDATION_ERROR",
    "Workflow is active. Refusing update without explicit confirmation.",
    400,
    {
      errorType: "ACTIVE_WORKFLOW_UPDATE_BLOCKED",
      hint: "Set allowActiveWorkflowUpdate=true or deactivateBeforeUpdate=true.",
      availableTools: ACTIVE_UPDATE_RELATED_TOOLS
    }
  );
};

const validateWorkflowDefinition = (input: {
  nodes: WorkflowNode[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
}): { valid: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (input.nodes.length === 0) {
    errors.push("Workflow must contain at least one node.");
  }

  const nodeNames = input.nodes.map((node) => node.name);
  const uniqueNodeNames = new Set(nodeNames);
  if (uniqueNodeNames.size !== nodeNames.length) {
    errors.push("Duplicate node names detected.");
  }

  if (Object.keys(input.connections).length === 0 && input.nodes.length > 1) {
    warnings.push("Workflow has more than one node but no connections.");
  }

  for (const node of input.nodes) {
    if (node.type.includes("scheduleTrigger")) {
      warnings.push(
        `Node '${node.name}' is a Schedule Trigger. Verify activation state before production updates.`
      );
    }

    const parameters = isRecord(node.parameters) ? node.parameters : {};

    const expressionCandidates = Object.values(parameters).filter((value) => typeof value === "string") as string[];
    for (const candidate of expressionCandidates) {
      if (candidate.includes("{{") && !candidate.includes("}}")) {
        warnings.push(`Node '${node.name}' contains a potentially invalid expression: '${candidate}'.`);
      }
    }

    if (node.type.includes("httpRequest")) {
      const authValue = parameters.authentication;
      if (typeof authValue === "string" && authValue !== "none") {
        warnings.push(
          `Node '${node.name}' uses HTTP authentication. Ensure credentials are not hardcoded in parameters.`
        );
      }

      const jsonBody = parameters.jsonBody;
      if (typeof jsonBody === "string") {
        const body = jsonBody.trim();
        if ((body.startsWith("{") || body.startsWith("[")) && body.length > 1) {
          try {
            JSON.parse(body);
          } catch {
            warnings.push(`Node '${node.name}' has potentially invalid JSON in jsonBody.`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
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

export const getWorkflowNodeHandler = async (
  input: unknown,
  deps: WorkflowToolsDeps
) => {
  try {
    const parsedInput = getWorkflowNodeInputSchema.parse(input);
    const workflow = await deps.n8nClient.getWorkflow(parsedInput.workflowId);
    const node = findNodeByNameOrId(workflow.nodes, parsedInput.nodeNameOrId);

    if (!node) {
      throw new AppError("NOT_FOUND", "Workflow node not found", 404, {
        errorType: "WORKFLOW_NODE_NOT_FOUND",
        workflowId: parsedInput.workflowId,
        nodeNameOrId: parsedInput.nodeNameOrId,
        hint: "Use get_workflow to inspect available node names and IDs."
      });
    }

    const payload = getWorkflowNodeOutputSchema.parse({
      workflowId: workflow.id,
      workflowName: workflow.name,
      workflowActive: workflow.active,
      node
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

export const cloneWorkflowHandler = async (
  input: unknown,
  deps: WorkflowToolsDeps
) => {
  try {
    const parsedInput = cloneWorkflowInputSchema.parse(input);
    const source = await deps.n8nClient.getWorkflow(parsedInput.sourceWorkflowId);
    const created = await deps.n8nClient.createWorkflow({
      name: parsedInput.newName,
      nodes: source.nodes,
      connections: source.connections,
      settings: source.settings
    });

    const finalWorkflow = parsedInput.active === true
      ? await deps.n8nClient.activateWorkflow(created.id)
      : created;

    const payload = cloneWorkflowOutputSchema.parse({
      sourceWorkflowId: parsedInput.sourceWorkflowId,
      id: finalWorkflow.id,
      name: finalWorkflow.name,
      active: finalWorkflow.active,
      updatedAt: finalWorkflow.updatedAt,
      cloned: true
    });

    return okToolResult(payload);
  } catch (error) {
    return errorToolResult(error);
  }
};

export const validateWorkflowHandler = async (input: unknown) => {
  try {
    const parsedInput = validateWorkflowInputSchema.parse(input);
    const result = validateWorkflowDefinition(parsedInput);
    const payload = validateWorkflowOutputSchema.parse(result);

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

    await enforceActiveWorkflowUpdatePolicy(
      parsedInput.workflowId,
      existing.active,
      {
        allowActiveWorkflowUpdate: parsedInput.allowActiveWorkflowUpdate,
        deactivateBeforeUpdate: parsedInput.deactivateBeforeUpdate
      },
      deps
    );

    if (parsedInput.nodes !== undefined && parsedInput.nodeUpdates !== undefined) {
      throw new AppError("VALIDATION_ERROR", "Cannot combine nodes and nodeUpdates in one request.", 400, {
        errorType: "INVALID_UPDATE_COMBINATION",
        hint: "Use either full nodes replacement or nodeUpdates patch mode, not both."
      });
    }

    if (parsedInput.nodes !== undefined) {
      const existingNodeKeys = new Set(
        existing.nodes.map((node) => (typeof node.id === "string" && node.id.length > 0 ? node.id : node.name))
      );
      const incomingNodeKeys = new Set(
        parsedInput.nodes.map((node) => (typeof node.id === "string" && node.id.length > 0 ? node.id : node.name))
      );
      const missingNodeKeys = Array.from(existingNodeKeys).filter((key) => !incomingNodeKeys.has(key));

      if (missingNodeKeys.length > 0) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Refusing partial nodes replacement.",
          400,
          {
            errorType: "PARTIAL_NODE_UPDATE_NOT_ALLOWED",
            hint: "Use update_workflow_node_parameter for incremental edits, or send the full nodes array.",
            availableTools: PARTIAL_UPDATE_RELATED_TOOLS,
            missingNodes: missingNodeKeys.slice(0, 20)
          }
        );
      }
    }

    let nodesFromNodeUpdates: WorkflowNode[] | undefined;
    if (parsedInput.nodeUpdates !== undefined) {
      const updatedNodes = structuredClone(existing.nodes);

      for (const update of parsedInput.nodeUpdates) {
        const selector = resolveNodeSelector(update);
        const node = findNodeByNameOrId(updatedNodes, selector);

        if (!node) {
          throw new AppError("NOT_FOUND", "Workflow node not found", 404, {
            errorType: "WORKFLOW_NODE_NOT_FOUND",
            workflowId: parsedInput.workflowId,
            nodeNameOrId: selector,
            hint: "Use get_workflow_node or get_workflow to inspect node IDs and names.",
            availableTools: NODE_PARAM_UPDATE_RELATED_TOOLS
          });
        }

        const nodeParameters = isRecord(node.parameters) ? node.parameters : {};
        node.parameters = deepMergeJson(nodeParameters, update.parameters);
      }

      nodesFromNodeUpdates = updatedNodes;
    }

    const mergedPayload = mergeWorkflowUpdate(existing, {
      name: parsedInput.name,
      nodes: parsedInput.nodes ?? nodesFromNodeUpdates,
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

    await enforceActiveWorkflowUpdatePolicy(
      parsedInput.workflowId,
      existing.active,
      {
        allowActiveWorkflowUpdate: parsedInput.allowActiveWorkflowUpdate,
        deactivateBeforeUpdate: parsedInput.deactivateBeforeUpdate
      },
      deps
    );

    const updatedNodes = structuredClone(existing.nodes);
    const selector = parsedInput.nodeNameOrId ?? parsedInput.nodeName;
    if (!selector) {
      throw new AppError("VALIDATION_ERROR", "nodeNameOrId is required", 400);
    }

    const node = findNodeByNameOrId(updatedNodes, selector);

    if (!node) {
      throw new AppError("NOT_FOUND", "Workflow node not found", 404, {
        errorType: "WORKFLOW_NODE_NOT_FOUND",
        workflowId: parsedInput.workflowId,
        nodeNameOrId: selector,
        hint: "Use get_workflow_node or get_workflow to inspect node IDs and names.",
        availableTools: NODE_PARAM_UPDATE_RELATED_TOOLS
      });
    }

    const nodeParameters = isRecord(node.parameters) ? node.parameters : {};
    setValueAtPath(nodeParameters, parsedInput.parameterPath, parsedInput.value);
    node.parameters = nodeParameters;

    const updatedWorkflow = await deps.n8nClient.updateWorkflow(parsedInput.workflowId, {
      name: existing.name,
      nodes: updatedNodes,
      connections: existing.connections,
      settings: existing.settings
    });

    const payload = updateWorkflowNodeParameterOutputSchema.parse({
      workflowId: parsedInput.workflowId,
      nodeId: node.id,
      nodeName: node.name,
      parameterPath: parsedInput.parameterPath,
      value: parsedInput.value,
      updated: true,
      active: updatedWorkflow.active,
      updatedAt: updatedWorkflow.updatedAt
    });

    return okToolResult(payload);
  } catch (error) {
    return errorToolResult(error);
  }
};

export const updateWorkflowNodeParametersHandler = async (
  input: unknown,
  deps: WorkflowToolsDeps
) => {
  try {
    const parsedInput = updateWorkflowNodeParametersInputSchema.parse(input);
    const existing = await deps.n8nClient.getWorkflow(parsedInput.workflowId);

    await enforceActiveWorkflowUpdatePolicy(
      parsedInput.workflowId,
      existing.active,
      {
        allowActiveWorkflowUpdate: parsedInput.allowActiveWorkflowUpdate,
        deactivateBeforeUpdate: parsedInput.deactivateBeforeUpdate
      },
      deps
    );

    const updatedNodes = structuredClone(existing.nodes);
    const selector = resolveNodeSelector(parsedInput);
    if (!selector) {
      throw new AppError("VALIDATION_ERROR", "nodeNameOrId is required", 400);
    }

    const node = findNodeByNameOrId(updatedNodes, selector);
    if (!node) {
      throw new AppError("NOT_FOUND", "Workflow node not found", 404, {
        errorType: "WORKFLOW_NODE_NOT_FOUND",
        workflowId: parsedInput.workflowId,
        nodeNameOrId: selector,
        hint: "Use get_workflow_node or get_workflow to inspect node IDs and names.",
        availableTools: NODE_PARAM_UPDATE_RELATED_TOOLS
      });
    }

    const baseParameters = isRecord(node.parameters) ? node.parameters : {};
    node.parameters = deepMergeJson(baseParameters, parsedInput.parametersPatch);

    const updatedWorkflow = await deps.n8nClient.updateWorkflow(parsedInput.workflowId, {
      name: existing.name,
      nodes: updatedNodes,
      connections: existing.connections,
      settings: existing.settings
    });

    const payload = updateWorkflowNodeParametersOutputSchema.parse({
      workflowId: parsedInput.workflowId,
      nodeId: node.id,
      nodeName: node.name,
      updated: true,
      changedTopLevelKeys: Object.keys(parsedInput.parametersPatch),
      active: updatedWorkflow.active,
      updatedAt: updatedWorkflow.updatedAt
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
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      updatedAt: workflow.updatedAt,
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
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      updatedAt: workflow.updatedAt,
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
      inputSchema: listWorkflowsInputSchema,
      annotations: READ_ONLY_ANNOTATIONS
    },
    async (input) => listWorkflowsHandler(input, deps)
  );

  server.registerTool(
    "get_workflow",
    {
      title: "Get Workflow",
      description:
        "Get one n8n workflow by ID with cleaned fields. Use this before update operations when node details are needed.",
      inputSchema: getWorkflowInputSchema,
      annotations: READ_ONLY_ANNOTATIONS
    },
    async (input) => getWorkflowHandler(input, deps)
  );

  server.registerTool(
    "get_workflow_node",
    {
      title: "Get Workflow Node",
      description:
        "Get one node from a workflow by node ID or node name. Useful for inspecting a single HTTP/Code/Wait node without loading full workflow context.",
      inputSchema: getWorkflowNodeInputSchema,
      annotations: READ_ONLY_ANNOTATIONS
    },
    async (input) => getWorkflowNodeHandler(input, deps)
  );

  server.registerTool(
    "validate_workflow",
    {
      title: "Validate Workflow",
      description:
        "Validate workflow definition before saving. Returns errors and warnings (duplicate names, disconnected graph hints, expression/HTTP body risks, schedule trigger caution).",
      inputSchema: validateWorkflowInputSchema,
      annotations: READ_ONLY_ANNOTATIONS
    },
    async (input) => validateWorkflowHandler(input)
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
      "clone_workflow",
      {
        title: "Clone Workflow",
        description:
          "Create a safe copy from an existing workflow. Preferred for experimentation: set active=false (default) to avoid changing production workflow directly.",
        inputSchema: cloneWorkflowInputSchema
      },
      async (input) => cloneWorkflowHandler(input, deps)
    );

    server.registerTool(
      "update_workflow",
      {
        title: "Update Workflow",
        description:
          "Safely update workflow with controlled merge. Modes: (1) full nodes replacement with 'nodes' (must include ALL nodes), or (2) targeted patch mode with 'nodeUpdates[].parameters'. IMPORTANT: 'nodeUpdates[].parameterUpdates' is NOT supported. Use update_workflow_node_parameter for single path edits. Active workflow requires allowActiveWorkflowUpdate=true or deactivateBeforeUpdate=true. Example nodeUpdates: {\"workflowId\":\"wf_1\",\"nodeUpdates\":[{\"nodeName\":\"Wait 150ms\",\"parameters\":{\"amount\":150,\"unit\":\"milliseconds\"}}]}",
        inputSchema: updateWorkflowInputSchema
      },
      async (input) => updateWorkflowHandler(input, deps)
    );

    server.registerTool(
      "update_workflow_node_parameter",
      {
        title: "Update Workflow Node Parameter",
        description:
          "Preferred tool for incremental scalar edits: update one parameter path on one node by ID/name. Example: {\"workflowId\":\"wf_1\",\"nodeNameOrId\":\"Pausa 2s\",\"parameterPath\":\"amount\",\"value\":60}. For nested object patches use update_workflow_node_parameters.",
        inputSchema: updateWorkflowNodeParameterInputSchema
      },
      async (input) => updateWorkflowNodeParameterHandler(input, deps)
    );

    server.registerTool(
      "update_workflow_node_parameters",
      {
        title: "Update Workflow Node Parameters",
        description:
          "Patch-merge multiple parameters on one node by ID/name. Use for nested objects like headerParameters/jsonBody. Example: {\"workflowId\":\"wf_1\",\"nodeName\":\"Create GHL Contact\",\"parametersPatch\":{\"headerParameters\":{\"parameters\":[{\"name\":\"Content-Type\",\"value\":\"application/json\"}]},\"jsonBody\":\"={{ {\\\"ok\\\":true} }}\"}}",
        inputSchema: updateWorkflowNodeParametersInputSchema
      },
      async (input) => updateWorkflowNodeParametersHandler(input, deps)
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
