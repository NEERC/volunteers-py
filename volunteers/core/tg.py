import aiogram
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.client.telegram import PRODUCTION, TelegramAPIServer


async def get_bot(
    token: str, api_server: str | None = None, proxy: str | None = None
) -> aiogram.Bot:
    api = TelegramAPIServer.from_base(api_server) if api_server is not None else PRODUCTION
    session = AiohttpSession(api=api, proxy=proxy)
    return aiogram.Bot(token=token, session=session)
