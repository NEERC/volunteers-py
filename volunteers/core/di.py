import dependency_injector.containers as containers
import dependency_injector.providers as providers
import socketio  # type: ignore[import-untyped]

from volunteers.bot.notify import Notifier
from volunteers.core.config import Config
from volunteers.core.db import create_engine
from volunteers.core.tg import get_bot
from volunteers.services.assessment import AssessmentService
from volunteers.services.export import ExportService
from volunteers.services.i18n import I18nService
from volunteers.services.legacy_user import LegacyUserService
from volunteers.services.user import UserService
from volunteers.services.year import YearService


def get_socketio_server() -> socketio.AsyncServer:
    """Get the socketio server instance."""
    from volunteers.core.socketio import sio

    return sio


class Container(containers.DeclarativeContainer):
    # Remove automatic wiring - will be done manually in app.py
    config = providers.Factory(Config)
    db = providers.Singleton(create_engine, config.provided.database.url)
    # logger = providers.Singleton(Logger)
    telegram = providers.Singleton(get_bot, config.provided.telegram.token)

    socketio_server: providers.Provider[socketio.AsyncServer] = providers.Singleton(
        get_socketio_server
    )

    notifier = providers.Singleton(Notifier, bot=telegram, config=config)
    i18n_service = providers.Singleton(I18nService, locale="en")
    user_service = providers.Singleton(UserService)
    year_service = providers.Singleton(
        YearService, notifier=notifier, socketio_server=socketio_server
    )
    legacy_user_service = providers.Singleton(LegacyUserService)
    assessment_service = providers.Singleton(AssessmentService)
    export_service = providers.Singleton(ExportService)


# Create a global container instance (not wired yet)
container = Container()
