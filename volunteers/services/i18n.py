"""Internationalization service for backend-only strings."""

import json
from pathlib import Path
from typing import Any

from .base import BaseService


class I18nService(BaseService):
    """Service for handling internationalization of backend strings."""

    def __init__(self, locale: str = "en"):
        self.locale = locale
        locales_path = Path(__file__).parent / "i18n_locales"
        self._translations: dict[str, dict[str, str]] = {}
        for language in locales_path.iterdir():
            with open(language / "translation.json") as f:
                self._translations[language.stem] = json.load(f)

    def translate(self, key: str, **kwargs: Any) -> str:
        """Translate a key to the current locale."""
        translation = self._translations.get(self.locale, {}).get(key, key)

        # Simple string formatting for kwargs
        if kwargs:
            try:
                return translation.format(**kwargs)
            except (ValueError, TypeError, KeyError):
                return translation

        return translation

    def set_locale(self, locale: str) -> None:
        """Set the current locale."""
        self.locale = locale
