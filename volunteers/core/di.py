import dependency_injector.containers as containers
import dependency_injector.providers as providers

from volunteers.core.config import Config
from volunteers.core.db import create_engine
from volunteers.services.user import UserService


class Container(containers.DeclarativeContainer):
    config = providers.Factory(Config)
    db = providers.Singleton(create_engine, config.provided.database.url)
    # logger = providers.Singleton(Logger)
    # telegram = providers.Singleton(Telegram)
    user_service = providers.Singleton(UserService, db=db)
