#!/usr/bin/env bash
#
# PostToolUse hook: bring a file just written in line with the project's
# formatting and type rules, so every later step builds on a correct file
# rather than discovering the problem at the end of the turn.
#
# stdin carries Claude Code's hook input JSON; exit 2 hands stderr back to the
# model for correction.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PRETTIER="$ROOT/node_modules/.bin/prettier"
TSC="$ROOT/node_modules/.bin/tsc"

file="$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')"
[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

# A file outside the project does not answer to the project's rules
case "$file" in
"$ROOT"/*) ;;
*) exit 0 ;;
esac

# --ignore-unknown lets prettier skip the extensions it does not recognize
[ -x "$PRETTIER" ] && "$PRETTIER" --ignore-unknown --write "$file" >/dev/null 2>&1

# A specification has a normal form of its own, which prettier only reaches the
# layout of. sumi fmt acts on the whole of .spec/, so it runs only when a
# specification is what changed.
case "$file" in
"$ROOT"/.spec/*)
	if command -v sumi >/dev/null 2>&1; then
		if ! out="$(cd "$ROOT" && sumi fmt 2>&1)"; then
			printf 'Specification could not be normalized:\n%s\n' "$out" >&2
			exit 2
		fi
	fi
	;;
esac

# Type checking only means something for TypeScript
case "$file" in
*.ts | *.tsx | *.mts | *.cts) ;;
*) exit 0 ;;
esac
[ -x "$TSC" ] || exit 0

# test/ carries its own tsconfig for the cloudflare:test types, checked apart from src/
case "$file" in
"$ROOT"/test/*) project="$ROOT/test/tsconfig.json" ;;
*) project="$ROOT/tsconfig.json" ;;
esac

if ! out="$("$TSC" --noEmit -p "$project" 2>&1)"; then
	printf 'Type check failed (%s):\n%s\n' "${project#"$ROOT"/}" "$out" >&2
	exit 2
fi
