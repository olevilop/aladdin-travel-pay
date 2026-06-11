-- Схема БД для Aladdin Travel Pay.
-- gen_random_uuid() входит в ядро PostgreSQL начиная с версии 13 — расширения не нужны.
-- Все команды идемпотентны (IF NOT EXISTS), поэтому миграцию можно запускать повторно.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'accountant')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Доступ к разделу «Договора» выдаёт админ. Колонка добавляется отдельно,
-- чтобы миграция работала и на уже существующей таблице users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_access_contracts BOOLEAN NOT NULL DEFAULT FALSE;

-- Роли: admin / manager / accountant (Бухгалтер). Пересоздаём CHECK, чтобы
-- разрешить новую роль на уже существующей базе (идемпотентно).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'accountant'));

CREATE TABLE IF NOT EXISTS applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number      TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications (created_at DESC);

CREATE TABLE IF NOT EXISTS files (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  company_type     TEXT NOT NULL CHECK (company_type IN ('ru', 'foreign')),
  name             TEXT NOT NULL,
  size             INTEGER NOT NULL,
  mime             TEXT NOT NULL,
  storage_path     TEXT NOT NULL,
  uploaded_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_by_name TEXT NOT NULL,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_paid          BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_files_application_id ON files (application_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Раздел «Договора»: категории → партнёры → договоры → поля-файлы.
-- ─────────────────────────────────────────────────────────────────────────────

-- Категория договоров. company_type: 'ru' (РФ компании) или 'foreign' (зарубежные).
CREATE TABLE IF NOT EXISTS contract_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_type TEXT NOT NULL CHECK (company_type IN ('ru', 'foreign')),
  name         TEXT NOT NULL,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contract_categories_type ON contract_categories (company_type);

-- Партнёр внутри категории.
CREATE TABLE IF NOT EXISTS contract_partners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES contract_categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contract_partners_category ON contract_partners (category_id);

-- Договор партнёра («строка»). У партнёра может быть несколько договоров.
CREATE TABLE IF NOT EXISTS contract_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID NOT NULL REFERENCES contract_partners(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contract_documents_partner ON contract_documents (partner_id);

-- Поле договора (Шаблон / 1 Подпись / 2-е Подписи / Приложения / Лицензия / своё).
-- Один файл на поле: при загрузке нового файл перезаписывается.
-- slot — машинное имя для пяти стандартных полей; для пользовательских полей
-- slot = NULL, а label содержит введённое название.
CREATE TABLE IF NOT EXISTS contract_fields (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES contract_documents(id) ON DELETE CASCADE,
  slot             TEXT,
  label            TEXT NOT NULL,
  position         INTEGER NOT NULL DEFAULT 0,
  -- данные файла (NULL, пока файл не загружен)
  file_name        TEXT,
  file_size        INTEGER,
  file_mime        TEXT,
  storage_path     TEXT,
  uploaded_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_by_name TEXT,
  uploaded_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_contract_fields_document ON contract_fields (document_id);
