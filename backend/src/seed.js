import "dotenv/config";
import bcrypt from "bcryptjs";

import { pool, query } from "./db.js";

const email = process.env.ADMIN_EMAIL || "admin@alladin.club";
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_NAME || "Администратор";

async function main() {
  if (!password) {
    console.log("ADMIN_PASSWORD не задан — создание администратора пропущено.");
    await pool.end();
    return;
  }
  const existing = await query("SELECT id FROM users WHERE lower(email) = lower($1)", [email]);
  if (existing.rows[0]) {
    console.log(`Администратор ${email} уже существует — пропускаю.`);
  } else {
    const hash = await bcrypt.hash(password, 10);
    await query(
      "INSERT INTO users (email, full_name, role, password_hash) VALUES ($1, $2, 'admin', $3)",
      [email, fullName, hash],
    );
    console.log(`Создан администратор: ${email}`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error("Ошибка seed:", err);
  process.exit(1);
});
