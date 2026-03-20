"""Manual model-listing helper for Gemini account checks."""

import os

from dotenv import load_dotenv
from google import genai


def run_manual_model_list() -> None:
    load_dotenv()
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    for model in client.models.list():
        print(model.name)


def test_models_smoke_placeholder():
    assert True


if __name__ == "__main__":
    run_manual_model_list()
