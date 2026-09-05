#!/usr/bin/env bash
#
# Stop hook: before a turn ends, confirm that tests, specification and types
# still agree. Any one of them failing hands the result back for correction
# rather than carrying a broken state into the next turn.
#
# stdin carries Claude Code's hook input JSON; decision:"block" hands the turn
# back to the model.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TSC="$ROOT/node_modules/.bin/tsc"
VITEST="$ROOT/node_modules/.bin/vitest"

input="$(cat)"

# The previous turn was already blocked by this hook; blocking again leaves no exit
if [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ]; then
	exit 0
fi

cd "$ROOT" || exit 0

# A working tree matching HEAD has nothing to verify
if git rev-parse --verify HEAD >/dev/null 2>&1 && [ -z "$(git status --porcelain)" ]; then
	exit 0
fi

report=""

record() {
	report="${report}## ${1}"$'\n'"${2}"$'\n\n'
}

if [ -x "$TSC" ]; then
	if ! out="$("$TSC" --noEmit -p "$ROOT/tsconfig.json" 2>&1)"; then
		record "Type check (tsconfig.json)" "$out"
	fi
	if ! out="$("$TSC" --noEmit -p "$ROOT/test/tsconfig.json" 2>&1)"; then
		record "Type check (test/tsconfig.json)" "$out"
	fi
fi

if [ -x "$VITEST" ]; then
	if ! out="$("$VITEST" run 2>&1)"; then
		record "Tests (vitest run)" "$out"
	fi
fi

# sumi is an external tool; without it the specification cannot be compared,
# which is not the same as a failure
if command -v sumi >/dev/null 2>&1; then
	out="$(sumi verify 2>&1)"
	case "$?" in
	0) ;;
	1) record "Specification (sumi verify)" "$out" ;;
	*) record "Specification could not be verified (sumi verify)" "$out" ;;
	esac
fi

if [ -n "$report" ]; then
	jq -n --arg r "Quality gate failed before the turn ends; fix these first:"$'\n\n'"$report" \
		'{decision: "block", reason: $r}'
fi
