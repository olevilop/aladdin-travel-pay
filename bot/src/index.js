import "dotenv/config";

import { parseMessage } from "./parse.js";

// ── Конфигурация ─────────────────────────────────────────────────────────────
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND_URL = (process.env.BACKEND_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const BOT_API_TOKEN = process.env.BOT_API_TOKEN;
// Кто может пользоваться ботом: список Telegram user id через запятую.
const ALLOWED = (process.env.ALLOWED_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!TG_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN не задан (см. bot/.env.example).");
  process.exit(1);
}
if (!BOT_API_TOKEN) {
  console.error("BOT_API_TOKEN не задан — должен совпадать с backend/.env.");
  process.exit(1);
}
if (ALLOWED.length === 0) {
  console.warn(
    "⚠️  ALLOWED_USER_IDS пуст — бот будет принимать файлы от КОГО УГОДНО. " +
      "Укажите разрешённые Telegram id для безопасности.",
  );
}

const TG_API = `https://api.telegram.org/bot${TG_TOKEN}`;
const TG_FILE = `https://api.telegram.org/file/bot${TG_TOKEN}`;

// ── Helpers Telegram ─────────────────────────────────────────────────────────
async function tg(method, payload) {
  const res = await fetch(`${TG_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
  return data.result;
}

async function sendMessage(chatId, text) {
  try {
    await tg("sendMessage", { chat_id: chatId, text });
  } catch (e) {
    console.error("sendMessage error:", e.message);
  }
}

// Достаёт описание файла из сообщения: документ или самое крупное фото.
function extractFile(msg) {
  if (msg.document) {
    return { fileId: msg.document.file_id, name: msg.document.file_name || "file" };
  }
  if (msg.photo && msg.photo.length) {
    const largest = msg.photo[msg.photo.length - 1];
    return { fileId: largest.file_id, name: `photo_${largest.file_unique_id}.jpg` };
  }
  return null;
}

async function downloadTelegramFile(fileId) {
  const info = await tg("getFile", { file_id: fileId });
  if (!info.file_path) {
    throw new Error("Telegram не отдал файл (возможно, он больше 20 МБ).");
  }
  const res = await fetch(`${TG_FILE}/${info.file_path}`);
  if (!res.ok) throw new Error(`Не удалось скачать файл из Telegram (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Отправка в наш backend ───────────────────────────────────────────────────
async function uploadToBackend({ number, companyType, isPaid, fileName, fileBuf, who }) {
  const form = new FormData();
  form.append("number", number);
  form.append("company_type", companyType);
  form.append("is_paid", isPaid ? "true" : "false");
  form.append("uploaded_by_name", who);
  form.append("file", new Blob([fileBuf]), fileName);

  const res = await fetch(`${BACKEND_URL}/bot/upload`, {
    method: "POST",
    headers: { "X-Bot-Token": BOT_API_TOKEN },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Ошибка backend (${res.status})`);
  return data;
}

const HELP =
  "Пришлите файл (документ или фото) и в подписи к нему укажите:\n" +
  "• номер заявки — дату ДД.ММ.ГГГГ (например 01.06.2026)\n" +
  "• раздел — «РФ» или «зарубежная»\n" +
  "• при желании — «оплачено»\n\n" +
  "Пример подписи: «01.06.2026 зарубежная оплачено»";

// ── Обработка одного апдейта ─────────────────────────────────────────────────
async function handleUpdate(update) {
  const msg = update.message;
  if (!msg) return;
  const chatId = msg.chat.id;
  const userId = String(msg.from?.id ?? "");

  // Whitelist по Telegram id
  if (ALLOWED.length && !ALLOWED.includes(userId)) {
    await sendMessage(
      chatId,
      `Доступ запрещён. Ваш Telegram id: ${userId}. Передайте его администратору для добавления.`,
    );
    return;
  }

  const text = msg.text || msg.caption || "";

  // Команды
  if (text.startsWith("/start") || text.startsWith("/help")) {
    await sendMessage(chatId, HELP);
    return;
  }
  if (text.startsWith("/id")) {
    await sendMessage(chatId, `Ваш Telegram id: ${userId}`);
    return;
  }

  const file = extractFile(msg);
  if (!file) {
    await sendMessage(chatId, "Не вижу файла.\n\n" + HELP);
    return;
  }

  // Разбор подписи
  const { number, companyType, isPaid, errors } = parseMessage(text);
  if (errors.length) {
    await sendMessage(chatId, "⚠️ " + errors.join("\n") + "\n\n" + HELP);
    return;
  }

  const who =
    [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") ||
    msg.from?.username ||
    `tg:${userId}`;

  try {
    await sendMessage(chatId, `Загружаю «${file.name}» в заявку ${number}…`);
    const buf = await downloadTelegramFile(file.fileId);
    const result = await uploadToBackend({
      number,
      companyType,
      isPaid,
      fileName: file.name,
      fileBuf: buf,
      who,
    });
    const section = companyType === "ru" ? "Компания РФ" : "Зарубежная компания";
    const createdNote = result.application_created ? " (заявка создана)" : "";
    const paidNote = isPaid ? ", отмечено «оплачено»" : "";
    await sendMessage(
      chatId,
      `✅ Готово. Заявка ${number}${createdNote}: файл «${file.name}» добавлен в раздел «${section}»${paidNote}.`,
    );
  } catch (e) {
    console.error("upload error:", e.message);
    await sendMessage(chatId, `❌ Не удалось загрузить: ${e.message}`);
  }
}

// ── Long polling ─────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `Бот запущен. Backend: ${BACKEND_URL}. Разрешённых пользователей: ${
      ALLOWED.length || "все (небезопасно)"
    }.`,
  );
  let offset = 0;
  try {
    await tg("deleteWebhook", { drop_pending_updates: false });
  } catch (e) {
    console.error("deleteWebhook:", e.message);
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const updates = await tg("getUpdates", { offset, timeout: 30 });
      for (const u of updates) {
        offset = u.update_id + 1;
        handleUpdate(u).catch((e) => console.error("handleUpdate:", e.message));
      }
    } catch (e) {
      console.error("getUpdates error:", e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main();
