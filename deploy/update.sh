#!/usr/bin/env bash
# Cập nhật phiên bản mới: kéo code, backup, build lại, khởi động lại.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
./deploy/backup.sh || echo "Bỏ qua backup (chưa có container?)"
docker compose up -d --build
docker compose ps
