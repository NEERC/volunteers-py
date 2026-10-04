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


class KeycloakConfig(BaseModel):
    issuer: str = "https://nerc.itmo.ru/teaching/auth/realms/master"
    client_id: str
    client_secret: str | None = None
    scope: str = "openid profile email"


class GeoIPConfig(BaseModel):
    # Path to a MaxMind-format country database (e.g. DB-IP Country Lite)
    database_path: str | None = None
    # Header with the real client IP set by the reverse proxy
    client_ip_header: str | None = "X-Real-IP"


class DatabaseConfig(BaseModel):
    url: str


class ServerConfig(BaseModel):
    port: int
    host: str


class LoggingConfig(BaseModel):
    level: str


class NotificationConfig(BaseModel):
    tg_chat_id: int


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="VOLUNTEERS_", env_nested_delimiter="__", extra="allow"
    )
    jwt: JWTConfig
    telegram: TelegramConfig
    keycloak: KeycloakConfig
    geoip: GeoIPConfig = GeoIPConfig()
    database: DatabaseConfig
    server: ServerConfig
    logging: LoggingConfig
    notification: NotificationConfig
