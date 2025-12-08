from collections.abc import Generator
from typing import ClassVar

import dependency_injector.containers as containers
import dependency_injector.providers as providers
import pytest

from volunteers.auth.providers.telegram import TelegramLoginData, verify_telegram_login_hash
from volunteers.core.config import Config


class Container(containers.DeclarativeContainer):
    config = providers.Singleton(Config)


@pytest.fixture(scope="session")
def container() -> Generator[Container]:
    container = Container()
    yield container
    container.unwire()


@pytest.fixture(scope="session")
def token(container: Container) -> str:
    return container.config().telegram.token


class TestTelegram:
    test_data_base: ClassVar[dict[str, str | int]] = {
        "auth_date": 1746113463,
        "first_name": "Матвей",
        "last_name": "Колесов",
        "username": "Vergil645",
        "id": 773660947,
        "photo_url": "https://t.me/i/userpic/320/3sH7KMNQRzYN_-Y4m75SgUL1-VpRwhoFy6u_4CRwiGU.jpg",
    }

    @staticmethod
    def generate_hash(data: dict[str, str | int], token: str) -> str:
        import hashlib
        import hmac

        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()) if v is not None)
        secret_key = hashlib.sha256(token.encode()).digest()
        return hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    def test_valid_login(self, token: str) -> None:
        data_dict = self.test_data_base.copy()
        data_dict["hash"] = self.generate_hash(self.test_data_base, token)
        data = TelegramLoginData(**data_dict)
        assert verify_telegram_login_hash(data, token)

    def test_invalid_login(self, token: str) -> None:
        data_dict = self.test_data_base.copy()
        data_dict["hash"] = self.generate_hash(self.test_data_base, token)
        data_dict["first_name"] += "!"
        data = TelegramLoginData(**data_dict)
        assert not verify_telegram_login_hash(data, token)
