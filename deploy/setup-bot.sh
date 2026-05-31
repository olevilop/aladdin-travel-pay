#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Установка/настройка Telegram-бота. Запускать на сервере от root:
#     sudo bash /var/www/aladdin-travel-pay/deploy/setup-bot.sh
#
# Можно задать параметры через окружение, чтобы не вводить интерактивно:
#     sudo TELEGRAM_BOT_TOKEN='123:AA...' ALLOWED_USER_IDS='111,222' \
#       bash deploy/setup-bot.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_USER="aladdin"
APP_DIR="/var/www/aladdin-travel-pay"
BOT_DIR="$APP_DIR/bot"
BOT_ENV="$BOT_DIR/.env"
BACKEND_ENV="$APP_DIR/backend/.env"
SVC="aladdin-bot"

log() { echo -e "\n\033[1;32m==> $*\033[0m"; }
run_user() { sudo -u "$APP_USER" -H "$@"; }

[[ $EUID -eq 0 ]] || { echo "Запусти от root:  sudo bash deploy/setup-bot.sh" >&2; exit 1; }
[[ -f "$BACKEND_ENV" ]] || { echo "Не найден $BACKEND_ENV — сначала разверни backend." >&2; exit 1; }

# Берём BOT_API_TOKEN из backend/.env (он там сгенерирован при установке).
BACKEND_BOT_TOKEN="$(grep -E '^BOT_API_TOKEN=' "$BACKEND_ENV" | cut -d= -f2-)"
if [[ -z "$BACKEND_BOT_TOKEN" ]]; then
  echo "В $BACKEND_ENV нет BOT_API_TOKEN. Обнови backend (deploy.sh) — он добавит токен." >&2
  exit 1
fi

# Запрашиваем токен Telegram, если не передан окружением.
if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  read -r -p "Вставь токен бота от @BotFather: " TELEGRAM_BOT_TOKEN
fi
[[ -n "$TELEGRAM_BOT_TOKEN" ]] || { echo "Токен Telegram обязателен." >&2; exit 1; }

# Разрешённые пользователи (можно оставить пустым и добавить позже).
if [[ -z "${ALLOWED_USER_IDS:-}" ]]; then
  read -r -p "Telegram id разрешённых пользователей через запятую (Enter — пропустить): " ALLOWED_USER_IDS || true
fi

log "Создаю $BOT_ENV"
cat > "$BOT_ENV" <<EOF
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
BACKEND_URL=http://127.0.0.1:3001
BOT_API_TOKEN=$BACKEND_BOT_TOKEN
ALLOWED_USER_IDS=${ALLOWED_USER_IDS:-}
EOF
chown "$APP_USER:$APP_USER" "$BOT_ENV"
chmod 600 "$BOT_ENV"

log "Устанавливаю зависимости бота"
( cd "$BOT_DIR" && run_user npm install --omit=dev )

log "Ставлю systemd-сервис $SVC"
install -m 0644 "$APP_DIR/deploy/${SVC}.service" "/etc/systemd/system/${SVC}.service"
systemctl daemon-reload
systemctl enable "$SVC"
systemctl restart "$SVC"

sleep 2
log "Статус бота"
systemctl is-active "$SVC" && echo "Бот запущен." || {
  echo "Бот не активен. Логи: journalctl -u ${SVC} -n 50 --no-pager" >&2
  exit 1
}

cat <<EOF

================ ГОТОВО ================
Бот работает. Дальнейшее:
  • Напиши боту в Telegram /id — узнаешь свой Telegram id.
  • Добавь нужные id:  отредактируй $BOT_ENV (строка ALLOWED_USER_IDS=111,222)
    и перезапусти:      systemctl restart ${SVC}

Логи бота:   journalctl -u ${SVC} -f
EOF
