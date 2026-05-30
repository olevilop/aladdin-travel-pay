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

// POST /files/:id/toggle-paid
filesRouter.post("/:id/toggle-paid", async (req, res, next) => {
  try {
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

// DELETE /files/:id
filesRouter.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      "DELETE FROM files WHERE id::text = $1 RETURNING storage_path",
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ message: "Файл не найден" });
    await safeUnlink(rows[0].storage_path);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
