import json
import os
import subprocess
import tempfile
from PIL import Image

from ai.gemini_client import generate_multimodal, generate_text


SUPPORTED_LANGUAGES = {
    "English": "English",
    "Hindi": "Hindi",
    "Bengali": "Bengali",
}

ALLOWED_VIDEO_EXTENSIONS = {
    ".mp4",
    ".mov",
    ".webm",
    ".mkv",
}

# Number of representative frames to sample from video
MAX_FRAMES = 4


# ============================================================
# VIDEO INFORMATION
# ============================================================

def _get_video_duration(video_path):
    """Get video duration in seconds using FFprobe."""
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        video_path,
    ]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        )

        data = json.loads(result.stdout)
        duration = float(data["format"]["duration"])

        if duration <= 0:
            raise ValueError("Video duration is invalid.")

        return duration

    except FileNotFoundError as exc:
        raise RuntimeError(
            "FFprobe was not found. "
            "Make sure FFmpeg is installed and available in PATH."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("FFprobe took too long to inspect the video.") from exc
    except (subprocess.CalledProcessError, KeyError, ValueError, json.JSONDecodeError) as exc:
        raise ValueError("Unable to determine video duration.") from exc


# ============================================================
# TIMESTAMP SELECTION
# ============================================================

def _choose_timestamps(duration):
    """
    Choose representative timestamps throughout the video.

    Exact beginning/end frames are avoided because they may
    contain black frames, transitions, or title screens.
    """
    if duration <= 2:
        return [duration / 2]

    frame_count = min(MAX_FRAMES, max(1, int(duration)))
    timestamps = []

    for index in range(frame_count):
        fraction = (index + 1) / (frame_count + 1)
        timestamps.append(duration * fraction)

    return timestamps


# ============================================================
# FRAME EXTRACTION
# ============================================================

def _extract_frame(video_path, timestamp, output_path):
    """Extract one representative frame using FFmpeg."""
    command = [
        "ffmpeg",
        "-y",
        "-ss",
        str(timestamp),
        "-i",
        video_path,
        "-frames:v",
        "1",
        "-vf",
        "scale='min(1280,iw)':-2",
        "-q:v",
        "3",
        output_path,
    ]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=60,
        )

        if result.returncode != 0:
            error_message = result.stderr.strip() or "Unknown FFmpeg error."
            raise RuntimeError(f"FFmpeg could not extract a video frame. {error_message}")

        if not os.path.isfile(output_path) or os.path.getsize(output_path) == 0:
            raise RuntimeError("FFmpeg created an empty or missing frame.")

    except FileNotFoundError as exc:
        raise RuntimeError(
            "FFmpeg was not found. Make sure FFmpeg is installed and available in PATH."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("FFmpeg took too long to process the video.") from exc


# ============================================================
# SINGLE FRAME ANALYSIS
# ============================================================

def _analyze_frame(frame_path, frame_number, timestamp):
    """Analyze ONE extracted frame using Gemini API."""
    prompt = f"""
You are analyzing one representative frame extracted from a video.

Frame number:
{frame_number}

Approximate timestamp:
{timestamp:.1f} seconds

Carefully inspect ONLY this image.

Describe the important visible information that may help another AI
understand what is happening in the complete video.

RULES:
- Describe the main subjects.
- Describe visible actions.
- Describe the environment or location when relevant.
- Mention important objects, machinery, crops, plants, animals,
  people, vehicles, buildings, text, or other visible content.
- If this is agricultural content, mention useful agricultural
  details that are actually visible.
- Do not invent anything that cannot be seen.
- Do not assume what happened before or after this frame.
- Do not claim to hear audio.
- If something is unclear, say that it is unclear.
- Keep the description concise but informative.

Return only the frame observation.
"""
    try:
        pil_image = Image.open(frame_path)
        return generate_multimodal([pil_image, prompt], temperature=0.1)
    except Exception as exc:
        raise RuntimeError(f"Failed to analyze frame {frame_number}: {exc}") from exc


# ============================================================
# FINAL VIDEO INTERPRETATION
# ============================================================

def _generate_final_answer(observations, message, language, duration):
    """
    Give the chronological frame observations to Gemini API
    and generate the final answer to the user's question.
    """
    response_language = SUPPORTED_LANGUAGES[language]
    observation_text = "\n\n".join(observations)

    prompt = f"""
You are KISAAN AI Assistant, a multimodal agricultural assistant
for farmers in India.

A user uploaded a video.

The video itself is NOT directly available to you.

A vision model inspected representative frames from the video in
chronological order. Those observations are provided below.

Your job is to use ONLY those observations to answer the user's
question.

Selected response language:
{response_language}

LANGUAGE RULES:
1. Always reply in {response_language}.
2. If Hindi is selected, use natural Hindi in Devanagari script.
3. If Bengali is selected, use natural Bengali script.
4. If English is selected, use clear simple English.
5. The user's question may be written in English, Hindi, Bengali,
   or mixed language.
6. Use natural agricultural terminology when appropriate.

VIDEO LIMITATIONS:
- The analysis is based on sampled video frames.
- Do not pretend that every frame of the video was inspected.
- Do not invent events between sampled frames.
- Do not claim that you heard the video's audio.
- Audio has not been analyzed.
- If the observations are insufficient to answer the question,
  clearly explain that limitation.
- If the observations conflict, mention the uncertainty.
- Do not assume the video is agricultural.

AGRICULTURAL SAFETY:
- You may explain visible agricultural activities.
- You may describe visible plant symptoms.
- Do not claim laboratory confirmation of a plant disease.
- Do not invent symptoms.
- Keep treatment recommendations conservative.
- Do not provide dangerous pesticide concentrations.
- When identification is uncertain, recommend expert confirmation
  where appropriate.

RESPONSE RULES:
- Answer the user's actual question directly.
- Do not introduce yourself unless asked.
- Keep the answer concise but useful.
- Do not list frame-by-frame observations unless that is useful
  for answering the question.
- Never invent information that is not supported by the
  observations.

Video duration:
{duration:.1f} seconds

VISION MODEL OBSERVATIONS:

{observation_text}

USER'S QUESTION:

{message}

Answer only the user's question in {response_language}.
"""
    try:
        return generate_text(prompt, temperature=0.2)
    except Exception as exc:
        raise RuntimeError(f"Failed to generate final video analysis answer: {exc}") from exc


# ============================================================
# PUBLIC VIDEO FUNCTION
# ============================================================

def generate_video_response(video_path, message="", language="English"):
    """
    Analyze a video using representative frames via Gemini API.
    """
    if not video_path or not os.path.isfile(video_path):
        raise ValueError("Video file was not found.")

    extension = os.path.splitext(video_path)[1].lower()
    if extension not in ALLOWED_VIDEO_EXTENSIONS:
        raise ValueError("Unsupported video format. Please use MP4, MOV, WEBM, or MKV.")

    if language not in SUPPORTED_LANGUAGES:
        language = "English"

    message = str(message or "").strip()
    if not message:
        message = "Describe what happens in this video."

    duration = _get_video_duration(video_path)
    timestamps = _choose_timestamps(duration)
    observations = []

    with tempfile.TemporaryDirectory() as temp_dir:
        for index, timestamp in enumerate(timestamps):
            frame_number = index + 1
            frame_path = os.path.join(temp_dir, f"frame_{frame_number}.jpg")

            _extract_frame(video_path, timestamp, frame_path)

            print(
                f"[AI Video] Analyzing frame {frame_number}/{len(timestamps)} at {timestamp:.1f}s via Gemini API..."
            )

            frame_analysis = _analyze_frame(frame_path, frame_number, timestamp)

            observations.append(
                f"Frame {frame_number} (approximately {timestamp:.1f} seconds):\n{frame_analysis}"
            )

    if not observations:
        raise RuntimeError("No video frames could be analyzed.")

    print("[AI Video] Combining frame observations via Gemini API...")
    return _generate_final_answer(
        observations=observations,
        message=message,
        language=language,
        duration=duration,
    )