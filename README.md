# creator-kit

An MCP server on Cloudflare Workers that turns a prompt into an image and text
into speech, using Workers AI.

Nothing generated passes through the Worker. Each model stores what it made and
answers with a presigned link that stands for about a day, and the reply hands
that link on as given — as a resource link, as structured content, and as text,
because a different reader needs each one.

## Tools

### `create_image`

Generate an image from a prompt.

| Argument       | Default                | Accepts                                                                       |
| -------------- | ---------------------- | ----------------------------------------------------------------------------- |
| `prompt`       | —                      | What the image should show. Required.                                         |
| `model`        | `google/nano-banana-2` | `google/nano-banana-pro`, `google/nano-banana-2`, `google/nano-banana-2-lite` |
| `aspect_ratio` | the model's own        | `1:1`, `3:2`, `2:3`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`       |
| `format`       | the model's own        | `jpg`, `png`, `webp`; only `google/nano-banana-pro` stores `webp`             |
| `resolution`   | `1K`                   | `1K`, `2K`, `4K`; `google/nano-banana-2-lite` generates `1K` alone            |

The provider's tiers run `google/nano-banana-pro`, `google/nano-banana-2`,
`google/nano-banana-2-lite` from dearest to cheapest; what each costs on an
account is on the Cloudflare dashboard.

### `create_audio`

Speak text aloud with a text-to-speech model.

| Argument | Default         | Accepts                                                                                                                                       |
| -------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`   | —               | What should be spoken. Required.                                                                                                              |
| `model`  | `openai/tts-1`  | `openai/tts-1`, `elevenlabs/eleven-v3`                                                                                                        |
| `voice`  | the model's own | `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer` for `openai/tts-1`; an ElevenLabs voice ID for `elevenlabs/eleven-v3`, which requires one |
| `format` | the model's own | `mp3`, `opus`, `wav`, `aac`, `flac`; `elevenlabs/eleven-v3` stores only `mp3` and `opus`                                                      |
| `speed`  | the model's own | `0.25` to `4`, and only `openai/tts-1` can vary it                                                                                            |

An argument is named for what the caller is choosing, never for what one model
happens to call it; each model is asked in its own words at the moment the
request is made. A request the chosen model cannot honour is refused before it
is sent, and the refusal names what would let the call through.

## Requirements

- Node.js 24 and pnpm (the version is pinned by `packageManager`)
- A Cloudflare account with Workers AI

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

`wrangler.jsonc` deliberately declares no `AI_GATEWAY`: a var of that name is
uploaded over the secret on every deploy. Set it with
`wrangler secret put AI_GATEWAY`, and `env.d.ts` is what types it.

## Access

Cloudflare Access is attached to the Worker rather than to a hostname, so it
covers every route, preview and Custom Domain, and `workers.dev` is closed. The
`/mcp` endpoint answers 401 to any request Access did not match, which is what
makes Managed OAuth safe to enable in front of it. Locally, the `access.dev`
block in `wrangler.jsonc` stands in for one.

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
