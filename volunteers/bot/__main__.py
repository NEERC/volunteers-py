import asyncio

import aiogram
from loguru import logger

from volunteers.core.di import Container

dp = aiogram.Dispatcher()


@dp.message()
async def handle(message: aiogram.types.Message) -> None:
    logger.info(f"Received message: {message}")


async def main() -> None:
    container = Container()
    container.wire()
    init_resources = container.init_resources()
    if init_resources:
        await init_resources

    bot = await container.telegram()
    logger.info("Starting polling")

    await dp.start_polling(bot)

    shutdown_resources = container.shutdown_resources()
    if shutdown_resources:
        await shutdown_resources


if __name__ == "__main__":
    asyncio.run(main())
