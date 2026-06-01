// Простые средства безопасности без внешних зависимостей.

// ── Защита от подбора пароля (брутфорса) ─────────────────────────────────────
// Считаем неудачные попытки входа по ключу (email + IP). После лимита —
// временная блокировка. Хранение в памяти процесса: для одного инстанса
// бэкенда этого достаточно; при перезапуске счётчики сбрасываются (не страшно).
const MAX_FAILS = 5; // сколько неудач до блокировки
const BLOCK_MS = 15 * 60 * 1000; // на сколько блокируем (15 минут)
const WINDOW_MS = 15 * 60 * 1000; // окно, за которое считаем неудачи

const attempts = new Map(); // key -> { fails, first, blockedUntil }

function now() {
  return Date.now();
}

function keyOf(req, email) {
  const ip =
    (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "?";
  return `${(email || "").toLowerCase()}|${ip}`;
}

// Вызывать ДО проверки пароля. Возвращает { blocked, retryAfterSec }.
export function checkLoginAllowed(req, email) {
  const key = keyOf(req, email);
  const rec = attempts.get(key);
  if (!rec) return { blocked: false };
  if (rec.blockedUntil && rec.blockedUntil > now()) {
    return { blocked: true, retryAfterSec: Math.ceil((rec.blockedUntil - now()) / 1000) };
  }
  return { blocked: false };
}

// Вызывать при НЕУДАЧНОМ входе.
export function registerFailedLogin(req, email) {
  const key = keyOf(req, email);
  const t = now();
  let rec = attempts.get(key);
  if (!rec || t - rec.first > WINDOW_MS) {
    rec = { fails: 0, first: t, blockedUntil: 0 };
  }
  rec.fails += 1;
  if (rec.fails >= MAX_FAILS) {
    rec.blockedUntil = t + BLOCK_MS;
  }
  attempts.set(key, rec);
}

// Вызывать при УСПЕШНОМ входе — сбрасываем счётчик.
export function registerSuccessfulLogin(req, email) {
  attempts.delete(keyOf(req, email));
}

// Периодически чистим старые записи, чтобы Map не рос бесконечно.
setInterval(
  () => {
    const t = now();
    for (const [k, rec] of attempts) {
      const expired = t - rec.first > WINDOW_MS && (!rec.blockedUntil || rec.blockedUntil < t);
      if (expired) attempts.delete(k);
    }
  },
  10 * 60 * 1000,
).unref?.();

// ── Проверка силы пароля ─────────────────────────────────────────────────────
// Минимум 8 символов, есть буква и цифра. Возвращает строку-ошибку или null.
export function validatePassword(pw) {
  const s = String(pw || "");
  if (s.length < 8) return "Пароль должен быть не короче 8 символов";
  if (!/[A-Za-zА-Яа-яЁё]/.test(s)) return "Пароль должен содержать хотя бы одну букву";
  if (!/[0-9]/.test(s)) return "Пароль должен содержать хотя бы одну цифру";
  return null;
}
