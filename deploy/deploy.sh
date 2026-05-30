#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Выкатка обновления: подтянуть код из GitHub, пересобрать фронт и бэк,
# применить миграции БД (идемпотентно) и перезапустить сервисы.
# Запускать на сервере от root:
#     sudo bash deploy/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_USER="aladdin"
APP_DIR="/var/www/aladdin-travel-pay"
SVC_FRONT="aladdin-travel-pay"
SVC_BACK="aladdin-backend"

log() { echo -e "\n\033[1;32m==> $*\033[0m"; }
run_user() { sudo -u "$APP_USER" -H "$@"; }

[[ $EUID -eq 0 ]] || { echo "Запусти от root:  sudo bash deploy/deploy.sh" >&2; exit 1; }

cd "$APP_DIR"

# git ругается на "dubious ownership", когда папка принадлежит $APP_USER, а git
# запускается от root. Помечаем папку доверенной (идемпотентно).
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

log "Подтягиваю свежий код из GitHub"
git fetch --all
git reset --hard origin/HEAD
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# .env-файлы не в репозитории — git reset их не трогает; восстанавливаем только если пропали
[[ -f "$APP_DIR/.env" ]] || echo "VITE_API_URL=/api" > "$APP_DIR/.env"

log "Бэкенд: зависимости + миграции"
( cd "$APP_DIR/backend" && run_user npm ci && run_user npm run migrate )

log "Фронтенд: зависимости + сборка"
run_user npm ci
run_user npm run build

log "Перезапускаю сервисы"
systemctl restart "$SVC_BACK"
systemctl restart "$SVC_FRONT"

log "Проверки"
sleep 2
curl -fsS -o /dev/null -w "Бэкенд /health:  HTTP %{http_code}\n" http://127.0.0.1:3001/health \
  || { echo "!! Бэкенд не отвечает. Логи: journalctl -u ${SVC_BACK} -n 50 --no-pager" >&2; exit 1; }
curl -fsS -o /dev/null -w "Фронтенд /login: HTTP %{http_code}\n" http://127.0.0.1:3000/login \
  || { echo "!! Фронтенд не отвечает. Логи: journalctl -u ${SVC_FRONT} -n 50 --no-pager" >&2; exit 1; }

log "Готово — обновление выкачено."
