#!/usr/bin/env python3
"""
UserPromptSubmit hook — Ambiguity Detection

Reads the user prompt from the hook event JSON (stdin), calls claude-haiku
to evaluate whether the prompt is specific enough to implement without
clarification, and injects additionalContext if it is ambiguous.

Exit codes:
  0 — proceed (with or without additionalContext)
  2 — block the prompt (not used here; we prefer injecting context)
"""

import json
import sys
import os
import urllib.request
import urllib.error


SYSTEM_PROMPT = """You are an expert software engineering assistant evaluating whether a user's request to an AI coding agent is specific enough to implement correctly without clarification.

A request is AMBIGUOUS if ANY of these are true:
- Uses broad terms without a target: "everywhere", "all", "refactor", "clean up", "update", "fix" with no specific file/function named
- Would require touching more than 3 files but does not name them
- Does not specify what existing behavior must be preserved
- Two developers would implement it meaningfully differently
- Contains only a goal (e.g. "make it faster") with no scope or constraints

A request is CLEAR if:
- Names specific files, functions, or components
- Specifies what should change AND what should not change
- Has a verifiable completion criterion
- A single developer could implement it with confidence

Short conversational messages, questions, and meta-requests (like "explain X" or "what does Y do") are always CLEAR — do not flag them.

Respond with a JSON object only. No prose.
{"ambiguous": true|false, "reason": "one sentence explaining why"}"""


def check_ambiguity(prompt: str) -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        # No API key — skip the check silently
        return {"ambiguous": False, "reason": "no API key"}

    payload = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 128,
        "system": SYSTEM_PROMPT,
        "messages": [
            {"role": "user", "content": f"Evaluate this request:\n\n{prompt}"}
        ],
    }

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode(),
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            body = json.loads(resp.read())
            text = body["content"][0]["text"].strip()
            return json.loads(text)
    except (urllib.error.URLError, json.JSONDecodeError, KeyError, TimeoutError):
        # Network error or parse failure — fail open (don't block)
        return {"ambiguous": False, "reason": "check failed"}


def main():
    try:
        event = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        sys.exit(0)

    prompt = event.get("prompt", "").strip()
    if not prompt or len(prompt) < 10:
        # Too short to evaluate
        sys.exit(0)

    result = check_ambiguity(prompt)

    if result.get("ambiguous"):
        context = (
            "IMPORTANT SYSTEM INSTRUCTION: The user's request has been flagged as potentially ambiguous "
            f"({result.get('reason', 'scope unclear')}). "
            "Before writing any code or making any changes, ask the user EXACTLY ONE clarifying question. "
            "Pick the single most important unknown. "
            "Format: \"Before I proceed — [question]?\" "
            "Do NOT start implementing until you have received their answer."
        )
        print(json.dumps({"additionalContext": context}))

    sys.exit(0)


if __name__ == "__main__":
    main()
