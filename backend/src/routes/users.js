import { Router } from "express";
import bcrypt from "bcryptjs";

import { query } from "../db.js";
import { authMiddleware, requireAdmin } from "../auth.js";
import { publicUser } from "../util.js";

export const usersRouter = Router();
usersRouter.use(authMiddleware, requireAdmin);

// GET /users
usersRouter.get("/", async (_req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM users ORDER BY created_at ASC");
    res.json(rows.map(publicUser));
  } catch (err) {
    next(err);
  }
});

// POST /users
usersRouter.post("/", async (req, res, next) => {
  try {
    const { email, full_name, role, temp_password } = req.body || {};
    if (!email || !full_name || !temp_password) {
      return res.status(400).json({ message: "Заполните email, имя и временный пароль" });
    }
    if (!["admin", "manager"].includes(role)) {
      return res.status(400).json({ message: "Неверная роль" });
    }
    const exists = await query("SELECT 1 FROM users WHERE lower(email) = lower($1)", [email]);
    if (exists.rows[0]) {
      return res.status(409).json({ message: "Пользователь с таким email уже существует" });
    }
    const hash = await bcrypt.hash(temp_password, 10);
    const { rows } = await query(
      "INSERT INTO users (email, full_name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING *",
      [email, full_name, role, hash],
    );
    res.status(201).json(publicUser(rows[0]));
  } catch (err) {
    next(err);
  }
});

// PATCH /users/:id/role
usersRouter.patch("/:id/role", async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!["admin", "manager"].includes(role)) {
      return res.status(400).json({ message: "Неверная роль" });
    }
    const { rows } = await query(
      "UPDATE users SET role = $1 WHERE id::text = $2 RETURNING *",
      [role, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ message: "Пользователь не найден" });
    res.json(publicUser(rows[0]));
  } catch (err) {
    next(err);
  }
});

// POST /users/:id/toggle-active
usersRouter.post("/:id/toggle-active", async (req, res, next) => {
  try {
    const { rows } = await query(
      "UPDATE users SET is_active = NOT is_active WHERE id::text = $1 RETURNING *",
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ message: "Пользователь не найден" });
    res.json(publicUser(rows[0]));
  } catch (err) {
    next(err);
  }
});
