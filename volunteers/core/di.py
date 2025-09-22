import dependency_injector.containers as containers
import dependency_injector.providers as providers

from volunteers.core.config import Config
from volunteers.core.db import create_engine
from volunteers.services.i18n import I18nService
from volunteers.services.legacy_user import LegacyUserService
from volunteers.services.user import UserService
from volunteers.services.year import YearService


class Container(containers.DeclarativeContainer):
    config = providers.Factory(Config)
    db = providers.Singleton(create_engine, config.provided.database.url)
    # logger = providers.Singleton(Logger)
    # telegram = providers.Singleton(Telegram)
    i18n_service = providers.Singleton(I18nService, locale="en")
    user_service = providers.Singleton(UserService, db=db)
    year_service = providers.Singleton(YearService, db=db)
    legacy_user_service = providers.Singleton(LegacyUserService, db=db)
