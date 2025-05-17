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


class DatabaseConfig(BaseModel):
    url: str


class ServerConfig(BaseModel):
    port: int
    host: str


class LoggingConfig(BaseModel):
    level: str


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="VOLUNTEERS_", env_nested_delimiter="__"
    )
    jwt: JWTConfig
    telegram: TelegramConfig
    database: DatabaseConfig
    server: ServerConfig
    logging: LoggingConfig
