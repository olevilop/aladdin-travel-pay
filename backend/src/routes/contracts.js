import fs from "node:fs";

import { Router } from "express";

import { query } from "../db.js";
import { authMiddleware, requireContracts, requireAdmin } from "../auth.js";
import { upload, decodeOriginalName } from "../upload.js";
import {
  DEFAULT_CONTRACT_SLOTS,
  mapContractCategory,
  mapContractPartner,
  mapContractDocument,
  mapContractField,
  safeUnlink,
} from "../util.js";

// Все эндпоинты раздела «Договора» требуют доступа (админ или флаг can_access_contracts).
export const contractsRouter = Router();
contractsRouter.use(authMiddleware, requireContracts);

// ── Категории ────────────────────────────────────────────────────────────────

// GET /contracts/categories?company_type=ru|foreign
contractsRouter.get("/categories", async (req, res, next) => {
  try {
    const ct = (req.query.company_type || "").toString();
    if (!["ru", "foreign"].includes(ct)) {
      return res.status(400).json({ message: "company_type должен быть 'ru' или 'foreign'" });
    }
    const { rows } = await query(
      "SELECT * FROM contract_categories WHERE company_type = $1 ORDER BY name ASC",
      [ct],
    );
    res.json(rows.map(mapContractCategory));
  } catch (err) {
    next(err);
  }
});

// POST /contracts/categories  { company_type, name }
contractsRouter.post("/categories", async (req, res, next) => {
  try {
    const { company_type, name } = req.body || {};
    if (!["ru", "foreign"].includes(company_type)) {
      return res.status(400).json({ message: "company_type должен быть 'ru' или 'foreign'" });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Укажите название категории" });
    }
    const { rows } = await query(
      "INSERT INTO contract_categories (company_type, name, created_by) VALUES ($1, $2, $3) RETURNING *",
      [company_type, name.trim(), req.user.id],
    );
    res.status(201).json(mapContractCategory(rows[0]));
  } catch (err) {
    next(err);
  }
});

// PATCH /contracts/categories/:id  { name } — переименовать категорию
contractsRouter.patch("/categories/:id", async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Укажите название категории" });
    }
    const { rows } = await query(
      "UPDATE contract_categories SET name = $1 WHERE id::text = $2 RETURNING *",
      [name.trim(), req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ message: "Категория не найдена" });
    res.json(mapContractCategory(rows[0]));
  } catch (err) {
    next(err);
  }
});

// DELETE /contracts/categories/:id — только админ (каскадом удалит партнёров/договоры/поля)
contractsRouter.delete("/categories/:id", requireAdmin, async (req, res, next) => {
  try {
    const paths = await query(
      `SELECT f.storage_path FROM contract_fields f
         JOIN contract_documents d ON d.id = f.document_id
         JOIN contract_partners p ON p.id = d.partner_id
        WHERE p.category_id::text = $1 AND f.storage_path IS NOT NULL`,
      [req.params.id],
    );
    const { rowCount } = await query("DELETE FROM contract_categories WHERE id::text = $1", [
      req.params.id,
    ]);
    if (!rowCount) return res.status(404).json({ message: "Категория не найдена" });
    for (const r of paths.rows) await safeUnlink(r.storage_path);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Партнёры ─────────────────────────────────────────────────────────────────

// GET /contracts/categories/:id/partners — партнёры категории со всеми договорами и полями
contractsRouter.get("/categories/:id/partners", async (req, res, next) => {
  try {
    const partnersRes = await query(
      "SELECT * FROM contract_partners WHERE category_id::text = $1 ORDER BY name ASC",
      [req.params.id],
    );
    const partners = partnersRes.rows;
    if (!partners.length) return res.json([]);

    const partnerIds = partners.map((p) => p.id);
    const docsRes = await query(
      "SELECT * FROM contract_documents WHERE partner_id = ANY($1::uuid[]) ORDER BY position ASC, created_at ASC",
      [partnerIds],
    );
    const docs = docsRes.rows;
    const docIds = docs.map((d) => d.id);

    let fieldsByDoc = new Map();
    if (docIds.length) {
      const fieldsRes = await query(
        "SELECT * FROM contract_fields WHERE document_id = ANY($1::uuid[]) ORDER BY position ASC",
        [docIds],
      );
      for (const f of fieldsRes.rows) {
        if (!fieldsByDoc.has(f.document_id)) fieldsByDoc.set(f.document_id, []);
        fieldsByDoc.get(f.document_id).push(f);
      }
    }

    const docsByPartner = new Map();
    for (const d of docs) {
      if (!docsByPartner.has(d.partner_id)) docsByPartner.set(d.partner_id, []);
      docsByPartner.get(d.partner_id).push(mapContractDocument(d, fieldsByDoc.get(d.id) || []));
    }

    res.json(partners.map((p) => mapContractPartner(p, docsByPartner.get(p.id) || [])));
  } catch (err) {
    next(err);
  }
});

// POST /contracts/categories/:id/partners  { name }
contractsRouter.post("/categories/:id/partners", async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Укажите название партнёра" });
    }
    const cat = await query("SELECT id FROM contract_categories WHERE id::text = $1", [
      req.params.id,
    ]);
    if (!cat.rows[0]) return res.status(404).json({ message: "Категория не найдена" });
    const { rows } = await query(
      "INSERT INTO contract_partners (category_id, name, created_by) VALUES ($1, $2, $3) RETURNING *",
      [cat.rows[0].id, name.trim(), req.user.id],
    );
    res.status(201).json(mapContractPartner(rows[0], []));
  } catch (err) {
    next(err);
  }
});

// DELETE /contracts/partners/:id — только админ
contractsRouter.delete("/partners/:id", requireAdmin, async (req, res, next) => {
  try {
    const paths = await query(
      `SELECT f.storage_path FROM contract_fields f
         JOIN contract_documents d ON d.id = f.document_id
        WHERE d.partner_id::text = $1 AND f.storage_path IS NOT NULL`,
      [req.params.id],
    );
    const { rowCount } = await query("DELETE FROM contract_partners WHERE id::text = $1", [
      req.params.id,
    ]);
    if (!rowCount) return res.status(404).json({ message: "Партнёр не найден" });
    for (const r of paths.rows) await safeUnlink(r.storage_path);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Договора (строки) ────────────────────────────────────────────────────────

// POST /contracts/partners/:id/documents  { title? }
// Создаёт договор и сразу 5 стандартных полей.
contractsRouter.post("/partners/:id/documents", async (req, res, next) => {
  try {
    const { title } = req.body || {};
    const partner = await query("SELECT id FROM contract_partners WHERE id::text = $1", [
      req.params.id,
    ]);
    if (!partner.rows[0]) return res.status(404).json({ message: "Партнёр не найден" });

    const posRes = await query(
      "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM contract_documents WHERE partner_id = $1",
      [partner.rows[0].id],
    );
    const position = posRes.rows[0].pos;

    const docRes = await query(
      "INSERT INTO contract_documents (partner_id, title, position, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
      [partner.rows[0].id, (title || "").trim(), position, req.user.id],
    );
    const doc = docRes.rows[0];

    // создаём пять стандартных полей
    const fields = [];
    for (let i = 0; i < DEFAULT_CONTRACT_SLOTS.length; i++) {
      const { slot, label } = DEFAULT_CONTRACT_SLOTS[i];
      const fRes = await query(
        "INSERT INTO contract_fields (document_id, slot, label, position) VALUES ($1, $2, $3, $4) RETURNING *",
        [doc.id, slot, label, i],
      );
      fields.push(fRes.rows[0]);
    }
    res.status(201).json(mapContractDocument(doc, fields));
  } catch (err) {
    next(err);
  }
});

// DELETE /contracts/documents/:id — только админ
contractsRouter.delete("/documents/:id", requireAdmin, async (req, res, next) => {
  try {
    const paths = await query(
      "SELECT storage_path FROM contract_fields WHERE document_id::text = $1 AND storage_path IS NOT NULL",
      [req.params.id],
    );
    const { rowCount } = await query("DELETE FROM contract_documents WHERE id::text = $1", [
      req.params.id,
    ]);
    if (!rowCount) return res.status(404).json({ message: "Договор не найден" });
    for (const r of paths.rows) await safeUnlink(r.storage_path);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Поля ─────────────────────────────────────────────────────────────────────

// POST /contracts/documents/:id/fields  { label } — добавить своё поле сверх пяти
contractsRouter.post("/documents/:id/fields", async (req, res, next) => {
  try {
    const { label } = req.body || {};
    if (!label || !label.trim()) {
      return res.status(400).json({ message: "Укажите название поля" });
    }
    const doc = await query("SELECT id FROM contract_documents WHERE id::text = $1", [
      req.params.id,
    ]);
    if (!doc.rows[0]) return res.status(404).json({ message: "Договор не найден" });
    const posRes = await query(
      "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM contract_fields WHERE document_id = $1",
      [doc.rows[0].id],
    );
    const { rows } = await query(
      "INSERT INTO contract_fields (document_id, slot, label, position) VALUES ($1, NULL, $2, $3) RETURNING *",
      [doc.rows[0].id, label.trim(), posRes.rows[0].pos],
    );
    res.status(201).json(mapContractField(rows[0]));
  } catch (err) {
    next(err);
  }
});

// DELETE /contracts/fields/:id — только админ (удаляет поле целиком). Файл — см. ниже.
contractsRouter.delete("/fields/:id", requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      "DELETE FROM contract_fields WHERE id::text = $1 RETURNING storage_path",
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ message: "Поле не найдено" });
    await safeUnlink(rows[0].storage_path);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /contracts/fields/:id/file  (multipart: file) — загрузить/заменить файл поля
contractsRouter.post("/fields/:id/file", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Файл не передан" });
    const cur = await query("SELECT storage_path FROM contract_fields WHERE id::text = $1", [
      req.params.id,
    ]);
    if (!cur.rows[0]) {
      await safeUnlink(req.file.path);
      return res.status(404).json({ message: "Поле не найдено" });
    }
    const oldPath = cur.rows[0].storage_path;
    const { rows } = await query(
      `UPDATE contract_fields
          SET file_name = $1, file_size = $2, file_mime = $3, storage_path = $4,
              uploaded_by = $5, uploaded_by_name = $6, uploaded_at = now()
        WHERE id::text = $7
      RETURNING *`,
      [
        decodeOriginalName(req.file.originalname),
        req.file.size,
        req.file.mimetype || "application/octet-stream",
        req.file.path,
        req.user.id,
        req.user.full_name,
        req.params.id,
      ],
    );
    if (oldPath && oldPath !== req.file.path) await safeUnlink(oldPath); // удаляем прежний файл
    res.json(mapContractField(rows[0]));
  } catch (err) {
    next(err);
  }
});

// DELETE /contracts/fields/:id/file — удалить только файл (поле остаётся пустым)
contractsRouter.delete("/fields/:id/file", async (req, res, next) => {
  try {
    const cur = await query("SELECT storage_path FROM contract_fields WHERE id::text = $1", [
      req.params.id,
    ]);
    if (!cur.rows[0]) return res.status(404).json({ message: "Поле не найдено" });
    const { rows } = await query(
      `UPDATE contract_fields
          SET file_name = NULL, file_size = NULL, file_mime = NULL, storage_path = NULL,
              uploaded_by = NULL, uploaded_by_name = NULL, uploaded_at = NULL
        WHERE id::text = $1
      RETURNING *`,
      [req.params.id],
    );
    await safeUnlink(cur.rows[0].storage_path); // удаляем файл с диска
    res.json(mapContractField(rows[0]));
  } catch (err) {
    next(err);
  }
});

// GET /contracts/fields/:id/download — скачать/просмотреть файл поля
contractsRouter.get("/fields/:id/download", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM contract_fields WHERE id::text = $1", [
      req.params.id,
    ]);
    const field = rows[0];
    if (!field || !field.storage_path) {
      return res.status(404).json({ message: "Файл не найден" });
    }
    if (!fs.existsSync(field.storage_path)) {
      return res.status(410).json({ message: "Файл отсутствует на сервере" });
    }
    res.setHeader("Content-Type", field.file_mime || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(field.file_name)}`,
    );
    fs.createReadStream(field.storage_path).pipe(res);
  } catch (err) {
    next(err);
  }
});
