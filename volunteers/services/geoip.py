from functools import cached_property
from typing import Any

import maxminddb
from loguru import logger


class GeoIPService:
    """Resolves the country of an IP address using a MaxMind-format database."""

    def __init__(self, database_path: str | None) -> None:
        self.database_path = database_path

    @cached_property
    def _reader(self) -> maxminddb.Reader | None:
        if not self.database_path:
            logger.warning("GeoIP database is not configured")
            return None
        try:
            return maxminddb.open_database(self.database_path)
        except (OSError, maxminddb.InvalidDatabaseError) as e:
            logger.error(f"Failed to open GeoIP database {self.database_path}: {e}")
            return None

    def country_code(self, ip: str) -> str | None:
        """ISO 3166-1 alpha-2 country code of `ip`, or None if unknown."""
        if self._reader is None:
            return None
        try:
            record: Any = self._reader.get(ip)
        except ValueError:
            logger.debug(f"Invalid IP address: {ip}")
            return None
        if not isinstance(record, dict):
            return None
        code = record.get("country", {}).get("iso_code")
        return str(code) if code else None
