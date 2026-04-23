"""
F-207: Voice pipeline — TTS (Text-to-Speech) tests

Uses unittest.mock to simulate binary availability and subprocess responses
so tests run without Piper installed or API keys set.
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch, mock_open

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from voice import (
    ModelNotAvailableError,
    SynthesisError,
    tts_local,
    tts_cloud,
)

_FAKE_WAV = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"


class TestTtsLocal(unittest.TestCase):
    def test_raises_model_not_available_when_piper_missing(self):
        with patch("voice._piper_available", return_value=False):
            with self.assertRaises(ModelNotAvailableError):
                tts_local("hello world")

    def test_returns_wav_bytes_on_success(self):
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = ""
        mock_result.stderr = ""

        with patch("voice._piper_available", return_value=True):
            with patch("voice._ensure_piper_model", return_value=(Path("/m.onnx"), Path("/m.json"))):
                with patch("voice.subprocess.run", return_value=mock_result):
                    with patch("builtins.open", mock_open(read_data=_FAKE_WAV)):
                        with patch("voice.Path.unlink"):
                            result = tts_local("hello world")

        self.assertEqual(result, _FAKE_WAV)

    def test_raises_synthesis_error_on_nonzero_exit(self):
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stdout = ""
        mock_result.stderr = "piper model error"

        with patch("voice._piper_available", return_value=True):
            with patch("voice._ensure_piper_model", return_value=(Path("/m.onnx"), Path("/m.json"))):
                with patch("voice.subprocess.run", return_value=mock_result):
                    with self.assertRaises(SynthesisError) as ctx:
                        tts_local("hello")
        self.assertIn("code 1", str(ctx.exception))

    def test_passes_model_and_config_to_piper(self):
        captured = []

        def fake_run(cmd, **kwargs):
            captured.append(cmd)
            r = MagicMock()
            r.returncode = 0
            r.stderr = ""
            return r

        with patch("voice._piper_available", return_value=True):
            with patch("voice._ensure_piper_model", return_value=(Path("/models/voice.onnx"), Path("/models/voice.json"))):
                with patch("voice.subprocess.run", side_effect=fake_run):
                    with patch("builtins.open", mock_open(read_data=b"wav")):
                        with patch("voice.Path.unlink"):
                            tts_local("test text")

        self.assertTrue(len(captured) > 0)
        cmd = captured[0]
        self.assertIn("--model", cmd)
        self.assertIn("/models/voice.onnx", cmd)
        self.assertIn("--config", cmd)


class TestTtsCloud(unittest.TestCase):
    def setUp(self):
        self._saved_env = {}
        for k in ("ELEVENLABS_API_KEY", "ELEVENLABS_DEFAULT_VOICE"):
            self._saved_env[k] = os.environ.pop(k, None)

    def tearDown(self):
        for k, v in self._saved_env.items():
            if v is not None:
                os.environ[k] = v
            else:
                os.environ.pop(k, None)

    def test_raises_model_not_available_when_key_missing(self):
        with self.assertRaises(ModelNotAvailableError):
            tts_cloud("hello")

    def test_returns_mp3_bytes_on_success(self):
        os.environ["ELEVENLABS_API_KEY"] = "test-key"
        fake_audio = b"fake mp3 bytes"

        class FakeResponse:
            def read(self):
                return fake_audio
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass

        with patch("urllib.request.urlopen", return_value=FakeResponse()):
            result = tts_cloud("hello world")

        self.assertEqual(result, fake_audio)

    def test_uses_default_voice_when_voice_id_is_default(self):
        os.environ["ELEVENLABS_API_KEY"] = "test-key"
        os.environ["ELEVENLABS_DEFAULT_VOICE"] = "custom-voice-id"

        captured_url = []

        class FakeResponse:
            def read(self):
                return b"audio"
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass

        def fake_urlopen(req, **kwargs):
            captured_url.append(req.full_url)
            return FakeResponse()

        with patch("urllib.request.urlopen", side_effect=fake_urlopen):
            tts_cloud("hello", voice_id="default")

        self.assertTrue(any("custom-voice-id" in u for u in captured_url))

    def test_uses_specific_voice_id_when_provided(self):
        os.environ["ELEVENLABS_API_KEY"] = "test-key"

        captured_url = []

        class FakeResponse:
            def read(self):
                return b"audio"
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass

        def fake_urlopen(req, **kwargs):
            captured_url.append(req.full_url)
            return FakeResponse()

        with patch("urllib.request.urlopen", side_effect=fake_urlopen):
            tts_cloud("hello", voice_id="specific-voice-xyz")

        self.assertTrue(any("specific-voice-xyz" in u for u in captured_url))


if __name__ == "__main__":
    unittest.main()
