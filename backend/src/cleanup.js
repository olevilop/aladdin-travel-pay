import "dotenv/config";

import { pool, query } from "./db.js";
import { safeUnlink } from "./util.js";

// Удаляет заявки старше срока хранения (по умолчанию 1 год) вместе с файлами.
// Запуск вручную:           node src/cleanup.js
// Изменить срок (в днях):   RETENTION_DAYS=730 node src/cleanup.js   (например 2 года)
//
// Файлы в БД удаляются каскадом (ON DELETE CASCADE), но физические файлы на диске
// нужно удалить отдельно — поэтому сначала собираем их пути.

const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 365);

async function main() {
  // Находим устаревшие заявки.
  const oldApps = await query(
    `SELECT id, number FROM applications
      WHERE created_at < now() - ($1::int * interval '1 day')`,
    [RETENTION_DAYS],
  );

  if (oldApps.rows.length === 0) {
    console.log(`Нет заявок старше ${RETENTION_DAYS} дней — удалять нечего.`);
    await pool.end();
    return;
  }

  const ids = oldApps.rows.map((a) => a.id);

  // Собираем пути файлов, которые лежат на диске.
  const files = await query(
    "SELECT storage_path FROM files WHERE application_id = ANY($1::uuid[])",
    [ids],
  );

  // Удаляем заявки (файлы в БД уйдут каскадом).
  const del = await query(
    "DELETE FROM applications WHERE id = ANY($1::uuid[])",
    [ids],
  );

  // Чистим физические файлы.
  let removedFiles = 0;
  for (const f of files.rows) {
    await safeUnlink(f.storage_path);
    removedFiles++;
  }

  console.log(
    `Удалено заявок: ${del.rowCount} (старше ${RETENTION_DAYS} дней), ` +
      `файлов с диска: ${removedFiles}.`,
  );
  console.log("Номера удалённых заявок:", oldApps.rows.map((a) => a.number).join(", "));

  await pool.end();
}

main().catch((err) => {
  console.error("Ошибка очистки:", err);
  process.exit(1);
});
