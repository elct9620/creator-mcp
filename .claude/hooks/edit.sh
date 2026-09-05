#!/usr/bin/env bash
#
# PostToolUse hook：剛寫入的檔案立即符合專案的格式與型別約定，
# 讓後續的每一步都建立在已經正確的檔案上，而不是留到回合結束才發現。
#
# stdin 為 Claude Code 的 hook 輸入 JSON；exit 2 會把 stderr 回饋給模型要求修正。

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PRETTIER="$ROOT/node_modules/.bin/prettier"
TSC="$ROOT/node_modules/.bin/tsc"

file="$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')"
[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

# 專案外的檔案不套用本專案的規則
case "$file" in
"$ROOT"/*) ;;
*) exit 0 ;;
esac

# --ignore-unknown 讓 prettier 自行跳過它不認得的副檔名
[ -x "$PRETTIER" ] && "$PRETTIER" --ignore-unknown --write "$file" >/dev/null 2>&1

# 規格有自己的正規形式，prettier 只管到排版為止。
# sumi fmt 作用於整個 .spec/，所以只在規格本身被改動時才跑。
case "$file" in
"$ROOT"/.spec/*)
	if command -v sumi >/dev/null 2>&1; then
		if ! out="$(cd "$ROOT" && sumi fmt 2>&1)"; then
			printf '規格無法正規化：\n%s\n' "$out" >&2
			exit 2
		fi
	fi
	;;
esac

# 型別檢查只對 TypeScript 有意義
case "$file" in
*.ts | *.tsx | *.mts | *.cts) ;;
*) exit 0 ;;
esac
[ -x "$TSC" ] || exit 0

# test/ 有自己的 tsconfig（cloudflare:test 型別），與 src/ 分開檢查
case "$file" in
"$ROOT"/test/*) project="$ROOT/test/tsconfig.json" ;;
*) project="$ROOT/tsconfig.json" ;;
esac

if ! out="$("$TSC" --noEmit -p "$project" 2>&1)"; then
	printf '型別檢查未通過（%s）：\n%s\n' "${project#"$ROOT"/}" "$out" >&2
	exit 2
fi
