#!/usr/bin/env bash
# Sao lưu nhất quán database SQLite (VACUUM INTO) vào ./backups, giữ 14 bản gần nhất.
# Chạy từ thư mục dự án. Cron gợi ý (mỗi ngày 3h sáng):
#   0 3 * * * cd /home/ubuntu/WebTruyen && ./deploy/backup.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
STAMP=$(date +%Y%m%d-%H%M%S)
docker compose exec -T app node -e "
const { DatabaseSync } = require('node:sqlite');
new DatabaseSync('/data/truyen.db').exec(\"VACUUM INTO '/data/backup-$STAMP.db'\");" 2>/dev/null
mv "data/backup-$STAMP.db" "backups/truyen-$STAMP.db"
gzip "backups/truyen-$STAMP.db"
ls -1t backups/truyen-*.db.gz | tail -n +15 | xargs -r rm --
echo "$(date -Is) ok backups/truyen-$STAMP.db.gz"
