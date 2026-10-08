---
name: gemini-tts
description: How to steer the way google/gemini-3.8-flash-tts and google/gemini-3.8-flash-lite-tts speak — pace, volume, pitch, emotion — and what cannot be steered.
---

# Speaking with the Gemini models

A Gemini model takes the whole of `text` as something to say. It has no
separate field for how to say it that this server can pass on, so everything
below is written into `text` itself.

## Name a voice to keep the same speaker

With no `voice`, each call is spoken by a different voice. Name one — `Kore`,
`Puck`, `Charon` and the rest listed on `create_audio` — and that voice speaks,
its gender included.

## Pauses and human sounds

A tag in angle brackets is performed rather than read:

| Tag             | What it does      |
| --------------- | ----------------- |
| `<short pause>` | a brief pause     |
| `<long pause>`  | a longer pause    |
| `<laugh>`       | a laugh           |
| `<sigh>`        | a sigh            |
| `<breath>`      | an audible breath |
| `<cough>`       | a cough           |

Keep the tags in English whatever language the text is in.

## Delivery: an audio profile

A plain instruction in front of the text is read aloud with it —
`Say this cheerfully: …` comes out as those words. What has been heard to work
instead is a structured profile ahead of the transcript:

```
Read the following transcript based on the audio profile.
# Audio Profile
## Language:
 Speak in zh-TW.
## Character:
 Speak as someone telling a secret late at night.
## Emotion:
 Express nervous, hushed emotion.
## Delivery:
 Whisper very softly and very slowly, with long pauses between phrases.
## Transcript:
<the words to speak>
```

What a profile changes, as heard on both models:

| Asked for                           | Result                               |
| ----------------------------------- | ------------------------------------ |
| Whispering, slowly                  | Whispered, and about 60% longer      |
| High-pitched, energetic, anime-like | Higher pitch, somewhat anime-like    |
| An accent (Japanese, Taiwanese)     | No audible change                    |
| A character of a given gender       | That gender, even over a named voice |

So a profile steers delivery — pace, volume, pitch, emotion — but not accent.
Words that give the character a gender (`actress`, `heroine`, `actor`, `hero`)
override the voice's own; leave them out to keep the voice as named.

Two cautions. The profile rests on behaviour Google does not document — its own
documentation says the text is spoken word for word — so it may stop working
when the model changes. And it does not hold for every wording: a profile whose
character line was only `Speak as a cheerful character in a Japanese anime.`
had part of itself read aloud. Keep each section as concrete as the example
above, and listen to the result before relying on it.
