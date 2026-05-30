import jwt from "jsonwebtoken";

import { query } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

if (!JWT_SECRET) {
  console.error("JWT_SECRET не задан. Заполни backend/.env (см. .env.example).");
  process.exit(1);
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Не авторизован" });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Сессия истекла, войдите заново" });
    }

    const { rows } = await query("SELECT * FROM users WHERE id = $1", [payload.sub]);
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ message: "Пользователь не найден или заблокирован" });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Доступ только для администратора" });
  }
  next();
}

// Аутентификация для сервисного клиента (Telegram-бот / агент).
// Бот шлёт заголовок X-Bot-Token со значением BOT_API_TOKEN из .env.
export function botAuth(req, res, next) {
  const token = req.headers["x-bot-token"];
  const expected = process.env.BOT_API_TOKEN;
  if (!expected || token !== expected) {
    return res.status(401).json({ message: "Недействительный токен бота" });
  }
  next();
}
