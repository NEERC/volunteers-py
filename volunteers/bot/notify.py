import aiogram
import aiogram.exceptions
from loguru import logger

from volunteers.core.config import Config


class Notifier:
    def __init__(self, bot: aiogram.Bot, config: Config) -> None:
        self.bot = bot
        self.config = config

    async def notify(self, message: str) -> None:
        try:
            await self.bot.send_message(chat_id=self.config.notification.tg_chat_id, text=message)
        except aiogram.exceptions.TelegramAPIError as e:
            logger.error(f"Failed to send notification: {e}")
