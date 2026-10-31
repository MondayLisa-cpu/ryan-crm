#!/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo '請先安裝 Node.js 24 LTS：https://nodejs.org/'
  read -r -p '按 Enter 關閉。'
  exit 1
fi
node crm/scripts/local/preview.mjs
