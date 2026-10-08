# creator-kit

An MCP server on Cloudflare Workers that turns a prompt into an image and text
into speech, using Workers AI.

A model most often stores what it made and answers with a presigned link that
stands for about a day, and the reply hands that link on as given, or a link to
the deployment's own copy where it [keeps one](#backup) — as a
resource link, as structured content, and as text, because a different reader
needs each one. Nothing generated passes through the Worker to do that; it does
only where a deployment [asks for backups](#backup), and then each file streams
through on its way to that deployment's own bucket. Audio a model hands over in
its answer instead has no link of its own, so only a deployment keeping copies
can hand it on, through the link to its copy.

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
| `name`         | the time of day alone        | What to call this file where the deployment [keeps copies](#backup), and offered only there. Up to 64 characters, and no slashes                                       |

Google's tiers run `google/nano-banana-pro`, `google/nano-banana-2`, then
`google/nano-banana-2.1` and `google/nano-banana-2-lite` from dearest to
cheapest; of the last two, only `google/nano-banana-2.1` generates above `1K`.
Of the GPT Image models, `openai/gpt-image-2.5-flare` is the faster and
`openai/gpt-image-2.5-sunburst` the more capable. What each costs on an account is on the Cloudflare dashboard.

### `create_audio`

Speak text aloud with a text-to-speech model.

| Argument | Default                                                                        | Accepts                                                                                                                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`   | —                                                                              | What should be spoken, word for word. Required. How a model can be steered through it is in the [guides](#read_guide)                                                                                                                        |
| `model`  | `google/gemini-3.8-flash-lite-tts`, or `openai/tts-1` where no copies are kept | `openai/tts-1`, `elevenlabs/eleven-v3`, and where the deployment [keeps copies](#backup), `google/gemini-3.8-flash-tts` and `google/gemini-3.8-flash-lite-tts`                                                                               |
| `voice`  | the model's own                                                                | `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer` for `openai/tts-1`; one of the 30 named in the tool's own schema, such as `Kore` or `Puck`, for the Gemini models; an ElevenLabs voice ID for `elevenlabs/eleven-v3`, which requires one |
| `format` | the model's own                                                                | `mp3`, `opus`, `wav`, `aac`, `flac`; `elevenlabs/eleven-v3` stores only `mp3` and `opus`, the Gemini models only `wav`                                                                                                                       |
| `speed`  | the model's own                                                                | `0.25` to `4`, and only `openai/tts-1` can vary it                                                                                                                                                                                           |
| `name`   | the time of day alone                                                          | What to call this file where the deployment [keeps copies](#backup), and offered only there. Up to 64 characters, and no slashes                                                                                                             |

`google/gemini-3.8-flash-lite-tts` speaks Mandarin closest to how people in
Taiwan do, and `google/gemini-3.8-flash-tts` pronounces most exactly at a higher
price. `openai/tts-1` is charged by the character where the Gemini models are
charged by the second, so it is the cheapest for Chinese. The Gemini models
only ever hand their audio over in the answer, so they are offered only where a
copy can be kept to link to it.

An argument is named for what the caller is choosing, never for what one model
happens to call it; each model is asked in its own words at the moment the
request is made. A request the chosen model cannot honour is refused before it
is sent, and the refusal names what would let the call through.

### `read_guide`

Read how to use the other tools beyond what their own descriptions say.

| Argument | Default | Accepts                                                                        |
| -------- | ------- | ------------------------------------------------------------------------------ |
| `name`   | —       | `gemini-tts`, on steering how the Gemini text-to-speech models speak. Required |

A tool's description is read on every listing, so it holds only what every call
needs; longer know-how lives in guides, read on asking the way an agent skill
is. Each guide is a Markdown file in `src/guides/` whose front matter gives its
name and one line on what it is for — the line the tool lists it by. Adding one
is that file and an import in `src/guide.ts`. A guide says what was heard to
work, and where that rests on behaviour a provider does not document.

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

| Name                                                        | Where                         | Purpose                                                                                                                                                       |
| ----------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AI_GATEWAY`                                                | a secret; `.dev.vars` locally | The AI Gateway inference is reached through, which decides how it is billed and rate limited. Leave it unset and the account's default gateway answers.       |
| `BACKUP`                                                    | a secret; `.dev.vars` locally | Whether a generated file is copied into the bucket as well as linked. Only `yes` turns it on; anything else, unset included, leaves it off.                   |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | a secret; `.dev.vars` locally | The account and an R2 API token, which sign the link to a [copy](#backup). Object Read only, scoped to this bucket, is enough: writes go through the binding. |
| `R2_BUCKET_NAME`                                            | a secret; `.dev.vars` locally | The bucket `BUCKET` is bound to, as the R2 page names it — usually `<Worker name>-bucket`.                                                                    |
| `TZ`                                                        | a secret; `.dev.vars` locally | The time zone the date in a backup's path is read in, as an IANA name such as `Asia/Taipei`. Unset, or naming no real zone, reads it in UTC.                  |

`wrangler.jsonc` deliberately declares none of these: a var of the same name is
uploaded over the secret on every deploy. Set each with
`wrangler secret put <NAME>`, and `env.d.ts` is what types them.

## Access

Cloudflare Access is attached to the Worker rather than to a hostname, so every
way in is covered by the one application. The `/mcp` endpoint answers 401 to any
request Access did not match, which is what makes Managed OAuth safe to enable
in front of it. Locally, the `access.dev` block in `wrangler.jsonc` stands in
for one.

| Address               | Open | Why                                                                                                                                                               |
| --------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom Domain, routes | yes  | Where callers reach the server                                                                                                                                    |
| Preview URLs          | yes  | Created per version by the platform                                                                                                                               |
| `workers.dev`         | no   | Nothing reaches the server through it, and `wrangler dev` cannot authenticate through it either, since Managed OAuth answers it 401 rather than with a login page |

## Backup

A model's link stands for about a day, and audio a model hands over in its
answer has no link at all. A deployment that wants what was generated to outlive that sets
`BACKUP` to `yes`, and every generated file is copied into its bucket on the way
out; the reply then links to the copy, presigned for a day through R2's S3 API.
Signing takes an R2 API token and the bucket's name, which the binding cannot
say: the first deploy names it after the Worker as the dashboard names it, so
it is usually `<Worker name>-bucket`. Without all
four signing secrets nothing is copied. A copy that cannot be made says why in
the log and leaves the model's own link in the reply, because the caller has
already paid for the generation; audio handed over has no such link, so that
call fails instead.

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
