import { describe, expect, it, vi } from "vitest";

import {
  cloneWorkflowHandler,
  createWorkflowHandler,
  deactivateWorkflowHandler,
  getWorkflowHandler,
  getWorkflowNodeHandler,
  listWorkflowsHandler,
  updateWorkflowNodeParameterHandler,
  updateWorkflowNodeParametersHandler,
  updateWorkflowHandler,
  validateWorkflowHandler
} from "../src/tools/workflowTools.js";
import {
  getExecutionHandler,
  getExecutionNodeDataHandler,
  listExecutionsHandler
} from "../src/tools/executionTools.js";

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

  it("returns one workflow node by id or name", async () => {
    const n8nClient = {
      getWorkflow: vi.fn().mockResolvedValue({
        id: "wf_1",
        name: "Workflow 1",
        active: true,
        nodes: [
          {
            id: "node_wait",
            name: "Pausa 2s",
            type: "n8n-nodes-base.wait",
            position: [100, 100],
            parameters: { amount: 2 }
          }
        ],
        connections: {}
      })
    };

    const result = await getWorkflowNodeHandler(
      {
        workflowId: "wf_1",
        nodeNameOrId: "node_wait"
      },
      { n8nClient } as never
    );

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      workflowId: "wf_1",
      node: {
        id: "node_wait",
        name: "Pausa 2s"
      }
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

  it("clones a workflow safely as inactive by default", async () => {
    const n8nClient = {
      getWorkflow: vi.fn().mockResolvedValue({
        id: "wf_source",
        name: "Source",
        active: true,
        nodes: [],
        connections: {},
        settings: {}
      }),
      createWorkflow: vi.fn().mockResolvedValue({
        id: "wf_clone",
        name: "Clone",
        active: false,
        updatedAt: "2026-05-01T10:00:00.000Z",
        nodes: [],
        connections: {}
      })
    };

    const result = await cloneWorkflowHandler(
      {
        sourceWorkflowId: "wf_source",
        newName: "Clone"
      },
      { n8nClient } as never
    );

    expect(result.structuredContent).toMatchObject({
      sourceWorkflowId: "wf_source",
      id: "wf_clone",
      active: false,
      cloned: true
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

  it("blocks active workflow update without explicit flag", async () => {
    const getWorkflow = vi.fn().mockResolvedValue({
      id: "wf_1",
      name: "Active WF",
      active: true,
      nodes: [],
      connections: {},
      settings: {}
    });

    const result = await updateWorkflowHandler(
      {
        workflowId: "wf_1",
        name: "Updated Name"
      },
      {
        n8nClient: {
          getWorkflow,
          updateWorkflow: vi.fn(),
          deactivateWorkflow: vi.fn()
        }
      } as never
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: {
        errorType: "ACTIVE_WORKFLOW_UPDATE_BLOCKED"
      }
    });
  });

  it("rejects partial nodes replacement in update_workflow", async () => {
    const getWorkflow = vi.fn().mockResolvedValue({
      id: "wf_1",
      name: "Base",
      active: false,
      nodes: [
        {
          id: "node_a",
          name: "Start",
          type: "n8n-nodes-base.manualTrigger",
          position: [0, 0],
          parameters: {}
        },
        {
          id: "node_b",
          name: "Pausa 2s",
          type: "n8n-nodes-base.wait",
          position: [100, 100],
          parameters: { amount: 2 }
        }
      ],
      connections: {},
      settings: { executionOrder: "v1" }
    });

    const updateWorkflow = vi.fn();

    const result = await updateWorkflowHandler(
      {
        workflowId: "wf_1",
        nodes: [
          {
            id: "node_b",
            name: "Pausa 2s",
            type: "n8n-nodes-base.wait",
            position: [100, 100],
            parameters: { amount: 60 }
          }
        ]
      },
      {
        n8nClient: {
          getWorkflow,
          updateWorkflow
        }
      } as never
    );

    expect(updateWorkflow).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: {
        errorType: "PARTIAL_NODE_UPDATE_NOT_ALLOWED",
        statusCode: 400
      }
    });
  });

  it("updates one workflow node parameter without full node payload", async () => {
    const getWorkflow = vi.fn().mockResolvedValue({
      id: "wf_1",
      name: "Campaign Flow",
      active: false,
      nodes: [
        {
          id: "node_wait",
          name: "Pausa 2s",
          type: "n8n-nodes-base.wait",
          position: [0, 0],
          parameters: { amount: 2, unit: "seconds" }
        }
      ],
      connections: {},
      settings: {}
    });

    const updateWorkflow = vi.fn().mockResolvedValue({
      id: "wf_1",
      name: "Campaign Flow",
      active: false,
      updatedAt: "2026-05-02T12:00:00.000Z",
      nodes: [],
      connections: {},
      settings: {}
    });

    const result = await updateWorkflowNodeParameterHandler(
      {
        workflowId: "wf_1",
        nodeNameOrId: "node_wait",
        parameterPath: "amount",
        value: 60
      },
      {
        n8nClient: {
          getWorkflow,
          updateWorkflow
        }
      } as never
    );

    expect(updateWorkflow).toHaveBeenCalledWith(
      "wf_1",
      expect.objectContaining({
        nodes: [
          expect.objectContaining({
            name: "Pausa 2s",
            parameters: expect.objectContaining({
              amount: 60,
              unit: "seconds"
            })
          })
        ]
      })
    );
    expect(result.structuredContent).toEqual({
      workflowId: "wf_1",
      nodeId: "node_wait",
      nodeName: "Pausa 2s",
      parameterPath: "amount",
      value: 60,
      updated: true,
      active: false,
      updatedAt: "2026-05-02T12:00:00.000Z"
    });
  });

  it("updates one workflow node with parameters patch", async () => {
    const getWorkflow = vi.fn().mockResolvedValue({
      id: "wf_1",
      name: "Campaign Flow",
      active: false,
      nodes: [
        {
          id: "node_ghl",
          name: "Create GHL Contact",
          type: "n8n-nodes-base.httpRequest",
          position: [0, 0],
          parameters: {
            headerParameters: {
              parameters: [
                { name: "Version", value: "2021-04-15" }
              ]
            },
            jsonBody: "={{ { old: true } }}"
          }
        }
      ],
      connections: {},
      settings: {}
    });

    const updateWorkflow = vi.fn().mockResolvedValue({
      id: "wf_1",
      name: "Campaign Flow",
      active: false,
      updatedAt: "2026-05-02T12:01:00.000Z",
      nodes: [],
      connections: {},
      settings: {}
    });

    const result = await updateWorkflowNodeParametersHandler(
      {
        workflowId: "wf_1",
        nodeName: "Create GHL Contact",
        parametersPatch: {
          headerParameters: {
            parameters: [
              { name: "Authorization", value: "={{ 'Bearer ' + $('Loop Contacts').first().json.ghl.api_token }}" },
              { name: "Version", value: "2021-04-15" },
              { name: "Content-Type", value: "application/json" }
            ]
          },
          jsonBody: "={{ { updated: true } }}"
        }
      },
      {
        n8nClient: {
          getWorkflow,
          updateWorkflow
        }
      } as never
    );

    expect(updateWorkflow).toHaveBeenCalledWith(
      "wf_1",
      expect.objectContaining({
        nodes: [
          expect.objectContaining({
            name: "Create GHL Contact",
            parameters: expect.objectContaining({
              jsonBody: "={{ { updated: true } }}",
              headerParameters: {
                parameters: [
                  { name: "Authorization", value: "={{ 'Bearer ' + $('Loop Contacts').first().json.ghl.api_token }}" },
                  { name: "Version", value: "2021-04-15" },
                  { name: "Content-Type", value: "application/json" }
                ]
              }
            })
          })
        ]
      })
    );

    expect(result.structuredContent).toEqual({
      workflowId: "wf_1",
      nodeId: "node_ghl",
      nodeName: "Create GHL Contact",
      updated: true,
      changedTopLevelKeys: ["headerParameters", "jsonBody"],
      active: false,
      updatedAt: "2026-05-02T12:01:00.000Z"
    });
  });

  it("supports update_workflow nodeUpdates patch mode", async () => {
    const getWorkflow = vi.fn().mockResolvedValue({
      id: "wf_1",
      name: "Campaign Flow",
      active: false,
      nodes: [
        {
          id: "node_ghl",
          name: "Create GHL Contact",
          type: "n8n-nodes-base.httpRequest",
          position: [0, 0],
          parameters: {
            headerParameters: {
              parameters: [{ name: "Version", value: "2021-04-15" }]
            },
            jsonBody: "={{ { old: true } }}"
          }
        },
        {
          id: "node_wait",
          name: "Pausa 2s",
          type: "n8n-nodes-base.wait",
          position: [100, 0],
          parameters: { amount: 2 }
        }
      ],
      connections: {},
      settings: {}
    });

    const updateWorkflow = vi.fn().mockResolvedValue({
      id: "wf_1",
      name: "Campaign Flow",
      active: false,
      nodes: [
        {
          id: "node_ghl",
          name: "Create GHL Contact",
          type: "n8n-nodes-base.httpRequest",
          position: [0, 0],
          parameters: {
            headerParameters: {
              parameters: [
                { name: "Authorization", value: "Bearer token" },
                { name: "Version", value: "2021-04-15" }
              ]
            },
            jsonBody: "={{ { updated: true } }}"
          }
        },
        {
          id: "node_wait",
          name: "Pausa 2s",
          type: "n8n-nodes-base.wait",
          position: [100, 0],
          parameters: { amount: 2 }
        }
      ],
      connections: {},
      settings: {}
    });

    const result = await updateWorkflowHandler(
      {
        workflowId: "wf_1",
        nodeUpdates: [
          {
            nodeName: "Create GHL Contact",
            parameters: {
              headerParameters: {
                parameters: [
                  { name: "Authorization", value: "Bearer token" },
                  { name: "Version", value: "2021-04-15" }
                ]
              },
              jsonBody: "={{ { updated: true } }}"
            }
          }
        ]
      },
      {
        n8nClient: {
          getWorkflow,
          updateWorkflow
        }
      } as never
    );

    expect(updateWorkflow).toHaveBeenCalledWith(
      "wf_1",
      expect.objectContaining({
        nodes: [
          expect.objectContaining({
            name: "Create GHL Contact",
            parameters: expect.objectContaining({
              jsonBody: "={{ { updated: true } }}"
            })
          }),
          expect.objectContaining({
            name: "Pausa 2s",
            parameters: { amount: 2 }
          })
        ]
      })
    );
    expect(result.isError).toBeUndefined();
  });

  it("returns NOT_FOUND when node is missing in update_workflow_node_parameter", async () => {
    const result = await updateWorkflowNodeParameterHandler(
      {
        workflowId: "wf_1",
        nodeNameOrId: "Missing Node",
        parameterPath: "amount",
        value: 60
      },
      {
        n8nClient: {
          getWorkflow: vi.fn().mockResolvedValue({
            id: "wf_1",
            name: "Campaign Flow",
            active: false,
            nodes: [],
            connections: {},
            settings: {}
          }),
          updateWorkflow: vi.fn()
        }
      } as never
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: {
        errorType: "WORKFLOW_NODE_NOT_FOUND",
        statusCode: 404
      }
    });
  });

  it("returns activation/deactivation confirmation payload", async () => {
    const n8nClient = {
      deactivateWorkflow: vi.fn().mockResolvedValue({
        id: "wf_1",
        name: "WF 1",
        active: false,
        updatedAt: "2026-05-02T12:20:00.000Z",
        nodes: [],
        connections: {}
      })
    };

    const result = await deactivateWorkflowHandler({ workflowId: "wf_1" }, { n8nClient } as never);

    expect(result.structuredContent).toEqual({
      id: "wf_1",
      name: "WF 1",
      active: false,
      updatedAt: "2026-05-02T12:20:00.000Z",
      message: "Workflow deactivated"
    });
  });

  it("returns validate_workflow warnings", async () => {
    const result = await validateWorkflowHandler({
      nodes: [
        {
          name: "Schedule Trigger",
          type: "n8n-nodes-base.scheduleTrigger",
          position: [0, 0],
          parameters: {}
        },
        {
          name: "HTTP Request",
          type: "n8n-nodes-base.httpRequest",
          position: [100, 100],
          parameters: {
            authentication: "headerAuth",
            jsonBody: "{ invalid-json"
          }
        }
      ],
      connections: {}
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      valid: true
    });
    expect((result.structuredContent as { warnings: string[] }).warnings.length).toBeGreaterThan(0);
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
        data: {
          resultData: {
            runData: {
              "HTTP Request": [
                {
                  source: [{ previousNode: "Start" }],
                  data: {
                    main: [[{ json: { ok: false } }]]
                  },
                  error: {
                    message: "422 email must be an email"
                  }
                }
              ]
            }
          }
        }
      })
    };

    const listResult = await listExecutionsHandler({}, { n8nClient } as never);
    const getResult = await getExecutionHandler({ executionId: "exec_1" }, { n8nClient } as never);
    const nodeDataResult = await getExecutionNodeDataHandler(
      { executionId: "exec_1", nodeName: "HTTP Request" },
      { n8nClient } as never
    );

    expect(listResult.isError).toBeUndefined();
    expect(getResult.isError).toBeUndefined();
    expect(nodeDataResult.structuredContent).toMatchObject({
      executionId: "exec_1",
      nodeName: "HTTP Request",
      hasAnyError: true
    });
  });
});
