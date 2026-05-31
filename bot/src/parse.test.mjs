// Простые юнит-тесты парсера. Запуск: node src/parse.test.mjs
import assert from "node:assert";
import { parseMessage } from "./parse.js";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ✔", name);
  } catch (e) {
    console.error("  x", name, "—", e.message);
    process.exitCode = 1;
  }
}

check("РФ + дата", () => {
  const r = parseMessage("01.06.2026 РФ");
  assert.equal(r.number, "01.06.2026");
  assert.equal(r.companyType, "ru");
  assert.equal(r.isPaid, false);
  assert.equal(r.errors.length, 0);
});

check("зарубежная + оплачено", () => {
  const r = parseMessage("заявка 01.06.2026, зарубежная компания, оплачено");
  assert.equal(r.number, "01.06.2026");
  assert.equal(r.companyType, "foreign");
  assert.equal(r.isPaid, true);
  assert.equal(r.errors.length, 0);
});

check("дата с одной цифрой нормализуется", () => {
  const r = parseMessage("5.6.2026 россия");
  assert.equal(r.number, "05.06.2026");
  assert.equal(r.companyType, "ru");
});

check("слово зарубеж в начале", () => {
  const r = parseMessage("зарубеж 12.06.2026");
  assert.equal(r.number, "12.06.2026");
  assert.equal(r.companyType, "foreign");
});

check("нет даты — ошибка", () => {
  const r = parseMessage("РФ оплачено");
  assert.equal(r.number, null);
  assert.ok(r.errors.some((e) => e.includes("номер заявки")));
});

check("нет раздела — ошибка", () => {
  const r = parseMessage("01.06.2026 оплата прошла");
  assert.equal(r.companyType, null);
  assert.ok(r.errors.some((e) => e.includes("раздел")));
});

check("оба раздела — неоднозначно", () => {
  const r = parseMessage("01.06.2026 РФ и зарубежная");
  assert.equal(r.companyType, null);
  assert.ok(r.errors.some((e) => e.includes("одно")));
});

check("иностранная = foreign", () => {
  const r = parseMessage("10.07.2026 иностранная компания");
  assert.equal(r.companyType, "foreign");
});

console.log(`\n${passed} тестов прошло.`);
