# Routing

Which paths this application answers, and what it answers for the rest.

## Includes

- `test/index.spec.ts`

## `R-001` The host is reachable before anything is published

| Step  | Statement                                        |
| ----- | ------------------------------------------------ |
| Given | an application publishing no page of its own yet |
| When  | `GET /` is requested                             |
| Then  | the response is 200 carrying `Coming Soon`       |

## `R-002` A path no route answers

| Step | Statement                               |
| ---- | --------------------------------------- |
| When | a path outside every route is requested |
| Then | the response is 404                     |
