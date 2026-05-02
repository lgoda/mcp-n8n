# ChatGPT Connector Policy (n8n MCP)

## Goal
- Minimize destructive updates.
- Prefer small, deterministic tool calls.
- Reduce latency and retries in workflow edits.

## Mandatory Tool Selection Rules
- For single parameter changes, use `update_workflow_node_parameter`.
- For nested/object parameter changes, use `update_workflow_node_parameters`.
- For multiple node parameter edits in one request, use `update_workflow` with `nodeUpdates`.
- Use full `update_workflow` with `nodes` only when replacing the full node graph intentionally.

## Safety Rules
- Before write operations, read first with `get_workflow` or `get_workflow_node`.
- Never send partial `nodes` arrays to `update_workflow`.
- If workflow is active:
  - set `allowActiveWorkflowUpdate: true`, or
  - set `deactivateBeforeUpdate: true`.
- After each mutation, verify result using `get_workflow_node` or `get_workflow`.

## Debug Rules
- For execution debugging:
  1. `list_executions`
  2. `get_execution`
  3. `get_execution_node_data`
- Do not infer success from global execution status only.
- Always inspect node-level errors when present.

## Response Style Rules
- Return concise confirmations with changed node/field names.
- If blocked, return normalized error and propose the exact next tool to use.
- Avoid ambiguous statements like "updated" without verifiable fields.

## Recommended Operational Flow
1. Discover: `get_workflow_node` (or `get_workflow` when needed).
2. Change:
   - simple scalar field -> `update_workflow_node_parameter`
   - nested object fields -> `update_workflow_node_parameters`
   - multiple nodes -> `update_workflow` + `nodeUpdates`
3. Verify: `get_workflow_node`.
4. Optional run/debug: `list_executions` -> `get_execution_node_data`.

## Copy/Paste Prompt for ChatGPT Connector Instructions
Use this MCP with strict tool discipline:
- Never do full workflow replacement for small edits.
- For one scalar field change use `update_workflow_node_parameter`.
- For nested object edits (headers/body/options) use `update_workflow_node_parameters`.
- For batched edits across nodes use `update_workflow` with `nodeUpdates`.
- Always read before write, and verify after write.
- If workflow is active, require explicit flag (`allowActiveWorkflowUpdate` or `deactivateBeforeUpdate`).
- For debugging, inspect node-level execution data with `get_execution_node_data`.
- If a tool fails, propose the exact safe fallback tool in the error hint.
