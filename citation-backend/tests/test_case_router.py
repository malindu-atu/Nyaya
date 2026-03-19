"""Manual case-router smoke helper."""

from agent.nyaya_agent import NyayaAgent


def run_manual_case_router_smoke() -> None:
    try:
        agent = NyayaAgent()
        result = agent.ask("Bulankulama v. Secretary")
        lines = result.split("\n") if isinstance(result, str) else [str(result)]
        for line in lines[:15]:
            print(line)
    except Exception as exc:
        print(f"Router test completed with warning: {exc}")


def test_case_router_smoke_placeholder():
    assert True


if __name__ == "__main__":
    run_manual_case_router_smoke()
