# Image generation

The tool this application offers for turning a prompt into an image, and what
it hands back.

The model stores what it generates and answers with a link to it. That link is
presigned and stands for a day, and it is handed on exactly as given: a call is
one-shot, so the caller reaches the image while the link still stands, and the
Worker never carries the image itself.

The output format a caller asks for is not a promise about the stored image —
one asked for as PNG has come back stored as JPEG — so what the reply says
about the encoding is read from the store rather than from the request. One
byte is enough to be told: the store answers with the encoding while the image
stays where it is. A store that will not answer leaves the format the caller
asked for as the best that can be said.

The address the store is asked at is the one the binding answered with, and it
is requested on that alone. Nothing about it is checked, because nothing else
decides what the Worker reaches for: a link it should not follow would have to
come from Workers AI itself.

## Includes

- `test/image.spec.ts`

## `I-001` The tool is offered

| Step  | Statement                    |
| ----- | ---------------------------- |
| Given | an endpoint serving the tool |
| When  | a client lists the tools     |
| Then  | `create_image` is among them |

## `I-002` A prompt becomes an image

| Step  | Statement                            |
| ----- | ------------------------------------ |
| Given | a prompt                             |
| When  | `create_image` is called with it     |
| Then  | the model generates from that prompt |

## `I-003` The model a caller names nothing for

| Step  | Statement                                    |
| ----- | -------------------------------------------- |
| Given | a call naming no model                       |
| When  | `create_image` is called                     |
| Then  | `google/nano-banana-pro` generates the image |

## `I-004` What the caller asks of the generation

| Step  | Statement                                          |
| ----- | -------------------------------------------------- |
| Given | an aspect ratio, an output format or an image size |
| When  | `create_image` is called with them                 |
| Then  | the model receives each one as given               |

## `I-005` The image is linked rather than carried

| Step  | Statement                                               |
| ----- | ------------------------------------------------------- |
| Given | a model answering with a link to the image it generated |
| When  | `create_image` replies                                  |
| Then  | the reply carries that link as given                    |

## `I-006` The encoding the stored image is in

| Step  | Statement                                                    |
| ----- | ------------------------------------------------------------ |
| Given | a store saying what the image is encoded as                  |
| When  | `create_image` replies                                       |
| Then  | the link states that encoding, whatever the caller asked for |

## `I-007` An encoding the store will not give

| Step  | Statement                                                  |
| ----- | ---------------------------------------------------------- |
| Given | a store that will not say, and a caller who named a format |
| When  | `create_image` replies                                     |
| Then  | the link states the format the caller asked for            |

## `I-008` A model answering without a link

| Step  | Statement                              |
| ----- | -------------------------------------- |
| Given | an answer carrying no link to an image |
| When  | `create_image` replies                 |
| Then  | the call fails                         |

## `I-009` An encoding nobody can give

| Step  | Statement                                                   |
| ----- | ----------------------------------------------------------- |
| Given | a store that will not say, and a caller who named no format |
| When  | `create_image` replies                                      |
| Then  | the link states no encoding                                 |

## `I-010` The image stays where it is

| Step  | Statement                                    |
| ----- | -------------------------------------------- |
| Given | a store holding the image that was generated |
| When  | `create_image` asks what it is encoded as    |
| Then  | it asks for a single byte                    |
