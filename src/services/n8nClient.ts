import axios, { AxiosError, type AxiosInstance, type AxiosResponse } from "axios";

import type {
  ExecutionDetail,
  ExecutionListResponse,
  ListExecutionsParams,
  ListWorkflowsParams,
  WorkflowCreatePayload,
  WorkflowDetail,
  WorkflowListResponse,
  WorkflowUpdatePatch
} from "../types/n8n.js";
import { AppError, notFoundError, upstreamError } from "../utils/errors.js";
import type { Logger } from "../utils/logger.js";

interface N8nClientOptions {
  baseUrl: string;
  apiKey: string;
  logger: Logger;
  httpClient?: Pick<AxiosInstance, "get" | "post" | "patch" | "put" | "defaults">;
}

const asId = (value: unknown): string => String(value);

const normalizeWorkflow = (workflow: Record<string, unknown>): WorkflowDetail => {
  return {
    id: asId(workflow.id),
    name: String(workflow.name ?? ""),
    active: Boolean(workflow.active),
    updatedAt: typeof workflow.updatedAt === "string" ? workflow.updatedAt : undefined,
    nodes: Array.isArray(workflow.nodes) ? (workflow.nodes as WorkflowDetail["nodes"]) : [],
    connections:
      workflow.connections && typeof workflow.connections === "object"
        ? (workflow.connections as Record<string, unknown>)
        : {},
    settings:
      workflow.settings && typeof workflow.settings === "object"
        ? (workflow.settings as Record<string, unknown>)
        : undefined
  };
};

const normalizeExecution = (execution: Record<string, unknown>): ExecutionDetail => {
  return {
    id: asId(execution.id),
    workflowId: asId(execution.workflowId),
    workflowName: typeof execution.workflowName === "string" ? execution.workflowName : undefined,
    status: String(execution.status ?? "error") as ExecutionDetail["status"],
    mode: typeof execution.mode === "string" ? execution.mode : undefined,
    startedAt: typeof execution.startedAt === "string" ? execution.startedAt : undefined,
    stoppedAt:
      execution.stoppedAt === null || typeof execution.stoppedAt === "string"
        ? execution.stoppedAt
        : undefined,
    data: execution.data && typeof execution.data === "object" ? (execution.data as Record<string, unknown>) : undefined
  };
};

const readErrorMessage = (payload: unknown): string | undefined => {
  if (typeof payload === "string") {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const maybeMessage = (payload as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
  }

  return undefined;
};

export const buildN8nAxiosClient = (baseUrl: string, apiKey: string): AxiosInstance => {
  return axios.create({
    baseURL: baseUrl,
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey
    }
  });
};

export class N8nClient {
  private readonly httpClient: Pick<AxiosInstance, "get" | "post" | "patch" | "put" | "defaults">;

  private readonly logger: Logger;

  public constructor(options: N8nClientOptions) {
    this.httpClient = options.httpClient ?? buildN8nAxiosClient(options.baseUrl, options.apiKey);
    this.logger = options.logger;
  }

  public async listWorkflows(params: ListWorkflowsParams): Promise<WorkflowListResponse> {
    const data = await this.request<Record<string, unknown>>(
      () => this.httpClient.get("/api/v1/workflows", { params }),
      "list workflows"
    );

    const workflows = Array.isArray(data.data) ? data.data.map((item) => normalizeWorkflow(item as Record<string, unknown>)) : [];

    return {
      data: workflows,
      nextCursor: data.nextCursor ? String(data.nextCursor) : null
    };
  }

  public async getWorkflow(workflowId: string): Promise<WorkflowDetail> {
    const data = await this.request<Record<string, unknown>>(
      () => this.httpClient.get(`/api/v1/workflows/${encodeURIComponent(workflowId)}`),
      "get workflow"
    );

    return normalizeWorkflow(data);
  }

  public async createWorkflow(payload: WorkflowCreatePayload): Promise<WorkflowDetail> {
    const data = await this.request<Record<string, unknown>>(
      () => this.httpClient.post("/api/v1/workflows", payload),
      "create workflow"
    );

    return normalizeWorkflow(data);
  }

  public async updateWorkflow(workflowId: string, payload: WorkflowUpdatePatch): Promise<WorkflowDetail> {
    const endpoint = `/api/v1/workflows/${encodeURIComponent(workflowId)}`;
    try {
      const data = await this.request<Record<string, unknown>>(
        () => this.httpClient.patch(endpoint, payload),
        "update workflow"
      );
      return normalizeWorkflow(data);
    } catch (error) {
      if (error instanceof AppError && error.code === "UPSTREAM_ERROR" && error.statusCode === 405) {
        this.logger.warn("PATCH not allowed for workflow update, retrying with PUT", {
          workflowId
        });
        const fallbackData = await this.request<Record<string, unknown>>(
          () => this.httpClient.put(endpoint, payload),
          "update workflow (put fallback)"
        );
        return normalizeWorkflow(fallbackData);
      }
      throw error;
    }
  }

  public async activateWorkflow(workflowId: string): Promise<WorkflowDetail> {
    const data = await this.request<Record<string, unknown>>(
      () => this.httpClient.post(`/api/v1/workflows/${encodeURIComponent(workflowId)}/activate`, {}),
      "activate workflow"
    );

    return normalizeWorkflow(data);
  }

  public async deactivateWorkflow(workflowId: string): Promise<WorkflowDetail> {
    const data = await this.request<Record<string, unknown>>(
      () => this.httpClient.post(`/api/v1/workflows/${encodeURIComponent(workflowId)}/deactivate`, {}),
      "deactivate workflow"
    );

    return normalizeWorkflow(data);
  }

  public async listExecutions(params: ListExecutionsParams): Promise<ExecutionListResponse> {
    const data = await this.request<Record<string, unknown>>(
      () => this.httpClient.get("/api/v1/executions", { params }),
      "list executions"
    );

    const executions = Array.isArray(data.data)
      ? data.data.map((item) => normalizeExecution(item as Record<string, unknown>))
      : [];

    return {
      data: executions,
      nextCursor: data.nextCursor ? String(data.nextCursor) : null,
      count: typeof data.count === "number" ? data.count : undefined,
      estimated: typeof data.estimated === "boolean" ? data.estimated : undefined,
      concurrentExecutionsCount:
        typeof data.concurrentExecutionsCount === "number" ? data.concurrentExecutionsCount : undefined
    };
  }

  public async getExecution(executionId: string): Promise<ExecutionDetail> {
    const data = await this.request<Record<string, unknown>>(
      () => this.httpClient.get(`/api/v1/executions/${encodeURIComponent(executionId)}`),
      "get execution"
    );

    return normalizeExecution(data);
  }

  private async request<T>(
    fn: () => Promise<AxiosResponse<T>>,
    operation: string
  ): Promise<T> {
    try {
      const response = await fn();
      return response.data;
    } catch (error) {
      throw this.mapError(error, operation);
    }
  }

  private mapError(error: unknown, operation: string): AppError {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const messageFromPayload = readErrorMessage(error.response?.data);
      const message = messageFromPayload ?? error.message;

      this.logger.warn("n8n API request failed", {
        operation,
        status,
        message
      });

      if (status === 404) {
        return notFoundError("Resource", "unknown");
      }

      if (status === 401) {
        return new AppError("UNAUTHORIZED", "Unauthorized n8n API request", 401);
      }

      if (status === 403) {
        return new AppError("FORBIDDEN", "Forbidden n8n API request", 403);
      }

      if (status === 409) {
        return new AppError("CONFLICT", message, 409);
      }

      if (typeof status === "number") {
        return upstreamError(message, status, { operation });
      }

      return upstreamError("n8n API unavailable", 502, { operation });
    }

    if (error instanceof AppError) {
      return error;
    }

    this.logger.error("Unexpected error while calling n8n API", {
      operation,
      error: error instanceof Error ? error.message : "unknown"
    });

    return new AppError("INTERNAL_ERROR", "Unexpected error while calling n8n API", 500, {
      operation
    });
  }
}
