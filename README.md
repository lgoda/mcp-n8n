# n8n MCP Remote Server (Node.js + TypeScript)

Server MCP remoto production-oriented per leggere e modificare workflow n8n via API REST ufficiali, pensato per integrazione con ChatGPT/OpenAI MCP.

## Obiettivo
- Esporre tool MCP piccoli, specifici e sicuri.
- Validare input/output con `zod`.
- Usare API key n8n da environment (`X-N8N-API-KEY`).
- Restituire output JSON puliti e sintetici per il modello.

## Riferimenti API ufficiali n8n
- Documentazione API n8n: https://docs.n8n.io/api/
- API Authentication (`X-N8N-API-KEY`): https://n8n-io-n8n.mintlify.app/api/authentication
- Workflows API: https://n8n-io-n8n.mintlify.app/api/workflows
- Executions API: https://n8n-io-n8n.mintlify.app/api/executions

## Endpoint n8n usati
- `GET /api/v1/workflows`
- `GET /api/v1/workflows/:id`
- `POST /api/v1/workflows`
- `PATCH /api/v1/workflows/:id` (con fallback automatico a `PUT` su `405`)
- `POST /api/v1/workflows/:id/activate`
- `POST /api/v1/workflows/:id/deactivate`
- `GET /api/v1/executions`
- `GET /api/v1/executions/:id`

## Tool MCP esposti
- `list_workflows`
- `get_workflow`
- `get_workflow_node`
- `create_workflow`
- `clone_workflow`
- `validate_workflow`
- `update_workflow`
- `update_workflow_node_parameter`
- `update_workflow_node_parameters`
- `activate_workflow`
- `deactivate_workflow`
- `list_executions`
- `get_execution`
- `get_execution_node_data`

## Guida rapida per ChatGPT/LLM
- Per cambiare un solo parametro di un nodo usa sempre `update_workflow_node_parameter`.
- Per cambiare un blocco di parametri annidati (es. `headerParameters`, `jsonBody`) usa `update_workflow_node_parameters`.
- Usa `update_workflow` solo quando vuoi sostituire esplicitamente sezioni intere del workflow.
- Flusso consigliato per modifiche sicure:
  1. `get_workflow` o `get_workflow_node`
  2. `update_workflow_node_parameter`
  3. `get_workflow_node` per verifica finale
- Per debug esecuzioni:
  1. `list_executions`
  2. `get_execution`
  3. `get_execution_node_data` (errore/input/output del nodo)

## Regole importanti di update
- `update_workflow`:
  - se passi `nodes`, devi passare l'array completo dei nodi (no replace parziale);
  - in alternativa puoi usare `nodeUpdates` per patchare in modo mirato i `parameters` dei nodi senza reinviare l'intero array;
  - per modifiche incrementali usa `update_workflow_node_parameter`;
  - se il workflow e' attivo, devi impostare `allowActiveWorkflowUpdate: true` oppure `deactivateBeforeUpdate: true`.
- `update_workflow_node_parameter`:
  - usa `nodeNameOrId` + `parameterPath` + `value`;
  - e' il tool consigliato per modifiche puntuali (es. `amount` da `2` a `60`).
- `update_workflow_node_parameters`:
  - usa `nodeNameOrId`/`nodeName`/`nodeId` + `parametersPatch`;
  - applica merge profondo sui parametri del nodo (array sostituiti come da patch).

## Sicurezza
- Validazione input/output con `zod`.
- Nessun secret hardcoded.
- Errori sanitizzati (no leak API key/token).
- Nessun tool catch-all/raw pass-through.
- Separazione read/write e flag `enableWriteTools` nel bootstrap.
- Errori MCP normalizzati con campi utili all'agente:
  - `errorType`
  - `hint`
  - `availableTools`

## Struttura progetto
```text
.
├─ src/
│  ├─ index.ts
│  ├─ server.ts
│  ├─ config.ts
│  ├─ schemas/
│  │  ├─ common.ts
│  │  ├─ workflowSchemas.ts
│  │  └─ executionSchemas.ts
│  ├─ services/
│  │  └─ n8nClient.ts
│  ├─ tools/
│  │  ├─ index.ts
│  │  ├─ workflowTools.ts
│  │  └─ executionTools.ts
│  ├─ types/
│  │  ├─ n8n.ts
│  │  └─ mcp.ts
│  └─ utils/
│     ├─ errors.ts
│     ├─ logger.ts
│     ├─ safeMerge.ts
│     └─ toolResults.ts
├─ tests/
│  ├─ schemas.spec.ts
│  ├─ safeMerge.spec.ts
│  ├─ errors.spec.ts
│  ├─ n8nClient.spec.ts
│  ├─ tools.spec.ts
│  └─ server.spec.ts
├─ PROJECT_PLAN.md
├─ STEP_BY_STEP_PLAN.md
├─ Dockerfile
├─ docker-compose.yml
├─ .env.example
├─ package.json
└─ tsconfig.json
```

## Variabili d'ambiente
Copia `.env.example` in `.env`:

```env
N8N_API_URL=https://your-n8n-instance.com
N8N_API_KEY=your_api_key_here
PORT=3000
MCP_SERVER_NAME=n8n-mcp-server
MCP_SERVER_VERSION=0.1.0
LOG_LEVEL=info
```

## Avvio locale
```bash
npm install
npm run build
npm run start
```

Dev mode:
```bash
npm run dev
```

Healthcheck:
```bash
curl http://localhost:3000/health
```

## Test e quality gate
```bash
npm run lint
npm run build
npm run test
```

## Esempi chiamata MCP (JSON-RPC)
Nota: per `POST /mcp` il client deve inviare `Accept: application/json, text/event-stream`.

Initialize:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-05",
      "capabilities": {},
      "clientInfo": { "name": "example-client", "version": "1.0.0" }
    }
  }'
```

List tools:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

Tool call (`update_workflow_node_parameter`):
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "update_workflow_node_parameter",
      "arguments": {
        "workflowId": "wf_123",
        "nodeNameOrId": "Pausa 2s",
        "parameterPath": "amount",
        "value": 60
      }
    }
  }'
```

Tool call (`update_workflow_node_parameters`):
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "update_workflow_node_parameters",
      "arguments": {
        "workflowId": "wf_123",
        "nodeName": "Create GHL Contact",
        "parametersPatch": {
          "headerParameters": {
            "parameters": [
              { "name": "Authorization", "value": "={{ \"Bearer \" + $(\"Loop Contacts\").first().json.ghl.api_token }}" },
              { "name": "Version", "value": "2021-04-15" },
              { "name": "Content-Type", "value": "application/json" }
            ]
          },
          "jsonBody": "={{ {\"ok\": true} }}"
        }
      }
    }
  }'
```

Tool call (`get_execution_node_data`):
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "get_execution_node_data",
      "arguments": {
        "executionId": "exec_123",
        "nodeName": "HTTP Request"
      }
    }
  }'
```

## Deploy

### Docker
```bash
docker build -t mcp-n8n-server .
docker run --rm -p 3000:3000 --env-file .env mcp-n8n-server
```

### docker-compose
```bash
docker compose up --build
```

### VPS / Render / Railway / Coolify
- Deploy image Docker o runtime Node 20+.
- Configura env vars obbligatorie.
- Esponi porta `PORT`.
- Verifica `GET /health` dopo il deploy.

## Note compatibilita MCP
- Transport MCP: Streamable HTTP stateless.
- Endpoint MCP principale: `POST /mcp`.
- `GET /mcp` e `DELETE /mcp` rispondono `405` in questa implementazione.
- Header richiesto su `POST /mcp`: `Accept: application/json, text/event-stream`.

## Policy ChatGPT Connector
- Policy operativa pronta da incollare nelle istruzioni del connector:
  - `CHATGPT_CONNECTOR_POLICY.md`
