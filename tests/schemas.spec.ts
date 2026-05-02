import { describe, expect, it } from "vitest";

import {
  createWorkflowInputSchema,
  getWorkflowNodeInputSchema,
  listWorkflowsInputSchema,
  updateWorkflowNodeParameterInputSchema,
  updateWorkflowNodeParametersInputSchema,
  updateWorkflowInputSchema
} from "../src/schemas/workflowSchemas.js";
import {
  getExecutionInputSchema,
  getExecutionNodeDataInputSchema,
  listExecutionsInputSchema
} from "../src/schemas/executionSchemas.js";

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

  it("accepts update_workflow_node_parameter input", () => {
    const parsed = updateWorkflowNodeParameterInputSchema.parse({
      workflowId: "wf_1",
      nodeNameOrId: "Pausa 2s",
      parameterPath: "amount",
      value: 60
    });

    expect(parsed.value).toBe(60);
  });

  it("accepts get_workflow_node input", () => {
    const parsed = getWorkflowNodeInputSchema.parse({
      workflowId: "wf_1",
      nodeNameOrId: "node_1"
    });

    expect(parsed.nodeNameOrId).toBe("node_1");
  });

  it("accepts get_execution_node_data input", () => {
    const parsed = getExecutionNodeDataInputSchema.parse({
      executionId: "exec_1",
      nodeName: "HTTP Request"
    });

    expect(parsed.nodeName).toBe("HTTP Request");
  });

  it("accepts update_workflow input with nodeUpdates patch mode", () => {
    const parsed = updateWorkflowInputSchema.parse({
      workflowId: "wf_1",
      nodeUpdates: [
        {
          nodeName: "Create GHL Contact",
          parameters: {
            jsonBody: "={{ { hello: 'world' } }}"
          }
        }
      ]
    });

    expect(parsed.nodeUpdates?.[0]?.nodeName).toBe("Create GHL Contact");
  });

  it("accepts update_workflow_node_parameters input", () => {
    const parsed = updateWorkflowNodeParametersInputSchema.parse({
      workflowId: "wf_1",
      nodeName: "Create GHL Contact",
      parametersPatch: {
        headerParameters: {
          parameters: [{ name: "Content-Type", value: "application/json" }]
        }
      }
    });

    expect(parsed.parametersPatch).toHaveProperty("headerParameters");
  });
});
