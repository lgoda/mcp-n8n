import { describe, expect, it } from "vitest";

import { mergeWorkflowUpdate } from "../src/utils/safeMerge.js";
import type { WorkflowDetail } from "../src/types/n8n.js";

const baseWorkflow: WorkflowDetail = {
  id: "wf_1",
  name: "Base Workflow",
  active: false,
  updatedAt: "2026-04-10T10:00:00.000Z",
  nodes: [
    {
      id: "node_1",
      name: "Start",
      type: "n8n-nodes-base.manualTrigger",
      position: [0, 0],
      parameters: {}
    }
  ],
  connections: {},
  settings: { executionOrder: "v1" }
};

describe("mergeWorkflowUpdate", () => {
  it("merges partial update safely", () => {
    const merged = mergeWorkflowUpdate(baseWorkflow, { name: "Updated Name" });

    expect(merged.name).toBe("Updated Name");
    expect(merged.nodes).toEqual(baseWorkflow.nodes);
    expect(merged.connections).toEqual(baseWorkflow.connections);
    expect(merged.settings).toEqual(baseWorkflow.settings);
  });

  it("uses provided nested fields when present", () => {
    const merged = mergeWorkflowUpdate(baseWorkflow, {
      settings: { executionOrder: "v2" },
      connections: { Start: { main: [[{ node: "Done", type: "main", index: 0 }]] } }
    });

    expect(merged.settings).toEqual({ executionOrder: "v2" });
    expect(merged.connections).toHaveProperty("Start");
  });
});
