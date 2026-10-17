import aiogram
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.client.telegram import TelegramAPIServer


async def get_bot(token: str, api_server: str | None = None) -> aiogram.Bot:
    if api_server is None:
        return aiogram.Bot(token=token)
    session = AiohttpSession(api=TelegramAPIServer.from_base(api_server))
    return aiogram.Bot(token=token, session=session)
