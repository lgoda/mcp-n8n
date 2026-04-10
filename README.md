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
- `PATCH /api/v1/workflows/:id`
- `POST /api/v1/workflows/:id/activate`
- `POST /api/v1/workflows/:id/deactivate`
- `GET /api/v1/executions`
- `GET /api/v1/executions/:id`

## Tool MCP esposti
- `list_workflows`
- `get_workflow`
- `create_workflow`
- `update_workflow`
- `activate_workflow`
- `deactivate_workflow`
- `list_executions`
- `get_execution`

## Sicurezza
- Validazione input/output con `zod`.
- Nessun secret hardcoded.
- Errori sanitizzati (no leak API key/token).
- Nessun tool catch-all/raw pass-through.
- Separazione read/write e flag `enableWriteTools` nel bootstrap.
- TODO chiari in codice per:
  - Middleware OAuth/auth applicativa.
  - Policy autorizzativa su write actions.

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
Nota: in ambiente reale, il client MCP (ChatGPT/OpenAI) gestisce handshake e call sequence. Di seguito esempi minimali HTTP.

Initialize:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
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

Tool call (`list_workflows`):
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "list_workflows",
      "arguments": { "limit": 20, "active": true }
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

## Note compatibilità
- Transport MCP: Streamable HTTP stateless.
- Endpoint MCP principale: `POST /mcp`.
- `GET /mcp` e `DELETE /mcp` rispondono `405` in questa implementazione.
