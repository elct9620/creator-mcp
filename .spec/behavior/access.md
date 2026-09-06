# Access

What the MCP endpoint requires of a caller. Cloudflare Access guards the
Worker itself and resolves who the caller is before the request arrives, so
the origin no longer reads an assertion of its own. What it can still tell
apart is whether Access matched this request at all: one that reached the
Worker by another path carries nothing, and Managed OAuth is only safe to
enable on a server that turns those away.

## Includes

- `test/access.spec.ts`

## `A-001` A caller Access never matched

| Step  | Statement                                                   |
| ----- | ----------------------------------------------------------- |
| Given | a request Cloudflare Access did not match an application on |
| When  | `/mcp` is requested                                         |
| Then  | the response is 401                                         |

## `A-002` A caller Access matched

| Step  | Statement                                             |
| ----- | ----------------------------------------------------- |
| Given | a request Cloudflare Access matched an application on |
| When  | `/mcp` is requested                                   |
| Then  | the endpoint answers the request                      |
