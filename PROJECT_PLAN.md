# Project Plan

## Project Goal
- [x] Build a production-oriented remote MCP server in Node.js + TypeScript to safely manage n8n workflows and executions through documented n8n REST API endpoints.
- [x] Ensure compatibility with ChatGPT/OpenAI MCP remote usage via HTTP/S transport.

## Scope
- [x] In scope:
  - Remote MCP server with HTTP endpoint and healthcheck.
  - Secure tool set for workflows/executions (read + write) with strict schemas.
  - n8n API client using API key auth from environment variables.
  - Input/output validation with `zod`.
  - Typed errors, sanitized error responses, minimal structured logging.
  - Unit tests + mock/integration-style tests.
  - Docker-ready deployment artifacts.
- [x] Out of scope for this iteration:
  - OAuth to n8n.
  - Fine-grained auth middleware for end users.
  - Arbitrary pass-through API proxying.

## Assumptions
- [x] `N8N_API_URL` points to n8n base URL and client calls `/api/v1/...` endpoints.
- [x] API key auth uses header `X-N8N-API-KEY`.
- [x] Endpoint set aligned with current official n8n API docs.
- [x] MCP remote transport is HTTP Streamable in stateless mode.
- [x] TODO tracked: integrate OAuth/auth middleware and write policy before multi-tenant exposure.

## Architecture
- [x] `src/config.ts`: env loading + validation with zod.
- [x] `src/services/n8nClient.ts`: all outbound HTTP calls to n8n.
- [x] `src/schemas/`: input/output schemas.
- [x] `src/tools/`: one handler per tool + registry.
- [x] `src/utils/`: logger, error mapping, safe merge helpers.
- [x] `src/types/`: shared types.
- [x] `src/server.ts`: MCP server setup, tool registration, HTTP endpoints.

## File Structure
- [x] `package.json`
- [x] `tsconfig.json`
- [x] `.env.example`
- [x] `README.md`
- [x] `PROJECT_PLAN.md`
- [x] `STEP_BY_STEP_PLAN.md`
- [x] `Dockerfile`
- [x] `docker-compose.yml`
- [x] `src/*` modules
- [x] `tests/*`

## Implementation Phases
- [x] Phase 1: Planning docs + scaffolding + tooling.
- [x] Phase 2: Core runtime modules.
- [x] Phase 3: n8n client implementation and API mapping.
- [x] Phase 4: MCP tool handlers and registry.
- [x] Phase 5: Remote MCP HTTP server + health endpoint.
- [x] Phase 6: Tests + packaging + docs + deploy artifacts.

## Test Strategy
- [x] Build/type check: `npm run build`.
- [x] Lint: `npm run lint`.
- [x] Unit tests for schemas, errors, safe merge.
- [x] Mock-based client tests for path/query/header/error mapping.
- [x] Tool handler tests (including safe update merge and validation failures).
- [x] Server health integration-style test.
- [x] Strict test-gated step execution applied.

## Risks
- [x] API docs/version drift risk acknowledged.
- [x] Large execution payload risk acknowledged.
- [x] Write actions require stronger auth policy in shared environments.
- [x] Compatibility differences across MCP clients may require transport tuning.

## Definition Of Done
- [x] All required files are present.
- [x] Required MCP tools are implemented and schema-validated.
- [x] No secrets hardcoded.
- [x] Build, lint, and tests pass.
- [x] `STEP_BY_STEP_PLAN.md` contains final per-step statuses and issue notes.
- [x] README includes run, test, and deploy instructions + examples.
