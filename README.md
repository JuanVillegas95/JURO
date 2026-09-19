# JURO

JURO is a local multi-language coding-practice web app. Fastify serves the React + TypeScript + Tailwind frontend, exposes the application API, and stores the catalog and learner activity in a local SQLite file.

## Architecture

- React, TypeScript, Vite, and Tailwind CSS frontend.
- Fastify + TypeScript local server.
- SQLite database at `.data/juro.sqlite` with WAL mode and automatic seed data.
- Claude connects through a separate TypeScript stdio MCP server for coaching, progress, and problem administration.
- Java, Python, Node.js, and Go are detected as local tools for generating and running workspaces. Maven remains optional for Java project workflows.

Problem definitions are read-only through the learner API. The MCP server is the only problem administration boundary. There is no problem-bank JSON import/export flow.

## Requirements

- Node.js 22.16+ (the server uses the built-in `node:sqlite` module).
- Java 17+, Python 3, Node.js, and Go for the languages you want to execute. Maven is optional.
- Claude Desktop (or another MCP client) for voice coaching and explanation evaluation.

No Oracle, Docker database, Spring Boot, or Tauri installation is required.

## Run in development

Install both TypeScript applications and start the web server plus Vite:

```sh
npm run install:all
npm run dev
```

Open `http://127.0.0.1:5173` during development. The Vite development server proxies `/api` requests to Fastify on `http://127.0.0.1:3000`.

Run the server-side runner checks with:

```sh
npm --prefix server test
```

## One-command launch

For the normal local workflow, use one command from the repository root:

```sh
npm run juro
```

It checks Node.js and the project dependencies, reports Java/Python/Node.js/Go availability, builds and starts JURO if it is not already running, waits for `/health`, and opens the web app in the default browser. Missing language toolchains are reported without installing system software automatically.

## Build and run the local web app

```sh
npm run build
npm start
```

Open `http://127.0.0.1:3000`. Fastify serves the compiled frontend from `frontend/dist` and the API from the same origin.

Copy `.env.example` to `.env` if you want to override the defaults. The server reads `JURO_DATABASE_PATH`, `JURO_SETTINGS_PATH`, `JURO_WORKSPACE_DIRECTORY`, and runner timeout settings.

If JURO cannot find an editor or compiler on `PATH`, open Settings and enter its command name or absolute executable path. Leave it blank to return to automatic detection.

For explicit local setup, `./scripts/init-db.sh` creates the SQLite schema and seed catalog. `./scripts/start-web.sh` and `./scripts/start-mcp.sh` are the corresponding shell entry points.

## Language runners

Java problems keep the existing typed `Solution.solve(...)` contract. Python, JavaScript, and Go problems use a simple local contract: the generated program reads one JSON value from standard input and writes one JSON value to standard output. JURO supplies each database test case to the selected runner, compares the parsed result, and reports compile, runtime, timeout, or per-case failures.

## MCP server

Build the server and configure an MCP client to launch:

```sh
npm run build
npm run mcp
```

The MCP process uses the same SQLite file and exposes `list_supported_languages`, `list_problems`, `get_problem`, `create_problem`, `update_problem`, `delete_problem`, `set_current_problem`, `get_current_problem`, `get_problem_progress`, `record_problem_status`, `start_knowledge_check`, and `submit_knowledge_check`. The current-problem and knowledge tools redact reference solutions and hidden tests. It does not expose arbitrary SQL, provider URLs, or AI credentials.

## Database

SQLite is initialized automatically on server startup. The database file and its WAL files live under `.data/`. The schema and starter catalog are defined in `server/src/db.ts`; shared current-problem context and knowledge-check sessions are persisted there so the web and MCP processes see the same state.
