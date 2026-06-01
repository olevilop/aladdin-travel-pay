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
// Разрешённые групповые чаты: список chat id через запятую (id группы — отрицательное число).
// В этих чатах бот реагирует на файлы; всё равно грузит только от пользователей из ALLOWED.
const ALLOWED_CHATS = (process.env.ALLOWED_CHAT_IDS || "")
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

// username бота (без @) — заполняется при старте через getMe.
// Нужен, чтобы в группах реагировать только на явное упоминание @имя_бота.
let BOT_USERNAME = "";

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Отправка в наш backend ───────────────────────────────────────────────────
async function uploadToBackend({ number, companyType, isPaid, fileName, fileBuf, who }) {
  // Сетевые сбои (например, backend перезапускается во время деплоя) дают
  // "fetch failed". Повторяем попытку несколько раз с паузой — для менеджера
  // загрузка проходит прозрачно, без ручного повтора.
  const MAX_ATTEMPTS = 4;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
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
      // 5xx — сервер временно нездоров, есть смысл повторить. 4xx — ошибка
      // данных (не тот раздел и т.п.), повторять бесполезно.
      if (!res.ok) {
        if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
          lastErr = new Error(data.message || `Ошибка backend (${res.status})`);
          await sleep(1500 * attempt);
          continue;
        }
        throw new Error(data.message || `Ошибка backend (${res.status})`);
      }
      return data;
    } catch (e) {
      // Сетевой сбой (fetch failed / ECONNREFUSED) — пробуем снова.
      const networkish =
        e instanceof TypeError ||
        /fetch failed|ECONNREFUSED|socket|network/i.test(e.message || "");
      if (networkish && attempt < MAX_ATTEMPTS) {
        lastErr = e;
        await sleep(1500 * attempt);
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error("Не удалось загрузить после нескольких попыток");
}

const HELP =
  "Пришлите файл (документ или фото) и в подписи к нему укажите:\n" +
  "• номер заявки с префиксом N (например N7002 или заявка A-555)\n" +
  "• раздел — «РФ» или «зарубежная»\n" +
  "• при желании — «оплачено»\n\n" +
  "Пример подписи: «N7002 зарубежная оплачено»\n\n" +
  "В групповом чате добавьте к подписи упоминание бота, например:\n" +
  "«@имя_бота N7002 РФ»";

// ── Обработка одного апдейта ─────────────────────────────────────────────────
async function handleUpdate(update) {
  const msg = update.message;
  if (!msg) return;
  const chatId = String(msg.chat.id);
  const userId = String(msg.from?.id ?? "");
  const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";

  const text = msg.text || msg.caption || "";

  // Команды — работают везде. /id показывает id пользователя и (в группе) id чата.
  if (text.startsWith("/start") || text.startsWith("/help")) {
    await sendMessage(chatId, HELP);
    return;
  }
  if (text.startsWith("/id")) {
    const lines = [`Ваш Telegram id: ${userId}`];
    if (isGroup) lines.push(`Id этого чата: ${chatId}`);
    await sendMessage(chatId, lines.join("\n"));
    return;
  }

  const file = extractFile(msg);

  // В группе бот реагирует ТОЛЬКО на явное упоминание @имя_бота (privacy mode можно
  // не выключать). Без упоминания — полностью молчим, чтобы не мешать переписке.
  const mention = BOT_USERNAME ? `@${BOT_USERNAME}` : "";
  const isMentioned = mention && text.toLowerCase().includes(mention.toLowerCase());
  if (isGroup && !isMentioned) {
    return;
  }

  // Без файла: в личке подсказываем; в группе (но с упоминанием) тоже подскажем.
  if (!file) {
    await sendMessage(chatId, "Не вижу файла.\n\n" + HELP);
    return;
  }

  // Контроль доступа.
  // В группе: чат должен быть в списке разрешённых И отправитель — в whitelist.
  // В личке: отправитель должен быть в whitelist.
  if (isGroup) {
    if (ALLOWED_CHATS.length && !ALLOWED_CHATS.includes(chatId)) {
      await sendMessage(
        chatId,
        `Этот чат не подключён к загрузке. Id чата: ${chatId}. Передайте его администратору.`,
      );
      return;
    }
  }
  if (ALLOWED.length && !ALLOWED.includes(userId)) {
    await sendMessage(
      chatId,
      `Доступ запрещён. Ваш Telegram id: ${userId}. Передайте его администратору для добавления.`,
    );
    return;
  }

  // Убираем упоминание @имя_бота из текста, чтобы оно не мешало разбору номера.
  const cleanText = mention
    ? text.replace(new RegExp(mention.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ").trim()
    : text;

  // Разбор подписи
  const { number, companyType, isPaid, errors } = parseMessage(cleanText);
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
  // Узнаём свой username — нужен для распознавания упоминаний в группах.
  try {
    const me = await tg("getMe", {});
    BOT_USERNAME = me.username || "";
  } catch (e) {
    console.error("getMe:", e.message);
  }
  console.log(
    `Бот запущен (@${BOT_USERNAME || "?"}). Backend: ${BACKEND_URL}. ` +
      `Разрешённых пользователей: ${ALLOWED.length || "все (небезопасно)"}. ` +
      `Разрешённых чатов: ${ALLOWED_CHATS.length || "нет (только личка)"}.`,
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
