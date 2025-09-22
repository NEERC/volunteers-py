import bcrypt

from volunteers.models import LegacyUser


def verify_legacy_user(password: str, legacy_user: LegacyUser) -> bool:
    return bcrypt.checkpw(password.encode(), legacy_user.password.encode())
