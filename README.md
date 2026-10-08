# creator-kit

An MCP server on Cloudflare Workers that turns a prompt into an image and text
into speech, using Workers AI.

A model most often stores what it made and answers with a presigned link that
stands for about a day, and the reply hands that link on as given — as a
resource link, as structured content, and as text, because a different reader
needs each one. Nothing generated passes through the Worker to do that; it does
only where a deployment [asks for backups](#backup), and then each file streams
through on its way to that deployment's own bucket. Audio a model hands over in
its answer instead is carried in the reply as audio content, since there is no
link to give.

## Tools

### `create_image`

Generate an image from a prompt.

| Argument       | Default                      | Accepts                                                                                                                                                                |
| -------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`       | —                            | What the image should show. Required.                                                                                                                                  |
| `model`        | `google/nano-banana-2.1`     | `google/nano-banana-pro`, `google/nano-banana-2`, `google/nano-banana-2.1`, `google/nano-banana-2-lite`, `openai/gpt-image-2.5-flare`, `openai/gpt-image-2.5-sunburst` |
| `aspect_ratio` | the model's own              | `1:1`, `3:2`, `2:3`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`; the GPT Image models draw `1:1`, `2:3` and `3:2` alone                                        |
| `format`       | the model's own              | `jpg`, `png`, `webp`; only `google/nano-banana-pro` and the GPT Image models store `webp`                                                                              |
| `resolution`   | `1K`                         | `1K`, `2K`, `4K`; `google/nano-banana-2-lite` and the GPT Image models generate `1K` alone                                                                             |
| `quality`      | `low`, where it can be named | `low`, `medium`, `high`, `xhigh`, `max`, `auto`; only the GPT Image models take one                                                                                    |
| `background`   | the model's own              | `transparent`, `opaque`; only the GPT Image models leave it transparent, and never as `jpg`                                                                            |
| `name`         | the time of day alone        | What to call this file where the deployment [keeps copies](#backup). Up to 64 characters, and no slashes                                                               |

Google's tiers run `google/nano-banana-pro`, `google/nano-banana-2`, then
`google/nano-banana-2.1` and `google/nano-banana-2-lite` from dearest to
cheapest; of the last two, only `google/nano-banana-2.1` generates above `1K`.
Of the GPT Image models, `openai/gpt-image-2.5-flare` is the faster and
`openai/gpt-image-2.5-sunburst` the more capable. What each costs on an account is on the Cloudflare dashboard.

### `create_audio`

Speak text aloud with a text-to-speech model.

| Argument | Default                            | Accepts                                                                                                                                                                                                                                      |
| -------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`   | —                                  | What should be spoken, word for word. Required. The Gemini models perform tags such as `<short pause>` or `<laugh>` in it                                                                                                                    |
| `model`  | `google/gemini-3.8-flash-lite-tts` | `openai/tts-1`, `elevenlabs/eleven-v3`, `google/gemini-3.8-flash-tts`, `google/gemini-3.8-flash-lite-tts`                                                                                                                                    |
| `voice`  | the model's own                    | `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer` for `openai/tts-1`; one of the 30 named in the tool's own schema, such as `Kore` or `Puck`, for the Gemini models; an ElevenLabs voice ID for `elevenlabs/eleven-v3`, which requires one |
| `format` | the model's own                    | `mp3`, `opus`, `wav`, `aac`, `flac`; `elevenlabs/eleven-v3` stores only `mp3` and `opus`, the Gemini models only `wav`                                                                                                                       |
| `speed`  | the model's own                    | `0.25` to `4`, and only `openai/tts-1` can vary it                                                                                                                                                                                           |
| `name`   | the time of day alone              | What to call this file where the deployment [keeps copies](#backup). Up to 64 characters, and no slashes                                                                                                                                     |

`google/gemini-3.8-flash-lite-tts` speaks Mandarin closest to how people in
Taiwan do, and `google/gemini-3.8-flash-tts` pronounces most exactly at a higher
price. `openai/tts-1` is charged by the character where the Gemini models are
charged by the second, so it is the cheapest for Chinese.

An argument is named for what the caller is choosing, never for what one model
happens to call it; each model is asked in its own words at the moment the
request is made. A request the chosen model cannot honour is refused before it
is sent, and the refusal names what would let the call through.

## Requirements

- Node.js 24 and pnpm (the version is pinned by `packageManager`)
- A Cloudflare account with Workers AI and R2 — the bucket backups go in is
  created by the first deploy, so nothing has to be made by hand

## Getting started

```sh
git clone git@github.com:elct9620/creator-mcp.git
cd creator-mcp
pnpm install
cp .dev.vars.example .dev.vars
pnpm dev
```

The endpoint is then at `http://localhost:8787/mcp`, speaking Streamable HTTP.

Workers AI has no local simulation: every call `wrangler dev` makes reaches the
account and is billed. The test suite closes remote bindings off and injects a
fake AI instead, so `pnpm test:run` costs nothing.

## Configuration

| Name         | Where                         | Purpose                                                                                                                                                 |
| ------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AI_GATEWAY` | a secret; `.dev.vars` locally | The AI Gateway inference is reached through, which decides how it is billed and rate limited. Leave it unset and the account's default gateway answers. |
| `BACKUP`     | a secret; `.dev.vars` locally | Whether a generated file is copied into the bucket as well as linked. Only `yes` turns it on; anything else, unset included, leaves it off.             |
| `TZ`         | a secret; `.dev.vars` locally | The time zone the date in a backup's path is read in, as an IANA name such as `Asia/Taipei`. Unset, or naming no real zone, reads it in UTC.            |

`wrangler.jsonc` deliberately declares none of these: a var of the same name is
uploaded over the secret on every deploy. Set each with
`wrangler secret put <NAME>`, and `env.d.ts` is what types them.

## Access

Cloudflare Access is attached to the Worker rather than to a hostname, so every
way in is covered by the one application. The `/mcp` endpoint answers 401 to any
request Access did not match, which is what makes Managed OAuth safe to enable
in front of it. Locally, the `access.dev` block in `wrangler.jsonc` stands in
for one.

| Address               | Guarded | Why it is open                                                                                          |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| Custom Domain, routes | yes     | Where callers reach the server                                                                          |
| `workers.dev`         | yes     | What `wrangler dev` identifies the Access application by, so a local session can reach a remote binding |
| Preview URLs          | yes     | Created per version by the platform                                                                     |

## Backup

A model's link stands for about a day, and audio carried in a reply is kept
nowhere at all. A deployment that wants what was generated to outlive that sets
`BACKUP` to `yes`, and every generated file is copied into its bucket on the way
out while the reply goes on as it would have without one. A copy that cannot be made says why in the log and changes
nothing the caller sees, because they have already paid for the generation.

| Part of `backup/{user}/{date}/{name}` | What it holds                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `backup/`                             | One prefix, so whatever the bucket comes to hold besides copies can still say what it is |
| `{user}`                              | The first sixteen hex digits of the SHA-256 of the caller's Access email address         |
| `{date}`                              | The caller's day, read in the zone `TZ` names                                            |
| `{name}`                              | The time of day, four random characters, and the encoding the file was really stored in  |

How long copies are kept is the bucket's answer rather than this Worker's. One
[object lifecycle rule](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
on the bucket deletes everything past the age you name — the date in the path
is there for a person browsing, not for that rule, which reads an object's own
age instead.

## Development

| Command           | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `pnpm dev`        | Local development                                          |
| `pnpm test:run`   | Run the tests once — `pnpm test` watches                   |
| `pnpm format`     | Format the working tree                                    |
| `pnpm cf-typegen` | Regenerate `Env` after changing bindings in wrangler.jsonc |
| `pnpm deploy`     | Publish from a working copy                                |
| `sumi verify`     | Check the source against `.spec/`                          |

`.spec/` is where this project's vocabulary and behaviour are settled, and
[`sumi`](https://github.com/elct9620/sumitsubo) checks the source against it.
Read it before changing behaviour, and record a decision there rather than only
in code. CI runs formatting, both TypeScript projects, the tests and `sumi
verify` on every push and pull request.

Deployment happens through Cloudflare Workers Builds when `main` moves, so
there is no deploy workflow in this repository.

## License

[MIT](LICENSE)
