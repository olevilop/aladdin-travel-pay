import { Router } from "express";

import { query } from "../db.js";
import { authMiddleware } from "../auth.js";
import { upload, decodeOriginalName } from "../upload.js";
import { formatAppNumber, mapApplication, mapFile, safeUnlink } from "../util.js";

export const applicationsRouter = Router();
applicationsRouter.use(authMiddleware);

// GET /applications?q=...
applicationsRouter.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const appsRes = q
      ? await query(
          "SELECT * FROM applications WHERE number ILIKE $1 OR title ILIKE $1 ORDER BY created_at DESC",
          [`%${q}%`],
        )
      : await query("SELECT * FROM applications ORDER BY created_at DESC");

    const apps = appsRes.rows;
    const ids = apps.map((a) => a.id);
    const filesByApp = new Map();
    if (ids.length) {
      const filesRes = await query(
        "SELECT * FROM files WHERE application_id = ANY($1::uuid[]) ORDER BY uploaded_at ASC",
        [ids],
      );
      for (const f of filesRes.rows) {
        if (!filesByApp.has(f.application_id)) filesByApp.set(f.application_id, []);
        filesByApp.get(f.application_id).push(f);
      }
    }
    res.json(apps.map((a) => mapApplication(a, filesByApp.get(a.id) || [])));
  } catch (err) {
    next(err);
  }
});

// POST /applications
applicationsRouter.post("/", async (req, res, next) => {
  try {
    const { title, description } = req.body || {};
    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Укажите название заявки" });
    }
    const { rows } = await query(
      "INSERT INTO applications (number, title, description, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
      [formatAppNumber(), title.trim(), (description || "").trim(), req.user.id],
    );
    res.status(201).json(mapApplication(rows[0], []));
  } catch (err) {
    next(err);
  }
});

// GET /applications/:id
applicationsRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM applications WHERE id::text = $1", [req.params.id]);
    const app = rows[0];
    if (!app) return res.status(404).json({ message: "Заявка не найдена" });
    const filesRes = await query(
      "SELECT * FROM files WHERE application_id = $1 ORDER BY uploaded_at ASC",
      [app.id],
    );
    res.json(mapApplication(app, filesRes.rows));
  } catch (err) {
    next(err);
  }
});

// DELETE /applications/:id
applicationsRouter.delete("/:id", async (req, res, next) => {
  try {
    const filesRes = await query(
      "SELECT storage_path FROM files WHERE application_id::text = $1",
      [req.params.id],
    );
    const { rowCount } = await query("DELETE FROM applications WHERE id::text = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: "Заявка не найдена" });
    for (const f of filesRes.rows) await safeUnlink(f.storage_path);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /applications/:id/files  (multipart: company_type, file)
applicationsRouter.post("/:id/files", upload.single("file"), async (req, res, next) => {
  try {
    const appRes = await query("SELECT id FROM applications WHERE id::text = $1", [req.params.id]);
    const app = appRes.rows[0];
    if (!app) {
      if (req.file) await safeUnlink(req.file.path);
      return res.status(404).json({ message: "Заявка не найдена" });
    }
    const companyType = (req.body.company_type || "").toString();
    if (!["ru", "foreign"].includes(companyType)) {
      if (req.file) await safeUnlink(req.file.path);
      return res.status(400).json({ message: "Неверный тип компании" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Файл не передан" });
    }
    const { rows } = await query(
      `INSERT INTO files
         (application_id, company_type, name, size, mime, storage_path, uploaded_by, uploaded_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        app.id,
        companyType,
        decodeOriginalName(req.file.originalname),
        req.file.size,
        req.file.mimetype || "application/octet-stream",
        req.file.path,
        req.user.id,
        req.user.full_name,
      ],
    );
    res.status(201).json(mapFile(rows[0]));
  } catch (err) {
    next(err);
  }
});
