import { describe, expect, it } from "vitest";

import {
  createWorkflowInputSchema,
  listWorkflowsInputSchema,
  updateWorkflowInputSchema
} from "../src/schemas/workflowSchemas.js";
import { getExecutionInputSchema, listExecutionsInputSchema } from "../src/schemas/executionSchemas.js";

describe("schema validation", () => {
  it("accepts valid list_workflows input", () => {
    const parsed = listWorkflowsInputSchema.parse({ limit: 20, active: true });

    expect(parsed.limit).toBe(20);
    expect(parsed.active).toBe(true);
  });

  it("rejects invalid create_workflow name", () => {
    const result = createWorkflowInputSchema.safeParse({
      name: "",
      nodes: [],
      connections: {}
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one update field", () => {
    const result = updateWorkflowInputSchema.safeParse({ workflowId: "wf_1" });

    expect(result.success).toBe(false);
  });

  it("accepts valid get_execution input", () => {
    const parsed = getExecutionInputSchema.parse({ executionId: "exec_1" });

    expect(parsed.executionId).toBe("exec_1");
  });

  it("rejects unsupported execution status", () => {
    const result = listExecutionsInputSchema.safeParse({ status: "queued" });

    expect(result.success).toBe(false);
  });
});
