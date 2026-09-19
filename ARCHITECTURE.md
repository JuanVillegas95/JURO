# JURO architecture

JURO is a local web application. A Fastify TypeScript server owns persistence, language tooling, editor launching, submissions, and review scheduling. The React frontend is served by that same server in production.

## Persistence

SQLite is an embedded file database stored under `.data/juro.sqlite`. The Node server enables foreign keys, WAL mode, a busy timeout, and transactional writes. The MCP process opens the same local file and uses the same schema.

## Boundaries

The browser talks only to Fastify REST endpoints. It never opens the SQLite file or calls an AI provider directly. Problem definitions can only be changed through the separate stdio MCP service; the learner REST API exposes read-only problem content.

## MCP-first coaching

The server does not call Claude through a provider base URL. Settings show a generated stdio MCP configuration that can be copied into Claude Desktop. The MCP server exposes a safe current-problem context, progress/status tools, and a knowledge-check session workflow. Claude asks the learner questions through its normal text or voice interface and submits a structured result through `submit_knowledge_check`.

## Local language workflow

Fastify creates a managed workspace under the configured workspace directory, writes a language-specific scaffold and generated runner, launches VS Code or Neovim when requested, and invokes the selected Java, Python, JavaScript, or Go toolchain with a bounded timeout for test runs. Non-Java runners use a small JSON standard-input/standard-output contract so test cases remain language-neutral.

## MCP

`server/src/mcp.ts` is a small stdio MCP service. It exposes validated catalog tools plus current-problem, progress, and knowledge-check tools, uses the same SQLite file as Fastify, and has no arbitrary SQL or provider credentials. Knowledge context intentionally omits reference solutions and hidden test cases.

## Review scheduling

The fixed SM-2 policy lives in `server/src/repository.ts`. The frontend has no scheduling controls.
