#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Устанавливает ежедневный автозапуск бэкапа через cron (каждый день в 03:30).
# Запускать ОДИН раз, от root:
#     bash /var/www/aladdin-travel-pay/deploy/install-backup-cron.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/var/www/aladdin-travel-pay"
CRON_FILE="/etc/cron.d/aladdin-backup"

[[ $EUID -eq 0 ]] || { echo "Запусти от root:  sudo bash deploy/install-backup-cron.sh" >&2; exit 1; }

cat > "$CRON_FILE" <<EOF
# Ежедневный бэкап Aladdin Travel Pay в 03:30 (логи в /var/log/aladdin-backup.log)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 3 * * * root bash $APP_DIR/deploy/backup.sh >> /var/log/aladdin-backup.log 2>&1
EOF
chmod 0644 "$CRON_FILE"

echo "Готово. Бэкап будет запускаться ежедневно в 03:30."
echo "Файл расписания: $CRON_FILE"
echo "Логи бэкапа:     /var/log/aladdin-backup.log"
echo "Копии:           /var/backups/aladdin"
