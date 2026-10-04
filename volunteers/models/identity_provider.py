import enum


class IdentityProvider(str, enum.Enum):
    TELEGRAM = "telegram"
    KEYCLOAK = "keycloak"
    LEGACY = "legacy"
