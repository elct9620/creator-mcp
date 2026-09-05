#!/usr/bin/env bash
#
# Stop hook：回合結束前，確認測試、規格與型別三者仍然一致。
# 任何一項失敗就把結果交回模型修正，避免把破損的狀態留給下一個回合。
#
# stdin 為 Claude Code 的 hook 輸入 JSON；輸出 decision:"block" 會讓模型接手修正。

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TSC="$ROOT/node_modules/.bin/tsc"
VITEST="$ROOT/node_modules/.bin/vitest"

input="$(cat)"

# 上一輪已由本 hook 擋下並要求修正，再擋一次就沒有出口了
if [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ]; then
	exit 0
fi

cd "$ROOT" || exit 0

# 工作樹相對 HEAD 完全乾淨時沒有東西需要驗證
if git rev-parse --verify HEAD >/dev/null 2>&1 && [ -z "$(git status --porcelain)" ]; then
	exit 0
fi

report=""

record() {
	report="${report}## ${1}"$'\n'"${2}"$'\n\n'
}

if [ -x "$TSC" ]; then
	if ! out="$("$TSC" --noEmit -p "$ROOT/tsconfig.json" 2>&1)"; then
		record "型別檢查（tsconfig.json）" "$out"
	fi
	if ! out="$("$TSC" --noEmit -p "$ROOT/test/tsconfig.json" 2>&1)"; then
		record "型別檢查（test/tsconfig.json）" "$out"
	fi
fi

if [ -x "$VITEST" ]; then
	if ! out="$("$VITEST" run 2>&1)"; then
		record "測試（vitest run）" "$out"
	fi
fi

# sumi 為外部工具，未安裝時規格驗證無從進行，不視為失敗
if command -v sumi >/dev/null 2>&1; then
	out="$(sumi verify 2>&1)"
	case "$?" in
	0) ;;
	1) record "規格驗證（sumi verify）" "$out" ;;
	*) record "規格無法驗證（sumi verify）" "$out" ;;
	esac
fi

if [ -n "$report" ]; then
	jq -n --arg r "回合結束前的品質關卡未通過，請先修正："$'\n\n'"$report" \
		'{decision: "block", reason: $r}'
fi
