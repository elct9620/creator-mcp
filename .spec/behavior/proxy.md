# Proxy

Running any model with a payload the caller wrote themselves, from a machine
that can reach the deployment through `cloudflared access curl`.

The tools speak a vocabulary of their own and carry nothing larger than a
prompt, so editing an image — which means handing a model the image itself —
has no place in them, and a tool argument holding a file's base64 would be paid
for in every message that repeats it. Cloudflare's own REST endpoint for
running a model takes an API token and not an Access session, so a machine
holding only the latter cannot reach it. The proxy is that endpoint behind
Access: `POST /api/ai/run/{model}` ends as Cloudflare's
`/accounts/{account_id}/ai/run/{model}` does, so a caller who knows one
replaces the base of the URL and keeps the rest.

It translates nothing. The body is the model's own input, written the way
Cloudflare documents it at
`https://developers.cloudflare.com/ai/models/{model}/schema-input.json`, and the
response is the model's own answer — without the `result` envelope the REST
endpoint wraps it in, since that envelope is the REST API's and not the
model's. Any model the account can run is accepted: Access already decides who
may call, and a list of models here would only stand between the person who
deployed it and their own account. Nothing is backed up either, because the
caller is a machine that keeps what it fetched.

The body is JSON alone. Of the models found taking an image to edit, the
partner models reached through unified billing all take it inside JSON, as
base64 or as a URL; multipart is what Cloudflare's own FLUX.2 models ask for,
and it is left out until one of them is wanted.

A failure says where to look next. A model that refuses a body answers with a
message of its own, and the response carries that message together with the
model's input schema and `GET /api`, so a caller can correct the body without
first being told where the rules are written. Every model failure answers 502,
because a refused body and an upstream that broke arrive here as the same
thrown error, and a status claiming to tell them apart would be a guess.

`GET /api` answers with the `api` guide, the same text `read_guide` hands back,
so an agent with only `cloudflared` and one with the MCP endpoint read the same
words.

## Includes

- `test/proxy.spec.ts`

## `P-001` The model the path names runs on the body as sent

| Step  | Statement                                                   |
| ----- | ----------------------------------------------------------- |
| Given | a request Access matched, carrying a JSON object            |
| When  | it is posted to `/api/ai/run/{model}`                       |
| Then  | the model the path names is run with that object, unchanged |

## `P-002` The gateway a deployment names

| Step  | Statement                                 |
| ----- | ----------------------------------------- |
| Given | a deployment naming an AI Gateway         |
| When  | a body is posted to `/api/ai/run/{model}` |
| Then  | the model is reached through that gateway |

## `P-003` An answer the model gives as a record

| Step  | Statement                                 |
| ----- | ----------------------------------------- |
| Given | a model answering with a record           |
| When  | a body is posted to `/api/ai/run/{model}` |
| Then  | the response is that record as JSON       |

## `P-004` An answer the model gives as a stream

| Step  | Statement                                 |
| ----- | ----------------------------------------- |
| Given | a model answering with a stream           |
| When  | a body is posted to `/api/ai/run/{model}` |
| Then  | the response carries that stream's bytes  |

## `P-005` A body that is no JSON object

| Step  | Statement                                   |
| ----- | ------------------------------------------- |
| Given | a body that does not parse as a JSON object |
| When  | it is posted to `/api/ai/run/{model}`       |
| Then  | the response is 400                         |

## `P-006` A body that is no JSON object reaches no model

| Step  | Statement                                   |
| ----- | ------------------------------------------- |
| Given | a body that does not parse as a JSON object |
| When  | it is posted to `/api/ai/run/{model}`       |
| Then  | no model is run                             |

## `P-007` A model that fails

| Step  | Statement                                 |
| ----- | ----------------------------------------- |
| Given | a model that fails with a message         |
| When  | a body is posted to `/api/ai/run/{model}` |
| Then  | the response is 502 carrying that message |

## `P-008` A failure points to the rules

| Attribute | Value   |
| --------- | ------- |
| relates   | `P-007` |

| Step  | Statement                                                   |
| ----- | ----------------------------------------------------------- |
| Given | a model that fails with a message                           |
| When  | a body is posted to `/api/ai/run/{model}`                   |
| Then  | the response names that model's input schema and `GET /api` |

## `P-009` A request a browser sends

| Step  | Statement                                  |
| ----- | ------------------------------------------ |
| Given | a request Access matched, naming an origin |
| When  | it is posted to `/api/ai/run/{model}`      |
| Then  | the response is 403                        |

## `P-010` How to call it

| Attribute | Value   |
| --------- | ------- |
| relates   | `G-003` |

| Step  | Statement                                    |
| ----- | -------------------------------------------- |
| Given | a request Access matched                     |
| When  | `GET /api` is requested                      |
| Then  | the response is the `api` guide, as Markdown |
