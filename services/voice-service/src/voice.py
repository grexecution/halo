"""Voice service stubs — real implementation requires Parakeet, Piper, Deepgram, or ElevenLabs."""


def stt_local(audio_path: str, language: str = "auto") -> str:
    """Transcribe audio using Parakeet (local STT)."""
    raise NotImplementedError("Real STT requires Parakeet model.")


def stt_cloud(audio_path: str, provider: str = "deepgram") -> str:
    """Transcribe audio using cloud STT (Deepgram or Whisper API)."""
    raise NotImplementedError("Real cloud STT requires API key.")


def tts_local(text: str, language: str = "en") -> bytes:
    """Synthesize audio using Piper (local TTS). Returns audio bytes."""
    raise NotImplementedError("Real TTS requires Piper model.")


def tts_cloud(text: str, voice_id: str = "default") -> bytes:
    """Synthesize audio using ElevenLabs. Returns audio bytes."""
    raise NotImplementedError("Real cloud TTS requires ElevenLabs API key.")
