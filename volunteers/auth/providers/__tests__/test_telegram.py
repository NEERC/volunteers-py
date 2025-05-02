import copy
from collections.abc import Generator

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
    test_data = TelegramLoginData(
        auth_date=1746113463,
        first_name="Матвей",
        last_name="Колесов",
        username="Vergil645",
        id=773660947,
        photo_url="https://t.me/i/userpic/320/3sH7KMNQRzYN_-Y4m75SgUL1-VpRwhoFy6u_4CRwiGU.jpg",
        hash="494e35602ffba396978394e8d1f58bc00d098070366d3300acacdfadee75f26e",
    )

    def test_valid_login(self, token: str) -> None:
        data = self.test_data
        assert verify_telegram_login_hash(data, token)

    def test_invalid_login(self, token: str) -> None:
        data = copy.deepcopy(self.test_data)
        data.first_name += "!"
        assert not verify_telegram_login_hash(data, token)
