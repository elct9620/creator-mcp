# MCP endpoint

The Model Context Protocol endpoint this application serves.

## Includes

- `test/mcp.spec.ts`

## `M-001` The endpoint serves the protocol

| Step  | Statement                                     |
| ----- | --------------------------------------------- |
| Given | a server carrying no tools of its own yet     |
| When  | `ping` is requested at `/mcp`                 |
| Then  | the response carries an empty JSON-RPC result |
