"""
Server-side half of the OpenID Connect Authorization Code Flow with PKCE.

The browser half (redirect to Keycloak, `state` and `code_verifier` handling) lives in
`ui/src/utils/keycloak.ts`. Here the authorization code received by the frontend is
exchanged for tokens (RFC 6749 §4.1.3), and the user is identified via the UserInfo
endpoint (OIDC Core §5.3) by the `sub` claim.

TODO: this is a hand-written minimal client. It could be rewritten with Authlib to get
endpoint discovery (`.well-known/openid-configuration`) and `id_token` validation
(JWKS signature, `iss`, `aud`, `nonce`) instead of relying on the UserInfo endpoint.
"""

from dataclasses import dataclass
from typing import Any

import httpx
from loguru import logger


@dataclass
class KeycloakLoginConfig:
    issuer: str
    client_id: str
    client_secret: str | None


@dataclass
class KeycloakUserInfo:
    sub: str
    preferred_username: str | None
    email: str | None
    given_name: str | None
    family_name: str | None


class KeycloakAuthError(Exception):
    message = "Invalid Keycloak login"

    def __init__(self) -> None:
        super().__init__(self.message)


class KeycloakUnavailableError(KeycloakAuthError):
    message = "Keycloak is unavailable"


def authorization_endpoint(issuer: str) -> str:
    return f"{issuer.rstrip('/')}/protocol/openid-connect/auth"


def token_endpoint(issuer: str) -> str:
    return f"{issuer.rstrip('/')}/protocol/openid-connect/token"


def userinfo_endpoint(issuer: str) -> str:
    return f"{issuer.rstrip('/')}/protocol/openid-connect/userinfo"


def _optional_str(data: dict[str, Any], key: str) -> str | None:
    value = data.get(key)
    return str(value) if value else None


async def exchange_keycloak_code(
    code: str, redirect_uri: str, code_verifier: str, config: KeycloakLoginConfig
) -> KeycloakUserInfo:
    """
    Exchange an authorization code for tokens and fetch the user info.

    The user info is requested directly from Keycloak over TLS with the freshly
    issued access token, so its contents can be trusted without verifying a JWT signature.
    """
    form = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": config.client_id,
        "code_verifier": code_verifier,
    }
    if config.client_secret:
        form["client_secret"] = config.client_secret

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            token_response = await client.post(token_endpoint(config.issuer), data=form)
        except httpx.HTTPError as e:
            logger.error(f"Keycloak token request failed: {e}")
            raise KeycloakUnavailableError() from e
        if token_response.status_code != httpx.codes.OK:
            logger.info(
                f"Keycloak rejected the code: {token_response.status_code} {token_response.text}"
            )
            raise KeycloakAuthError()
        access_token = token_response.json().get("access_token")
        if not access_token:
            raise KeycloakAuthError()

        try:
            userinfo_response = await client.get(
                userinfo_endpoint(config.issuer),
                headers={"Authorization": f"Bearer {access_token}"},
            )
        except httpx.HTTPError as e:
            logger.error(f"Keycloak userinfo request failed: {e}")
            raise KeycloakUnavailableError() from e
        if userinfo_response.status_code != httpx.codes.OK:
            logger.info(f"Keycloak userinfo request failed: {userinfo_response.status_code}")
            raise KeycloakAuthError()
        data: dict[str, Any] = userinfo_response.json()

    sub = data.get("sub")
    if not sub:
        raise KeycloakAuthError()

    return KeycloakUserInfo(
        sub=str(sub),
        preferred_username=_optional_str(data, "preferred_username"),
        email=_optional_str(data, "email"),
        given_name=_optional_str(data, "given_name"),
        family_name=_optional_str(data, "family_name"),
    )
