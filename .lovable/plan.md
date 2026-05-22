# План: Frontend CRM "Alladin Travel Club"

Чистый React + TypeScript + Tailwind + shadcn/ui фронтенд со встроенным мок-режимом и абстрактным API-слоем для будущей замены на реальный backend. Без Supabase, без БД, без edge functions.

## Стек и базовая настройка
- Vite + React + TS (текущий шаблон проекта)
- Tailwind + shadcn/ui (уже доступны)
- Роутинг: react-router-dom
- Стейт: Zustand (лёгкий стор для текущего пользователя + мок-данных в памяти)
- Уведомления: shadcn `sonner` toast
- Иконки: lucide-react
- Локаль дат: ручной форматер `ДД.ММ.ГГГГ`

## Цветовая схема (index.css / tailwind tokens)
- `--primary`: тёмно-синий (≈ #0b1f3a)
- Фон: белый
- Акцент РФ: `#d62828`
- Акцент Зарубеж: `#003566`
- Статусные цвета: красный / жёлтый / зелёный / серый
Все цвета — через CSS-переменные в `index.css`, без хардкода в компонентах.

## Структура файлов
```text
src/
  types.ts                       — User, Application, InvoiceFile, CompanyType, Role, PaymentStatus
  lib/
    api.ts                       — единая точка API (мок/реальный режим)
    mock/
      store.ts                   — in-memory store (Zustand) + seed демо-данных
      files.ts                   — Map<fileId, File> + createObjectURL для скачивания
    format.ts                    — formatDate, formatBytes, генерация номера 2026-0001
  store/
    auth.ts                      — Zustand: token, currentUser, hydrate из localStorage
  components/
    Layout/AppHeader.tsx         — название "Счета на оплату" + меню пользователя
    Layout/ProtectedRoute.tsx    — редирект на /login без токена
    Layout/AdminRoute.tsx        — 403 если role !== 'admin'
    Applications/ApplicationCard.tsx
    Applications/NewApplicationDialog.tsx
    Applications/StatusBadge.tsx
    Files/FileBlock.tsx          — блок Компания РФ / Зарубеж (цвет через prop)
    Files/FileRow.tsx            — иконка по расширению, действия
    Files/Dropzone.tsx           — drag-and-drop + input multiple
    Admin/UsersTable.tsx
    Admin/NewUserDialog.tsx
    common/ConfirmDialog.tsx
    common/EmptyState.tsx
  pages/
    Login.tsx
    Applications.tsx             — / и /applications
    ApplicationDetail.tsx        — /applications/:id
    Admin.tsx                    — /admin
    Forbidden.tsx                — 403
    NotFound.tsx
  App.tsx                        — роутер
  main.tsx
```

## API-слой (src/lib/api.ts)
- `const API_URL = import.meta.env.VITE_API_URL || ''`
- Если пусто → все методы дергают мок-стор (с искусственной задержкой ~200мс для реализма loading-state)
- Если задан → `fetch(${API_URL}${path}, { headers: { Authorization: Bearer <token> } })`
- Один внутренний `request()` helper для реального режима
- Экспортируемые методы (типизированы): `login`, `logout`, `getCurrentUser`, `listApplications`, `createApplication`, `getApplication`, `deleteApplication`, `uploadFile`, `downloadFile`, `toggleFilePaid`, `deleteFile`, `listUsers`, `createUser`, `updateUserRole`, `toggleUserActive`

### Мок-режим — поведение
- Авторизация: любой email/пароль → токен `mock-token-...`, пользователь-админ (`role: 'admin'`)
- Seed при старте: ~3 заявки с разными статусами оплаты + 2-3 файла в каждой + 2-3 пользователя
- Загрузка файла: File сохраняется в `Map<id, File>`, `download_url = URL.createObjectURL(file)`
- `downloadFile(id)` → возвращает Blob из мапы
- Номер заявки: `YYYY-NNNN`, последовательно растущий

## Страницы
1. **/login** — лого "Alladin Travel Club", форма email+пароль, текст "Доступ выдаёт администратор", редирект на /applications
2. **/applications** — шапка, поиск, "+ Новая заявка" (модалка), сетка карточек с бейджами статусов, empty state
3. **/applications/:id** — хлебные крошки, шапка с действиями (Удалить с confirm, Скачать всё ZIP — для ZIP используем `jszip`), две колонки `FileBlock` (РФ красный / Зарубеж синий) с Dropzone, списком файлов и действиями
4. **/admin** — только для admin (иначе /forbidden), таблица пользователей + действия + модалка добавления

## UX-детали
- Все действия → `sonner` toast
- Удаления → `AlertDialog` confirm
- Кнопки с loading (disabled + spinner)
- Empty states на пустых списках
- Валидация файлов: расширение из whitelist + ≤25 МБ, иначе toast-ошибка
- Адаптив: блоки РФ/Зарубеж — `grid md:grid-cols-2`, на мобиле в одну колонку
- Защита роутов через `ProtectedRoute`, токен в `localStorage` (ключ `att_token`)
- Хидратация currentUser при загрузке: если есть токен — `getCurrentUser()`

## Технические детали
- ZIP: `jszip` (добавится через bun add)
- Поиск: клиентский фильтр по `number`/`title` (regex-insensitive)
- Генерация id в моке: `crypto.randomUUID()`
- Формат даты: `new Intl.DateTimeFormat('ru-RU')` или ручной `dd.MM.yyyy`

## Сообщение для пользователя после реализации
В отдельном сообщении после билда отдам:
1. ENV-переменные: `VITE_API_URL` (пусто = мок, иначе базовый URL backend)
2. Точное расположение API-слоя: `src/lib/api.ts` + типы `src/types.ts`
3. Полный список ожидаемых endpoint'ов (метод, путь, request body, response shape) — выведу таблицей с примерами JSON

## Что НЕ делаю (по требованию)
- Supabase не подключаю, Lovable Cloud не включаю
- БД, миграций, edge functions — нет
- Никакого реального бэкенда — только мок + готовый контракт
