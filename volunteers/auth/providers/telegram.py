from dataclasses import dataclass


@dataclass
class TelegramLoginData:
    auth_date: int
    first_name: str
    last_name: str
    username: str
    id: int
    hash: str


async def verify_telegram_login(data: TelegramLoginData) -> bool:
    """
    Verify the Telegram login data.
    """
    return True # TODO: Implement the actual verification

