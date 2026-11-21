---
name: api
description: How to edit an image, or run any Workers AI model with a payload of your own, from a machine that can run cloudflared — what the tools cannot carry.
---

# Running a model with your own payload

The tools take a prompt and the words they define. Anything else — an image to
edit, a parameter no tool offers, a model no tool lists — goes through the
deployment's `/api` instead, from a machine where `cloudflared` is installed.
Cloudflare Access guards it as it guards the MCP endpoint, and
`cloudflared access curl` is what carries the Access session; the first call
opens a browser to sign in.

```sh
cloudflared access curl https://<host>/api/ai/run/<model> \
  -X POST -H 'content-type: application/json' -d @payload.json
```

## The body is the model's own input

Nothing is translated. Write the body the way Cloudflare documents the model,
and its id is the whole of the path:

| What                     | Where                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| Which models there are   | `https://developers.cloudflare.com/ai/llms.txt`                          |
| What a model takes       | `https://developers.cloudflare.com/ai/models/<model>/schema-input.json`  |
| What it answers          | `https://developers.cloudflare.com/ai/models/<model>/schema-output.json` |
| Its parameters, examples | `https://developers.cloudflare.com/ai/models/<model>/index.md`           |

An `@cf/` model's pages redirect, so fetch them with `curl -L`.

Models disagree on how an image to edit is handed over, and the schema is what
says which:

| Model                                   | Field         | Holds                                    |
| --------------------------------------- | ------------- | ---------------------------------------- |
| `openai/gpt-image-2.5-*`                | `images`      | 1 to 16 entries, base64 or a `data:` URL |
| `google/nano-banana-2`, `2.1`, `2-lite` | `image_input` | up to 3 URLs                             |

The body is JSON alone. A model asking for multipart, such as Cloudflare's own
FLUX.2 models, cannot be run here.

## The answer is the model's own

The response is what the model answered, without the `result` envelope
Cloudflare's REST API wraps it in: a record arrives as JSON, a stream as its
bytes. An image model most often answers with a link, at `result.image` inside
that record, which stands for about a day; nothing is kept for you, so save the
file before then.

## When a call fails

| Status | Means                                                                        |
| ------ | ---------------------------------------------------------------------------- |
| 401    | Access did not match the request: call through `cloudflared access curl`     |
| 403    | The request named an origin: no browser may call this                        |
| 400    | The body is not a JSON object                                                |
| 502    | The model failed; its own message follows, then where its input is described |

A body the model refuses and a model that broke both answer 502, so read the
message, and check the body against the schema before sending it again: the
gateway refuses a field the schema does not list.
