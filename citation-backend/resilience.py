"""
Shared reliability utilities: retry, timeout, and circuit breaker.
"""

import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from typing import Any, Callable, Iterable, Optional, Type


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, recovery_timeout: float = 30.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.state = "closed"
        self.failure_count = 0
        self.last_failure_time = 0.0
        self._lock = threading.Lock()

    def before_call(self) -> None:
        with self._lock:
            if self.state == "open":
                elapsed = time.time() - self.last_failure_time
                if elapsed >= self.recovery_timeout:
                    self.state = "half_open"
                else:
                    raise RuntimeError("Circuit breaker is open")

    def record_success(self) -> None:
        with self._lock:
            self.state = "closed"
            self.failure_count = 0
            self.last_failure_time = 0.0

    def record_failure(self) -> None:
        with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.failure_threshold:
                self.state = "open"


def run_with_timeout(func: Callable[..., Any], timeout_seconds: float, *args: Any, **kwargs: Any) -> Any:
    if timeout_seconds <= 0:
        return func(*args, **kwargs)

    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(func, *args, **kwargs)
        try:
            return future.result(timeout=timeout_seconds)
        except FutureTimeoutError as exc:
            raise TimeoutError(f"Operation timed out after {timeout_seconds}s") from exc


def call_with_retry(
    func: Callable[..., Any],
    *args: Any,
    retries: int = 2,
    timeout_seconds: float = 0,
    retry_exceptions: Optional[Iterable[Type[BaseException]]] = None,
    circuit_breaker: Optional[CircuitBreaker] = None,
    **kwargs: Any,
) -> Any:
    exceptions = tuple(retry_exceptions or (Exception,))
    last_error: Optional[BaseException] = None

    if circuit_breaker:
        circuit_breaker.before_call()

    for attempt in range(retries + 1):
        try:
            result = run_with_timeout(func, timeout_seconds, *args, **kwargs)
            if circuit_breaker:
                circuit_breaker.record_success()
            return result
        except exceptions as exc:
            last_error = exc
            if attempt >= retries:
                if circuit_breaker:
                    circuit_breaker.record_failure()
                raise
            time.sleep(0.5 * (attempt + 1))

    if last_error:
        raise last_error
    raise RuntimeError("Retry call failed without explicit exception")
