import copy
import os

from volunteers.auth.providers.telegram import TelegramLoginData, verify_telegram_login_hash


class TestTelegram:
    token: str = os.environ.get("TG_TOKEN", "")
    test_data = TelegramLoginData(
        auth_date=1746113463,
        first_name="Матвей",
        last_name="Колесов",
        username="Vergil645",
        id=773660947,
        photo_url="https://t.me/i/userpic/320/3sH7KMNQRzYN_-Y4m75SgUL1-VpRwhoFy6u_4CRwiGU.jpg",
        hash="494e35602ffba396978394e8d1f58bc00d098070366d3300acacdfadee75f26e",
    )

    def test_valid_login(self) -> None:
        data = self.test_data
        assert verify_telegram_login_hash(data, self.token)

    def test_invalid_login(self) -> None:
        data = copy.deepcopy(self.test_data)
        data.first_name += "!"
        assert not verify_telegram_login_hash(data, self.token)
