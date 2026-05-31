#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Резервное копирование Aladdin Travel Pay: база PostgreSQL + загруженные файлы.
# Хранит копии локально на сервере с ротацией (старые удаляются).
#
# Ручной запуск (от root):
#     bash /var/www/aladdin-travel-pay/deploy/backup.sh
#
# Автоматический запуск настраивается через cron (см. deploy/install-backup-cron.sh).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/var/www/aladdin-travel-pay"
ENV_FILE="$APP_DIR/backend/.env"
UPLOADS_DIR="$APP_DIR/backend/uploads"
BACKUP_DIR="/var/backups/aladdin"
KEEP_DAYS="${KEEP_DAYS:-14}"          # сколько дней хранить копии
DB_NAME="${DB_NAME:-aladdin}"
DB_USER="${DB_USER:-aladdin}"

# Метка времени в имени файла. Без двоеточий (несовместимы с некоторыми ФС).
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"

log() { echo -e "\n\033[1;32m==> $*\033[0m"; }

[[ $EUID -eq 0 ]] || { echo "Запусти от root:  sudo bash deploy/backup.sh" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"

# Достаём пароль БД из backend/.env (строка DATABASE_URL).
if [[ -f "$ENV_FILE" ]]; then
  DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)"
else
  echo "Не найден $ENV_FILE" >&2; exit 1
fi

log "Бэкап базы данных ($DB_NAME)"
DB_FILE="$BACKUP_DIR/db_${STAMP}.sql.gz"
# pg_dump через DATABASE_URL — не зависит от системного пользователя postgres.
pg_dump "$DB_URL" | gzip > "$DB_FILE"
echo "  → $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

log "Бэкап загруженных файлов"
FILES_FILE="$BACKUP_DIR/uploads_${STAMP}.tar.gz"
if [[ -d "$UPLOADS_DIR" ]] && [[ -n "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]]; then
  tar -czf "$FILES_FILE" -C "$UPLOADS_DIR" .
  echo "  → $FILES_FILE ($(du -h "$FILES_FILE" | cut -f1))"
else
  echo "  (папка uploads пуста — пропускаю)"
fi

log "Удаляю копии старше $KEEP_DAYS дней"
find "$BACKUP_DIR" -name 'db_*.sql.gz'      -mtime +"$KEEP_DAYS" -delete -print | sed 's/^/  удалено: /' || true
find "$BACKUP_DIR" -name 'uploads_*.tar.gz' -mtime +"$KEEP_DAYS" -delete -print | sed 's/^/  удалено: /' || true

log "Готово. Текущие копии в $BACKUP_DIR:"
ls -lh "$BACKUP_DIR" | tail -n +2 | awk '{print "  " $9 "  " $5}'
