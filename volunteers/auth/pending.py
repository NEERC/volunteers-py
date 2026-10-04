"""
Pending authentication state.

Authentication may take several steps (e.g. Telegram, then Keycloak, then registration).
Identities verified on each step are accumulated in a short-lived signed token that is
passed back by the client on the next step.
"""

import datetime

from dependency_injector.wiring import Provide, inject
from fastapi import HTTPException
from pydantic import BaseModel

from volunteers.auth.jwt_tokens import create_token, decode_token
from volunteers.core.config import Config
from volunteers.core.di import Container
from volunteers.models import IdentityProvider

PENDING_TOKEN_EXPIRATION = 30 * 60  # in seconds


class VerifiedIdentity(BaseModel):
    provider: IdentityProvider
    subject: str
    display_name: str | None = None


class KeycloakProfile(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None


class PendingAuth(BaseModel):
    identities: list[VerifiedIdentity] = []
    keycloak_profile: KeycloakProfile | None = None
    telegram_username: str | None = None

    def get(self, provider: IdentityProvider) -> VerifiedIdentity | None:
        for identity in self.identities:
            if identity.provider == provider:
                return identity
        return None

    def with_identity(self, identity: VerifiedIdentity) -> "PendingAuth":
        """Return a copy with `identity` added, replacing an identity of the same provider."""
        identities = [i for i in self.identities if i.provider != identity.provider]
        return self.model_copy(update={"identities": [*identities, identity]})


@inject
def create_pending_token(pending: PendingAuth, config: Config = Provide[Container.config]) -> str:
    now = datetime.datetime.now(tz=datetime.UTC)
    return create_token(
        {
            "pending": pending.model_dump(mode="json"),
            "exp": now + datetime.timedelta(seconds=PENDING_TOKEN_EXPIRATION),
            "iat": now,
            "type": "pending",
        }
    )


def decode_pending_token(token: str | None) -> PendingAuth:
    if token is None:
        return PendingAuth()
    payload = decode_token(token)
    if payload.get("type") != "pending":
        raise HTTPException(status_code=401, detail="Invalid token type")
    return PendingAuth.model_validate(payload["pending"])
