When using the terminal - don't use cd to navigate to the project directory. Use the project root directory as the current directory.

When writing backend code, follow these rules:
- Use .venv/bin for executing commands like pytest or alembic
- Always use alebmic's automigration for generating migrations. Never generate migrations manually.
- Assume backend is already running at localhost:8000 and it's in refresh mode, so the code is updated automatically.

When writing frontend code, follow these rules:
- Use pnpm run openapi-ts to generate types from OpenAPI spec
- Add translations for all new strings

Translations: keys are the English strings, in ui/src/i18n/locales/{en,ru}/translation.json; backend error messages are in volunteers/services/i18n_locales. Translate a key by where it is shown: find its `t(...)` calls first. A key shown with two meanings gets an i18next context (`t("Score", { context: "assessment" })` reads the key `Score_assessment`). The e2e tests find elements by their English text, so a changed English value means updating e2e/tests too.

Russian glossary, used the same way on every screen and in the backend:
- all assignments of a day (the day page, publishing, copying a day) — распределение; one assignment of a volunteer — назначение
- position — роль (feminine: «доступна», «менеджерская роль»)
- hall — холл
- score of a position or a day — баллы; assessment — оценка

Generated code (ui/src/client, ui/src/routeTree.gen.ts) is excluded from all linters and formatters and is checked in CI (.github/workflows/codegen.yml): regenerating it must not change any files. Commit the generator output as is, don't edit or format it by hand. Alembic migrations are regular code: they are linted, may be edited by hand, and CI runs `alembic check` to make sure models have no unmigrated changes.
