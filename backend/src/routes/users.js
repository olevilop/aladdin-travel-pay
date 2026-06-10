import { Router } from "express";
import bcrypt from "bcryptjs";

import { query } from "../db.js";
import { authMiddleware, requireAdmin } from "../auth.js";
import { publicUser } from "../util.js";
import { validatePassword } from "../security.js";

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
    const pwErr = validatePassword(temp_password);
    if (pwErr) {
      return res.status(400).json({ message: pwErr });
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

// POST /users/:id/toggle-contracts — выдать/забрать доступ к разделу «Договора»
usersRouter.post("/:id/toggle-contracts", async (req, res, next) => {
  try {
    const { rows } = await query(
      "UPDATE users SET can_access_contracts = NOT can_access_contracts WHERE id::text = $1 RETURNING *",
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ message: "Пользователь не найден" });
    res.json(publicUser(rows[0]));
  } catch (err) {
    next(err);
  }
});

// POST /users/:id/reset-password  { new_password } — админ задаёт пользователю новый пароль
usersRouter.post("/:id/reset-password", async (req, res, next) => {
  try {
    const { new_password } = req.body || {};
    const pwErr = validatePassword(new_password);
    if (pwErr) {
      return res.status(400).json({ message: pwErr });
    }
    const hash = await bcrypt.hash(new_password, 10);
    const { rows } = await query(
      "UPDATE users SET password_hash = $1 WHERE id::text = $2 RETURNING *",
      [hash, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ message: "Пользователь не найден" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /users/:id — удалить пользователя совсем
usersRouter.delete("/:id", async (req, res, next) => {
  try {
    // Нельзя удалить самого себя (чтобы админ не остался без доступа случайно).
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: "Нельзя удалить самого себя" });
    }
    // Нельзя удалить последнего активного админа.
    const target = await query("SELECT role FROM users WHERE id::text = $1", [req.params.id]);
    if (!target.rows[0]) return res.status(404).json({ message: "Пользователь не найден" });
    if (target.rows[0].role === "admin") {
      const admins = await query(
        "SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND is_active = TRUE",
      );
      if (admins.rows[0].n <= 1) {
        return res.status(400).json({ message: "Нельзя удалить последнего администратора" });
      }
    }
    await query("DELETE FROM users WHERE id::text = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
