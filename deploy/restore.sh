#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Восстановление из бэкапа. ОПАСНО: перезаписывает текущие данные.
# Запуск от root:
#     bash deploy/restore.sh                       # показать доступные копии
#     bash deploy/restore.sh db_2026-05-30_03-30-00.sql.gz   # восстановить БД
#     bash deploy/restore.sh uploads_2026-05-30_03-30-00.tar.gz  # восстановить файлы
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/var/www/aladdin-travel-pay"
ENV_FILE="$APP_DIR/backend/.env"
UPLOADS_DIR="$APP_DIR/backend/uploads"
BACKUP_DIR="/var/backups/aladdin"
APP_USER="aladdin"

[[ $EUID -eq 0 ]] || { echo "Запусти от root:  sudo bash deploy/restore.sh" >&2; exit 1; }

FILE="${1:-}"

if [[ -z "$FILE" ]]; then
  echo "Доступные копии в $BACKUP_DIR:"
  ls -lh "$BACKUP_DIR" 2>/dev/null | tail -n +2 | awk '{print "  " $9 "  " $5 "  " $6 " " $7 " " $8}'
  echo ""
  echo "Использование:"
  echo "  bash deploy/restore.sh <имя_файла_из_списка>"
  exit 0
fi

PATH_FULL="$BACKUP_DIR/$FILE"
[[ -f "$PATH_FULL" ]] || { echo "Файл не найден: $PATH_FULL" >&2; exit 1; }

DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)"

read -r -p "Это перезапишет текущие данные. Продолжить? (введите yes): " CONFIRM
[[ "$CONFIRM" == "yes" ]] || { echo "Отменено."; exit 0; }

case "$FILE" in
  db_*.sql.gz)
    echo "Восстанавливаю базу из $FILE ..."
    gunzip -c "$PATH_FULL" | psql "$DB_URL"
    echo "База восстановлена."
    ;;
  uploads_*.tar.gz)
    echo "Восстанавливаю файлы из $FILE ..."
    mkdir -p "$UPLOADS_DIR"
    tar -xzf "$PATH_FULL" -C "$UPLOADS_DIR"
    chown -R "$APP_USER:$APP_USER" "$UPLOADS_DIR"
    echo "Файлы восстановлены."
    ;;
  *)
    echo "Не пойму тип файла. Имя должно начинаться с db_ или uploads_." >&2
    exit 1
    ;;
esac

echo "Перезапусти бэкенд, если восстанавливал БД:  systemctl restart aladdin-backend"
