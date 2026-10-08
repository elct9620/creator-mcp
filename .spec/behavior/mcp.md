# MCP endpoint

The Model Context Protocol endpoint this application serves.

A client is told as it connects what the server offers and that `read_guide`
holds how to use the tools beyond their descriptions. Not every client passes
those instructions to its model, so they repeat what the tools already say
rather than carry anything only they would: a client that drops them loses
nothing the tool list does not still show.

## Includes

- `test/mcp.spec.ts`

## `M-001` The endpoint serves the protocol

| Step  | Statement                          |
| ----- | ---------------------------------- |
| Given | a client connected to the endpoint |
| When  | it pings the server                |
| Then  | the server answers an empty result |

## `M-002` The server says where more is written

| Step  | Statement                                    |
| ----- | -------------------------------------------- |
| Given | a client connected to the endpoint           |
| When  | it reads the instructions the server gave it |
| Then  | they point to `read_guide`                   |
