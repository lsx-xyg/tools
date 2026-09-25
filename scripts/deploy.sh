#!/usr/bin/env bash
# 本地部署入口：从环境变量注入 KV namespace id（仓库中只存占位符，避免公开泄露）
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${TRANSFER_KV_ID:-}" ]; then
  echo "❌ 缺少环境变量 TRANSFER_KV_ID"
  echo "  获取你的 KV namespace id:  npx wrangler kv namespace list"
  echo "  用法:  TRANSFER_KV_ID=<你的id> ./scripts/deploy.sh"
  echo "  或:    export TRANSFER_KV_ID=<你的id> 后再执行 ./scripts/deploy.sh"
  exit 1
fi

TMP=$(mktemp /tmp/wrangler.deploy.XXXXXX.jsonc)
trap 'rm -f "$TMP"' EXIT
sed "s/TRANSFER_KV_ID_PLACEHOLDER/${TRANSFER_KV_ID}/" wrangler.jsonc > "$TMP"

echo "▸ 构建 OpenNext 产物…"
npx opennextjs-cloudflare build

echo "▸ 部署到 Cloudflare Workers（临时配置已注入 KV id，不入库）…"
npx wrangler deploy --config "$TMP"

echo "✓ 部署完成"
