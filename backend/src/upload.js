import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import multer from "multer";

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve("uploads");
const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 25);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, _file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}`),
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

// multer декодирует имя файла как latin1 — возвращаем корректный UTF-8 (важно для кириллицы).
export function decodeOriginalName(name) {
  return Buffer.from(name, "latin1").toString("utf8");
}
