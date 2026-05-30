import { Router } from "express";
import bcrypt from "bcryptjs";

import { query } from "../db.js";
import { signToken, authMiddleware } from "../auth.js";
import { publicUser } from "../util.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Укажите email и пароль" });
    }
    const { rows } = await query("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ message: "Неверный email или пароль" });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Неверный email или пароль" });
    }
    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", (_req, res) => {
  // JWT не хранится на сервере — клиент просто удаляет токен у себя.
  res.json({ ok: true });
});

authRouter.get("/me", authMiddleware, (req, res) => {
  res.json(publicUser(req.user));
});

// Смена собственного пароля (нужен текущий пароль для подтверждения).
authRouter.post("/change-password", authMiddleware, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ message: "Укажите текущий и новый пароль" });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ message: "Новый пароль должен быть не короче 6 символов" });
    }
    const ok = await bcrypt.compare(current_password, req.user.password_hash);
    if (!ok) {
      return res.status(400).json({ message: "Текущий пароль неверный" });
    }
    const hash = await bcrypt.hash(new_password, 10);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Смена собственного email (он же логин). Требует подтверждения паролем.
authRouter.post("/change-email", authMiddleware, async (req, res, next) => {
  try {
    const { current_password, new_email } = req.body || {};
    if (!current_password || !new_email) {
      return res.status(400).json({ message: "Укажите пароль и новый email" });
    }
    const email = String(new_email).trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ message: "Некорректный email" });
    }
    const ok = await bcrypt.compare(current_password, req.user.password_hash);
    if (!ok) {
      return res.status(400).json({ message: "Пароль неверный" });
    }
    const exists = await query(
      "SELECT 1 FROM users WHERE lower(email) = lower($1) AND id <> $2",
      [email, req.user.id],
    );
    if (exists.rows[0]) {
      return res.status(409).json({ message: "Этот email уже занят" });
    }
    const { rows } = await query(
      "UPDATE users SET email = $1 WHERE id = $2 RETURNING *",
      [email, req.user.id],
    );
    res.json(publicUser(rows[0]));
  } catch (err) {
    next(err);
  }
});
