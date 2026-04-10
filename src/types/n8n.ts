export interface WorkflowNode {
  id?: string;
  name: string;
  type: string;
  position: number[];
  parameters: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  updatedAt?: string;
}

export interface WorkflowDetail extends WorkflowSummary {
  nodes: WorkflowNode[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface WorkflowCreatePayload {
  name: string;
  nodes: WorkflowNode[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface WorkflowUpdatePatch {
  name?: string;
  nodes?: WorkflowNode[];
  connections?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface ListWorkflowsParams {
  cursor?: string;
  limit?: number;
  active?: boolean;
}

export interface WorkflowListResponse {
  data: WorkflowDetail[];
  nextCursor: string | null;
}

export type ExecutionStatus = "success" | "error" | "running" | "waiting" | "canceled" | "crashed";

export interface ExecutionSummary {
  id: string;
  workflowId: string;
  workflowName?: string;
  status: ExecutionStatus;
  mode?: string;
  startedAt?: string;
  stoppedAt?: string | null;
}

export interface ExecutionDetail extends ExecutionSummary {
  data?: Record<string, unknown>;
}

export interface ListExecutionsParams {
  workflowId?: string;
  limit?: number;
  status?: ExecutionStatus;
}

export interface ExecutionListResponse {
  data: ExecutionSummary[];
  nextCursor: string | null;
  count?: number;
  estimated?: boolean;
  concurrentExecutionsCount?: number;
}
