from abc import ABC


class DomainError(Exception, ABC):
    def __init__(self, message: str = "Something went wrong") -> None:
        super().__init__(message)


class PositionAlreadyExists(DomainError):
    """Raised when a position with the same name already exists for a year."""

    def __init__(self) -> None:
        super().__init__("Position with this name already exists for the year")
