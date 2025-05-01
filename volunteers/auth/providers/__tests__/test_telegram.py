import hashlib
import hmac
import time

import pytest

from volunteers.auth.providers.telegram import (
    TelegramLoginConfig,
    TelegramLoginData,
    verify_telegram_login,
)


@pytest.mark.asyncio
class TestTelegram:
    config = TelegramLoginConfig(
        token="testToken",  # noqa: S106
        expiration_time=24 * 3600,
    )

    def _get_test_login_data(self) -> TelegramLoginData:
        data = TelegramLoginData(
            auth_date=int(time.time()),
            first_name="Test",
            last_name="Testovich",
            username="testDominator777",
            id=1,
            hash="",
        )

        data_check_string = "\n".join(
            f"{k}={v}" for k, v in sorted(data.__dict__.items()) if k != "hash"
        )
        secret_key = hashlib.sha256(self.config.token.encode()).digest()
        data.hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        return data

    async def test_valid_login(self) -> None:
        data = self._get_test_login_data()
        assert await verify_telegram_login(data, self.config)

    async def test_incorrect_hash(self) -> None:
        data = self._get_test_login_data()
        data.hash = ""
        assert not await verify_telegram_login(data, self.config)

    async def test_changed_field(self) -> None:
        data = self._get_test_login_data()
        data.first_name += "!"
        assert not await verify_telegram_login(data, self.config)

    async def test_expired_login(self) -> None:
        data = self._get_test_login_data()
        data.auth_date -= self.config.expiration_time + 1
        assert not await verify_telegram_login(data, self.config)
