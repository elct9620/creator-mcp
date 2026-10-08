# Audio generation

The tool this application offers for speaking text aloud, and what it hands
back.

More than one model speaks here, and they do not agree on words. OpenAI names a
voice `voice` and ElevenLabs `voice_id`; OpenAI calls the stored encoding
`response_format` and takes `mp3`, ElevenLabs calls it `output_format` and takes
`mp3_44100_128`, and a Gemini model cannot be asked for one at all; only
`openai/tts-1` can be asked to speak faster. So the tool keeps a vocabulary of
its own and every model states how much of it it answers to, translating at the
moment the request is made.

That the vocabulary is shared rather than split per model is forced as well as
chosen: a tool's `inputSchema` is a JSON Schema whose `type` must be `object`,
so a union of per-model shapes has nowhere in the protocol to live. What the
schema cannot say, the description of each argument says instead — which model
requires a voice, which stores only some encodings, which can vary speed.

A call naming no model is spoken by `google/gemini-3.8-flash-lite-tts`, and it
is chosen for how it sounds rather than for what it costs: of the models here,
its Mandarin comes closest to how people in Taiwan speak, where
`google/gemini-3.8-flash-tts` pronounces more exactly but sounds less local. It
is not the cheapest. `openai/tts-1` is charged by the character of text and a
Gemini model by the second of audio, so for Chinese, which packs much into
each second, `openai/tts-1` costs about half as much; a caller who would rather
pay less names it. Whichever model is the default has to be one that can be
asked with text alone — a voice is `elevenlabs/eleven-v3`'s to require, not this
tool's to invent.

How a Gemini model should sound cannot be steered by writing it into the text:
an instruction there is read aloud with the rest. So nothing in this tool
suggests it.

A Gemini model always answers in WAV and has no word for an encoding. Asking it
for `wav` asks for what it already gives, so that is let through and nothing
about the encoding is sent; any other encoding is refused. It takes up to
10,000 characters, which is what the binding admits.

Raw PCM is not among the encodings offered. It carries no container, so a store
holding it has nothing to say about what it is, and the reply would be left with
no encoding to state.

What happens after the model answers is what happens for a generated image: the
link is presigned, stands for a day, and is handed on exactly as given; the
encoding is read from the store rather than from the request; and the reply
states the link three ways, because a resource link, structured content and text
each reach a different reader.

A model may instead hand the audio over in the answer itself, as base64 in a
`data:` URL. Which of the two an answer is decides the reply, and the model
named does not: nothing promises that one model answers the same way twice, and
an answer that was a link once could be carried the next time or the other way
round. Audio handed over is carried on as the protocol's own audio content
rather than stored anywhere first — the bytes are already in hand, and putting
them somewhere only to link back to them would add a store this application
otherwise never needs. The encoding is the one the `data:` URL states, there
being no store to ask. A text block still goes with it saying the audio is
carried rather than linked, because a client that shows nothing for audio
content would otherwise show nothing at all, and the structured content states
the encoding alone, there being no link to state.

The spoken text is not repeated as the resource link's title. A prompt
describing an image is short enough to name it; the words of a recording are the
content itself, and thousands of them are not a label.

A request the chosen model cannot honour is refused before it is sent, because
the alternative is audio that quietly is not what was asked for: a speed that
was ignored, an encoding that fell back to the model's own. What the schema
cannot state and a description can only advise, the call itself enforces, and
each refusal names the way out so a caller can ask again. The one thing let
through is a request the model already meets — asking a model that always
speaks at one pace for that same pace changes nothing, so the speed is dropped
in translation rather than refused.

## Includes

- `test/audio.spec.ts`

## `AU-001` The tool is offered

| Step  | Statement                    |
| ----- | ---------------------------- |
| Given | an endpoint serving the tool |
| When  | a client lists the tools     |
| Then  | `create_audio` is among them |

## `AU-002` Text becomes speech

| Step  | Statement                        |
| ----- | -------------------------------- |
| Given | a text to speak                  |
| When  | `create_audio` is called with it |
| Then  | the model receives that text     |

## `AU-003` The model a caller names nothing for

| Step  | Statement                                          |
| ----- | -------------------------------------------------- |
| Given | a call naming no model                             |
| When  | `create_audio` is called                           |
| Then  | `google/gemini-3.8-flash-lite-tts` speaks the text |

## `AU-004` Each model is asked in its own words

| Step  | Statement                                                                         |
| ----- | --------------------------------------------------------------------------------- |
| Given | a voice and an encoding                                                           |
| When  | `create_audio` is called naming a model                                           |
| Then  | the model receives them under the names it uses, and nothing it was not asked for |

## `AU-005` The audio is linked rather than carried

| Step  | Statement                                               |
| ----- | ------------------------------------------------------- |
| Given | a model answering with a link to the audio it generated |
| When  | `create_audio` replies                                  |
| Then  | the reply carries that link as given                    |

## `AU-006` The encoding the stored audio is in

| Step  | Statement                                                    |
| ----- | ------------------------------------------------------------ |
| Given | a store saying what the audio is encoded as                  |
| When  | `create_audio` replies                                       |
| Then  | the link states that encoding, whatever the caller asked for |

## `AU-007` An encoding the store will not give

| Step  | Statement                                                     |
| ----- | ------------------------------------------------------------- |
| Given | a store that will not say, and a caller who named an encoding |
| When  | `create_audio` replies                                        |
| Then  | the link states the encoding the caller asked for             |

## `AU-008` A model answering without a link

| Step  | Statement                                                    |
| ----- | ------------------------------------------------------------ |
| Given | an answer carrying neither a link to the audio nor the audio |
| When  | `create_audio` replies                                       |
| Then  | the call fails                                               |

## `AU-009` An encoding nobody can give

| Step  | Statement                                                     |
| ----- | ------------------------------------------------------------- |
| Given | a store that will not say, and a caller who named no encoding |
| When  | `create_audio` replies                                        |
| Then  | the link states no encoding                                   |

## `AU-010` The audio stays where it is

| Step  | Statement                                    |
| ----- | -------------------------------------------- |
| Given | a store holding the audio that was generated |
| When  | `create_audio` asks what it is encoded as    |
| Then  | it asks for a single byte                    |

## `AU-011` The gateway a deployment names

| Step  | Statement                                 |
| ----- | ----------------------------------------- |
| Given | a deployment naming an AI Gateway         |
| When  | `create_audio` speaks                     |
| Then  | the model is reached through that gateway |

## `AU-012` The reply is also structured

| Step  | Statement                                                                  |
| ----- | -------------------------------------------------------------------------- |
| Given | a model answering with a link to the audio it generated                    |
| When  | `create_audio` replies                                                     |
| Then  | the structured content carries that link and the encoding the reply states |

## `AU-013` The tool says what it answers with

| Step  | Statement                                                    |
| ----- | ------------------------------------------------------------ |
| Given | an endpoint serving the tool                                 |
| When  | a client lists the tools                                     |
| Then  | `create_audio` states the shape of the reply it answers with |

## `AU-014` The link reaches the person who has to fetch it

| Step  | Statement                                                  |
| ----- | ---------------------------------------------------------- |
| Given | a model answering with a link to the audio it generated    |
| When  | `create_audio` replies                                     |
| Then  | the reply states that link in text, and how long it stands |

## `AU-015` A text longer than the model speaks

| Step  | Statement                                     |
| ----- | --------------------------------------------- |
| Given | a text longer than the chosen model will take |
| When  | `create_audio` is called                      |
| Then  | the call fails and nothing reaches the model  |

## `AU-016` A model that has to be told a voice

| Step  | Statement                                    |
| ----- | -------------------------------------------- |
| Given | `elevenlabs/eleven-v3` and no voice named    |
| When  | `create_audio` is called                     |
| Then  | the call fails and nothing reaches the model |

## `AU-017` A voice the model does not have

| Step  | Statement                                          |
| ----- | -------------------------------------------------- |
| Given | a voice outside the set the chosen model speaks as |
| When  | `create_audio` is called                           |
| Then  | the call fails and nothing reaches the model       |

## `AU-018` An encoding the model cannot store

| Step  | Statement                                    |
| ----- | -------------------------------------------- |
| Given | an encoding the chosen model does not store  |
| When  | `create_audio` is called                     |
| Then  | the call fails and nothing reaches the model |

## `AU-019` A speed the model cannot vary

| Step  | Statement                                         |
| ----- | ------------------------------------------------- |
| Given | a speed other than 1 and a model that cannot vary |
| When  | `create_audio` is called                          |
| Then  | the call fails and nothing reaches the model      |

## `AU-020` A speed that asks for no change

| Step  | Statement                                      |
| ----- | ---------------------------------------------- |
| Given | a speed of 1 and a model that cannot vary      |
| When  | `create_audio` is called                       |
| Then  | the model speaks, and is not asked for a speed |

## `AU-021` A refusal says the way out

| Step  | Statement                                              |
| ----- | ------------------------------------------------------ |
| Given | a request the chosen model cannot honour               |
| When  | `create_audio` refuses it                              |
| Then  | the reply says in text what would let the call through |

## `AU-022` The tool says what each model can be asked

| Step  | Statement                                                             |
| ----- | --------------------------------------------------------------------- |
| Given | an endpoint serving the tool                                          |
| When  | a client lists the tools                                              |
| Then  | `create_audio` states on each argument which models accept what of it |

## `AU-023` A speed outside what the model can reach

| Step  | Statement                                            |
| ----- | ---------------------------------------------------- |
| Given | a speed outside the range the chosen model speaks in |
| When  | `create_audio` is called                             |
| Then  | the call fails and nothing reaches the model         |

## `AU-024` Audio handed over in the answer

| Step  | Statement                                                        |
| ----- | ---------------------------------------------------------------- |
| Given | a model answering with the audio itself rather than a link to it |
| When  | `create_audio` replies                                           |
| Then  | the reply carries that audio, in the encoding the answer states  |

## `AU-025` Audio carried rather than linked says so

| Step  | Statement                                                        |
| ----- | ---------------------------------------------------------------- |
| Given | a model answering with the audio itself rather than a link to it |
| When  | `create_audio` replies                                           |
| Then  | the reply says in text that the audio is carried, not linked     |

## `AU-026` Structured content with no link to state

| Step  | Statement                                                        |
| ----- | ---------------------------------------------------------------- |
| Given | a model answering with the audio itself rather than a link to it |
| When  | `create_audio` replies                                           |
| Then  | the structured content carries the encoding alone                |

## `AU-027` An encoding the model already gives

| Step  | Statement                                          |
| ----- | -------------------------------------------------- |
| Given | `wav` and a model that has no word for an encoding |
| When  | `create_audio` is called                           |
| Then  | the model speaks, and is not asked for an encoding |
