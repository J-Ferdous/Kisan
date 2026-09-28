import os
from PIL import Image

from ai.gemini_client import generate_multimodal


SUPPORTED_LANGUAGES = {
    "English": "English",
    "Hindi": "Hindi",
    "Bengali": "Bengali",
}

ALLOWED_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}


def generate_image_response(
    image_path,
    message="",
    language="English"
):
    """
    Analyze an image using the Gemini API.

    This service belongs to the general KISAAN AI Assistant.
    It is intentionally separate from vision_service.py so the
    Leaf Doctor maintains its distinct two-stage pipeline.
    """

    if not image_path:
        raise ValueError("Image path is required.")

    if not os.path.isfile(image_path):
        raise ValueError("Image file was not found.")

    extension = os.path.splitext(image_path)[1].lower()

    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValueError(
            "Unsupported image format. "
            "Please use JPG, JPEG, PNG, or WEBP."
        )

    if language not in SUPPORTED_LANGUAGES:
        language = "English"

    response_language = SUPPORTED_LANGUAGES[language]

    message = str(message or "").strip()

    if not message:
        message = "Describe and explain this image."

    try:
        pil_image = Image.open(image_path)
    except Exception as exc:
        raise ValueError(f"Unable to read image file: {exc}") from exc

    prompt = f"""
You are KISAAN AI Assistant, a multimodal agricultural assistant
for farmers in India.

The user has uploaded an image and may also have asked a question.

Your job is to carefully inspect the image, understand the user's
actual question, and answer based on what is genuinely visible.

SELECTED RESPONSE LANGUAGE:
{response_language}

LANGUAGE RULES:
1. Always reply in {response_language}.
2. If Hindi is selected, use natural Hindi in Devanagari script.
3. If Bengali is selected, use natural Bengali script.
4. If English is selected, use clear simple English.
5. The user's question may be written in English, Hindi, Bengali,
   or mixed language.
6. Understand the question before answering it.
7. Do not translate the user's question back unless requested.
8. Use natural agricultural terminology.
9. For Bengali, prefer standard terms such as "দোআঁশ মাটি"
   and "এঁটেল-দোআঁশ মাটি" where appropriate.
10. If a technical term may be difficult, the local-language term
    may be followed by the English term in parentheses.

IMAGE ANALYSIS RULES:
- Analyze the actual uploaded image.
- Do not claim to see something that is not clearly visible.
- If an object cannot be identified confidently, say that you are
  uncertain.
- If text in the image is unreadable, say so instead of inventing it.
- Do not assume that every image contains a crop or plant.
- The image may contain plants, agricultural machinery, documents,
  diagrams, objects, animals, people, landscapes, or other content.
- Answer the user's specific question about the image.
- If the user simply asks what the image contains, describe the
  important visible content clearly.
- If the image appears agricultural, provide relevant agricultural
  context when useful.

PLANT AND DISEASE SAFETY:
- If the image contains a plant, you may describe visible symptoms.
- Do not claim laboratory confirmation of a plant disease.
- If disease identification is uncertain, clearly state that it is
  uncertain.
- Do not invent symptoms that are not visible.
- Do not provide dangerous pesticide concentrations.
- Treatment recommendations should be conservative.
- For serious or uncertain crop problems, recommend confirmation
  from a local agricultural expert when appropriate.

GENERAL RESPONSE RULES:
- Answer directly.
- Do not introduce yourself unless asked.
- Keep normal answers concise but useful.
- Use simple language suitable for farmers.
- Never invent information when uncertain.
- If the image alone is insufficient to answer reliably, explain
  what additional information or clearer image is needed.

User's question:
{message}

Answer only the user's question in {response_language}.
"""

    try:
        answer = generate_multimodal([pil_image, prompt], temperature=0.2)
        if not answer:
            raise RuntimeError("Gemini API returned an empty response.")
        return answer
    except Exception as exc:
        raise RuntimeError(f"Gemini API image analysis failed: {exc}") from exc