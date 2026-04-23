"""
F-207: Voice pipeline — STT (Speech-to-Text) tests

Uses unittest.mock to simulate binary availability and subprocess responses
so tests run without Parakeet installed or API keys set.
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from voice import (
    ModelNotAvailableError,
    TranscriptionError,
    stt_local,
    stt_cloud,
)


def _make_audio_file(suffix=".wav") -> str:
    """Create a minimal temp file to stand in for audio."""
    f = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    f.write(b"RIFF....WAVEfmt ")  # minimal WAV header stub
    f.close()
    return f.name


class TestSttLocal(unittest.TestCase):
    def setUp(self):
        self.audio = _make_audio_file()

    def tearDown(self):
        Path(self.audio).unlink(missing_ok=True)

    def test_raises_file_not_found_for_missing_audio(self):
        with self.assertRaises(FileNotFoundError):
            stt_local("/nonexistent/audio.wav")

    def test_raises_model_not_available_when_binary_missing(self):
        with patch("voice._find_binary", return_value=None):
            with self.assertRaises(ModelNotAvailableError):
                stt_local(self.audio)

    def test_returns_transcription_from_json_output(self):
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = json.dumps({"text": "hello world"})
        mock_result.stderr = ""

        with patch("voice._find_binary", return_value="/usr/local/bin/parakeet"):
            with patch("voice.subprocess.run", return_value=mock_result):
                result = stt_local(self.audio)
        self.assertEqual(result, "hello world")

    def test_returns_transcription_from_plain_text_output(self):
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "plain text transcript"
        mock_result.stderr = ""

        with patch("voice._find_binary", return_value="/usr/local/bin/parakeet"):
            with patch("voice.subprocess.run", return_value=mock_result):
                result = stt_local(self.audio)
        self.assertEqual(result, "plain text transcript")

    def test_raises_transcription_error_on_nonzero_exit(self):
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stdout = ""
        mock_result.stderr = "model error"

        with patch("voice._find_binary", return_value="/usr/local/bin/parakeet"):
            with patch("voice.subprocess.run", return_value=mock_result):
                with self.assertRaises(TranscriptionError) as ctx:
                    stt_local(self.audio)
        self.assertIn("code 1", str(ctx.exception))

    def test_passes_language_flag_when_not_auto(self):
        captured_cmd = []

        def fake_run(cmd, **kwargs):
            captured_cmd.extend(cmd)
            r = MagicMock()
            r.returncode = 0
            r.stdout = json.dumps({"text": "bonjour"})
            r.stderr = ""
            return r

        with patch("voice._find_binary", return_value="/usr/local/bin/parakeet"):
            with patch("voice.subprocess.run", side_effect=fake_run):
                stt_local(self.audio, language="fr")

        self.assertIn("--language", captured_cmd)
        self.assertIn("fr", captured_cmd)

    def test_does_not_pass_language_flag_for_auto(self):
        captured_cmd = []

        def fake_run(cmd, **kwargs):
            captured_cmd.extend(cmd)
            r = MagicMock()
            r.returncode = 0
            r.stdout = json.dumps({"text": "hello"})
            r.stderr = ""
            return r

        with patch("voice._find_binary", return_value="/usr/local/bin/parakeet"):
            with patch("voice.subprocess.run", side_effect=fake_run):
                stt_local(self.audio, language="auto")

        self.assertNotIn("--language", captured_cmd)


class TestSttCloud(unittest.TestCase):
    def setUp(self):
        self.audio = _make_audio_file()
        # Clear any API keys that might be set in the test env
        self._saved_env = {}
        for k in ("DEEPGRAM_API_KEY", "OPENAI_API_KEY"):
            self._saved_env[k] = os.environ.pop(k, None)

    def tearDown(self):
        Path(self.audio).unlink(missing_ok=True)
        for k, v in self._saved_env.items():
            if v is not None:
                os.environ[k] = v
            else:
                os.environ.pop(k, None)

    def test_raises_file_not_found_for_missing_audio(self):
        os.environ["DEEPGRAM_API_KEY"] = "fake"
        with self.assertRaises(FileNotFoundError):
            stt_cloud("/nonexistent/audio.wav", provider="deepgram")

    def test_raises_model_not_available_when_deepgram_key_missing(self):
        with self.assertRaises(ModelNotAvailableError):
            stt_cloud(self.audio, provider="deepgram")

    def test_raises_model_not_available_when_openai_key_missing(self):
        with self.assertRaises(ModelNotAvailableError):
            stt_cloud(self.audio, provider="whisper")

    def test_raises_value_error_for_unknown_provider(self):
        os.environ["DEEPGRAM_API_KEY"] = "fake"
        with self.assertRaises(ValueError):
            stt_cloud(self.audio, provider="unknown-provider")

    def test_deepgram_returns_transcript_on_success(self):
        os.environ["DEEPGRAM_API_KEY"] = "test-key"
        response_data = {
            "results": {
                "channels": [{"alternatives": [{"transcript": "deepgram result"}]}]
            }
        }

        class FakeResponse:
            def read(self):
                return json.dumps(response_data).encode()
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass

        with patch("urllib.request.urlopen", return_value=FakeResponse()):
            result = stt_cloud(self.audio, provider="deepgram")
        self.assertEqual(result, "deepgram result")


if __name__ == "__main__":
    unittest.main()
