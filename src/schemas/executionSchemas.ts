import { z } from "zod";

import { idSchema, paginationLimitSchema } from "./common.js";

export const executionStatusSchema = z.enum([
  "success",
  "error",
  "running",
  "waiting",
  "canceled",
  "crashed"
]);

export const executionSummarySchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workflowName: z.string().optional(),
  status: executionStatusSchema,
  mode: z.string().optional(),
  startedAt: z.string().optional(),
  stoppedAt: z.string().nullable().optional()
});

export const executionDetailSchema = executionSummarySchema.extend({
  data: z.record(z.unknown()).optional()
});

export const listExecutionsInputSchema = z.object({
  workflowId: idSchema.optional(),
  limit: paginationLimitSchema.optional(),
  status: executionStatusSchema.optional()
});

export const listExecutionsOutputSchema = z.object({
  data: z.array(executionSummarySchema),
  nextCursor: z.string().nullable()
});

export const getExecutionInputSchema = z.object({
  executionId: idSchema
});

export const getExecutionOutputSchema = executionDetailSchema;

export const getExecutionNodeDataInputSchema = z.object({
  executionId: idSchema,
  nodeName: z.string().min(1)
});

export const executionNodeRunSchema = z.object({
  runIndex: z.number().int().nonnegative(),
  hasError: z.boolean(),
  errorMessage: z.string().optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional()
});

export const getExecutionNodeDataOutputSchema = z.object({
  executionId: z.string(),
  nodeName: z.string(),
  runs: z.array(executionNodeRunSchema),
  hasAnyError: z.boolean()
});
