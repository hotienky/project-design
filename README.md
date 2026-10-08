# Project Design

Design a software project on a canvas — tech stack, architecture style, services, layers,
modules, data model, APIs, queues and integrations — then let coding agents (Claude Code,
Cursor, Codex, …) read that design over [MCP](https://modelcontextprotocol.io) and generate a
codebase that matches it. Agents report progress back, and it shows up on the canvas.

![The designer showing the Team Tasks example](docs/screenshot.png)

- **Canvas designer** (React Flow): services contain layers contain modules; datastores contain
  entities; typed connections (`depends_on`, `calls`, `exposes`, `accesses`, `publishes`,
  `subscribes`, `uses`, `relation`, `interacts`); inspector forms for every kind; undo/redo,
  autosave, validation panel.
- **Project sections**: overview, tech stack, conventions, architecture decisions, a markdown
  **brief**, and published **versions** with diff and restore.
- **MCP server** at `/api/mcp`: 12 tools, 3 prompts, 3 resources. Agents get the brief, the raw
  JSON, per-component context, an OpenAPI 3.1 contract, the data model (JSON or Mermaid), a
  dependency-ordered build plan and the changes between versions.
- **Self-hosted**: Next.js 16, PostgreSQL 18, one Docker Compose file.

## Quick start (Docker)

```bash
docker compose up -d --build --wait
open http://localhost:3000        # or xdg-open on Linux
```

Create a project (try **Example: Team Tasks**), then connect an agent (below). Data lives in the
`pgdata` Docker volume; `docker compose down` keeps it, `docker compose down -v` deletes it.
The app and the database bind to `127.0.0.1` only. Change the ports with `APP_PORT` and
`DB_PORT`.

## Connect an agent

Create a token under **Settings → MCP tokens**. A token can be scoped to one project, which lets
the agent leave out the `project` argument — create one per generated repository.

```bash
# Claude Code
claude mcp add --transport http project-design http://localhost:3000/api/mcp \
  --header "Authorization: Bearer pd_…"
```

```jsonc
// .mcp.json in the generated repo (keep the token in an environment variable)
{
  "mcpServers": {
    "project-design": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer ${PROJECT_DESIGN_TOKEN}" }
    }
  }
}
```

Any other client: a Streamable HTTP MCP server at `<APP_URL>/api/mcp` with the header
`Authorization: Bearer <token>`.

Then ask the agent to run the **`implement_design`** prompt, or just: _"Read the design with
get_project_brief and implement it step by step."_

| Tool                                                    | What it returns                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| `list_projects`                                         | Projects this token can read                                    |
| `get_design_schema`                                     | What every node/edge kind means, plus the JSON Schema           |
| `get_project_brief`                                     | The whole design as markdown (start here)                       |
| `get_project_design`                                    | The raw design document (JSON)                                  |
| `list_components`, `get_component`                      | The component tree; one component with its context and status   |
| `get_api_contract`                                      | OpenAPI 3.1 for REST APIs, JSON otherwise                       |
| `get_data_model`                                        | Entities, fields, indexes, relations (JSON or Mermaid ER)       |
| `get_build_plan`                                        | Dependency-ordered implementation steps with current statuses   |
| `validate_design`                                       | Warnings about unused, unimplemented or inconsistent parts      |
| `get_design_changes`                                    | What changed between two versions (or a version and the draft)  |
| `set_component_status`                                  | Write-back: `todo` / `in_progress` / `done` / `blocked` + note  |

Prompts: `implement_design`, `sync_design_changes`, `review_against_design`. Resources:
`design://schema`, `design://projects/{slug}/brief`, `design://projects/{slug}/document`.
Every read tool accepts `version`: `"draft"` (default), `"latest"` or a version number, so an
agent can build against a published snapshot while you keep editing.

## Develop

Requires Node ≥ 24 and Docker.

```bash
cp .env.example .env
npm install
npx playwright install chromium     # for the e2e tests
npm run db:up                       # Postgres 18 on 127.0.0.1:5434 (dev + test databases)
npm run dev                         # http://localhost:3000
```

| Command                              | What it does                                                          |
| ------------------------------------ | --------------------------------------------------------------------- |
| `npm run verify`                     | Prettier, ESLint, typecheck, unit + integration tests, production build |
| `npm test` / `npm run test:integration` | Vitest unit tests / integration tests against the test database    |
| `npm run test:e2e`                   | Playwright against the standalone build (run `npm run build` first)    |
| `npm run db:generate -- --name x`    | New SQL migration from `src/server/db/schema.ts`                       |
| `npm run docs:screenshot`            | Regenerate `docs/screenshot.png`                                       |

The app migrates its own database on boot (`MIGRATE_ON_START`). Everything the UI saves and
every document an agent reads goes through one contract, `src/lib/design/schema.ts`. See
[AGENTS.md](AGENTS.md) for the rules this codebase follows.

## Backup and restore

```bash
docker compose exec -T db pg_dump -U design project_design > backup.sql        # back up
docker compose exec -T db psql -U design project_design < backup.sql           # restore (into an empty database)
```

A single design can also be exported from the UI (**Export → Design JSON**) and imported again
from the projects page.

## Configuration

| Variable          | Default                                                           | Purpose                                                              |
| ----------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`    | `postgres://design:design@localhost:5434/project_design` (dev)    | Postgres connection string (Compose sets it for the app)             |
| `DATABASE_URL_TEST` | `…/project_design_test`                                         | Database for integration and e2e tests                               |
| `APP_URL`         | `http://localhost:3000`                                           | Base URL shown in the connection snippets                            |
| `APP_BASIC_AUTH`  | _(empty)_                                                         | `user:password`; when set, the UI and REST API require HTTP Basic auth |
| `MIGRATE_ON_START` | `true`                                                           | Run migrations when the server starts                                |
| `APP_PORT`, `DB_PORT` | `3000`, `5434`                                                | Host ports used by `compose.yaml`                             |

## Security

- The UI and the REST API have **no accounts**: it is a single-user tool. Compose binds every
  port to `127.0.0.1`. **Don't expose it beyond localhost without `APP_BASIC_AUTH` and TLS.**
- MCP requests need a bearer token. Only the SHA-256 of a token is stored, the plaintext is shown
  once, and revoking a token takes effect immediately. A project-scoped token cannot see other
  projects.
- Every inbound document is validated (schema plus integrity rules) and JSON bodies are
  size-limited; all SQL goes through Drizzle (parameterised); user text is rendered as text,
  never as HTML.
