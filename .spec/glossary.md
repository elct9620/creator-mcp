# Glossary

The words this project keeps, and the ones it turns down in their place.

## How an argument is named

A tool's argument is named for what the caller is choosing, in the plainest
word for that, and independently of how many models serve it or what any of
them calls it. A provider's spelling never reaches the caller; the translation
happens where the model is asked.

Written down because the alternative is not neutral. Naming an argument after
the one model that happens to serve it today reads as no decision at all, and
then a second model arrives and the name has to change — a rename the caller
pays for, to record something that was never theirs to know.

## painter

One model's account of how much of a tool's vocabulary it answers to, and what
it calls each part of it: which encodings it can store, which shapes it can
draw, which resolutions it can produce, and what it calls each of them.

A painter is the same kind of account a speaker gives, for a model that paints
rather than speaks, and it is what lets a single flat schema stay honest across
models that disagree: `google/nano-banana-pro` asks for `image_size` and can
store webp, `google/nano-banana-2` asks for `resolution` and cannot, and a GPT
Image model asks for a size in pixels where the others ask for a shape. It is
not a style, and not a model — a model is what is named in a call, a painter
is what this application knows about that model.

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
`mp3`, `opus`, `wav`, `jpg`, `png`.

Turned down is first a value space: ElevenLabs folds a sample rate and a
bitrate into the same string, `mp3_44100_128`. A caller names the encoding and
nothing else; what a sample rate should be is the speaker's answer, not theirs.
Turned down as well is `jpeg`, the spelling OpenAI's models take: a caller says
`jpg` whichever model stores it.

## aspect ratio

The shape of an image, said as its width to its height — `1:1`, `3:2`.

Turned down is `size`, a width and a height in pixels, which is how a GPT Image
model is asked. A caller names the shape and the resolution; which pixels those
come to is the painter's answer, not theirs.
