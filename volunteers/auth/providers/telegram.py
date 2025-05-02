from dataclasses import dataclass


@dataclass
class TelegramLoginData:
    id: int
    auth_date: int
    first_name: str
    hash: str
    last_name: str | None
    username: str | None
    photo_url: str | None


@dataclass
class TelegramLoginConfig:
    token: str
    expiration_time: int


def verify_telegram_login(data: TelegramLoginData, config: TelegramLoginConfig) -> bool:
    """
    Verify the Telegram login data.
    """

    import time

    if not verify_telegram_login_hash(data, config.token):
        return False

    return time.time() - data.auth_date < config.expiration_time


def verify_telegram_login_hash(data: TelegramLoginData, token: str) -> bool:
    """
    Verify the Telegram login data by hash.
    """

    import hashlib
    import hmac

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(data.__dict__.items()) if k != "hash" and v is not None
    )
    secret_key = hashlib.sha256(token.encode()).digest()
    hmac_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    return hmac.compare_digest(hmac_hash, data.hash)
