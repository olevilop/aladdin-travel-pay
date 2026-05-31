// Разбор сообщения менеджера по шаблону (без нейросети).
// Менеджер пишет в свободной форме, главное — указать номер заявки (дату)
// и раздел: РФ или зарубежная. Опционально — пометку «оплачено».
//
// Примеры, которые понимает парсер:
//   "01.06.2026 РФ"
//   "заявка 01.06.2026, зарубежная компания, оплачено"
//   "5.6.2026 россия"
//   "зарубеж 12.06.2026"
//
// ВАЖНО: в JS регэксп \b (граница слова) НЕ работает с кириллицей,
// поэтому ключевые слова ищем подстрокой/через пробельные границы вручную.

// Находит дату ДД.ММ.ГГГГ (день и месяц могут быть с одной цифрой) и нормализует.
function findNumber(text) {
  const m = text.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${dd}.${mm}.${yyyy}`;
}

// Определяет раздел компании. Возвращает "ru" | "foreign" | "ambiguous" | null.
function findCompanyType(text) {
  const t = text.toLowerCase();
  // foreign: зарубеж(ная), иностран(ная), загран, foreign
  const isForeign =
    t.includes("зарубеж") ||
    t.includes("иностран") ||
    t.includes("загран") ||
    t.includes("foreign");
  // ru: рф, россия/российск, ru (как отдельное слово), русск
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
      "Не нашёл номер заявки. Укажите дату в формате ДД.ММ.ГГГГ, например 01.06.2026.",
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
