import pytest

from volunteers.services.errors import DomainError


def test_domain_error_inheritance() -> None:
    err = DomainError("custom message")
    assert isinstance(err, Exception)
    assert isinstance(err, DomainError)


def test_domain_error_message() -> None:
    msg = "domain specific error"
    err = DomainError(msg)
    assert str(err) == msg


def test_domain_error_can_be_raised_and_caught() -> None:
    with pytest.raises(DomainError) as excinfo:
        raise DomainError()
    assert str(excinfo.value) == "Something went wrong"
