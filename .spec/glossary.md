# Glossary

The words this project keeps, and the ones it turns down in their place.

## speaker

One model's account of how much of a tool's vocabulary it answers to, and what
it calls each part of it: how long a text it takes, whether it brings a voice or
has to be told one, which encodings it can store, whether it can be asked to
speak faster.

A speaker is what lets a single flat schema stay honest across providers that
disagree. It is not a voice, and not a model — a model is what is named in a
call, a speaker is what this application knows about that model.

## voice

Who is speaking. Every model asks for one, and they do not ask alike:
`openai/tts-1` draws from a closed set of names it was trained with,
`elevenlabs/eleven-v3` takes an identifier from an open library and has no
default to fall back on.

Turned down as words a caller has to say: `voice_id`, the ElevenLabs spelling.
A caller says `voice` whichever model is speaking, and the speaker for that
model translates.

## format

The encoding a generated file is stored in, said in the plainest name for it —
`mp3`, `opus`, `wav`.

Turned down as words a caller has to say: `response_format`, the OpenAI
spelling, and ElevenLabs' `output_format`, which is not only another name but
another value space, folding a sample rate and a bitrate into the same string.
A caller names the encoding and nothing else; what a sample rate should be is
the speaker's answer, not theirs.
