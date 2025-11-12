import dependency_injector.containers as containers
import dependency_injector.providers as providers

from volunteers.bot.notify import Notifier
from volunteers.core.config import Config
from volunteers.core.db import create_engine
from volunteers.core.tg import get_bot
from volunteers.services.i18n import I18nService
from volunteers.services.legacy_user import LegacyUserService
from volunteers.services.user import UserService
from volunteers.services.year import YearService


class Container(containers.DeclarativeContainer):
    wiring_config = containers.WiringConfiguration(
        packages=[
            "volunteers.services",
            "volunteers.models",
            "volunteers.schemas",
            "volunteers.core",
            "volunteers.auth",
            "volunteers.api",
            "volunteers.bot",
        ],
        warn_unresolved=True,  # type: ignore[call-arg]
    )
    config = providers.Factory(Config)
    db = providers.Singleton(create_engine, config.provided.database.url)
    # logger = providers.Singleton(Logger)
    telegram = providers.Singleton(get_bot, config.provided.telegram.token)

    notifier = providers.Singleton(Notifier, bot=telegram, config=config)
    i18n_service = providers.Singleton(I18nService, locale="en")
    user_service = providers.Singleton(UserService)
    year_service = providers.Singleton(YearService, notifier=notifier)
    legacy_user_service = providers.Singleton(LegacyUserService)
