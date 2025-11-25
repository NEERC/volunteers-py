When using the terminal - don't use cd to navigate to the project directory. Use the project root directory as the current directory.

When writing backend code, follow these rules:
- Use .venv/bin for executing commands like pytest or alembic
- Always use alebmic's automigration for generating migrations. Never generate migrations manually.
- Assume backend is already running at localhost:8000 and it's in refresh mode, so the code is updated automatically.

When writing frontend code, follow these rules:
- Use pnpm run openapi-ts to generate types from OpenAPI spec
- Add translations for all new strings
