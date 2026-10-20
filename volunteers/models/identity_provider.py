import enum


class IdentityProvider(str, enum.Enum):
    TELEGRAM = "telegram"
    KEYCLOAK = "keycloak"
    LEGACY = "legacy"


# A user can have at most one identity of these providers
SINGLE_IDENTITY_PROVIDERS = frozenset({IdentityProvider.TELEGRAM, IdentityProvider.KEYCLOAK})
