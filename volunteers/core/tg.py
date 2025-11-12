import aiogram


async def get_bot(token: str) -> aiogram.Bot:
    return aiogram.Bot(token=token)
