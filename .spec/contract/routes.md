# Routes

The routes this application serves. Nothing in a TypeScript file is a
route, so each one is claimed in front of the code answering it.

## Includes

- `src/**/*.ts`

## Marker

`@route`

## `GET /`

The host is reachable before anything is published on it, and this says so
rather than leaving a caller to read a 404 as a wrong address.

A placeholder is all that stands here, so the origin makes no check of its
own and leaves the guarding to Access. Whatever replaces it will have to
answer that question again.

## `GET /api`

How to call what is under `/api`, as Markdown, for an agent that reached the
deployment through `cloudflared` rather than through the MCP endpoint.

## `POST /api/ai/run/{model}`

Running a model on a payload the caller wrote, behind Access. It ends as
Cloudflare's own REST endpoint does, so a caller who knows that one keeps
everything but the base of the URL.

## `ALL /mcp`

The Model Context Protocol endpoint. Method dispatch belongs to the
protocol rather than to the router, so every method reaches the handler
and the handler decides what it will answer.
