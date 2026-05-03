import { z } from "zod";

import { idSchema, paginationLimitSchema } from "./common.js";

export const workflowNodeSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1),
    type: z.string().min(1),
    // OpenAI/ChatGPT tool schema compatibility: avoid tuple JSON schema.
    // Keep n8n shape as array with exactly 2 numeric values [x, y].
    position: z.array(z.number()).length(2),
    parameters: z.record(z.unknown())
  })
  .passthrough();

export const workflowConnectionsSchema = z.record(z.unknown());
export const workflowSettingsSchema = z.record(z.unknown());
export const nodeSelectorSchema = z.string().min(1);
export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)])
);

export const workflowSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  updatedAt: z.string().optional()
});

export const workflowDetailSchema = workflowSummarySchema.extend({
  nodes: z.array(workflowNodeSchema),
  connections: workflowConnectionsSchema,
  settings: workflowSettingsSchema.optional()
});

export const listWorkflowsInputSchema = z.object({
  limit: paginationLimitSchema.optional(),
  cursor: z.string().min(1).optional(),
  active: z.boolean().optional()
}).strict();

export const listWorkflowsOutputSchema = z.object({
  data: z.array(workflowSummarySchema),
  nextCursor: z.string().nullable()
});

export const getWorkflowInputSchema = z.object({
  workflowId: idSchema
}).strict();

export const getWorkflowOutputSchema = workflowDetailSchema;

export const createWorkflowInputSchema = z.object({
  name: z.string().min(1).max(128),
  nodes: z.array(workflowNodeSchema),
  connections: workflowConnectionsSchema,
  settings: workflowSettingsSchema.optional()
}).strict();

export const createWorkflowOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  created: z.literal(true)
});

export const updateWorkflowInputSchema = z
  .object({
    workflowId: idSchema,
    name: z.string().min(1).max(128).optional(),
    nodes: z.array(workflowNodeSchema).optional(),
    nodeUpdates: z
      .array(
        z
          .object({
            nodeNameOrId: nodeSelectorSchema.optional(),
            nodeName: nodeSelectorSchema.optional(),
            nodeId: nodeSelectorSchema.optional(),
            parameters: z.record(jsonValueSchema)
          })
          .strict()
          .refine(
            (value) =>
              value.nodeNameOrId !== undefined || value.nodeName !== undefined || value.nodeId !== undefined,
            {
              message: "nodeNameOrId, nodeName or nodeId is required",
              path: ["nodeNameOrId"]
            }
          )
      )
      .min(1)
      .optional()
      .describe(
        "Patch mode for node parameters. Use nodeUpdates[].parameters object. Do not use parameterUpdates[]."
      ),
    connections: workflowConnectionsSchema.optional(),
    settings: workflowSettingsSchema.optional(),
    allowActiveWorkflowUpdate: z.boolean().optional(),
    deactivateBeforeUpdate: z.boolean().optional()
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.nodes !== undefined ||
      value.nodeUpdates !== undefined ||
      value.connections !== undefined ||
      value.settings !== undefined,
    {
      message: "At least one field to update must be provided",
      path: ["workflowId"]
    }
  );

export const updateWorkflowOutputSchema = workflowDetailSchema;

export const workflowParameterValueSchema = jsonValueSchema;

export const updateWorkflowNodeParameterInputSchema = z.object({
  workflowId: idSchema,
  nodeNameOrId: nodeSelectorSchema.optional(),
  nodeName: z.string().min(1).optional(),
  parameterPath: z.string().min(1).describe("Path syntax: amount or headerParameters.parameters[0].value"),
  value: workflowParameterValueSchema,
  allowActiveWorkflowUpdate: z.boolean().optional(),
  deactivateBeforeUpdate: z.boolean().optional()
}).strict().refine((value) => value.nodeNameOrId !== undefined || value.nodeName !== undefined, {
  message: "nodeNameOrId is required",
  path: ["nodeNameOrId"]
});

export const updateWorkflowNodeParameterOutputSchema = z.object({
  workflowId: z.string(),
  nodeId: z.string().optional(),
  nodeName: z.string(),
  parameterPath: z.string(),
  value: workflowParameterValueSchema,
  updated: z.literal(true),
  active: z.boolean(),
  updatedAt: z.string().optional()
});

export const updateWorkflowNodeParametersInputSchema = z.object({
  workflowId: idSchema,
  nodeNameOrId: nodeSelectorSchema.optional(),
  nodeName: z.string().min(1).optional(),
  nodeId: z.string().min(1).optional(),
  parametersPatch: z
    .record(jsonValueSchema)
    .describe("Deep patch object merged into node.parameters. Arrays are replaced by provided values."),
  allowActiveWorkflowUpdate: z.boolean().optional(),
  deactivateBeforeUpdate: z.boolean().optional()
}).strict().refine(
  (value) =>
    value.nodeNameOrId !== undefined || value.nodeName !== undefined || value.nodeId !== undefined,
  {
    message: "nodeNameOrId, nodeName or nodeId is required",
    path: ["nodeNameOrId"]
  }
);

export const updateWorkflowNodeParametersOutputSchema = z.object({
  workflowId: z.string(),
  nodeId: z.string().optional(),
  nodeName: z.string(),
  updated: z.literal(true),
  changedTopLevelKeys: z.array(z.string()),
  active: z.boolean(),
  updatedAt: z.string().optional()
});

export const getWorkflowNodeInputSchema = z.object({
  workflowId: idSchema,
  nodeNameOrId: nodeSelectorSchema
}).strict();

export const getWorkflowNodeOutputSchema = z.object({
  workflowId: z.string(),
  workflowName: z.string(),
  workflowActive: z.boolean(),
  node: workflowNodeSchema
});

export const cloneWorkflowInputSchema = z.object({
  sourceWorkflowId: idSchema,
  newName: z.string().min(1).max(128),
  active: z.boolean().optional()
}).strict();

export const cloneWorkflowOutputSchema = z.object({
  sourceWorkflowId: z.string(),
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  updatedAt: z.string().optional(),
  cloned: z.literal(true)
});

export const validateWorkflowInputSchema = z.object({
  nodes: z.array(workflowNodeSchema),
  connections: workflowConnectionsSchema,
  settings: workflowSettingsSchema.optional()
}).strict();

export const validateWorkflowOutputSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string())
});

export const activateWorkflowInputSchema = z.object({
  workflowId: idSchema
}).strict();

export const deactivateWorkflowInputSchema = z.object({
  workflowId: idSchema
}).strict();

export const activationOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  updatedAt: z.string().optional(),
  message: z.string()
});
