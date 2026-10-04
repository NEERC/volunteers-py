When using the terminal - don't use cd to navigate to the project directory. Use the project root directory as the current directory.

When writing backend code, follow these rules:
- Use .venv/bin for executing commands like pytest or alembic
- Always use alebmic's automigration for generating migrations. Never generate migrations manually.
- Assume backend is already running at localhost:8000 and it's in refresh mode, so the code is updated automatically.

When writing frontend code, follow these rules:
- Use pnpm run openapi-ts to generate types from OpenAPI spec
- Add translations for all new strings

Generated code (ui/src/client, ui/src/routeTree.gen.ts) is excluded from all linters and formatters and is checked in CI (.github/workflows/codegen.yml): regenerating it must not change any files. Commit the generator output as is, don't edit or format it by hand. Alembic migrations are regular code: they are linted, may be edited by hand, and CI runs `alembic check` to make sure models have no unmigrated changes.
