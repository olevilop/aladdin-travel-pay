// Простые юнит-тесты парсера. Запуск: node src/parse.test.mjs
import assert from "node:assert";
import { parseMessage } from "./parse.js";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ok", name);
  } catch (e) {
    console.error("  x", name, "—", e.message);
    process.exitCode = 1;
  }
}

check("№ + РФ", () => {
  const r = parseMessage("№123 РФ");
  assert.equal(r.number, "123");
  assert.equal(r.companyType, "ru");
  assert.equal(r.isPaid, false);
  assert.equal(r.errors.length, 0);
});

check("заявка с буквенно-цифровым номером + зарубежная + оплачено", () => {
  const r = parseMessage("заявка A-555 зарубежная компания оплачено");
  assert.equal(r.number, "A-555");
  assert.equal(r.companyType, "foreign");
  assert.equal(r.isPaid, true);
  assert.equal(r.errors.length, 0);
});

check("no 777 россия", () => {
  const r = parseMessage("no 777 россия");
  assert.equal(r.number, "777");
  assert.equal(r.companyType, "ru");
});

check("#42 зарубеж", () => {
  const r = parseMessage("#42 зарубеж");
  assert.equal(r.number, "42");
  assert.equal(r.companyType, "foreign");
});

check("номер словом «номер»", () => {
  const r = parseMessage("номер 2026/15 иностранная");
  assert.equal(r.number, "2026/15");
  assert.equal(r.companyType, "foreign");
});

check("нет номера — ошибка", () => {
  const r = parseMessage("РФ оплачено");
  assert.equal(r.number, null);
  assert.ok(r.errors.some((e) => e.includes("номер заявки")));
});

check("нет раздела — ошибка", () => {
  const r = parseMessage("№50 оплата прошла");
  assert.equal(r.companyType, null);
  assert.ok(r.errors.some((e) => e.includes("раздел")));
});

check("оба раздела — неоднозначно", () => {
  const r = parseMessage("№50 РФ и зарубежная");
  assert.equal(r.companyType, null);
  assert.ok(r.errors.some((e) => e.includes("одно")));
});

console.log(`\n${passed} тестов прошло.`);
