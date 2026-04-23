"""
Voice service — real implementation.

STT (Speech-to-Text):
  - Local: Parakeet-tdt-0.6b-v3 via parakeet CLI / nemo subprocess
  - Cloud: Deepgram or OpenAI Whisper API

TTS (Text-to-Speech):
  - Local: Piper via piper CLI subprocess
  - Cloud: ElevenLabs REST API

Both local implementations use subprocess calls to the installed binaries.
If a binary is not installed, a ModelNotAvailableError is raised (not NotImplementedError)
so callers can decide to fall back to cloud.

Model weights download automatically on first use via _ensure_model().
Progress is printed to stderr so the caller can surface it.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional
import urllib.request
import urllib.error


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class ModelNotAvailableError(RuntimeError):
    """Raised when the required binary or model is not installed/downloaded."""


class TranscriptionError(RuntimeError):
    """Raised when STT fails for a non-availability reason."""


class SynthesisError(RuntimeError):
    """Raised when TTS fails for a non-availability reason."""


# ---------------------------------------------------------------------------
# Config paths
# ---------------------------------------------------------------------------

_GREG_DIR = Path.home() / ".open-greg"
_MODELS_DIR = _GREG_DIR / "models"
_PARAKEET_DIR = _MODELS_DIR / "parakeet"
_PIPER_DIR = _MODELS_DIR / "piper"

PARAKEET_MODEL_URL = (
    "https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2/resolve/main/parakeet-tdt-0.6b-v2.nemo"
)

# Default Piper voice — English (US), medium quality
PIPER_VOICE_NAME = os.environ.get("PIPER_VOICE", "en_US-lessac-medium")
PIPER_VOICE_URL = (
    f"https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/"
    f"{PIPER_VOICE_NAME}.onnx"
)
PIPER_CONFIG_URL = (
    f"https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/"
    f"{PIPER_VOICE_NAME}.onnx.json"
)


# ---------------------------------------------------------------------------
# Binary discovery
# ---------------------------------------------------------------------------


def _find_binary(name: str) -> Optional[str]:
    """Return the absolute path to a binary if it's on PATH, else None."""
    result = subprocess.run(
        ["which", name], capture_output=True, text=True, timeout=5
    )
    return result.stdout.strip() or None


def _parakeet_available() -> bool:
    return _find_binary("parakeet") is not None or _find_binary("parakeet-tdt") is not None


def _piper_available() -> bool:
    return _find_binary("piper") is not None


# ---------------------------------------------------------------------------
# Model file management
# ---------------------------------------------------------------------------


def _download_file(url: str, dest: Path, label: str) -> None:
    """Download url → dest, printing progress to stderr."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return
    print(f"[voice-service] Downloading {label}...", file=sys.stderr)
    try:
        urllib.request.urlretrieve(url, dest)  # noqa: S310
        print(f"[voice-service] {label} saved to {dest}", file=sys.stderr)
    except urllib.error.URLError as e:
        raise ModelNotAvailableError(f"Failed to download {label}: {e}") from e


def _ensure_piper_model() -> tuple[Path, Path]:
    """Ensure Piper voice model + config are downloaded. Returns (onnx_path, config_path)."""
    onnx = _PIPER_DIR / f"{PIPER_VOICE_NAME}.onnx"
    config = _PIPER_DIR / f"{PIPER_VOICE_NAME}.onnx.json"
    _download_file(PIPER_VOICE_URL, onnx, f"Piper voice {PIPER_VOICE_NAME}")
    _download_file(PIPER_CONFIG_URL, config, f"Piper voice config {PIPER_VOICE_NAME}")
    return onnx, config


# ---------------------------------------------------------------------------
# STT: local (Parakeet)
# ---------------------------------------------------------------------------


def stt_local(audio_path: str, language: str = "auto") -> str:
    """
    Transcribe audio using Parakeet-tdt (local STT).

    Args:
        audio_path: Path to a WAV or MP3 file.
        language: ISO-639-1 language code or "auto" (default). "auto" lets Parakeet detect.

    Returns:
        Transcription as a string.

    Raises:
        ModelNotAvailableError: if the parakeet binary is not installed.
        TranscriptionError: if transcription fails.
        FileNotFoundError: if audio_path does not exist.
    """
    if not Path(audio_path).exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    binary = _find_binary("parakeet") or _find_binary("parakeet-tdt")
    if binary is None:
        raise ModelNotAvailableError(
            "parakeet binary not found. Install via: pip install parakeet-tdt"
        )

    cmd = [binary, "--audio", audio_path, "--output", "json"]
    if language != "auto":
        cmd += ["--language", language]

    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120
        )
    except subprocess.TimeoutExpired as e:
        raise TranscriptionError("Parakeet transcription timed out (>120s)") from e

    if proc.returncode != 0:
        raise TranscriptionError(
            f"parakeet exited with code {proc.returncode}: {proc.stderr.strip()}"
        )

    try:
        data = json.loads(proc.stdout)
        return str(data.get("text", data))
    except json.JSONDecodeError:
        # Some versions print plain text
        return proc.stdout.strip()


# ---------------------------------------------------------------------------
# STT: cloud (Deepgram / Whisper API)
# ---------------------------------------------------------------------------


def stt_cloud(audio_path: str, provider: str = "deepgram") -> str:
    """
    Transcribe audio using a cloud STT provider.

    Args:
        audio_path: Path to the audio file.
        provider: "deepgram" or "whisper". Reads API key from env:
                  - Deepgram: DEEPGRAM_API_KEY
                  - Whisper:  OPENAI_API_KEY

    Returns:
        Transcription as a string.

    Raises:
        ModelNotAvailableError: if the required API key is not set.
        TranscriptionError: if the API call fails.
        FileNotFoundError: if audio_path does not exist.
    """
    if not Path(audio_path).exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    if provider == "deepgram":
        return _stt_deepgram(audio_path)
    elif provider == "whisper":
        return _stt_whisper(audio_path)
    else:
        raise ValueError(f"Unknown provider: {provider}. Use 'deepgram' or 'whisper'.")


def _stt_deepgram(audio_path: str) -> str:
    api_key = os.environ.get("DEEPGRAM_API_KEY")
    if not api_key:
        raise ModelNotAvailableError("DEEPGRAM_API_KEY environment variable not set")

    import urllib.request
    import urllib.error

    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

    ext = Path(audio_path).suffix.lower().lstrip(".")
    mime = {"mp3": "audio/mpeg", "wav": "audio/wav", "m4a": "audio/m4a"}.get(ext, "audio/wav")

    req = urllib.request.Request(
        "https://api.deepgram.com/v1/listen",
        data=audio_bytes,
        headers={
            "Authorization": f"Token {api_key}",
            "Content-Type": mime,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            return data["results"]["channels"][0]["alternatives"][0]["transcript"]
    except urllib.error.HTTPError as e:
        raise TranscriptionError(f"Deepgram API error {e.code}: {e.read().decode()}") from e
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        raise TranscriptionError(f"Unexpected Deepgram response: {e}") from e


def _stt_whisper(audio_path: str) -> str:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ModelNotAvailableError("OPENAI_API_KEY environment variable not set")

    # Use subprocess call to openai CLI to avoid heavy SDK dependency
    binary = _find_binary("openai")
    if binary is None:
        raise ModelNotAvailableError(
            "openai CLI not found. Install via: pip install openai"
        )

    proc = subprocess.run(
        [binary, "audio", "transcriptions", "--file", audio_path, "--model", "whisper-1"],
        capture_output=True,
        text=True,
        env={**os.environ, "OPENAI_API_KEY": api_key},
        timeout=60,
    )
    if proc.returncode != 0:
        raise TranscriptionError(f"openai CLI error: {proc.stderr.strip()}")
    return proc.stdout.strip()


# ---------------------------------------------------------------------------
# TTS: local (Piper)
# ---------------------------------------------------------------------------


def tts_local(text: str, language: str = "en") -> bytes:
    """
    Synthesize audio using Piper (local TTS).

    Args:
        text: Text to synthesize.
        language: Language hint (currently unused — model determines language).

    Returns:
        WAV audio as bytes.

    Raises:
        ModelNotAvailableError: if the piper binary is not installed.
        SynthesisError: if synthesis fails.
    """
    if not _piper_available():
        raise ModelNotAvailableError(
            "piper binary not found. Install via: pip install piper-tts"
        )

    onnx, config = _ensure_piper_model()

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        proc = subprocess.run(
            [
                "piper",
                "--model", str(onnx),
                "--config", str(config),
                "--output_file", tmp_path,
            ],
            input=text,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if proc.returncode != 0:
            raise SynthesisError(f"piper exited with code {proc.returncode}: {proc.stderr.strip()}")

        with open(tmp_path, "rb") as f:
            return f.read()
    except subprocess.TimeoutExpired as e:
        raise SynthesisError("piper TTS timed out (>60s)") from e
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# TTS: cloud (ElevenLabs)
# ---------------------------------------------------------------------------


def tts_cloud(text: str, voice_id: str = "default") -> bytes:
    """
    Synthesize audio using ElevenLabs.

    Args:
        text: Text to synthesize.
        voice_id: ElevenLabs voice ID or "default" (uses ELEVENLABS_DEFAULT_VOICE env var,
                  falls back to "21m00Tcm4TlvDq8ikWAM" which is Rachel).

    Returns:
        MP3 audio as bytes.

    Raises:
        ModelNotAvailableError: if ELEVENLABS_API_KEY is not set.
        SynthesisError: if the API call fails.
    """
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise ModelNotAvailableError("ELEVENLABS_API_KEY environment variable not set")

    if voice_id == "default":
        voice_id = os.environ.get("ELEVENLABS_DEFAULT_VOICE", "21m00Tcm4TlvDq8ikWAM")

    import urllib.request
    import urllib.error

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    payload = json.dumps({
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.5},
    }).encode()

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        raise SynthesisError(f"ElevenLabs API error {e.code}: {e.read().decode()}") from e
