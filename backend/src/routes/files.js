import fs from "node:fs";

import { Router } from "express";

import { query } from "../db.js";
import { authMiddleware } from "../auth.js";
import { mapFile, safeUnlink } from "../util.js";

export const filesRouter = Router();
filesRouter.use(authMiddleware);

// GET /files/:id/download
filesRouter.get("/:id/download", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM files WHERE id::text = $1", [req.params.id]);
    const file = rows[0];
    if (!file) return res.status(404).json({ message: "Файл не найден" });
    if (!fs.existsSync(file.storage_path)) {
      return res.status(410).json({ message: "Файл отсутствует на сервере" });
    }
    res.setHeader("Content-Type", file.mime || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    fs.createReadStream(file.storage_path).pipe(res);
  } catch (err) {
    next(err);
  }
});

// POST /files/:id/toggle-paid — отметку «оплачено» ставят админ и бухгалтер (не менеджер)
filesRouter.post("/:id/toggle-paid", async (req, res, next) => {
  try {
    if (!["admin", "accountant"].includes(req.user.role)) {
      return res.status(403).json({ message: "Отметку «оплачено» ставит бухгалтер или администратор" });
    }
    const { rows } = await query(
      "UPDATE files SET is_paid = NOT is_paid WHERE id::text = $1 RETURNING *",
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ message: "Файл не найден" });
    res.json(mapFile(rows[0]));
  } catch (err) {
    next(err);
  }
});

// DELETE /files/:id — удаляет админ; менеджер — только в своей заявке. Бухгалтер не удаляет.
filesRouter.delete("/:id", async (req, res, next) => {
  try {
    const found = await query(
      `SELECT f.storage_path, a.created_by
         FROM files f JOIN applications a ON a.id = f.application_id
        WHERE f.id::text = $1`,
      [req.params.id],
    );
    if (!found.rows[0]) return res.status(404).json({ message: "Файл не найден" });

    const role = req.user.role;
    const appOwner = found.rows[0].created_by;
    const allowed =
      role === "admin" ||
      (role === "manager" && (!appOwner || appOwner === req.user.id));
    if (!allowed) {
      return res.status(403).json({ message: "Нет прав на удаление этого файла" });
    }

    await query("DELETE FROM files WHERE id::text = $1", [req.params.id]);
    await safeUnlink(found.rows[0].storage_path);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
