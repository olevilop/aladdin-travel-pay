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
