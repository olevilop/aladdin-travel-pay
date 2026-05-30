import { Router } from "express";

import { query } from "../db.js";
import { botAuth } from "../auth.js";
import { upload, decodeOriginalName } from "../upload.js";
import { mapApplication, mapFile, safeUnlink } from "../util.js";

// Эндпоинты для сервисного клиента (Telegram-бот / ИИ-агент).
// Все защищены токеном BOT_API_TOKEN (заголовок X-Bot-Token).
export const botRouter = Router();
botRouter.use(botAuth);

function parseBool(v, fallback = false) {
  if (v === undefined || v === null || v === "") return fallback;
  const s = String(v).trim().toLowerCase();
  return ["true", "1", "yes", "да", "оплачено", "paid"].includes(s);
}

// Найти заявку по точному номеру, либо создать новую с этим номером.
async function findOrCreateApplication(number, title) {
  const num = String(number).trim();
  const found = await query(
    "SELECT * FROM applications WHERE number = $1 ORDER BY created_at DESC LIMIT 1",
    [num],
  );
  if (found.rows[0]) return { app: found.rows[0], created: false };

  const ins = await query(
    "INSERT INTO applications (number, title, description, created_by) VALUES ($1, $2, '', NULL) RETURNING *",
    [num, (title && String(title).trim()) || `Заявка ${num}`],
  );
  return { app: ins.rows[0], created: true };
}

// GET /bot/applications?number=... — посмотреть, существует ли заявка (для агента).
botRouter.get("/applications", async (req, res, next) => {
  try {
    const number = (req.query.number || "").toString().trim();
    if (!number) {
      const all = await query(
        "SELECT id, number, title FROM applications ORDER BY created_at DESC LIMIT 50",
      );
      return res.json(all.rows);
    }
    const { rows } = await query(
      "SELECT * FROM applications WHERE number = $1 ORDER BY created_at DESC LIMIT 1",
      [number],
    );
    if (!rows[0]) return res.status(404).json({ message: "Заявка не найдена", number });
    const files = await query(
      "SELECT * FROM files WHERE application_id = $1 ORDER BY uploaded_at ASC",
      [rows[0].id],
    );
    res.json(mapApplication(rows[0], files.rows));
  } catch (err) {
    next(err);
  }
});

// POST /bot/upload — единый вызов для агента:
//   найти-или-создать заявку по номеру и положить в неё файл.
// multipart/form-data поля:
//   number        (обязательно) — номер заявки (напр. "01.06.2026")
//   company_type  (обязательно) — "ru" | "foreign"
//   is_paid       (необязательно) — статус оплаты, по умолчанию false (не оплачено)
//   title         (необязательно) — название для НОВОЙ заявки
//   uploaded_by_name (необязательно) — кто загрузил (имя менеджера), по умолчанию "Telegram-бот"
//   file          (обязательно) — сам файл
botRouter.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    const { number, company_type, is_paid, title, uploaded_by_name } = req.body || {};

    if (!number || !String(number).trim()) {
      if (req.file) await safeUnlink(req.file.path);
      return res.status(400).json({ message: "Не указан номер заявки (number)" });
    }
    if (!["ru", "foreign"].includes(company_type)) {
      if (req.file) await safeUnlink(req.file.path);
      return res
        .status(400)
        .json({ message: "Неверный раздел: company_type должен быть 'ru' или 'foreign'" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Файл не передан (file)" });
    }

    const { app, created } = await findOrCreateApplication(number, title);
    const paid = parseBool(is_paid, false);

    const { rows } = await query(
      `INSERT INTO files
         (application_id, company_type, name, size, mime, storage_path, uploaded_by, uploaded_by_name, is_paid)
       VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8)
       RETURNING *`,
      [
        app.id,
        company_type,
        decodeOriginalName(req.file.originalname),
        req.file.size,
        req.file.mimetype || "application/octet-stream",
        req.file.path,
        (uploaded_by_name && String(uploaded_by_name).trim()) || "Telegram-бот",
        paid,
      ],
    );

    res.status(201).json({
      ok: true,
      application_created: created,
      application: { id: app.id, number: app.number, title: app.title },
      file: mapFile(rows[0]),
    });
  } catch (err) {
    next(err);
  }
});
