from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException, Path
from loguru import logger

from volunteers.api.v1.auth.schemas import (
    AuthFlowResponse,
    AuthFlowStatus,
    ErrorLoginResponse,
    IdentityResponse,
    KeycloakAuthRequest,
    KeycloakConfigResponse,
    LegacyAuthRequest,
    PendingIdentityResponse,
    RefreshTokenRequest,
    RegistrationPrefill,
    RegistrationRequest,
    SuccessfulLoginResponse,
    TelegramAuthRequest,
    TelegramLoginData,
    UserResponse,
    UserUpdateRequest,
)
from volunteers.auth.deps import with_user
from volunteers.auth.jwt_tokens import (
    JWTTokenPayload,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
)
from volunteers.auth.pending import (
    KeycloakProfile,
    PendingAuth,
    VerifiedIdentity,
    create_pending_token,
    decode_pending_token,
)
from volunteers.auth.providers import telegram as telegram_provider
from volunteers.auth.providers.keycloak import (
    KeycloakAuthError,
    KeycloakLoginConfig,
    authorization_endpoint,
    exchange_keycloak_code,
)
from volunteers.auth.providers.legacy import verify_legacy_password
from volunteers.core.config import Config
from volunteers.core.di import Container
from volunteers.models import IdentityProvider, User, UserIdentity
from volunteers.schemas.user import UserIn, UserUpdate
from volunteers.services.i18n import I18nService
from volunteers.services.identity import IdentityService
from volunteers.services.user import UserService

router = APIRouter(tags=["auth"])

# A user can have at most one identity of these providers
SINGLE_IDENTITY_PROVIDERS = {IdentityProvider.TELEGRAM, IdentityProvider.KEYCLOAK}


def verify_telegram_login(data: TelegramLoginData, config: Config) -> bool:
    return telegram_provider.verify_telegram_login(
        data=telegram_provider.TelegramLoginData(
            id=data.telegram_id,
            auth_date=data.telegram_auth_date,
            first_name=data.telegram_first_name,
            hash=data.telegram_hash,
            last_name=data.telegram_last_name,
            username=data.telegram_username,
            photo_url=data.telegram_photo_url,
        ),
        config=telegram_provider.TelegramLoginConfig(
            token=config.telegram.token, expiration_time=config.telegram.expiration_time
        ),
    )


def _telegram_identity(data: TelegramLoginData) -> VerifiedIdentity:
    return VerifiedIdentity(
        provider=IdentityProvider.TELEGRAM,
        subject=str(data.telegram_id),
        display_name=f"@{data.telegram_username}"
        if data.telegram_username
        else data.telegram_first_name,
    )


async def _issue_tokens(user: User, config: Config) -> SuccessfulLoginResponse:
    payload = JWTTokenPayload(user_id=user.id, role="user")
    return SuccessfulLoginResponse(
        token=await create_access_token(payload),
        refresh_token=await create_refresh_token(payload),
        expires_in=config.jwt.expiration,
        refresh_expires_in=config.jwt.refresh_expiration,
    )


def _identities_response(pending: PendingAuth) -> list[PendingIdentityResponse]:
    return [
        PendingIdentityResponse(provider=i.provider, display_name=i.display_name)
        for i in pending.identities
    ]


async def _success_response(user: User, pending: PendingAuth, config: Config) -> AuthFlowResponse:
    return AuthFlowResponse(
        status=AuthFlowStatus.SUCCESS,
        tokens=await _issue_tokens(user, config),
        identities=_identities_response(pending),
        user_found=True,
    )


def _pending_response(
    pending: PendingAuth, status: AuthFlowStatus, *, user_found: bool
) -> AuthFlowResponse:
    profile = pending.keycloak_profile
    return AuthFlowResponse(
        status=status,
        pending_token=create_pending_token(pending),
        identities=_identities_response(pending),
        user_found=user_found,
        prefill=RegistrationPrefill(
            first_name=profile.first_name, last_name=profile.last_name, email=profile.email
        )
        if profile
        else None,
    )


async def _find_user(
    pending: PendingAuth, identity_service: IdentityService, i18n: I18nService
) -> User | None:
    """Find the user owning the verified identities."""
    users: dict[int, User] = {}
    for identity in pending.identities:
        user = await identity_service.get_user_by_identity(identity.provider, identity.subject)
        if user is not None:
            users[user.id] = user
    if len(users) > 1:
        logger.warning(f"Verified identities belong to different users: {list(users)}")
        raise HTTPException(
            status_code=409,
            detail=i18n.translate("These accounts are linked to different users"),
        )
    return next(iter(users.values()), None)


async def _link_identities(
    user: User,
    pending: PendingAuth,
    existing: list[UserIdentity],
    identity_service: IdentityService,
) -> None:
    for identity in pending.identities:
        already_linked = next(
            (
                e
                for e in existing
                if e.provider == identity.provider and e.subject == identity.subject
            ),
            None,
        )
        if already_linked is not None:
            await identity_service.update_display_name(already_linked.id, identity.display_name)
            continue
        await identity_service.add_identity(
            user_id=user.id,
            provider=identity.provider,
            subject=identity.subject,
            display_name=identity.display_name,
        )
        logger.info(f"Linked {identity.provider.value} identity to user {user.id}")


def _check_can_link(pending: PendingAuth, existing: list[UserIdentity], i18n: I18nService) -> None:
    for identity in pending.identities:
        if identity.provider not in SINGLE_IDENTITY_PROVIDERS:
            continue
        for e in existing:
            if e.provider == identity.provider and e.subject != identity.subject:
                logger.warning(f"User already has another {identity.provider.value} identity")
                raise HTTPException(
                    status_code=409,
                    detail=i18n.translate(
                        "This user is already linked to another {provider} account",
                        provider=identity.provider.value,
                    ),
                )


async def _resolve(
    pending: PendingAuth,
    identity_service: IdentityService,
    user_service: UserService,
    config: Config,
    i18n: I18nService,
) -> AuthFlowResponse:
    """Decide on the next authentication step based on the identities verified so far."""
    user = await _find_user(pending, identity_service, i18n)

    if user is None:
        if pending.get(IdentityProvider.KEYCLOAK) is None:
            return _pending_response(pending, AuthFlowStatus.KEYCLOAK_REQUIRED, user_found=False)
        return _pending_response(pending, AuthFlowStatus.REGISTRATION_REQUIRED, user_found=False)

    existing = await identity_service.get_user_identities(user.id)
    _check_can_link(pending, existing, i18n)

    has_keycloak = pending.get(IdentityProvider.KEYCLOAK) is not None or any(
        e.provider == IdentityProvider.KEYCLOAK for e in existing
    )
    if not has_keycloak:
        return _pending_response(pending, AuthFlowStatus.KEYCLOAK_REQUIRED, user_found=True)

    await _link_identities(user, pending, existing, identity_service)

    # Update telegram username on each login
    if (
        pending.get(IdentityProvider.TELEGRAM) is not None
        and user.telegram_username != pending.telegram_username
    ):
        await user_service.update_user(
            user_id=user.id, user_update=UserUpdate(telegram_username=pending.telegram_username)
        )

    logger.info(f"User {user.id} has been authorized")
    return await _success_response(user, pending, config)


def _keycloak_login_config(config: Config) -> KeycloakLoginConfig:
    return KeycloakLoginConfig(
        issuer=config.keycloak.issuer,
        client_id=config.keycloak.client_id,
        client_secret=config.keycloak.client_secret,
    )


@router.get("/keycloak/config")
@inject
async def keycloak_config(
    config: Annotated[Config, Depends(Provide[Container.config])],
) -> KeycloakConfigResponse:
    return KeycloakConfigResponse(
        authorization_endpoint=authorization_endpoint(config.keycloak.issuer),
        client_id=config.keycloak.client_id,
        scope=config.keycloak.scope,
    )


@router.post("/telegram")
@inject
async def telegram_auth(
    request: TelegramAuthRequest,
    identity_service: Annotated[IdentityService, Depends(Provide[Container.identity_service])],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
    config: Annotated[Config, Depends(Provide[Container.config])],
    i18n: Annotated[I18nService, Depends(Provide[Container.i18n_service])],
) -> AuthFlowResponse:
    if not verify_telegram_login(request, config):
        logger.info("Invalid Telegram login")
        raise HTTPException(status_code=401, detail=i18n.translate("Invalid Telegram login"))

    pending = decode_pending_token(request.pending_token).with_identity(_telegram_identity(request))
    pending.telegram_username = request.telegram_username
    return await _resolve(pending, identity_service, user_service, config, i18n)


@router.post("/keycloak")
@inject
async def keycloak_auth(
    request: KeycloakAuthRequest,
    identity_service: Annotated[IdentityService, Depends(Provide[Container.identity_service])],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
    config: Annotated[Config, Depends(Provide[Container.config])],
    i18n: Annotated[I18nService, Depends(Provide[Container.i18n_service])],
) -> AuthFlowResponse:
    pending = decode_pending_token(request.pending_token)
    try:
        info = await exchange_keycloak_code(
            code=request.code,
            redirect_uri=request.redirect_uri,
            code_verifier=request.code_verifier,
            config=_keycloak_login_config(config),
        )
    except KeycloakAuthError as e:
        raise HTTPException(status_code=401, detail=i18n.translate(e.message)) from e

    pending = pending.with_identity(
        VerifiedIdentity(
            provider=IdentityProvider.KEYCLOAK,
            subject=info.sub,
            display_name=info.preferred_username or info.email,
        )
    )
    pending.keycloak_profile = KeycloakProfile(
        first_name=info.given_name, last_name=info.family_name, email=info.email
    )
    return await _resolve(pending, identity_service, user_service, config, i18n)


@router.post("/legacy")
@inject
async def legacy_auth(
    request: LegacyAuthRequest,
    identity_service: Annotated[IdentityService, Depends(Provide[Container.identity_service])],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
    config: Annotated[Config, Depends(Provide[Container.config])],
    i18n: Annotated[I18nService, Depends(Provide[Container.i18n_service])],
) -> AuthFlowResponse:
    pending = decode_pending_token(request.pending_token)

    identity = await identity_service.get_identity(IdentityProvider.LEGACY, request.email)
    if identity is None or identity.secret is None:
        logger.warning("Detected an attempt to use a non-existent legacy account")
        raise HTTPException(status_code=403, detail=i18n.translate("User is not found"))

    if not verify_legacy_password(password=request.password, password_hash=identity.secret):
        logger.warning("Detected an attempt to use a legacy account with an incorrect password")
        raise HTTPException(status_code=403, detail=i18n.translate("Incorrect password"))

    pending = pending.with_identity(
        VerifiedIdentity(
            provider=IdentityProvider.LEGACY,
            subject=identity.subject,
            display_name=identity.display_name,
        )
    )
    return await _resolve(pending, identity_service, user_service, config, i18n)


@router.post("/register")
@inject
async def register(
    request: RegistrationRequest,
    identity_service: Annotated[IdentityService, Depends(Provide[Container.identity_service])],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
    config: Annotated[Config, Depends(Provide[Container.config])],
    i18n: Annotated[I18nService, Depends(Provide[Container.i18n_service])],
) -> AuthFlowResponse:
    pending = decode_pending_token(request.pending_token)

    if pending.get(IdentityProvider.KEYCLOAK) is None:
        raise HTTPException(
            status_code=403, detail=i18n.translate("ITMO account is required to register")
        )
    if pending.get(IdentityProvider.LEGACY) is not None:
        # Legacy identities always belong to an existing user
        raise HTTPException(status_code=409, detail=i18n.translate("User is already registered"))
    if await _find_user(pending, identity_service, i18n) is not None:
        logger.warning("Detected an attempt to register an existing user again")
        raise HTTPException(status_code=409, detail=i18n.translate("User is already registered"))

    user = await user_service.create_user(
        UserIn(
            first_name_ru=request.first_name_ru,
            last_name_ru=request.last_name_ru,
            first_name_en=request.first_name_en,
            last_name_en=request.last_name_en,
            isu_id=request.isu_id,
            patronymic_ru=request.patronymic_ru,
            phone=request.phone,
            email=request.email,
            telegram_username=pending.telegram_username,
            gender=request.gender,
            is_admin=False,
        )
    )
    logger.info("User has been registered")

    await _link_identities(user, pending, [], identity_service)
    return await _success_response(user, pending, config)


@router.post("/refresh")
@inject
async def refresh(
    request: RefreshTokenRequest,
    config: Annotated[Config, Depends(Provide[Container.config])],
    identity_service: Annotated[IdentityService, Depends(Provide[Container.identity_service])],
) -> SuccessfulLoginResponse | ErrorLoginResponse:
    payload = await verify_refresh_token(request.refresh_token)
    identities = await identity_service.get_user_identities(payload.user_id)
    if not any(i.provider == IdentityProvider.KEYCLOAK for i in identities):
        # Sessions started before the ITMO account became mandatory must log in again
        logger.info(f"User {payload.user_id} has no keycloak identity, refusing to refresh")
        raise HTTPException(status_code=401, detail="ITMO account is not linked")
    return SuccessfulLoginResponse(
        token=await create_access_token(payload),
        refresh_token=request.refresh_token,
        expires_in=config.jwt.expiration,
        refresh_expires_in=config.jwt.refresh_expiration,
    )


@router.get("/identities")
@inject
async def my_identities(
    user: Annotated[User, Depends(with_user)],
    identity_service: Annotated[IdentityService, Depends(Provide[Container.identity_service])],
) -> list[IdentityResponse]:
    identities = await identity_service.get_user_identities(user.id)
    return [
        IdentityResponse(
            id=i.id, provider=i.provider, display_name=i.display_name, created_at=i.created_at
        )
        for i in identities
    ]


@router.post("/identities/telegram")
@inject
async def link_telegram(
    request: TelegramLoginData,
    user: Annotated[User, Depends(with_user)],
    identity_service: Annotated[IdentityService, Depends(Provide[Container.identity_service])],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
    config: Annotated[Config, Depends(Provide[Container.config])],
    i18n: Annotated[I18nService, Depends(Provide[Container.i18n_service])],
) -> list[IdentityResponse]:
    if not verify_telegram_login(request, config):
        logger.info("Invalid Telegram login")
        raise HTTPException(status_code=401, detail=i18n.translate("Invalid Telegram login"))

    pending = PendingAuth(identities=[_telegram_identity(request)])
    owner = await _find_user(pending, identity_service, i18n)
    if owner is not None and owner.id != user.id:
        raise HTTPException(
            status_code=409,
            detail=i18n.translate("This account is already linked to another user"),
        )
    existing = await identity_service.get_user_identities(user.id)
    _check_can_link(pending, existing, i18n)
    await _link_identities(user, pending, existing, identity_service)
    if user.telegram_username != request.telegram_username:
        await user_service.update_user(
            user_id=user.id, user_update=UserUpdate(telegram_username=request.telegram_username)
        )
    return await my_identities(user=user, identity_service=identity_service)


@router.delete("/identities/{identity_id}")
@inject
async def unlink_identity(
    identity_id: Annotated[int, Path(title="The ID of the identity")],
    user: Annotated[User, Depends(with_user)],
    identity_service: Annotated[IdentityService, Depends(Provide[Container.identity_service])],
    i18n: Annotated[I18nService, Depends(Provide[Container.i18n_service])],
) -> list[IdentityResponse]:
    identity = await identity_service.get_identity_by_id(identity_id)
    if identity is None or identity.user_id != user.id:
        raise HTTPException(status_code=404, detail="Identity not found")
    if identity.provider == IdentityProvider.KEYCLOAK:
        raise HTTPException(
            status_code=400, detail=i18n.translate("ITMO account cannot be unlinked")
        )
    await identity_service.delete_identity(identity_id)
    logger.info(f"User {user.id} unlinked {identity.provider.value} identity")
    return await my_identities(user=user, identity_service=identity_service)


@router.get("/me")
async def me(user: Annotated[User, Depends(with_user)]) -> UserResponse:
    return UserResponse(
        user_id=user.id,
        first_name_ru=user.first_name_ru,
        last_name_ru=user.last_name_ru,
        first_name_en=user.first_name_en,
        last_name_en=user.last_name_en,
        is_admin=user.is_admin,
        isu_id=user.isu_id,
        patronymic_ru=user.patronymic_ru,
        phone=user.phone,
        email=user.email,
        telegram_username=user.telegram_username,
        gender=user.gender,
    )


@router.post("/update")
@inject
async def update_user(
    user_update: UserUpdateRequest,
    current_user: Annotated[User, Depends(with_user)],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
) -> UserResponse:
    updated_user = await user_service.update_user(
        user_id=current_user.id,
        user_update=UserUpdate(**user_update.model_dump()),
    )
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        user_id=updated_user.id,
        first_name_ru=updated_user.first_name_ru,
        last_name_ru=updated_user.last_name_ru,
        first_name_en=updated_user.first_name_en,
        last_name_en=updated_user.last_name_en,
        is_admin=updated_user.is_admin,
        isu_id=updated_user.isu_id,
        patronymic_ru=updated_user.patronymic_ru,
        phone=updated_user.phone,
        email=updated_user.email,
        telegram_username=updated_user.telegram_username,
        gender=updated_user.gender,
    )
