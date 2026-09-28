"""
KISAAN - AI Smart Crop Advisor Service

Uses Google Gemini API to generate structured crop recommendations
from farm, climate, soil and farmer-priority data.
"""

import json
import re
from copy import deepcopy

from ai.gemini_client import generate_text


MAX_ATTEMPTS = 2


def _clean_text(value, default="Unknown"):
    """Convert incoming values to safe, readable strings."""
    if value is None:
        return default

    value = str(value).strip()
    return value if value else default


def _number_or_none(value):
    """Convert an optional numeric value to float."""
    if value in (None, "", "null"):
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_json(text):
    """
    Extract a JSON object if the model accidentally surrounds
    it with markdown or explanatory text.
    """
    if not text:
        raise ValueError("AI returned an empty response.")

    text = text.strip()

    text = re.sub(
        r"^```(?:json)?\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )

    text = re.sub(
        r"\s*```$",
        "",
        text,
    )

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise ValueError(
            "AI response did not contain a valid JSON object."
        )

    return json.loads(text[start:end + 1])


def _normalize_score(value):
    """Force suitability score into the 0-100 range."""
    try:
        value = float(value)
    except (TypeError, ValueError):
        return 0.0

    return round(max(0.0, min(value, 100.0)), 1)


def _normalize_string_list(value, limit=4):
    """Normalize an AI field into a short list of strings."""
    if not isinstance(value, list):
        return []

    cleaned = []

    for item in value:
        item = str(item).strip()

        if item:
            cleaned.append(item)

    return cleaned[:limit]


def _normalize_recommendation(item, rank):
    """Normalize one recommendation returned by the model."""
    if not isinstance(item, dict):
        return None

    crop_name = _clean_text(
        item.get("crop_name"),
        "",
    )

    if not crop_name:
        return None

    risk_level = _clean_text(
        item.get("risk_level"),
        "Moderate",
    )

    if risk_level.lower() not in {
        "low",
        "moderate",
        "high",
    }:
        risk_level = "Moderate"

    water_requirement = _clean_text(
        item.get("water_requirement"),
        "Moderate",
    )

    if water_requirement.lower() not in {
        "low",
        "moderate",
        "high",
    }:
        water_requirement = "Moderate"

    return {
        "rank": rank,
        "crop_name": crop_name,
        "suitability_score": _normalize_score(
            item.get("suitability_score", 0)
        ),
        "reason": _clean_text(
            item.get("reason"),
            "Suitable based on the supplied farm conditions.",
        ),
        "season": _clean_text(
            item.get("season"),
        ),
        "water_requirement": water_requirement.title(),
        "duration_days": _clean_text(
            item.get("duration_days"),
        ),
        "risk_level": risk_level.title(),
        "expected_yield": _clean_text(
            item.get("expected_yield"),
            "Local yield estimate required",
        ),
        "key_advantages": _normalize_string_list(
            item.get("key_advantages"),
            limit=4,
        ),
        "important_caution": _clean_text(
            item.get("important_caution"),
            "",
        ),
    }


def _call_gemini(prompt):
    """Call Gemini API and return the raw JSON response string."""
    try:
        return generate_text(prompt, temperature=0.2, response_json=True)
    except Exception as exc:
        raise RuntimeError(
            f"Could not connect to Gemini API: {exc}"
        ) from exc


def _validate_water_constraints(
    recommendations,
    water_availability,
    irrigation,
):
    """
    Reject obviously contradictory low-water recommendations.
    """
    if str(water_availability).strip().lower() != "low":
        return

    high_water_crop_terms = {
        "rice",
        "paddy",
        "sugarcane",
    }

    irrigation_lower = str(irrigation).strip().lower()

    for recommendation in recommendations:
        crop_name = (
            str(recommendation.get("crop_name", ""))
            .strip()
            .lower()
        )

        water_requirement = (
            str(recommendation.get("water_requirement", ""))
            .strip()
            .lower()
        )

        if any(
            term == crop_name
            or crop_name.startswith(f"{term} ")
            or crop_name.endswith(f" {term}")
            or f"({term})" in crop_name
            for term in high_water_crop_terms
        ):
            raise ValueError(
                f"AI returned {crop_name} for a low-water farm. "
                "Recommendation rejected for constraint conflict."
            )

        if (
            irrigation_lower == "rain-fed"
            and water_requirement == "high"
        ):
            raise ValueError(
                "AI returned a high-water crop for a low-water "
                "rain-fed farm."
            )


def _validate_recommendation_consistency(recommendations):
    """
    Reject recommendations where the explanation contradicts
    the structured water requirement.
    """
    high_water_phrases = {
        "high-water crop",
        "high water crop",
        "water-intensive crop",
        "water intensive crop",
    }

    low_water_phrases = {
        "low-water crop",
        "low water crop",
        "drought-tolerant crop",
        "drought tolerant crop",
    }

    for recommendation in recommendations:
        crop_name = str(
            recommendation.get("crop_name", "")
        ).strip()

        water_requirement = str(
            recommendation.get("water_requirement", "")
        ).strip().lower()

        reason = str(
            recommendation.get("reason", "")
        ).strip().lower()

        if any(
            phrase in reason
            for phrase in high_water_phrases
        ):
            if water_requirement != "high":
                raise ValueError(
                    f"AI returned contradictory water information "
                    f"for {crop_name}: explanation says high-water "
                    f"but water_requirement is "
                    f"'{water_requirement}'."
                )

        if any(
            phrase in reason
            for phrase in low_water_phrases
        ):
            if water_requirement == "high":
                raise ValueError(
                    f"AI returned contradictory water information "
                    f"for {crop_name}: explanation says low-water "
                    f"but water_requirement is High."
                )


def _validate_specific_crop_names(recommendations):
    """
    Reject generic crop groups. The UI must show a real crop name,
    not a broad category such as 'Pulses' or 'Oilseeds'.
    """
    generic_names = {
        "pulse",
        "pulses",
        "oilseed",
        "oilseeds",
        "millet",
        "millets",
        "cereal",
        "cereals",
        "grain",
        "grains",
        "vegetable",
        "vegetables",
        "legume",
        "legumes",
        "cash crop",
        "cash crops",
        "horticultural crop",
        "horticultural crops",
    }

    for recommendation in recommendations:
        crop_name = str(
            recommendation.get("crop_name", "")
        ).strip().lower()

        if crop_name in generic_names:
            raise ValueError(
                f"AI returned generic crop category '{crop_name}'. "
                "Return a specific crop name instead."
            )


def _validate_selected_season(
    ai_result,
    recommendations,
    requested_season,
):
    """
    If the farmer explicitly selected a season, the returned season
    must match it instead of copying example/schema text.
    """
    requested = str(requested_season).strip()
    if requested.lower() == "auto":
        season_used = str(ai_result.get("season_used", "")).strip().lower()
        if season_used in {"", "auto", "unknown"}:
            raise ValueError(
                "Auto season must be resolved to an actual growing season "
                "such as Kharif, Rabi, or Zaid. Do not return 'Auto'."
            )
        for recommendation in recommendations:
            crop_season = str(recommendation.get("season", "")).strip().lower()
            if crop_season != season_used:
                raise ValueError(
                    f"AI returned season '{recommendation.get('season')}' for "
                    f"{recommendation.get('crop_name')} but season_used is "
                    f"'{ai_result.get('season_used')}'."
                )
        return

    if not requested:
        return

    season_used = str(
        ai_result.get("season_used", "")
    ).strip()

    if season_used.lower() != requested.lower():
        raise ValueError(
            f"AI returned season_used='{season_used}' even though "
            f"the farmer selected '{requested}'."
        )

    for recommendation in recommendations:
        crop_name = str(
            recommendation.get("crop_name", "")
        ).strip()

        crop_season = str(
            recommendation.get("season", "")
        ).strip()

        if crop_season.lower() != requested.lower():
            raise ValueError(
                f"AI returned season '{crop_season}' for {crop_name} "
                f"even though the farmer selected '{requested}'."
            )

def _validate_known_crop_seasons(ai_result, recommendations):
    """Reject known crop-season mismatches without restricting other crops."""
    season_used = str(ai_result.get("season_used", "")).strip().lower()

    known_crop_seasons = {
        "chickpea": {"rabi"},
        "chana": {"rabi"},
        "bengal gram": {"rabi"},
    }

    for recommendation in recommendations:
        crop_name = str(recommendation.get("crop_name", "")).strip().lower()

        # Match these names exactly; do not guess about unfamiliar crops.
        allowed_seasons = known_crop_seasons.get(crop_name)
        if allowed_seasons and season_used not in allowed_seasons:
            raise ValueError(
                f"{recommendation['crop_name']} is not appropriate for "
                f"the returned season '{season_used}'. Choose a different "
                "crop suitable for that season."
            )

def _validate_expected_yield(recommendations):
    """Reject placeholder yield text."""
    forbidden_phrases = {
        "approximate range per acre",
        "expected yield",
        "varies",
    }

    for recommendation in recommendations:
        crop_name = str(
            recommendation.get("crop_name", "")
        ).strip()

        expected_yield = str(
            recommendation.get("expected_yield", "")
        ).strip()

        if not expected_yield:
            raise ValueError(
                f"AI did not provide expected yield for {crop_name}."
            )

        if expected_yield.lower() in forbidden_phrases:
            raise ValueError(
                f"AI returned placeholder yield text for {crop_name}."
            )


def _validate_duplicate_content(recommendations):
    """
    Reject obviously copied cautions across all three recommendations.
    This keeps the model from returning three nearly identical cards.
    """
    if len(recommendations) != 3:
        return

    cautions = [
        str(item.get("important_caution", "")).strip().lower()
        for item in recommendations
    ]

    for recommendation, caution in zip(recommendations, cautions):
        if not caution:
            raise ValueError(
                f"AI did not provide a crop-specific caution for "
                f"{recommendation.get('crop_name')}."
            )

    if (
        cautions[0]
        and cautions[0] == cautions[1] == cautions[2]
    ):
        raise ValueError(
            "AI returned the same caution for all three crops. "
            "Each crop needs a crop-specific caution."
        )


def _build_prompt(farm_context):
    """Build the main crop-advisor prompt."""
    return f"""
You are KISAAN AI Crop Advisor, an agricultural decision-support
assistant for Indian farmers.

Your task is to recommend exactly THREE SPECIFIC practical crops for
the farmer's supplied conditions.

FARM CONTEXT:
{json.dumps(farm_context, indent=2)}

IMPORTANT RULES:

1. Give exactly 3 crop recommendations.

2. Rank the crops from most suitable to least suitable.

3. Recommendations must consider:
   - location
   - soil type
   - growing season
   - water availability
   - irrigation source
   - farmer priority
   - temperature, humidity and rainfall when supplied

4. SEASON RULE:
   - If season is "Auto", infer a reasonable season from the supplied
     location/climate context.
   - If the farmer explicitly selected Kharif, Rabi, Zaid or another
     season, season_used MUST be exactly that selected season.
   - Each recommendation's "season" field must also match the selected
     season.
   - Never copy instructional example text into season_used.
      - Check that each crop is actually suitable for season_used in the
     farmer's region. Do not change a crop's usual growing season just
     to make it match season_used.
   - Chickpea (Chana/Bengal gram) is generally a Rabi crop in India.
     Do NOT recommend it when season_used is Kharif. Choose a
     genuinely Kharif-suitable crop instead.

5. WATER CONSTRAINTS ARE STRICT.

   If water_availability is "Low":
   - Prefer drought-tolerant and low-water crops.
   - Strongly prefer appropriate pulses, oilseeds, millets and other
     crops for the supplied season and region.
   - Do NOT recommend conventional flooded paddy/rice as a top crop.
   - Do NOT classify conventional rice/paddy as a Low-water crop.
   - Do NOT recommend highly water-demanding crops such as sugarcane
     unless reliable irrigation is available.
   - If irrigation is "Rain-fed", recommendations must be realistic
     without assuming regular irrigation.

   Never describe a generally water-intensive crop as
   "water-efficient" merely to make it fit the farmer's request.

6. Respect the farmer's stated priority:
   - Higher Profit
   - Low Water
   - Low Risk
   - Short Duration
   - Balanced

7. Do not invent exact guarantees for profit, yield or market price.

8. Expected yield must contain a REALISTIC NUMERIC approximate range
   when you are reasonably confident.

   Good examples:
   - "8-12 quintals/acre"
   - "15-20 quintals/acre"
   - "4-6 tonnes/acre"

   NEVER return placeholder text such as:
   - "Approximate range per acre"
   - "Varies"
   - "Expected yield"

   If you cannot provide a responsible estimate, return:
   "Local yield estimate required"

9. The reason, water_requirement, risk_level and caution must agree
   with each other.

10. Do not force a crop to match the farmer's constraints.
    If a crop is unsuitable, choose a different crop.

11. For Low-water + Rain-fed conditions, give strong preference to
    crops that can realistically tolerate moisture stress.

12. Suitability scores must reflect the supplied constraints.
    A crop conflicting with an important constraint must not receive
    a high suitability score.

13. Suitability score is a decision-support score, NOT a scientific
    probability. Use realistic differentiation between crops.
    Do not automatically give 95-100 to every crop.

14. Keep recommendations appropriate for Indian agriculture.

15. Do not recommend a crop merely because it is popular.

16. If the supplied information is incomplete, mention the
    uncertainty in analysis_summary.

17. USE SPECIFIC CROP NAMES ONLY.
    Do NOT return broad categories such as:
    - "Pulses"
    - "Oilseeds"
    - "Millets"
    - "Cereals"
    - "Vegetables"

    Examples of acceptable specific crop names include:
    - Chickpea
    - Lentil
    - Mustard
    - Groundnut
    - Soybean
    - Pearl Millet (Bajra)
    - Sorghum (Jowar)
    - Maize
    - Rice

18. Each crop must have crop-specific agronomic values.

    Do NOT copy the same duration, expected yield, water requirement,
    risk level, advantages, or caution across all three recommendations
    unless they are genuinely appropriate.

    Assess the three crops independently.

    For each crop:
    - Use a realistic crop-specific duration.
    - Use a realistic crop-specific expected yield range.
    - Use a realistic crop-specific water requirement.
    - Use a realistic crop-specific risk level.
    - Give crop-specific advantages.
    - Give a crop-specific caution.

    Avoid using the same generic caution for every crop.
         IMPORTANT: Write a different, practical caution for EACH crop.
     Each caution must identify a risk or management concern specific
     to that crop. Do not repeat the same caution across all three crops.
     Do not use "Confirm local suitability before planting" as a
     generic caution for every crop.

19. Crop-specific accuracy is more important than making every crop
    appear suitable.

    Important examples:
    - Conventional rice/paddy is generally water-demanding. Do not
      describe it as "water-efficient" or a low-water crop.
    - Maize has different water needs, duration, risks and management
      concerns from rice.
    - Soybean has different water needs, duration, risks and management
      concerns from both rice and maize.

20. When water availability is High and reliable irrigation such as
    Canal is available, do not unnecessarily prefer only low-water
    crops. Evaluate crops according to the farmer's stated priority,
    soil, season, climate and available water.

21. Every crop's explanation must mention at least one characteristic
    specific to that crop.

22. Do not blindly copy any values or wording from the JSON schema
    examples below. They demonstrate FORMAT only.

Return ONLY valid JSON.

Use EXACTLY this structure:

{{
  "analysis_summary": "Short explanation based on the actual farm context.",
  "season_used": "Use the actual selected or inferred season",
  "recommendations": [
    {{
      "crop_name": "Specific crop name",
      "suitability_score": 88,
      "reason": "Crop-specific reason based on the farm context.",
      "season": "Actual season",
      "water_requirement": "Low",
      "duration_days": "100-120 days",
      "risk_level": "Low",
      "expected_yield": "8-12 quintals/acre",
      "key_advantages": [
        "Crop-specific advantage one",
        "Crop-specific advantage two"
      ],
      "important_caution": "Crop-specific practical caution."
    }},
    {{
      "crop_name": "Another specific crop name",
      "suitability_score": 82,
      "reason": "Different crop-specific reason.",
      "season": "Actual season",
      "water_requirement": "Moderate",
      "duration_days": "90-110 days",
      "risk_level": "Moderate",
      "expected_yield": "10-15 quintals/acre",
      "key_advantages": [
        "Different advantage one",
        "Different advantage two"
      ],
      "important_caution": "Different crop-specific caution."
    }},
    {{
      "crop_name": "Third specific crop name",
      "suitability_score": 76,
      "reason": "Third crop-specific reason.",
      "season": "Actual season",
      "water_requirement": "Low",
      "duration_days": "110-130 days",
      "risk_level": "Moderate",
      "expected_yield": "6-10 quintals/acre",
      "key_advantages": [
        "Third advantage one",
        "Third advantage two"
      ],
      "important_caution": "Third crop-specific caution."
    }}
  ]
}}
"""


def _parse_and_validate_result(
    raw_model_response,
    water_availability,
    irrigation,
    requested_season,
):
    """Parse, normalize and validate one Gemini response."""
    ai_result = _extract_json(
        raw_model_response
    )

    if not isinstance(ai_result, dict):
        raise ValueError(
            "Crop Advisor AI response must be a JSON object."
        )

    raw_recommendations = ai_result.get(
        "recommendations",
        [],
    )

    if not isinstance(raw_recommendations, list):
        raise ValueError(
            "AI recommendations must be a list."
        )

    recommendations = []

    for item in raw_recommendations[:3]:
        normalized = _normalize_recommendation(
            item,
            len(recommendations) + 1,
        )

        if normalized:
            recommendations.append(normalized)

    if len(recommendations) != 3:
        raise ValueError(
            "AI did not return exactly three valid crop recommendations."
        )

    _validate_specific_crop_names(
        recommendations=recommendations,
    )

    _validate_water_constraints(
        recommendations=recommendations,
        water_availability=water_availability,
        irrigation=irrigation,
    )

    _validate_recommendation_consistency(
        recommendations=recommendations,
    )

    _validate_selected_season(
        ai_result=ai_result,
        recommendations=recommendations,
        requested_season=requested_season,
    )

    _validate_known_crop_seasons(
        ai_result=ai_result,
        recommendations=recommendations,
    )

    _validate_expected_yield(
        recommendations=recommendations,
    )

    _validate_duplicate_content(
        recommendations=recommendations,
    )

    recommendations.sort(
        key=lambda item: item["suitability_score"],
        reverse=True,
    )

    for index, recommendation in enumerate(
        recommendations,
        start=1,
    ):
        recommendation["rank"] = index

    return ai_result, recommendations


def recommend_crops(
    soil_type,
    season,
    water_availability,
    irrigation,
    land_size=None,
    priority="Balanced",
    location="Unknown",
    temperature=None,
    humidity=None,
    rainfall=None,
):
    """
    Generate the top three crop recommendations using Gemini API.

    A failed validation receives one automatic retry with the
    validation error fed back to the model.
    """

    soil_type = _clean_text(soil_type)
    season = _clean_text(season, "Auto")
    water_availability = _clean_text(
        water_availability,
        "Moderate",
    )
    irrigation = _clean_text(
        irrigation,
        "Unknown",
    )
    priority = _clean_text(
        priority,
        "Balanced",
    )
    location = _clean_text(
        location,
        "Unknown",
    )

    land_size = _number_or_none(land_size)
    temperature = _number_or_none(temperature)
    humidity = _number_or_none(humidity)
    rainfall = _number_or_none(rainfall)

    farm_context = {
        "location": location,
        "soil_type": soil_type,
        "season": season,
        "water_availability": water_availability,
        "irrigation_source": irrigation,
        "land_size_acres": land_size,
        "farmer_priority": priority,
        "current_temperature_c": temperature,
        "current_humidity_percent": humidity,
        "rainfall_context": rainfall,
    }

    base_prompt = _build_prompt(
        farm_context=farm_context,
    )

    last_error = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        prompt = base_prompt

        if attempt > 1 and last_error is not None:
            prompt += f"""

YOUR PREVIOUS RESPONSE WAS REJECTED.

VALIDATION ERROR:
{last_error}

Generate the complete JSON again from scratch.

Correct the validation problem while preserving all farm constraints.

If the validation error concerns missing or identical cautions:
- First identify a real, distinct agronomic risk or management concern
  for EACH crop under this farm's soil, season, climate and water conditions.
- Then write one concrete, crop-specific important_caution for each crop.
- A caution should name the crop and explain its particular concern;
  do not repeat a generic warning or copy a caution between crops.
- Never invent risks just to make the wording different. If a crop does
  not fit these conditions, replace it with a genuinely suitable crop.
- Check all three important_caution fields before returning the JSON.

Do not explain the correction.
Return ONLY the corrected JSON object.
"""

        try:
            raw_response = _call_gemini(
                prompt=prompt,
            )

            ai_result, recommendations = _parse_and_validate_result(
                raw_model_response=raw_response,
                water_availability=water_availability,
                irrigation=irrigation,
                requested_season=season,
            )

            return {
                "analysis_summary": _clean_text(
                    ai_result.get("analysis_summary"),
                    (
                        "Recommendations generated from the supplied "
                        "farm conditions."
                    ),
                ),
                "season_used": _clean_text(
                    ai_result.get("season_used"),
                    season,
                ),
                "farm_context": farm_context,
                "recommendations": recommendations,
                "analysis_source": "gemini-api",
            }

        except RuntimeError:
            # Network/API server errors surface immediately
            raise

        except (ValueError, KeyError, TypeError) as exc:
            last_error = str(exc)

            if attempt >= MAX_ATTEMPTS:
                raise ValueError(
                    "AI Crop Advisor could not produce a valid "
                    f"recommendation after {MAX_ATTEMPTS} attempts. "
                    f"Last validation error: {last_error}"
                ) from exc

    raise RuntimeError(
        "AI Crop Advisor failed unexpectedly."
    )
