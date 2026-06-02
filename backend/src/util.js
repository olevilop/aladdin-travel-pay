import fs from "node:fs/promises";

const iso = (v) => (v instanceof Date ? v.toISOString() : v);

// Номер заявки = дата создания в формате ДД.ММ.ГГГГ (московское время).
export function formatAppNumber(date = new Date()) {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")}`;
}

// Приводим строку из БД к форме, которую ждёт фронтенд (без password_hash).
export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
    // Админ всегда имеет доступ к договорам; остальным выдаётся флагом.
    can_access_contracts: row.role === "admin" || row.can_access_contracts === true,
    created_at: iso(row.created_at),
  };
}

export function mapFile(row) {
  return {
    id: row.id,
    application_id: row.application_id,
    company_type: row.company_type,
    name: row.name,
    size: row.size,
    mime: row.mime,
    uploaded_by: row.uploaded_by,
    uploaded_by_name: row.uploaded_by_name,
    uploaded_at: iso(row.uploaded_at),
    is_paid: row.is_paid,
  };
}

export function mapApplication(row, files = []) {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    description: row.description || "",
    created_at: iso(row.created_at),
    created_by: row.created_by,
    files: files.map(mapFile),
  };
}

export async function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // файла уже нет — игнорируем
  }
}

// ── Договора ─────────────────────────────────────────────────────────────────

// Пять стандартных полей, создаваемых для каждого нового договора (в этом порядке).
export const DEFAULT_CONTRACT_SLOTS = [
  { slot: "template", label: "Шаблон" },
  { slot: "sign1", label: "1 Подпись" },
  { slot: "sign2", label: "2-е Подписи" },
  { slot: "annexes", label: "Приложения" },
  { slot: "license", label: "Лицензия" },
];

export function mapContractField(row) {
  return {
    id: row.id,
    document_id: row.document_id,
    slot: row.slot,
    label: row.label,
    position: row.position,
    // данные файла (null, если ещё не загружен)
    file: row.file_name
      ? {
          name: row.file_name,
          size: row.file_size,
          mime: row.file_mime,
          uploaded_by_name: row.uploaded_by_name,
          uploaded_at: iso(row.uploaded_at),
        }
      : null,
  };
}

export function mapContractDocument(row, fields = []) {
  return {
    id: row.id,
    partner_id: row.partner_id,
    title: row.title || "",
    position: row.position,
    created_at: iso(row.created_at),
    fields: fields.map(mapContractField),
  };
}

export function mapContractPartner(row, documents = []) {
  return {
    id: row.id,
    category_id: row.category_id,
    name: row.name,
    created_at: iso(row.created_at),
    documents,
  };
}

export function mapContractCategory(row) {
  return {
    id: row.id,
    company_type: row.company_type,
    name: row.name,
    created_at: iso(row.created_at),
  };
}
