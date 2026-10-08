# Project Design

Design a software project — tech stack, architecture style, services, layers, modules,
data model, APIs, queues and integrations — on a canvas, then let coding agents read that
design over MCP and generate a codebase that matches it.

## Run it

```bash
docker compose up -d --build --wait
open http://localhost:3000
```

Data lives in the `pgdata` Docker volume. Ports bind to 127.0.0.1 only. To expose the app
beyond localhost, set `APP_BASIC_AUTH=user:password` (and put it behind TLS).

## Develop

```bash
cp .env.example .env
npm install
npm run db:up        # Postgres on 127.0.0.1:5434
npm run dev          # http://localhost:3000
npm run verify       # format, lint, typecheck, tests, build
```

## Connect an agent

Create a token under **Settings → MCP tokens**, then for Claude Code:

```bash
claude mcp add --transport http project-design http://localhost:3000/api/mcp \
  --header "Authorization: Bearer pd_…"
```
