"""Manual smoke helper for hybrid retrieval.

This file is intentionally non-automated so CI test runs are deterministic and
do not call external model providers.
"""

from agent.nyaya_agent import NyayaAgent
from dotenv import load_dotenv


def run_manual_hybrid_smoke() -> None:
    load_dotenv()
    print("\n" + "=" * 60)
    print("PHASE 4: HYBRID RETRIEVAL TEST")
    print("=" * 60 + "\n")

    agent = NyayaAgent()
    test_queries = [
        "Suez Canal Company case",
        "most cited cases in Indian constitution",
        "fundamental rights article 21",
    ]

    for query in test_queries:
        print(f"\n[QUERY] '{query}'")
        print("-" * 60)
        try:
            response = agent.ask(query)
            print(f"Response:\n{response}\n")
        except Exception as exc:
            print(f"Error: {exc}\n")

    print("\n" + "=" * 60)
    print("Test completed!")
    print("=" * 60)


def test_hybrid_smoke_placeholder():
    # Keeps pytest discovery healthy while avoiding external calls.
    assert True


if __name__ == "__main__":
    run_manual_hybrid_smoke()
