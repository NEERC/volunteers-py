import pytest

from volunteers.services import mailing_expression
from volunteers.services.mailing_expression import (
    ExpressionEvaluationError,
    ExpressionSyntaxError,
    ExpressionTimeout,
    evaluate_expression,
    expression_uses_assignment,
)

CTX_VYAZMA = {
    "user": {"phone": "+7999", "telegram_username": "alice"},
    "form": {"extra_fields": {"lives_in_vyazma": True}},
    "year": {"id": 1},
}
CTX_OTHER = {
    "user": {"phone": None, "telegram_username": "bob"},
    "form": {"extra_fields": {}},
    "year": {"id": 1},
}


async def test_evaluates_expression_over_contexts() -> None:
    result = await evaluate_expression(
        'form.extra_fields.get("lives_in_vyazma") == True', [CTX_VYAZMA, CTX_OTHER]
    )
    assert result == [True, False]

    result = await evaluate_expression(
        "user.phone is not None and len(user.phone) > 0", [CTX_VYAZMA, CTX_OTHER]
    )
    assert result == [True, False]

    result = await evaluate_expression("True", [])
    assert result == []


@pytest.mark.parametrize(
    ("expression", "expected"),
    [
        ("user.phone", False),
        ('form.extra_fields.get("x")', False),
        ("day.id == 1", True),
        ("assignment.hall is not None", True),
        ("hall is not None and hall.name == 'Main'", True),
        ("user.phone and day.id == 1", True),
    ],
)
def test_expression_uses_assignment(expression: str, expected: bool) -> None:
    assert expression_uses_assignment(expression) is expected


async def test_syntax_error_has_a_line() -> None:
    with pytest.raises(ExpressionSyntaxError) as error:
        await evaluate_expression("user.phone and", [CTX_VYAZMA])
    assert error.value.line == 1


async def test_unknown_name_and_missing_attribute_are_errors() -> None:
    with pytest.raises(ExpressionEvaluationError, match="foo"):
        await evaluate_expression("foo == 1", [CTX_VYAZMA])
    with pytest.raises(ExpressionEvaluationError, match="missing_field"):
        await evaluate_expression("user.missing_field == 1", [CTX_VYAZMA])
    with pytest.raises(ExpressionEvaluationError):
        await evaluate_expression("len(user.phone) > 0", [CTX_OTHER])


@pytest.mark.parametrize(
    "attack",
    [
        '__import__("os")',
        'open("/etc/passwd")',
        "().__class__",
        "user.phone.__class__",
        "lambda: 1",
        "(x := 1)",
        "9**9**9**9",
        '"a" * (10**9)',
    ],
)
async def test_sandbox_blocks_escapes_and_bombs(attack: str) -> None:
    with pytest.raises(ExpressionEvaluationError):
        await evaluate_expression(attack, [CTX_VYAZMA])
    # The pool survives a blocked expression
    result = await evaluate_expression("True", [CTX_VYAZMA])
    assert result == [True]


async def test_timeout_kills_the_pool_and_the_next_batch_works(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(mailing_expression, "EVALUATION_TIMEOUT", 0.1)
    # 2M bignum multiplications: slow but inside every simpleeval cap
    with pytest.raises(ExpressionTimeout):
        await evaluate_expression("3**2000000 > 0", [CTX_VYAZMA])
    # The killed pool is recreated; give the spawn more than the patched 0.1 s limit
    monkeypatch.setattr(mailing_expression, "EVALUATION_TIMEOUT", 10.0)
    result = await evaluate_expression('user.telegram_username == "alice"', [CTX_VYAZMA])
    assert result == [True]
