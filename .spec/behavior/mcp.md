# MCP endpoint

The Model Context Protocol endpoint this application serves.

## Includes

- `test/mcp.spec.ts`

## `M-001` The endpoint serves the protocol

| Step  | Statement                          |
| ----- | ---------------------------------- |
| Given | a client connected to the endpoint |
| When  | it pings the server                |
| Then  | the server answers an empty result |

## `M-002` Nothing is offered yet

| Step  | Statement                                 |
| ----- | ----------------------------------------- |
| Given | a server carrying no tools of its own yet |
| When  | a client lists the tools                  |
| Then  | the list is empty                         |
