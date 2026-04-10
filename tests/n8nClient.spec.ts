import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";

import { buildN8nAxiosClient, N8nClient } from "../src/services/n8nClient.js";
import type { Logger } from "../src/utils/logger.js";
import { AppError } from "../src/utils/errors.js";

const logger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

const createAxiosError = (status: number, payload: unknown): AxiosError => {
  const response: AxiosResponse = {
    data: payload,
    status,
    statusText: "ERR",
    headers: {},
    config: { headers: new AxiosHeaders() } as InternalAxiosRequestConfig
  };

  return new AxiosError("request failed", undefined, response.config, undefined, response);
};

describe("N8nClient", () => {
  it("builds axios client with API key header", () => {
    const http = buildN8nAxiosClient("https://n8n.example.com", "my-key");

    expect(http.defaults.baseURL).toBe("https://n8n.example.com");
    expect(http.defaults.headers["X-N8N-API-KEY"]).toBe("my-key");
  });

  it("maps listWorkflows query params and response", async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        data: [
          {
            id: "wf_1",
            name: "WF 1",
            active: true,
            updatedAt: "2026-04-10T00:00:00.000Z",
            nodes: [],
            connections: {}
          }
        ],
        nextCursor: "next"
      }
    });

    const client = new N8nClient({
      baseUrl: "https://n8n.example.com",
      apiKey: "key",
      logger,
      httpClient: {
        get,
        post: vi.fn(),
        patch: vi.fn(),
        put: vi.fn(),
        defaults: {}
      }
    });

    const result = await client.listWorkflows({ limit: 10, active: true });

    expect(get).toHaveBeenCalledWith("/api/v1/workflows", {
      params: { limit: 10, active: true }
    });
    expect(result.data[0].id).toBe("wf_1");
    expect(result.nextCursor).toBe("next");
  });

  it("calls activate/deactivate endpoints with POST", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        id: "wf_1",
        name: "WF",
        active: true,
        nodes: [],
        connections: {}
      }
    });

    const client = new N8nClient({
      baseUrl: "https://n8n.example.com",
      apiKey: "key",
      logger,
      httpClient: {
        get: vi.fn(),
        post,
        patch: vi.fn(),
        put: vi.fn(),
        defaults: {}
      }
    });

    await client.activateWorkflow("wf_1");
    await client.deactivateWorkflow("wf_1");

    expect(post).toHaveBeenNthCalledWith(1, "/api/v1/workflows/wf_1/activate", {});
    expect(post).toHaveBeenNthCalledWith(2, "/api/v1/workflows/wf_1/deactivate", {});
  });

  it("maps 404 errors to typed NOT_FOUND", async () => {
    const get = vi.fn().mockRejectedValue(createAxiosError(404, { message: "missing" }));
    const client = new N8nClient({
      baseUrl: "https://n8n.example.com",
      apiKey: "key",
      logger,
      httpClient: {
        get,
        post: vi.fn(),
        patch: vi.fn(),
        put: vi.fn(),
        defaults: {}
      }
    });

    await expect(client.getWorkflow("wf_missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404
    });
  });

  it("maps network errors to UPSTREAM_ERROR 502", async () => {
    const get = vi.fn().mockRejectedValue(new AxiosError("network down"));
    const client = new N8nClient({
      baseUrl: "https://n8n.example.com",
      apiKey: "key",
      logger,
      httpClient: {
        get,
        post: vi.fn(),
        patch: vi.fn(),
        put: vi.fn(),
        defaults: {}
      }
    });

    try {
      await client.getExecution("exec_1");
      throw new Error("Expected call to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("UPSTREAM_ERROR");
      expect(appError.statusCode).toBe(502);
    }
  });

  it("falls back to PUT when PATCH update returns 405", async () => {
    const patch = vi.fn().mockRejectedValue(createAxiosError(405, { message: "PATCH method not allowed" }));
    const put = vi.fn().mockResolvedValue({
      data: {
        id: "wf_1",
        name: "WF updated",
        active: false,
        nodes: [],
        connections: {}
      }
    });

    const client = new N8nClient({
      baseUrl: "https://n8n.example.com",
      apiKey: "key",
      logger,
      httpClient: {
        get: vi.fn(),
        post: vi.fn(),
        patch,
        put,
        defaults: {}
      }
    });

    const result = await client.updateWorkflow("wf_1", { name: "WF updated" });

    expect(patch).toHaveBeenCalledWith("/api/v1/workflows/wf_1", { name: "WF updated" });
    expect(put).toHaveBeenCalledWith("/api/v1/workflows/wf_1", { name: "WF updated" });
    expect(result.name).toBe("WF updated");
  });
});
