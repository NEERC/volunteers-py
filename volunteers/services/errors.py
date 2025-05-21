from abc import ABC


class DomainError(Exception, ABC):
    def __init__(self, message: str = "something went wrong") -> None:
        super().__init__(message)
