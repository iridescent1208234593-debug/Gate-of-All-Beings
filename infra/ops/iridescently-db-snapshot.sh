#!/bin/bash
# 每日数据库一致性快照（只读，不修改生产数据）
set -u
BASE=/root/dsh-backups/daily
DAY=$(date +%Y%m%d)
OUT="$BASE/$DAY"
LOG=/var/log/iridescently-snapshot.log
D=/srv/iridescently/data
KEEP=14

mkdir -p "$OUT"
echo "[$(date '+%F %T')] snapshot start -> $OUT" >> "$LOG"

snap() {
  [ -f "$1" ] || return 0
  local n; n=$(basename "$1")
  if sqlite3 "file:$1?mode=ro" ".backup '$OUT/$n'" 2>>"$LOG"; then
    local ok rows
    ok=$(sqlite3 "$OUT/$n" 'PRAGMA integrity_check;' 2>&1)
    rows=""
    case "$n" in
      users.db) rows="local_users=$(sqlite3 "$OUT/$n" 'select count(*) from local_users;' 2>&1)" ;;
    esac
    echo "  OK $n $(du -h "$OUT/$n" | cut -f1) integrity=$ok $rows" >> "$LOG"
  else
    echo "  FAIL $n" >> "$LOG"
  fi
}

snap "$D/portal/huiguan/users.db"
snap "$D/data/homepage-gallery.sqlite3"
snap "$D/assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db"
snap "$D/server/app/src/cards/update-feedback.sqlite3"

# 轮转：只保留最近 KEEP 天
find "$BASE" -maxdepth 1 -type d -name '20*' | sort | head -n -$KEEP | while read -r old; do
  rm -rf "$old" && echo "  rotated out $(basename "$old")" >> "$LOG"
done

echo "[$(date '+%F %T')] done, dirs=$(ls -1d "$BASE"/20* 2>/dev/null | wc -l)" >> "$LOG"
