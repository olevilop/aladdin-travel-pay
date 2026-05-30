#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Первичная настройка VPS Timeweb (Ubuntu 22.04/24.04) для Aladdin Travel Pay.
# Поднимает: фронтенд (SSR), бэкенд (REST API), PostgreSQL, Nginx.
#
# Запускать ОДИН РАЗ, от root:
#     sudo bash deploy/setup-server.sh
# Можно сразу задать домен и админский логин:
#     sudo DOMAIN=pay.example.ru ADMIN_EMAIL=me@example.ru ADMIN_PASSWORD='Пароль123' \
#       bash deploy/setup-server.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── НАСТРОЙ ЭТИ ПЕРЕМЕННЫЕ (или передай через окружение) ──────────────────────
REPO_URL="${REPO_URL:-https://github.com/olevilop/aladdin-travel-pay.git}"
DOMAIN="${DOMAIN:-example.com}"          # напр. pay.aladdin.club (без http://)
# ADMIN_EMAIL / ADMIN_PASSWORD — необязательно; если не заданы, будут созданы автоматически.
# ─────────────────────────────────────────────────────────────────────────────

APP_USER="aladdin"
APP_DIR="/var/www/aladdin-travel-pay"
ENV_FILE="$APP_DIR/backend/.env"
NODE_MAJOR="22"
DB_NAME="aladdin"
DB_USER="aladdin"
SVC_FRONT="aladdin-travel-pay"
SVC_BACK="aladdin-backend"
GENERATED_ADMIN=0

log() { echo -e "\n\033[1;32m==> $*\033[0m"; }
run_user() { sudo -u "$APP_USER" -H "$@"; }

[[ $EUID -eq 0 ]] || { echo "Запусти от root:  sudo bash deploy/setup-server.sh" >&2; exit 1; }
if [[ "$DOMAIN" == "example.com" ]]; then
  echo "!! Укажи домен:  sudo DOMAIN=pay.твойдомен.ru bash deploy/setup-server.sh" >&2
  exit 1
fi

log "Ставлю системные пакеты (nginx, postgresql, git, curl)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git gnupg nginx postgresql openssl

log "Запускаю PostgreSQL"
systemctl enable --now postgresql

log "Ставлю Node.js ${NODE_MAJOR} LTS"
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" != "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
node --version

log "Создаю системного пользователя $APP_USER (если нужно)"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"

log "Клонирую/обновляю репозиторий в $APP_DIR"
mkdir -p "$APP_DIR"
# git помечает папку как "dubious ownership", если она принадлежит не root.
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch --all
  git -C "$APP_DIR" reset --hard origin/HEAD
else
  git clone "$REPO_URL" "$APP_DIR"
fi

# ── PostgreSQL: роль, база, секреты, backend/.env ────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  log "backend/.env уже есть — секреты и пользователь БД сохраняю как есть"
else
  log "Создаю пользователя БД, базу и backend/.env"
  DB_PASS="$(openssl rand -hex 16)"
  JWT_SECRET="$(openssl rand -hex 32)"
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@alladin.club}"
  if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
    ADMIN_PASSWORD="$(openssl rand -hex 8)"
    GENERATED_ADMIN=1
  fi

  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
    sudo -u postgres psql -c "ALTER ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';"
  else
    sudo -u postgres psql -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';"
  fi
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

  mkdir -p "$APP_DIR/backend"
  cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgres://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES=7d
HOST=127.0.0.1
PORT=3001
UPLOAD_DIR=$APP_DIR/backend/uploads
MAX_UPLOAD_MB=25
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
ADMIN_NAME=Администратор
EOF
fi

log "Прописываю фронтенду адрес API (VITE_API_URL=/api)"
echo "VITE_API_URL=/api" > "$APP_DIR/.env"

log "Готовлю каталог загрузок и права"
mkdir -p "$APP_DIR/backend/uploads"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 600 "$ENV_FILE"

# ── Бэкенд: зависимости, миграции, администратор ─────────────────────────────
log "Бэкенд: установка зависимостей"
( cd "$APP_DIR/backend" && run_user npm ci )
log "Бэкенд: применяю схему БД"
( cd "$APP_DIR/backend" && run_user npm run migrate )
log "Бэкенд: создаю администратора (если ещё нет)"
( cd "$APP_DIR/backend" && run_user npm run seed )

# ── Фронтенд: зависимости и сборка ───────────────────────────────────────────
log "Фронтенд: установка зависимостей и сборка"
( cd "$APP_DIR" && run_user npm ci && run_user npm run build )

# ── systemd-сервисы ──────────────────────────────────────────────────────────
log "Устанавливаю systemd-сервисы"
install -m 0644 "$APP_DIR/deploy/${SVC_BACK}.service"  "/etc/systemd/system/${SVC_BACK}.service"
install -m 0644 "$APP_DIR/deploy/${SVC_FRONT}.service" "/etc/systemd/system/${SVC_FRONT}.service"
systemctl daemon-reload
systemctl enable "$SVC_BACK" "$SVC_FRONT"
systemctl restart "$SVC_BACK"
systemctl restart "$SVC_FRONT"

# ── Nginx ────────────────────────────────────────────────────────────────────
log "Настраиваю Nginx для домена $DOMAIN"
sed "s/__DOMAIN__/${DOMAIN}/g" "$APP_DIR/deploy/nginx.conf" > "/etc/nginx/sites-available/${SVC_FRONT}"
ln -sf "/etc/nginx/sites-available/${SVC_FRONT}" "/etc/nginx/sites-enabled/${SVC_FRONT}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ── Проверки ─────────────────────────────────────────────────────────────────
log "Проверки работоспособности"
sleep 2
curl -fsS -o /dev/null -w "Бэкенд /health:  HTTP %{http_code}\n" http://127.0.0.1:3001/health \
  || { echo "!! Бэкенд не отвечает. Логи: journalctl -u ${SVC_BACK} -n 50 --no-pager" >&2; exit 1; }
curl -fsS -o /dev/null -w "Фронтенд /login: HTTP %{http_code}\n" http://127.0.0.1:3000/login \
  || { echo "!! Фронтенд не отвечает. Логи: journalctl -u ${SVC_FRONT} -n 50 --no-pager" >&2; exit 1; }

TEST_EMAIL="$(grep -E '^ADMIN_EMAIL=' "$ENV_FILE" | cut -d= -f2-)"
TEST_PASS="$(grep -E '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
LOGIN_CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASS}\"}")"
echo "Тест логина админа: HTTP ${LOGIN_CODE} (ожидается 200)"

cat <<EOF

================ ГОТОВО (HTTP) ================
Сайт доступен по http://${DOMAIN}

Данные администратора для входа:
  email:  ${TEST_EMAIL}
EOF
if [[ "$GENERATED_ADMIN" == "1" ]]; then
  echo "  пароль: ${TEST_PASS}"
  echo "  (пароль сгенерирован автоматически — сохрани его и при желании смени в админке/БД)"
else
  echo "  пароль: тот, что ты задал в ADMIN_PASSWORD (хранится в ${ENV_FILE})"
fi
cat <<EOF

Дальше — бесплатный HTTPS (после того как домен указывает на этот сервер):
    apt-get install -y certbot python3-certbot-nginx
    certbot --nginx -d ${DOMAIN}

Полезное:
    systemctl status ${SVC_BACK} ${SVC_FRONT}
    journalctl -u ${SVC_BACK} -f          # логи API
    journalctl -u ${SVC_FRONT} -f         # логи фронтенда
    bash ${APP_DIR}/deploy/deploy.sh      # выкатить обновление из GitHub
EOF
