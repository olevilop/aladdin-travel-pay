import "dotenv/config";
import bcrypt from "bcryptjs";

import { pool, query } from "./db.js";

// Утилита для сброса пароля пользователя напрямую в БД.
//
// Посмотреть список пользователей:
//     node src/reset-password.js
//
// Задать новый пароль (email — это логин):
//     node src/reset-password.js admin@alladin.club 'НовыйПароль123'
//
// Пароль передаётся аргументом (в одинарных кавычках), а НЕ через .env —
// поэтому спецсимволы (#, $, пробелы и т.п.) обрабатываются корректно.

async function listUsers() {
  const { rows } = await query(
    "SELECT email, role, is_active FROM users ORDER BY created_at ASC",
  );
  if (!rows.length) {
    console.log("В базе нет ни одного пользователя.");
    return;
  }
  console.log("Пользователи в базе:");
  for (const u of rows) {
    const status = u.is_active ? "активен" : "заблокирован";
    console.log(`  - ${u.email}  (${u.role}, ${status})`);
  }
  console.log("\nЧтобы задать пароль:");
  console.log("  node src/reset-password.js <email> '<новый-пароль>'");
}

async function resetPassword(email, password) {
  if (password.length < 6) {
    console.error("Пароль должен быть не короче 6 символов.");
    process.exitCode = 1;
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    "UPDATE users SET password_hash = $1, is_active = TRUE WHERE lower(email) = lower($2) RETURNING email, role",
    [hash, email],
  );
  if (!rows[0]) {
    console.error(`Пользователь с email "${email}" не найден.`);
    console.error("Запусти без аргументов, чтобы увидеть список:  node src/reset-password.js");
    process.exitCode = 1;
    return;
  }
  console.log(`✔ Пароль обновлён для ${rows[0].email} (${rows[0].role}).`);
  console.log("Теперь можно войти на сайте с этим email и новым паролем.");
}

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email) {
    await listUsers();
  } else if (!password) {
    console.error("Не указан новый пароль.");
    console.error("Использование: node src/reset-password.js <email> '<новый-пароль>'");
    process.exitCode = 1;
  } else {
    await resetPassword(email, password);
  }
  await pool.end();
}

main().catch((err) => {
  console.error("Ошибка:", err);
  process.exit(1);
});
