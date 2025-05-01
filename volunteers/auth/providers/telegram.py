from dataclasses import dataclass


@dataclass
class TelegramLoginData:
    auth_date: int
    first_name: str
    last_name: str
    username: str
    id: int
    hash: str


@dataclass
class TelegramLoginConfig:
    token: str
    expiration_time: int


async def verify_telegram_login(data: TelegramLoginData, config: TelegramLoginConfig) -> bool:
    """
    Verify the Telegram login data.
    """

    import hashlib
    import hmac
    import time

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(data.__dict__.items()) if k != "hash"
    )
    secret_key = hashlib.sha256(config.token.encode()).digest()
    hmac_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(hmac_hash, data.hash):
        return False

    return time.time() - data.auth_date < config.expiration_time
