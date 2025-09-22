from abc import ABC


class DomainError(Exception, ABC):
    def __init__(self, message: str = "Something went wrong") -> None:
        super().__init__(message)
