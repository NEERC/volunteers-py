"""Sandboxed evaluation of mailing recipient expressions.

An expression is a Python expression evaluated with the same context as the message
template (``user``, ``form``, ``year`` and, per assignment, ``assignment``, ``day``,
``position``, ``hall``). Expressions are evaluated in worker processes with no
builtins: only a whitelist of pure helpers and the template context are available.
A batch that runs longer than :data:`EVALUATION_TIMEOUT` seconds is killed by
terminating the pool.

Errors are :class:`DomainError` subclasses with a message for the user:
:class:`ExpressionSyntaxError` (with a line number), :class:`ExpressionEvaluationError`
(a name, attribute or type problem) and :class:`ExpressionTimeout`.
"""

import ast
import asyncio
import atexit
import multiprocessing.pool
import threading
import weakref
from collections.abc import AsyncGenerator, Mapping, Sequence
from typing import Any, NamedTuple

from simpleeval import DEFAULT_NAMES, EvalWithCompoundTypes

from .errors import DomainError

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


class ExpressionError(DomainError):
    """Base class for recipient expression errors, with a message for the user."""


class ExpressionSyntaxError(ExpressionError):
    """The expression doesn't parse."""

    def __init__(self, message: str, line: int | None = None) -> None:
        self.line = line
        if line is not None:
            message = f"{message} (line {line})"
        super().__init__(message)


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


class ExpressionEvaluator:
    """Evaluates recipient filter expressions in worker processes.

    Create through the DI container (``providers.Resource`` over
    :func:`create_expression_evaluator`), so the pool is warmed up at startup and
    terminated on shutdown.
    """

    def __init__(self) -> None:
        self._pool: multiprocessing.pool.Pool | None = None
        self._lock = threading.Lock()
        _evaluators.add(self)

    async def initialize(self) -> None:
        """Create the worker pool in advance, so the first evaluation is fast."""
        await asyncio.get_running_loop().run_in_executor(None, self._get_pool)

    def shutdown(self) -> None:
        """Terminate the worker pool, e.g. on application shutdown."""
        self._terminate_pool()

    async def evaluate(self, expression: str, contexts: Sequence[Mapping[str, Any]]) -> list[bool]:
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
                loop.run_in_executor(None, self._run_batch, expression, context_list),
                timeout=THREAD_TIMEOUT,
            )
        except TimeoutError:
            self._terminate_pool()
            raise ExpressionTimeout(EVALUATION_TIMEOUT) from None
        except ExpressionError:
            raise
        except Exception as e:
            raise ExpressionEvaluationError(str(e)) from e

    def _get_pool(self) -> multiprocessing.pool.Pool:
        if self._pool is None:
            with self._lock:
                if self._pool is None:
                    self._pool = multiprocessing.Pool(processes=POOL_PROCESSES)
        return self._pool

    def _terminate_pool(self) -> None:
        pool = self._pool
        self._pool = None
        if pool is not None:
            pool.terminate()
            pool.join()

    def _run_batch(self, expression: str, contexts: list[dict[str, Any]]) -> list[bool]:
        """Run the batch in the pool with an in-thread timeout, killing the pool on expiry."""
        result = self._get_pool().apply_async(_evaluate_batch, ((expression, contexts),))
        try:
            batch = result.get(timeout=EVALUATION_TIMEOUT)
        except multiprocessing.TimeoutError:
            self._terminate_pool()
            raise ExpressionTimeout(EVALUATION_TIMEOUT) from None
        if isinstance(batch, _BatchFailure):
            raise ExpressionEvaluationError(batch.message)
        return batch


_evaluators: weakref.WeakSet[ExpressionEvaluator] = weakref.WeakSet()


def _shutdown_evaluators() -> None:
    for evaluator in list(_evaluators):
        evaluator.shutdown()


atexit.register(_shutdown_evaluators)


async def create_expression_evaluator() -> AsyncGenerator[ExpressionEvaluator]:
    """DI resource: an initialized evaluator that is shut down with the container."""
    evaluator = ExpressionEvaluator()
    await evaluator.initialize()
    try:
        yield evaluator
    finally:
        evaluator.shutdown()
