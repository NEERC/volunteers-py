"""Sandboxed evaluation of mailing recipient expressions.

An expression is a Python expression evaluated with the same context as the message
template (``user``, ``form``, ``year`` and, per assignment, ``assignment``, ``day``,
``position``, ``hall``). It is evaluated in a separate process with no builtins: only a
whitelist of pure helpers and the template context are available. A batch that runs
longer than :data:`EVALUATION_TIMEOUT` seconds is killed by terminating the pool.

Errors are raised as :class:`ExpressionSyntaxError` (with a line number),
:class:`ExpressionEvaluationError` (a name, attribute or type problem) or
:class:`ExpressionTimeout`.
"""

import ast
import asyncio
import atexit
import multiprocessing.pool
import threading
from collections.abc import Mapping, Sequence
from typing import Any, NamedTuple

from simpleeval import DEFAULT_NAMES, EvalWithCompoundTypes

# How long the whole batch of one recipients request may take before the pool is killed
EVALUATION_TIMEOUT = 1.0
# Backstop for the thread waiting on the pool: the in-thread timeout must fire first
THREAD_TIMEOUT = EVALUATION_TIMEOUT + 5.0
POOL_PROCESSES = 2

# Pure helpers available in expressions, in addition to the template context
FUNCTIONS: dict[str, Any] = {
    "len": len,
    "any": any,
    "all": all,
    "min": min,
    "max": max,
    "sum": sum,
    "abs": abs,
    "round": round,
    "sorted": sorted,
    "str": str,
    "int": int,
    "float": float,
    "bool": bool,
}

ASSIGNMENT_VARIABLES = frozenset({"assignment", "day", "position", "hall"})


class ExpressionError(Exception):
    """Base class for recipient expression errors."""


class ExpressionSyntaxError(ExpressionError):
    """The expression doesn't parse."""

    def __init__(self, message: str, line: int | None = None) -> None:
        super().__init__(message)
        self.line = line


class ExpressionEvaluationError(ExpressionError):
    """A name, attribute or type problem while evaluating the expression."""


class ExpressionTimeout(ExpressionError):
    """The expression took longer than the limit and was killed."""

    def __init__(self, timeout: float) -> None:
        super().__init__(f"The filter took longer than {timeout:.0f} s to evaluate")


def parse_expression(expression: str) -> ast.expr:
    """Parse an expression, raising :class:`ExpressionSyntaxError` with a line number."""
    try:
        return ast.parse(expression, mode="eval").body
    except SyntaxError as e:
        raise ExpressionSyntaxError(e.msg, e.lineno) from e


def expression_uses_assignment(expression: str) -> bool:
    """Whether the expression refers to variables that only exist per assignment."""
    node = parse_expression(expression)
    return any(
        isinstance(child, ast.Name) and child.id in ASSIGNMENT_VARIABLES for child in ast.walk(node)
    )


class _BatchFailure(NamedTuple):
    """An evaluation error from a worker, sent back instead of the exception itself
    (simpleeval exceptions don't survive pickling)."""

    error: str
    message: str


def _evaluate_batch(payload: tuple[str, list[dict[str, Any]]]) -> list[bool] | _BatchFailure:
    """Evaluate one expression over many contexts, in a worker process.

    The first evaluation error aborts the batch: a name or attribute problem is the
    same for every context, and a loud error is safer than silently dropping
    recipients.
    """
    expression, contexts = payload
    try:
        evaluator = EvalWithCompoundTypes(functions=dict(FUNCTIONS), names=dict(DEFAULT_NAMES))
        node = parse_expression(expression)
        results = []
        for context in contexts:
            evaluator.names = {**DEFAULT_NAMES, **context}
            results.append(bool(evaluator.eval(expression, previously_parsed=node)))
    except Exception as e:
        return _BatchFailure(type(e).__name__, str(e))
    return results


_pool: multiprocessing.pool.Pool | None = None
_pool_lock = threading.Lock()


def init_pool() -> None:
    """Create the worker pool in advance, so the first filter evaluation is fast."""
    _get_pool()


def close_pool() -> None:
    """Terminate the worker pool, e.g. on application shutdown."""
    global _pool
    pool = _pool
    _pool = None
    if pool is not None:
        pool.terminate()
        pool.join()


atexit.register(close_pool)


def _get_pool() -> multiprocessing.pool.Pool:
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = multiprocessing.Pool(processes=POOL_PROCESSES)
    return _pool


def _kill_pool() -> None:
    global _pool
    pool = _pool
    _pool = None
    if pool is not None:
        pool.terminate()
        pool.join()


def _run_batch(expression: str, contexts: list[dict[str, Any]]) -> list[bool]:
    """Run the batch in the pool with an in-thread timeout, killing the pool on expiry."""
    result = _get_pool().apply_async(_evaluate_batch, ((expression, contexts),))
    try:
        batch = result.get(timeout=EVALUATION_TIMEOUT)
    except multiprocessing.TimeoutError:
        _kill_pool()
        raise ExpressionTimeout(EVALUATION_TIMEOUT) from None
    if isinstance(batch, _BatchFailure):
        raise ExpressionEvaluationError(batch.message)
    return batch


async def evaluate_expression(expression: str, contexts: Sequence[Mapping[str, Any]]) -> list[bool]:
    """Evaluate ``expression`` over ``contexts``, one result per context.

    Raises :class:`ExpressionSyntaxError`, :class:`ExpressionEvaluationError` or
    :class:`ExpressionTimeout`.
    """
    parse_expression(expression)  # Fail fast, before touching the pool
    if not contexts:
        return []
    context_list = [dict(context) for context in contexts]
    loop = asyncio.get_running_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(None, _run_batch, expression, context_list),
            timeout=THREAD_TIMEOUT,
        )
    except TimeoutError:
        _kill_pool()
        raise ExpressionTimeout(EVALUATION_TIMEOUT) from None
    except ExpressionError:
        raise
    except Exception as e:
        raise ExpressionEvaluationError(str(e)) from e
