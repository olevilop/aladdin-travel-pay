// Разбор сообщения менеджера по шаблону (без нейросети).
// Менеджер пишет в свободной форме, главное — указать НОМЕР заявки
// (с префиксом N / № / # / "заявка" / "номер" / "no") и раздел: РФ или зарубежная.
// Опционально — пометку «оплачено».
//
// Примеры, которые понимает парсер:
//   "N123 РФ"
//   "N 7010 РФ"
//   "№123 РФ"
//   "заявка A-555 зарубежная компания оплачено"
//   "no 777 россия"
//   "#42 зарубеж"
//
// ВАЖНО: в JS регэксп \b (граница слова) НЕ работает с кириллицей,
// поэтому ключевые слова ищем подстрокой/через пробельные границы вручную.

// Извлекает номер заявки после префикса N / № / # / "заявка" / "номер" / "no".
// Номер может состоять из цифр, букв, дефисов, слешей, точек.
function findNumber(text) {
  const patterns = [
    // словесные префиксы
    /(?:заявк[аиуе])\s*(?:N|№|#)?\s*([\wА-Яа-яЁё][\wА-Яа-яЁё\-/.]*)/i,
    /(?:номер|number)\s*(?:N|№|#)?\s*([\wА-Яа-яЁё][\wА-Яа-яЁё\-/.]*)/i,
    // символьные префиксы № и #
    /№\s*([\wА-Яа-яЁё][\wА-Яа-яЁё\-/.]*)/i,
    /#\s*([\wА-Яа-яЁё][\wА-Яа-яЁё\-/.]*)/i,
    // латинское "no" перед числом (no 777, no.777)
    /(?:^|\s)no\.?\s*([0-9][\w\-/.]*)/i,
    // латинская N как префикс: "N123", "N 123", "N-123". Требуем, чтобы
    // следующий символ был цифрой — иначе "no"/слова на N сюда не попадут.
    /(?:^|\s)N[\s°.]*([0-9][\w\-/.]*)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

// Определяет раздел компании. Возвращает "ru" | "foreign" | "ambiguous" | null.
function findCompanyType(text) {
  const t = text.toLowerCase();
  const isForeign =
    t.includes("зарубеж") ||
    t.includes("иностран") ||
    t.includes("загран") ||
    t.includes("foreign");
  const isRu =
    /(^|[^а-яё])рф([^а-яё]|$)/i.test(t) ||
    t.includes("росси") ||
    t.includes("российск") ||
    t.includes("русск") ||
    /(^|[^a-z])ru([^a-z]|$)/i.test(t);

  if (isForeign && isRu) return "ambiguous";
  if (isForeign) return "foreign";
  if (isRu) return "ru";
  return null;
}

function findPaid(text) {
  const t = text.toLowerCase();
  return t.includes("оплач") || t.includes("оплата") || t.includes("paid");
}

// Главная функция. Возвращает { number, companyType, isPaid, errors: [] }.
export function parseMessage(text) {
  const src = (text || "").trim();
  const errors = [];

  const number = findNumber(src);
  if (!number) {
    errors.push(
      "Не нашёл номер заявки. Укажите его с префиксом N, например «N123» или «заявка A-555».",
    );
  }

  const companyTypeRaw = findCompanyType(src);
  let companyType = null;
  if (companyTypeRaw === "ambiguous") {
    errors.push("Указаны и «РФ», и «зарубежная» — оставьте что-то одно.");
  } else if (!companyTypeRaw) {
    errors.push("Не понял раздел. Напишите «РФ» или «зарубежная».");
  } else {
    companyType = companyTypeRaw;
  }

  return { number, companyType, isPaid: findPaid(src), errors };
}
