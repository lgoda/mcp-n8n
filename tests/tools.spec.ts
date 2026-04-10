import { describe, expect, it, vi } from "vitest";

import {
  createWorkflowHandler,
  getWorkflowHandler,
  listWorkflowsHandler,
  updateWorkflowHandler
} from "../src/tools/workflowTools.js";
import { getExecutionHandler, listExecutionsHandler } from "../src/tools/executionTools.js";

describe("tool handlers", () => {
  it("returns simplified workflow list output", async () => {
    const n8nClient = {
      listWorkflows: vi.fn().mockResolvedValue({
        data: [
          {
            id: "wf_1",
            name: "Workflow 1",
            active: true,
            updatedAt: "2026-04-10T10:00:00.000Z",
            nodes: [],
            connections: {}
          }
        ],
        nextCursor: null
      })
    };

    const result = await listWorkflowsHandler({}, { n8nClient } as never);

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      data: [
        {
          id: "wf_1",
          name: "Workflow 1",
          active: true,
          updatedAt: "2026-04-10T10:00:00.000Z"
        }
      ],
      nextCursor: null
    });
  });

  it("creates workflow and returns compact output", async () => {
    const n8nClient = {
      createWorkflow: vi.fn().mockResolvedValue({
        id: "wf_2",
        name: "Created",
        active: false,
        nodes: [],
        connections: {}
      })
    };

    const result = await createWorkflowHandler(
      {
        name: "Created",
        nodes: [],
        connections: {}
      },
      { n8nClient } as never
    );

    expect(result.structuredContent).toEqual({
      id: "wf_2",
      name: "Created",
      active: false,
      created: true
    });
  });

  it("performs safe merge on update workflow", async () => {
    const getWorkflow = vi.fn().mockResolvedValue({
      id: "wf_1",
      name: "Base",
      active: false,
      nodes: [
        {
          name: "Start",
          type: "n8n-nodes-base.manualTrigger",
          position: [0, 0],
          parameters: {}
        }
      ],
      connections: {},
      settings: { executionOrder: "v1" }
    });

    const updateWorkflow = vi.fn().mockResolvedValue({
      id: "wf_1",
      name: "Updated",
      active: false,
      nodes: [
        {
          name: "Start",
          type: "n8n-nodes-base.manualTrigger",
          position: [0, 0],
          parameters: {}
        }
      ],
      connections: {},
      settings: { executionOrder: "v1" }
    });

    const result = await updateWorkflowHandler(
      {
        workflowId: "wf_1",
        name: "Updated"
      },
      {
        n8nClient: {
          getWorkflow,
          updateWorkflow
        }
      } as never
    );

    expect(getWorkflow).toHaveBeenCalledWith("wf_1");
    expect(updateWorkflow).toHaveBeenCalledWith("wf_1", {
      name: "Updated",
      nodes: [
        {
          name: "Start",
          type: "n8n-nodes-base.manualTrigger",
          position: [0, 0],
          parameters: {}
        }
      ],
      connections: {},
      settings: { executionOrder: "v1" }
    });
    expect(result.isError).toBeUndefined();
  });

  it("returns validation error for invalid get_workflow input", async () => {
    const result = await getWorkflowHandler({}, { n8nClient: {} } as never);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        statusCode: 400
      }
    });
  });

  it("returns execution list and details", async () => {
    const n8nClient = {
      listExecutions: vi.fn().mockResolvedValue({
        data: [
          {
            id: "exec_1",
            workflowId: "wf_1",
            workflowName: "WF",
            status: "success",
            mode: "manual",
            startedAt: "2026-04-10T10:00:00.000Z",
            stoppedAt: "2026-04-10T10:00:01.000Z"
          }
        ],
        nextCursor: null
      }),
      getExecution: vi.fn().mockResolvedValue({
        id: "exec_1",
        workflowId: "wf_1",
        status: "success",
        mode: "manual",
        data: { resultData: {} }
      })
    };

    const listResult = await listExecutionsHandler({}, { n8nClient } as never);
    const getResult = await getExecutionHandler({ executionId: "exec_1" }, { n8nClient } as never);

    expect(listResult.isError).toBeUndefined();
    expect(getResult.isError).toBeUndefined();
  });
});
