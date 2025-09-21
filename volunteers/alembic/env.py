import asyncio
from typing import Any

from alembic import context
from dependency_injector.wiring import inject
from sqlalchemy import Connection

from volunteers.core.di import Container
from volunteers.models.base import metadata

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
# if config.config_file_name is not None:
#     fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=False,
    )
    with context.begin_transaction():
        context.run_migrations()


@inject
async def run_async_migrations() -> None:
    container = Container()
    container.wire(packages=["volunteers"])
    if init_resources := container.init_resources():
        await init_resources

    engine = await container.db()
    async with engine.connect() as conn:
        await conn.run_sync(do_run_migrations)
    await engine.dispose()  # nice-to-have cleanup


def run_migrations_online() -> Any:
    """Entry-point used by Alembic *and* by your own code."""
    coro = run_async_migrations()
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        # No loop yet → classic Alembic CLI
        asyncio.run(coro)
    else:
        # A loop is already running → just hand back the coroutine
        # so the caller (`await run_migrations_online()`) drives it.
        return coro


run_migrations_online()
