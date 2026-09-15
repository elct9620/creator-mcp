# Image generation

The tool this application offers for turning a prompt into an image, and what
it hands back.

The model stores what it generates and answers with a link to it. That link is
presigned and stands for a day, and it is handed on exactly as given: a call is
one-shot, so the caller reaches the image while the link still stands, and the
Worker never carries the image itself.

More than one model generates here, and they do not agree on words.
`google/nano-banana-pro` calls the resolution `image_size` where the other
nano banana models call it `resolution`. The GPT Image models call the encoding
`jpeg` rather than `jpg`, and are asked for neither a shape nor a resolution
but for a size in pixels. So the tool keeps a vocabulary of its own and every
model states how much of it it answers to — a painter, in the glossary's words
— translating at the moment the request is made. The point of it is that a
caller says `aspect_ratio`, `format` and `resolution` whichever model generates.

A GPT Image model draws at `1024x1024`, `1024x1536` or `1536x1024`, and a
caller reaches them by naming `1:1`, `2:3` or `3:2` at `1K`. What a caller needs
is an image of the right shape and size, and those two words already say it; a
size in pixels would be one model's spelling reaching the caller. OpenAI
documents other sizes, but Cloudflare's schema for these models admits those
three alone, and the schema of the binding actually called is the one that
bounds what can be asked for.

Editing an existing image is a tool of its own rather than part of this one, so
the reference images a GPT Image model can take are no part of this vocabulary.

A call naming no model is generated with `google/nano-banana-2`. The same
reason that picks the smallest resolution picks it: a caller who said nothing
has not asked to pay more, and Google's tiers put it below
`google/nano-banana-pro`. Google's cheapest tier is
`google/nano-banana-2-lite`, and it is not the default because it generates 1K
alone — a default that quietly caps what can be asked for is a different thing
from one that costs less.

A call naming no resolution is generated at the smallest one. It is the
cheapest, and a caller who said nothing has not asked to pay more; which one
the model would otherwise reach for is undocumented, so naming one is also what
makes the same call answer the same way twice.

A request the chosen model cannot honour is refused before it is sent, because
the alternative is an image that quietly is not what was asked for: an encoding
that fell back to the model's own, a shape or a resolution the model never had.
`google/nano-banana-2` and `google/nano-banana-2-lite` do not store webp,
`google/nano-banana-2-lite` generates 1K alone, and a GPT Image model draws
`1:1`, `2:3` and `3:2` alone, at 1K. What the schema cannot state
and a description can only advise, the call itself enforces, and each refusal
names the way out so a caller can ask again rather than only be told no.

The format a caller asks for is not a promise about the stored image —
one asked for as PNG has come back stored as JPEG — so what the reply says
about the encoding is read from the store rather than from the request. One
byte is enough to be told: the store answers with the encoding while the image
stays where it is. A store that will not answer leaves the format the caller
asked for as the best that can be said.

The address the store is asked at is the one the binding answered with, and it
is requested on that alone. Nothing about it is checked, because nothing else
decides what the Worker reaches for: a link it should not follow would have to
come from Workers AI itself.

Which AI Gateway the model is reached through is a deployment's answer rather
than a caller's, because it decides how the inference is billed and rate
limited. Naming none is not the absence of a gateway — the account's default
one answers instead — so the choice is which gateway, never whether. A name is
therefore left out entirely rather than sent empty: an empty one is refused as
a missing gateway rather than read as none.

The reply states the link three ways, because three readers need it: a resource
link for the client that follows one, structured content for whatever parses the
reply, and text for the model — the only path by which the link reaches the
person who has to fetch the file. A client that renders neither of the first two
still leaves that person able to save what was generated, so the text says how
long the link stands as well as where it points.

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

| Step  | Statement                                  |
| ----- | ------------------------------------------ |
| Given | a call naming no model                     |
| When  | `create_image` is called                   |
| Then  | `google/nano-banana-2` generates the image |

## `I-004` What the caller asks of the generation

| Step  | Statement                                              |
| ----- | ------------------------------------------------------ |
| Given | a model, and an aspect ratio, a format or a resolution |
| When  | `create_image` is called with them                     |
| Then  | that model receives each one under the name it uses    |

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

## `I-011` The gateway a deployment names

| Step  | Statement                                 |
| ----- | ----------------------------------------- |
| Given | a deployment naming an AI Gateway         |
| When  | `create_image` generates                  |
| Then  | the model is reached through that gateway |

## `I-012` A deployment naming no gateway

| Step  | Statement                         |
| ----- | --------------------------------- |
| Given | a deployment naming no AI Gateway |
| When  | `create_image` generates          |
| Then  | the generation names none         |

## `I-013` The reply is also structured

| Step  | Statement                                                                  |
| ----- | -------------------------------------------------------------------------- |
| Given | a model answering with a link to the image it generated                    |
| When  | `create_image` replies                                                     |
| Then  | the structured content carries that link and the encoding the reply states |

## `I-014` A structured reply with no encoding to give

| Step  | Statement                                                   |
| ----- | ----------------------------------------------------------- |
| Given | a store that will not say, and a caller who named no format |
| When  | `create_image` replies                                      |
| Then  | the structured content states no encoding                   |

## `I-015` The tool says what it answers with

| Step  | Statement                                                    |
| ----- | ------------------------------------------------------------ |
| Given | an endpoint serving the tool                                 |
| When  | a client lists the tools                                     |
| Then  | `create_image` states the shape of the reply it answers with |

## `I-016` The link reaches the person who has to fetch it

| Step  | Statement                                                  |
| ----- | ---------------------------------------------------------- |
| Given | a model answering with a link to the image it generated    |
| When  | `create_image` replies                                     |
| Then  | the reply states that link in text, and how long it stands |

## `I-017` The resolution a caller names nothing for

| Step  | Statement                      |
| ----- | ------------------------------ |
| Given | a call naming no resolution    |
| When  | `create_image` generates       |
| Then  | the image is generated at `1K` |

## `I-018` An encoding the model cannot store

| Step  | Statement                                    |
| ----- | -------------------------------------------- |
| Given | an encoding the chosen model does not store  |
| When  | `create_image` is called                     |
| Then  | the call fails and nothing reaches the model |

## `I-019` A resolution the model cannot generate

| Step  | Statement                                       |
| ----- | ----------------------------------------------- |
| Given | a resolution the chosen model does not generate |
| When  | `create_image` is called                        |
| Then  | the call fails and nothing reaches the model    |

## `I-020` A shape the model cannot draw

| Step  | Statement                                      |
| ----- | ---------------------------------------------- |
| Given | an aspect ratio the chosen model does not draw |
| When  | `create_image` is called                       |
| Then  | the call fails and nothing reaches the model   |
