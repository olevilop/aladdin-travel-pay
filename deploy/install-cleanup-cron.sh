#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Устанавливает ежедневную авто-очистку заявок старше 1 года (cron, 04:00).
# Запускать ОДИН раз, от root:
#     bash /var/www/aladdin-travel-pay/deploy/install-cleanup-cron.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_USER="aladdin"
APP_DIR="/var/www/aladdin-travel-pay"
CRON_FILE="/etc/cron.d/aladdin-cleanup"

[[ $EUID -eq 0 ]] || { echo "Запусти от root:  sudo bash deploy/install-cleanup-cron.sh" >&2; exit 1; }

cat > "$CRON_FILE" <<EOF
# Ежедневная очистка заявок старше 1 года в 04:00 (логи в /var/log/aladdin-cleanup.log)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 4 * * * $APP_USER cd $APP_DIR/backend && /usr/bin/node src/cleanup.js >> /var/log/aladdin-cleanup.log 2>&1
EOF
chmod 0644 "$CRON_FILE"
touch /var/log/aladdin-cleanup.log
chown "$APP_USER:$APP_USER" /var/log/aladdin-cleanup.log

echo "Готово. Авто-очистка заявок старше 1 года будет запускаться ежедневно в 04:00."
echo "Файл расписания: $CRON_FILE"
echo "Логи:            /var/log/aladdin-cleanup.log"
echo "Срок хранения по умолчанию: 365 дней (меняется через RETENTION_DAYS)."
echo "Проверить вручную:  cd $APP_DIR/backend && sudo -u $APP_USER node src/cleanup.js"
