# Access

What the MCP endpoint requires of a caller. Cloudflare Access guards the
hostname and resolves the caller's identity into an assertion; this is the
origin's own check on that assertion, without which Managed OAuth would be
trusting a header nobody verified.

## Includes

- `test/access.spec.ts`

## `A-001` A caller Access never saw

| Step  | Statement                              |
| ----- | -------------------------------------- |
| Given | a request carrying no Access assertion |
| When  | `/mcp` is requested                    |
| Then  | the response is 401                    |

## `A-002` A caller Access admitted

| Step  | Statement                                          |
| ----- | -------------------------------------------------- |
| Given | an assertion signed by Access for this application |
| When  | `/mcp` is requested                                |
| Then  | the endpoint answers the request                   |

## `A-003` A caller admitted to another application

| Step  | Statement                                                 |
| ----- | --------------------------------------------------------- |
| Given | an assertion whose audience is another Access application |
| When  | `/mcp` is requested                                       |
| Then  | the response is 401                                       |

## `A-005` A caller admitted by another organisation

| Step  | Statement                                        |
| ----- | ------------------------------------------------ |
| Given | an assertion whose issuer is another team domain |
| When  | `/mcp` is requested                              |
| Then  | the response is 401                              |

## `A-004` Local development, where no Access sits in front

| Step  | Statement                                    |
| ----- | -------------------------------------------- |
| Given | `DEBUG` turned on                            |
| When  | `/mcp` is requested with no Access assertion |
| Then  | the endpoint answers the request             |
