import "dotenv/config";

import express from "express";

import { pool } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { applicationsRouter } from "./routes/applications.js";
import { filesRouter } from "./routes/files.js";
import { usersRouter } from "./routes/users.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json());

// Проверка работоспособности (используется скриптами деплоя и мониторингом)
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch {
    res.status(500).json({ status: "db_error" });
  }
});

app.use("/auth", authRouter);
app.use("/applications", applicationsRouter);
app.use("/files", filesRouter);
app.use("/users", usersRouter);

app.use((_req, res) => res.status(404).json({ message: "Не найдено" }));

// Централизованный обработчик ошибок
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "Файл слишком большой" });
  }
  console.error(err);
  res.status(500).json({ message: "Внутренняя ошибка сервера" });
});

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "127.0.0.1";
app.listen(PORT, HOST, () => {
  console.log(`Backend слушает http://${HOST}:${PORT}`);
});
