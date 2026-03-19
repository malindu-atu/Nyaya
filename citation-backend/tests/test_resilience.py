import time

import pytest

from resilience import CircuitBreaker, call_with_retry, run_with_timeout


def test_run_with_timeout_raises_timeout_error():
    def slow():
        time.sleep(0.2)
        return 1

    with pytest.raises(TimeoutError):
        run_with_timeout(slow, 0.05)


def test_call_with_retry_eventually_succeeds():
    state = {"count": 0}

    def flaky():
        state["count"] += 1
        if state["count"] < 3:
            raise ValueError("transient")
        return "ok"

    result = call_with_retry(flaky, retries=3, retry_exceptions=(ValueError,))
    assert result == "ok"
    assert state["count"] == 3


def test_circuit_breaker_opens_after_threshold_failures():
    breaker = CircuitBreaker(failure_threshold=2, recovery_timeout=10)

    def always_fails():
        raise RuntimeError("down")

    with pytest.raises(RuntimeError):
        call_with_retry(always_fails, retries=0, circuit_breaker=breaker)
    with pytest.raises(RuntimeError):
        call_with_retry(always_fails, retries=0, circuit_breaker=breaker)

    assert breaker.state == "open"
    with pytest.raises(RuntimeError, match="Circuit breaker is open"):
        call_with_retry(always_fails, retries=0, circuit_breaker=breaker)
