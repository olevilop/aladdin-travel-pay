-- Схема БД для Aladdin Travel Pay.
-- gen_random_uuid() входит в ядро PostgreSQL начиная с версии 13 — расширения не нужны.
-- Все команды идемпотентны (IF NOT EXISTS), поэтому миграцию можно запускать повторно.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'manager')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
