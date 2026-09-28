"""
Kisan Web Project - Gemini API Client Helper
Provides unified interface for Gemini text and multimodal AI services with automatic model fallback.
"""
import os
from PIL import Image
from google import genai
from google.genai import types

# Candidate models ordered by priority & availability
FALLBACK_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-flash-latest",
]


def get_gemini_client():
    """Initialize and return the Gemini API client using environment key."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. Please add GEMINI_API_KEY to your environment variables or .env file."
        )
    return genai.Client(api_key=api_key)


def get_candidate_models():
    """Return an ordered list of candidate models starting with user configuration."""
    primary = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash").strip()
    candidates = [primary]
    for model in FALLBACK_MODELS:
        if model not in candidates:
            candidates.append(model)
    return candidates


def generate_text(prompt, system_instruction=None, temperature=0.2, response_json=False):
    """Generate text response using Gemini API with automatic model failover."""
    client = get_gemini_client()
    candidates = get_candidate_models()

    config_args = {"temperature": temperature}
    if system_instruction:
        config_args["system_instruction"] = system_instruction
    if response_json:
        config_args["response_mime_type"] = "application/json"

    config = types.GenerateContentConfig(**config_args)

    last_exception = None

    for model in candidates:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=config,
            )
            if response and response.text and response.text.strip():
                return response.text.strip()
        except Exception as exc:
            last_exception = exc
            print(f"[Gemini API] Model {model} request failed ({exc}). Retrying next candidate...")

    raise RuntimeError(f"Gemini API request failed across all candidate models: {last_exception}") from last_exception


def generate_multimodal(contents, system_instruction=None, temperature=0.2, response_json=False):
    """
    Generate response for multimodal input (images + text) with automatic model failover.
    contents can be a list containing PIL Image objects and prompt text strings.
    """
    client = get_gemini_client()
    candidates = get_candidate_models()

    config_args = {"temperature": temperature}
    if system_instruction:
        config_args["system_instruction"] = system_instruction
    if response_json:
        config_args["response_mime_type"] = "application/json"

    config = types.GenerateContentConfig(**config_args)

    last_exception = None

    for model in candidates:
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
            if response and response.text and response.text.strip():
                return response.text.strip()
        except Exception as exc:
            last_exception = exc
            print(f"[Gemini API] Multimodal model {model} request failed ({exc}). Retrying next candidate...")

    raise RuntimeError(f"Gemini API multimodal request failed across all candidate models: {last_exception}") from last_exception
