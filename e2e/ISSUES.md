# Проблемы, найденные smoke e2e тестами

Найдены при написании и прогонах тестов из `e2e/tests/` (октябрь 2026, ветка
`claude/smoke-e2e-tests-278845`). В коде приложения ничего не исправлялось: тесты либо
обходят проблему, либо фиксируют текущее поведение. Как запускать стек и тесты, описано в
[README.md](README.md).

Сводка:

| # | Проблема | Серьёзность | Где |
|---|---|---|---|
| 1 | Realtime-обновления назначений не работают у залогиненных пользователей | Высокая | backend, socket.io |
| 2 | Экспорт года игнорирует `BASE_URL` | Средняя | UI, settings |
| 3 | Пол «Prefer not to say» показывается как «Female» | Низкая | UI, карточка пользователя и фильтр contacts |
| 4 | `/results` показывает не всех зарегистрированных, хотя подзаголовок обещает всех | Низкая / уточнить | backend + UI, results |
| 5 | Кнопка «Export to CSV» скачивает ZIP | Косметика | UI, переводы |
| 6 | В форме заявки волонтёра не показываются дни | Уточнить | UI, registration |
| 7 | Селект пола без связанного label | Доступность | UI, registration |
| 8 | Заголовки страниц дня показывают id или общий текст вместо названия дня | Косметика (есть TODO) | UI, days |
| 9 | Одновременные прогоны e2e делят `test-results` | Инфраструктура тестов | e2e |

---

## 1. Realtime-обновления назначений не работают у залогиненных пользователей

**Где:** [volunteers/sockets/assignments.py:13](../volunteers/sockets/assignments.py),
клиент [ui/src/integrations/socketio/socket.ts](../ui/src/integrations/socketio/socket.ts).

**Суть.** Обработчик подключения объявлен как `async def connect(sid, environ)`. Клиент
подключается с `auth: { token: "Bearer <access token>" }`, когда токен уже есть, то есть
практически всегда. Если auth непустой, python-socketio 5.15 вызывает обработчик как
`connect(sid, environ, auth)`. На `TypeError` он повторяет вызов с меньшим числом аргументов
только для `disconnect` (`socketio/async_server.py`, `_trigger_event`), а здесь просто
перевыбрасывает ошибку. В итоге CONNECT для namespace не подтверждается, клиент не выполняет
`subscribe_day_assignments` и не получает `assignment_updated`.

**Симптомы:**
- В логе бэкенда на каждое подключение:
  `TypeError: register_assignment_handlers.<locals>.connect() takes 2 positional arguments but 3 were given`.
- Админ меняет назначение, а у открытой страницы дня у других пользователей ничего не
  обновляется до перезагрузки.
- Воспроизводится и на обычном дев-бэкенде (:8000), не только в e2e-стеке.

**Как воспроизвести без браузера** (polling, e2e-бэкенд на :8001):
- пакет `40` без auth получает ответ `40{"sid":...}`;
- пакет `40{"token":"Bearer x"}` не получает ответа, long-poll висит до таймаута.

**Вероятный фикс:** `async def connect(sid: str, environ: dict[str, Any], auth: dict[str, Any] | None = None) -> None`.
Заодно стоит решить, должен ли сокет проверять токен: сейчас `auth` никак не используется,
и подписаться на комнату любого дня может кто угодно.

**Покрытие в тестах:** `e2e/tests/assignments.spec.ts`, тест «volunteer day page updates in
realtime» помечен `test.fail(true, "socket.io connect handler rejects clients that send auth")`.
После исправления он начнёт падать с «expected to fail», тогда `test.fail` нужно снять.
Основной тест назначений проверяет страницу волонтёра через reload.

## 2. Экспорт года игнорирует `BASE_URL`

**Где:** [ui/src/routes/_logged-in/$yearId/settings.tsx:539](../ui/src/routes/_logged-in/$yearId/settings.tsx).

**Суть.** Экспорт скачивается по абсолютному пути
`downloadFile(\`/api/v1/admin/year/${yearId}/export-csv\`)`, без `import.meta.env.BASE_URL`.
Для сертификатов в `results.tsx:127` префикс используется:
`${import.meta.env.BASE_URL}api/v1/admin/year/${yearId}/certificates`. Если приложение
собрано с `PUBLIC_URL` с подпутём (как раз про это последний коммит `4a5c08e Respect PUBLIC_URL
base path in Keycloak redirect_uri`), экспорт уйдёт мимо API.

**Покрытие:** e2e работает с base `/`, поэтому тест экспорта
(`results-certificates.spec.ts`, шаг 5) это не ловит.

**Фикс:** собирать URL так же, как для сертификатов.

## 3. Пол «Prefer not to say» показывается как «Female»

**Где:**
- [ui/src/components/DetailedUserCard.tsx:111](../ui/src/components/DetailedUserCard.tsx):
  `user.gender === "male" ? t("Male") : t("Female")`;
- [ui/src/routes/_logged-in/$yearId/contacts.tsx:483](../ui/src/routes/_logged-in/$yearId/contacts.tsx):
  опции фильтра по полу, `label: g === "male" ? t("Male") : t("Female")`.

**Суть.** Любое значение, кроме `male` (включая `unspecified`), отображается как «Female».
В других местах уже есть `getGenderLabel` из `@/utils/gender`, например в колонке таблицы
contacts (`contacts.tsx:245`) и в форме регистрации.

**Фикс:** использовать `getGenderLabel(gender, t)` в обоих местах.

**Покрытие:** тесты используют только Male/Female и это не ловят.

## 4. `/results` показывает не всех зарегистрированных

**Где:** [volunteers/services/year.py:1149](../volunteers/services/year.py) (`get_year_results`),
подзаголовок в [ui/src/routes/_logged-in/$yearId/results.tsx:117](../ui/src/routes/_logged-in/$yearId/results.tsx).

**Суть.** `get_year_results` пропускает волонтёров, у которых нет ни одного дня с посещением
`yes`/`late` (`if not was_at_lease_once: continue`). При этом на странице написано «All
registered volunteers for this year (N)». Похоже, фильтр сделан намеренно: результаты нужны
только участвовавшим. Тогда неправ текст на странице. Ещё стоит учесть, что от
`get_year_results` зависит генерация сертификатов.

**Покрытие:** `results-certificates.spec.ts` фиксирует текущее поведение: волонтёра без
посещений (vol3) в результатах нет.

**Нужно решить:** поменять текст или поведение.

## 5. Кнопка «Export to CSV» скачивает ZIP

**Где:** `settings.tsx:547` использует ключ `t("Export to ZIP")`, при этом в
`ui/src/i18n/locales/en/translation.json:227` стоит `"Export to ZIP": "Export to CSV"`, а в
`ru/translation.json:236` — `"Экспортировать в CSV"`.

**Суть.** На кнопке написано CSV, а скачивается ZIP с несколькими CSV-файлами (например,
`01_users_and_registrations.csv`). Тест ищет кнопку по видимому тексту «Export to CSV».
Если поправить перевод, локатор в `results-certificates.spec.ts` тоже нужно обновить.

## 6. В форме заявки волонтёра не показываются дни

**Где:** [ui/src/routes/_logged-in/$yearId/registration.tsx](../ui/src/routes/_logged-in/$yearId/registration.tsx).

**Суть.** API `GET /api/v1/year/{id}` отдаёт `days`, но форма заявки выводит только
желаемые позиции. Дни волонтёр видит только в сайдбаре. Возможно, так и задумано
(миграция `make_all_days_mandatory`), но тогда `days` в ответе для формы не нужен. Нужно
уточнить.

**Покрытие:** `admin-entities.spec.ts` проверяет дни у волонтёра через сайдбар.

## 7. Селект пола без связанного label

**Где:** `registration.tsx:286-292`: у `InputLabel` и `Select` нет `id`/`labelId`.

**Суть.** У комбобокса нет доступного имени: скринридер его не озвучивает, и по label его
не найти. Тест ищет селект по `input[name="gender"]` внутри `.MuiFormControl-root`.
Для желаемых позиций рядом `labelId` задан, поэтому лучше сделать так же.

## 8. Заголовки страниц дня

**Где:**
- `ui/src/routes/_logged-in/$yearId/days/$dayId/edit.tsx:1465` — `Day Assignments - id={dayId}`;
- `ui/src/routes/_logged-in/$yearId/days/$dayId/index.tsx:103` — «Volunteer Assignments»,
  в коде уже есть TODO: show day name.

**Суть.** Название дня не показывается, из-за этого страницы разных дней не отличить.
Тесты на заголовки не опираются.

## 9. Одновременные прогоны e2e делят `test-results`

**Где:** `e2e/playwright.config.ts` (`outputDir: "./test-results"`).

**Суть.** Если параллельно запустить несколько процессов `playwright test`, каждый в начале
очищает `outputDir`. В результате пропадают трейсы и скриншоты соседних прогонов, и
появляется `ENOENT ... .playwright-artifacts-*/...trace`, который прячет настоящую ошибку.
Одиночный прогон (обычный сценарий) это не затрагивает.

Сессии пользователей уже разведены по прогонам (`e2e/.auth/<RUN_TAG>/`), так что
перетирания `admin.json` больше нет. Для параллельных прогонов можно передавать
`--output=<dir>` или сделать `outputDir` зависящим от `E2E_RUN_TAG` (тогда отчёты будут
копиться и их придётся чистить руками).

---

## Что в тестах сделано обходным путём

- **Первый админ.** API для выдачи роли админа без уже существующего админа нет, поэтому
  `tests/auth.setup.ts` после регистрации через UI выполняет `UPDATE users SET is_admin = true`
  напрямую в базе `volunteers_e2e`, один раз за прогон. Остальных админов можно назначать
  через `POST /api/v1/admin/user/{id}/edit` (`is_admin`).
- **Нет `data-testid`.** Местами используются CSS-фолбэки: `.MuiCard-root` на странице
  registration-forms, `.MuiFormControl-root` для селекта пола; таблица contacts
  виртуализирована и не имеет ролей строк.
