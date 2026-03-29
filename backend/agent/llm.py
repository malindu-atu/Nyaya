
import os
from typing import Generator, List, Optional
from dotenv import load_dotenv
from resilience import CircuitBreaker, call_with_retry

load_dotenv()

# ── Groq ──────────────────────────────────────────────────────────────────────
GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL    = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# ── Anthropic ─────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL   = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

# ── Gemini ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# ── Azure OpenAI ──────────────────────────────────────────────────────────────
AZURE_OPENAI_API_KEY     = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_ENDPOINT    = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_DEPLOYMENT  = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

# ── Runtime state ─────────────────────────────────────────────────────────────
llm_backend: Optional[str] = None
groq_client      = None
anthropic_client = None
gemini_client    = None
azure_client     = None

groq_breaker      = CircuitBreaker(failure_threshold=3, recovery_timeout=30.0)
anthropic_breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30.0)
gemini_breaker    = CircuitBreaker(failure_threshold=3, recovery_timeout=30.0)
azure_breaker     = CircuitBreaker(failure_threshold=3, recovery_timeout=30.0)

SYSTEM = "You are Nyaya, a Senior Sri Lankan legal researcher."

# ── 1. Try Groq ───────────────────────────────────────────────────────────────
if GROQ_API_KEY:
    try:
        from openai import OpenAI
        groq_client = OpenAI(
            api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )
        llm_backend = "groq"
        print(f"[LLM] Using Groq ({GROQ_MODEL})")
    except Exception as e:
        print(f"[LLM] Groq init failed: {e}")

# ── 2. Try Anthropic ──────────────────────────────────────────────────────────
if not llm_backend and ANTHROPIC_API_KEY:
    try:
        import anthropic
        anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        llm_backend = "anthropic"
        print(f"[LLM] Using Anthropic Claude ({ANTHROPIC_MODEL})")
    except Exception as e:
        print(f"[LLM] Anthropic init failed: {e}")

# ── 3. Try Gemini ─────────────────────────────────────────────────────────────
if not llm_backend and GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_client = genai.GenerativeModel(GEMINI_MODEL)
        llm_backend = "gemini"
        print(f"[LLM] Using Gemini ({GEMINI_MODEL})")
    except Exception as e:
        print(f"[LLM] Gemini init failed: {e}")

# ── 4. Try Azure OpenAI ───────────────────────────────────────────────────────
if not llm_backend and AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT:
    try:
        from openai import AzureOpenAI
        azure_client = AzureOpenAI(
            api_key=AZURE_OPENAI_API_KEY,
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_version=AZURE_OPENAI_API_VERSION,
        )
        llm_backend = "azure"
        print(f"[LLM] Using Azure OpenAI ({AZURE_OPENAI_DEPLOYMENT})")
    except Exception as e:
        print(f"[LLM] Azure OpenAI init failed: {e}")

if not llm_backend:
    print("[WARNING] No LLM configured!")
    print("  Add one of these to your .env:")
    print("    GROQ_API_KEY=gsk_...       (free, recommended)")
    print("    ANTHROPIC_API_KEY=sk-ant-...")
    print("    GEMINI_API_KEY=AIza...")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_backend():
    if not llm_backend:
        raise RuntimeError("No LLM configured. Add GROQ_API_KEY to your .env file.")


def _call_groq(messages: list, max_tokens: int = 2000) -> str:
    response = call_with_retry(
        groq_client.chat.completions.create,
        model=GROQ_MODEL,
        messages=messages,
        temperature=0.1,
        max_tokens=max_tokens,
        retries=2,
        timeout_seconds=40,
        circuit_breaker=groq_breaker,
    )
    if not response.choices:
        raise RuntimeError("Groq returned no choices")
    return response.choices[0].message.content.strip()


def _call_anthropic(prompt: str, system: str = "", max_tokens: int = 2000) -> str:
    kwargs = dict(
        model=ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    if system:
        kwargs["system"] = system
    response = call_with_retry(
        anthropic_client.messages.create,
        retries=2, timeout_seconds=40,
        circuit_breaker=anthropic_breaker,
        **kwargs,
    )
    return "".join(b.text for b in response.content if hasattr(b, "text")).strip()


def _call_anthropic_with_history(prompt: str, history: List[dict], system: str = "", max_tokens: int = 2000) -> str:
    messages = []
    for turn in history[-6:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": prompt})
    kwargs = dict(model=ANTHROPIC_MODEL, max_tokens=max_tokens, messages=messages, temperature=0.1)
    if system:
        kwargs["system"] = system
    response = call_with_retry(
        anthropic_client.messages.create,
        retries=2, timeout_seconds=40,
        circuit_breaker=anthropic_breaker,
        **kwargs,
    )
    return "".join(b.text for b in response.content if hasattr(b, "text")).strip()


def _call_gemini(prompt: str) -> str:
    response = call_with_retry(
        gemini_client.generate_content, prompt,
        retries=2, timeout_seconds=30,
        circuit_breaker=gemini_breaker,
    )
    return response.text.strip()


def _call_azure(messages: list, max_tokens: int = 2000) -> str:
    response = call_with_retry(
        azure_client.chat.completions.create,
        model=AZURE_OPENAI_DEPLOYMENT,
        messages=messages,
        temperature=0.1,
        max_completion_tokens=max_tokens,
        retries=2, timeout_seconds=30,
        circuit_breaker=azure_breaker,
    )
    if not response.choices:
        raise RuntimeError("Azure returned no choices")
    content = response.choices[0].message.content
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        return "\n".join(
            p.get("text", "") if isinstance(p, dict) else getattr(p, "text", "")
            for p in content
        ).strip()
    raise RuntimeError("Azure returned empty content")


# ── Public API ────────────────────────────────────────────────────────────────

def generate_answer(prompt: str) -> str:
    _require_backend()
    try:
        if llm_backend == "groq":
            return _call_groq([
                {"role": "system", "content": SYSTEM},
                {"role": "user",   "content": prompt},
            ])
        if llm_backend == "anthropic":
            return _call_anthropic(prompt, system=SYSTEM)
        if llm_backend == "gemini":
            return _call_gemini(f"{SYSTEM}\n\n{prompt}")
        if llm_backend == "azure":
            return _call_azure([
                {"role": "system", "content": SYSTEM},
                {"role": "user",   "content": prompt},
            ])
    except Exception as e:
        raise RuntimeError(f"LLM generation failed ({llm_backend}): {e}") from e
    raise RuntimeError("No active LLM backend")


def generate_answer_with_history(prompt: str, history: List[dict]) -> str:
    _require_backend()
    try:
        if llm_backend == "groq":
            messages = [{"role": "system", "content": SYSTEM}]
            for turn in history[-6:]:
                if turn.get("role") in ("user", "assistant") and turn.get("content"):
                    messages.append({"role": turn["role"], "content": turn["content"]})
            messages.append({"role": "user", "content": prompt})
            return _call_groq(messages)
        if llm_backend == "anthropic":
            return _call_anthropic_with_history(prompt, history, system=SYSTEM)
        if llm_backend == "gemini":
            history_text = ""
            for turn in history[-6:]:
                role = "User" if turn.get("role") == "user" else "Assistant"
                history_text += f"{role}: {turn.get('content', '')}\n"
            combined = f"{SYSTEM}\n\n{history_text}User: {prompt}" if history_text else f"{SYSTEM}\n\n{prompt}"
            return _call_gemini(combined)
        if llm_backend == "azure":
            messages = [{"role": "system", "content": SYSTEM}]
            for turn in history[-6:]:
                if turn.get("role") in ("user", "assistant") and turn.get("content"):
                    messages.append({"role": turn["role"], "content": turn["content"]})
            messages.append({"role": "user", "content": prompt})
            return _call_azure(messages)
    except Exception as e:
        raise RuntimeError(f"LLM history generation failed ({llm_backend}): {e}") from e
    raise RuntimeError("No active LLM backend")


def stream_answer(prompt: str, history: Optional[List[dict]] = None) -> Generator[str, None, None]:
    _require_backend()

    if llm_backend == "groq":
        messages = [{"role": "system", "content": SYSTEM}]
        for turn in (history or [])[-6:]:
            if turn.get("role") in ("user", "assistant") and turn.get("content"):
                messages.append({"role": turn["role"], "content": turn["content"]})
        messages.append({"role": "user", "content": prompt})
        stream = groq_client.chat.completions.create(
            model=GROQ_MODEL, messages=messages,
            temperature=0.1, max_tokens=2000, stream=True,
        )
        for chunk in stream:
            if chunk.choices:
                content = getattr(chunk.choices[0].delta, "content", None)
                if content:
                    yield content
        return

    if llm_backend == "anthropic":
        messages = []
        for turn in (history or [])[-6:]:
            if turn.get("role") in ("user", "assistant") and turn.get("content"):
                messages.append({"role": turn["role"], "content": turn["content"]})
        messages.append({"role": "user", "content": prompt})
        with anthropic_client.messages.stream(
            model=ANTHROPIC_MODEL, max_tokens=2000,
            system=SYSTEM, messages=messages, temperature=0.1,
        ) as stream:
            for text in stream.text_stream:
                yield text
        return

    if llm_backend == "gemini":
        history_text = ""
        for turn in (history or [])[-6:]:
            role = "User" if turn.get("role") == "user" else "Assistant"
            history_text += f"{role}: {turn.get('content', '')}\n"
        combined = f"{SYSTEM}\n\n{history_text}User: {prompt}" if history_text else f"{SYSTEM}\n\n{prompt}"
        response = gemini_client.generate_content(combined, stream=True)
        for chunk in response:
            text = getattr(chunk, "text", None)
            if text:
                yield text
        return

    if llm_backend == "azure":
        messages = [{"role": "system", "content": SYSTEM}]
        for turn in (history or [])[-6:]:
            if turn.get("role") in ("user", "assistant") and turn.get("content"):
                messages.append({"role": turn["role"], "content": turn["content"]})
        messages.append({"role": "user", "content": prompt})
        stream = azure_client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT, messages=messages,
            temperature=0.1, max_completion_tokens=2000, stream=True,
        )
        for chunk in stream:
            if chunk.choices:
                content = getattr(chunk.choices[0].delta, "content", None)
                if content:
                    yield content
        return

    raise RuntimeError("No streaming-capable LLM backend available.")