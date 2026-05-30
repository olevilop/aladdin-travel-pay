import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL не задан. Заполни backend/.env (см. .env.example).");
  process.exit(1);
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on("error", (err) => {
  console.error("Неожиданная ошибка пула PostgreSQL:", err);
});

export const query = (text, params) => pool.query(text, params);
