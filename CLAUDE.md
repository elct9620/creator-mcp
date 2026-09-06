# creator-kit

## Commands

| Command           | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `pnpm dev`        | Local development                                          |
| `pnpm deploy`     | Deploy to Cloudflare                                       |
| `pnpm test:run`   | Run tests once — `pnpm test` watches and never exits       |
| `pnpm cf-typegen` | Regenerate `Env` after changing bindings in wrangler.jsonc |
| `sumi verify`     | Check the source against `.spec/`                          |

## Conventions

- `.spec/` is where this project's vocabulary and interfaces are settled. Read it
  before changing behaviour; record a decision there rather than only in code.
- Hooks in `.claude/` format every written file, type-check the project, and run
  tests plus `sumi verify` before a turn ends. Do not run prettier by hand.
- Trunk-based: commit to `main`. No feature branches.

# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/
