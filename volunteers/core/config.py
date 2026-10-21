from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class JWTConfig(BaseModel):
    secret: str
    algorithm: str
    expiration: int  # in seconds
    refresh_expiration: int  # in seconds


class TelegramConfig(BaseModel):
    token: str
    expiration_time: int
    # Bot API server base URL, the official one is used when not set
    api_server: str | None = None
    # Proxy for Bot API requests, e.g. http://user:pass@host:3128 (socks5:// works too),
    # requests go directly when not set
    proxy: str | None = None


class KeycloakConfig(BaseModel):
    issuer: str = "https://nerc.itmo.ru/teaching/auth/realms/master"
    client_id: str
    client_secret: str | None = None
    scope: str = "openid profile email"
    # Issuer as seen by the browser, when the backend reaches Keycloak by another URL
    # (the Keycloak mock of test stands)
    public_issuer: str | None = None


class DatabaseConfig(BaseModel):
    url: str


class ServerConfig(BaseModel):
    port: int
    host: str
    # Public URL of the app, e.g. https://volunteers.example.com/, for links in notifications
    public_url: str | None = None


class LoggingConfig(BaseModel):
    level: str


class NotificationConfig(BaseModel):
    tg_chat_id: int


class MailingConfig(BaseModel):
    # Whether this process sends mailings. Several processes may, only one sends at a time
    worker_enabled: bool = True
    # Below the limits of Telegram (about 30 messages per second for a bot)
    messages_per_second: float = 20
    # Seconds between checks of the sending queue
    poll_interval: float = 2


class BootstrapConfig(BaseModel):
    # ITMO ID usernames that get the admin role on registration, for test stands only
    admins: list[str] = []


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="VOLUNTEERS_", env_nested_delimiter="__", extra="allow"
    )
    jwt: JWTConfig
    telegram: TelegramConfig
    keycloak: KeycloakConfig
    database: DatabaseConfig
    server: ServerConfig
    logging: LoggingConfig
    notification: NotificationConfig
    bootstrap: BootstrapConfig = BootstrapConfig()
    mailing: MailingConfig = MailingConfig()
