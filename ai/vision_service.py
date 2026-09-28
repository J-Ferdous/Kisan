import json
import os
from PIL import Image

from ai.gemini_client import generate_multimodal


PLANT_GATE_MIN_CONFIDENCE = 70

VALID_SEVERITIES = {
    "Low",
    "Medium",
    "High",
    "Critical",
}


# ============================================================
# HELPERS
# ============================================================

def _safe_string(value, default=""):
    if value is None:
        return default

    value = str(value).strip()

    return value if value else default


def _normalize_boolean(value, default=False):
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        value = value.strip().lower()

        if value in {"true", "yes", "1"}:
            return True

        if value in {"false", "no", "0"}:
            return False

    return default


def _normalize_confidence(value):
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.0

    return max(
        0.0,
        min(100.0, confidence),
    )


def _normalize_severity(value):
    severity = _safe_string(
        value,
        "Low",
    ).title()

    if severity not in VALID_SEVERITIES:
        return "Low"

    return severity


def _normalize_symptoms(value):
    if not isinstance(value, list):
        return []

    symptoms = []

    for symptom in value:
        symptom = _safe_string(symptom)

        if symptom:
            symptoms.append(symptom)

    return symptoms[:6]


def _gemini_request(pil_image, prompt):
    """
    Send an image + prompt to Gemini API
    and return a parsed JSON object.
    """
    try:
        raw_result = generate_multimodal(
            [pil_image, prompt],
            temperature=0.2,
            response_json=True,
        )

        result = json.loads(raw_result)

        if not isinstance(result, dict):
            raise ValueError("Gemini API response was not a JSON object.")

        return result

    except json.JSONDecodeError as error:
        raise ValueError(
            f"Gemini API returned invalid JSON: {error}"
        ) from error

    except Exception as error:
        raise RuntimeError(
            f"Gemini API request failed: {error}"
        ) from error


# ============================================================
# STAGE 1 — PLANT IMAGE VALIDATION
# ============================================================

def _validate_plant_image(
    pil_image,
    supplied_crop_name=None,
):
    """
    First AI pass.

    This stage ONLY determines whether the uploaded
    image contains plant material suitable for diagnosis.

    It must not diagnose diseases.
    """

    crop_text = (
        supplied_crop_name
        if supplied_crop_name
        else "Not provided"
    )

    prompt = f"""
You are an image validation system for an agricultural plant disease application.

Your ONLY task is to determine whether the uploaded image clearly contains real plant material suitable for crop disease diagnosis.

The user selected this crop or plant:
{crop_text}

IMPORTANT:

Do NOT diagnose any disease.

Do NOT describe plant diseases.

Do NOT recommend treatments.

Determine whether the main subject of the image is clearly one or more of:

- plant leaf
- crop leaf
- plant stem
- plant fruit
- crop plant
- visible living plant tissue

Reject images whose main subject is something like:

- bottle
- container
- vehicle
- person
- animal
- furniture
- electronics
- building
- food packaging
- household object
- machinery
- non-plant object

A green object is NOT automatically a plant.

A green bottle is NOT a plant.

Printed leaf images, artificial plants, logos, drawings, screens, packaging, or objects with plant-like colors should not be treated as valid crop specimens unless real plant tissue is clearly visible.

Return ONLY valid JSON using exactly this structure:

{{
    "is_plant_image": false,
    "validation_confidence": 95,
    "visible_subject": "green plastic bottle",
    "reason": "The main subject is a plastic bottle and no real plant tissue is clearly visible."
}}

Rules:

1. is_plant_image must be true or false.

2. validation_confidence must be a number between 0 and 100.

3. visible_subject should briefly describe the main visible object.

4. reason should briefly explain why the image is or is not suitable.

5. Be conservative.

6. If you are not clearly sure that real plant tissue is visible, return false.

7. Do not include markdown.

8. Do not include text outside the JSON.
"""

    result = _gemini_request(
        pil_image,
        prompt,
    )

    is_plant_image = _normalize_boolean(
        result.get("is_plant_image"),
        False,
    )

    validation_confidence = (
        _normalize_confidence(
            result.get(
                "validation_confidence"
            )
        )
    )

    visible_subject = _safe_string(
        result.get("visible_subject"),
        "Unknown object",
    )

    reason = _safe_string(
        result.get("reason"),
        "The uploaded image could not be verified as plant material.",
    )

    verified = (
        is_plant_image
        and
        validation_confidence
        >= PLANT_GATE_MIN_CONFIDENCE
    )

    return {
        "verified": verified,
        "is_plant_image": is_plant_image,
        "validation_confidence": (
            validation_confidence
        ),
        "visible_subject": visible_subject,
        "reason": reason,
    }


# ============================================================
# REJECTION RESPONSE
# ============================================================

def _build_rejection_response(
    supplied_crop_name,
    validation,
):
    """
    Return a safe response when Stage 1 cannot
    verify the image as real plant material.
    """

    return {
        "validation_status": "rejected",

        "is_plant_image": False,

        "crop_match": False,

        "health_status": "uncertain",

        "disease_name": "Unable to Diagnose",

        "crop_name": (
            supplied_crop_name
            or "Unknown"
        ),

        "confidence": 0.0,

        "severity": "Low",

        "symptoms": [],

        "organic_treatment": "",

        "chemical_treatment": "",

        "reasoning_summary": (
            validation.get("reason")
            or
            "The image could not be verified as plant material."
        ),

        "uncertain": True,

        "validation_confidence": (
            validation.get(
                "validation_confidence",
                0,
            )
        ),

        "visible_subject": (
            validation.get(
                "visible_subject",
                "Unknown object",
            )
        ),
    }


# ============================================================
# STAGE 2 — DISEASE DIAGNOSIS
# ============================================================

def _diagnose_verified_plant(
    pil_image,
    supplied_crop_name=None,
):
    """
    Second AI pass.

    Runs ONLY after Stage 1 verifies that the
    image contains plant material.
    """

    crop_text = (
        supplied_crop_name
        if supplied_crop_name
        else "Not provided"
    )

    prompt = f"""
You are a cautious agricultural plant disease diagnostic assistant.

The image has already passed a separate validation stage confirming that it contains real plant material.

The farmer says the crop or plant is:

{crop_text}

The farmer-provided crop name is supporting context only.

Do not blindly assume that the crop name is correct.

Analyze visible plant symptoms carefully.

Determine whether the plant appears:

- healthy
- diseased
- uncertain

Use visible evidence such as:

- leaf spots
- lesions
- discoloration
- chlorosis
- necrosis
- fungal growth
- mildew
- rust-like pustules
- curling
- wilting
- blight patterns
- bacterial-looking lesions
- pest damage
- nutrient deficiency patterns

If there is not enough evidence to identify a specific disease, return an uncertain result instead of inventing a disease.

Return ONLY valid JSON using exactly this structure:

{{
    "crop_match": true,
    "health_status": "diseased",
    "disease_name": "Disease name",
    "crop_name": "{crop_text}",
    "confidence": 75,
    "severity": "Low",
    "symptoms": [
        "Visible symptom 1",
        "Visible symptom 2",
        "Visible symptom 3"
    ],
    "organic_treatment": "Conservative organic recommendation",
    "chemical_treatment": "Conservative chemical recommendation",
    "reasoning_summary": "Short explanation based on visible evidence",
    "uncertain": false
}}

Rules:

1. crop_match must be true or false.

2. health_status must be exactly:
   healthy
   diseased
   uncertain

3. confidence must be between 0 and 100.

4. severity must be exactly:
   Low
   Medium
   High
   Critical

5. If confidence is below 45, uncertain must be true.

6. If disease evidence is weak or ambiguous, return uncertain.

7. Do not invent symptoms.

8. Do not invent a disease just to complete the response.

9. If healthy:
   disease_name must be "Healthy"
   health_status must be "healthy"
   severity must be "Low"

10. Treatments must be conservative.

11. Do not provide dangerous pesticide concentrations.

12. Do not claim laboratory confirmation.

13. Do not include markdown.

14. Do not include text outside the JSON.
"""

    result = _gemini_request(
        pil_image,
        prompt,
    )

    crop_match = _normalize_boolean(
        result.get("crop_match"),
        True,
    )

    health_status = _safe_string(
        result.get("health_status"),
        "uncertain",
    ).lower()

    if health_status not in {
        "healthy",
        "diseased",
        "uncertain",
    }:
        health_status = "uncertain"

    disease_name = _safe_string(
        result.get("disease_name"),
        "Unable to determine",
    )

    crop_name = _safe_string(
        result.get("crop_name"),
        supplied_crop_name or "Unknown",
    )

    confidence = _normalize_confidence(
        result.get("confidence")
    )

    severity = _normalize_severity(
        result.get("severity")
    )

    symptoms = _normalize_symptoms(
        result.get("symptoms")
    )

    uncertain = _normalize_boolean(
        result.get("uncertain"),
        False,
    )

    reasoning_summary = _safe_string(
        result.get("reasoning_summary"),
        "No visual explanation was provided.",
    )

    organic_treatment = _safe_string(
        result.get("organic_treatment"),
        "",
    )

    chemical_treatment = _safe_string(
        result.get("chemical_treatment"),
        "",
    )

    if confidence < 45:
        uncertain = True

    if health_status == "uncertain":
        uncertain = True

    if uncertain:
        health_status = "uncertain"

        if disease_name.lower() not in {
            "uncertain",
            "unable to determine",
            "healthy",
        }:
            disease_name = (
                f"Possible {disease_name}"
            )

    if health_status == "healthy":
        disease_name = "Healthy"
        severity = "Low"

        organic_treatment = (
            "Continue normal crop monitoring "
            "and preventive care."
        )

        chemical_treatment = (
            "No chemical treatment is recommended "
            "for a healthy plant."
        )

    return {
        "validation_status": "passed",

        "is_plant_image": True,

        "crop_match": crop_match,

        "health_status": health_status,

        "disease_name": disease_name,

        "crop_name": crop_name,

        "confidence": confidence,

        "severity": severity,

        "symptoms": symptoms,

        "organic_treatment": (
            organic_treatment
        ),

        "chemical_treatment": (
            chemical_treatment
        ),

        "reasoning_summary": (
            reasoning_summary
        ),

        "uncertain": uncertain,
    }


# ============================================================
# PUBLIC FUNCTION
# ============================================================

def diagnose_leaf(
    image_path,
    crop_name=None,
):
    """
    Two-stage plant disease analysis using Gemini API.

    Stage 1:
        Verify that the uploaded image actually
        contains real plant material.

    Stage 2:
        Only if Stage 1 passes, perform disease
        diagnosis.
    """

    # ----------------------------------------------------------
    # Read image using Pillow
    # ----------------------------------------------------------

    try:
        pil_image = Image.open(image_path)
    except Exception as error:
        raise ValueError(
            f"Unable to read image: {error}"
        ) from error

    # ----------------------------------------------------------
    # Clean supplied crop name
    # ----------------------------------------------------------

    supplied_crop_name = None

    if (
        isinstance(crop_name, str)
        and crop_name.strip()
    ):
        supplied_crop_name = (
            crop_name.strip()
        )

    # ----------------------------------------------------------
    # STAGE 1
    # ----------------------------------------------------------

    validation = _validate_plant_image(
        pil_image,
        supplied_crop_name,
    )

    print(
        "[AI Vision] Plant validation:",
        validation,
    )

    if not validation["verified"]:
        return _build_rejection_response(
            supplied_crop_name,
            validation,
        )

    # ----------------------------------------------------------
    # STAGE 2
    # ----------------------------------------------------------

    diagnosis = _diagnose_verified_plant(
        pil_image,
        supplied_crop_name,
    )

    diagnosis[
        "validation_confidence"
    ] = validation[
        "validation_confidence"
    ]

    diagnosis[
        "visible_subject"
    ] = validation[
        "visible_subject"
    ]

    return diagnosis