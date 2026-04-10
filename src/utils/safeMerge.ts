import type { WorkflowDetail, WorkflowUpdatePatch } from "../types/n8n.js";

export const mergeWorkflowUpdate = (
  current: WorkflowDetail,
  patch: WorkflowUpdatePatch
): WorkflowUpdatePatch => {
  const merged: WorkflowUpdatePatch = {
    name: patch.name ?? current.name,
    nodes: patch.nodes ?? current.nodes,
    connections: patch.connections ?? current.connections,
    settings: patch.settings ?? current.settings
  };

  return merged;
};
