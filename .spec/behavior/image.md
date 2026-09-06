# Image generation

The tool this application offers for turning a prompt into an image, and what
it hands back.

The model stores what it generates and answers with a link to it. That link is
short-lived, and it is handed on exactly as given: a call is one-shot, so the
caller reaches the image while the link still stands, and the Worker never
carries the image itself.

## Includes

- `test/image.spec.ts`

## `I-001` The tool is offered

| Step  | Statement                    |
| ----- | ---------------------------- |
| Given | an endpoint serving the tool |
| When  | a client lists the tools     |
| Then  | `create_image` is among them |

## `I-002` A prompt becomes an image

| Step  | Statement                                          |
| ----- | -------------------------------------------------- |
| Given | a prompt                                            |
| When  | `create_image` is called with it                    |
| Then  | the model generates from that prompt                |

## `I-003` The model a caller names nothing for

| Step  | Statement                                    |
| ----- | -------------------------------------------- |
| Given | a call naming no model                       |
| When  | `create_image` is called                     |
| Then  | `google/nano-banana-pro` generates the image |

## `I-004` What the caller asks of the generation

| Step  | Statement                                                    |
| ----- | ------------------------------------------------------------ |
| Given | an aspect ratio, an output format or an image size            |
| When  | `create_image` is called with them                            |
| Then  | the model receives each one as given                          |

## `I-005` The image is linked rather than carried

| Step  | Statement                                                 |
| ----- | --------------------------------------------------------- |
| Given | a model answering with a link to the image it generated    |
| When  | `create_image` replies                                     |
| Then  | the reply carries that link as given                       |
