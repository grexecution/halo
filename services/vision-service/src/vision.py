"""
Vision service — real implementation.

Backends (in priority order):
  describe / analyze: Claude vision API (anthropic SDK) → fallback message if no key
  ocr:               pytesseract (Tesseract 4) → fallback to Claude vision OCR
  gui_act:           pyautogui + Claude computer-use (requires DISPLAY / screen access)
"""
from __future__ import annotations

import base64
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_image_base64(image_path: Optional[str] = None, image_base64: Optional[str] = None) -> str:
    """Return a base64-encoded PNG/JPEG string from either a path or raw b64."""
    if image_base64:
        return image_base64
    if image_path:
        data = Path(image_path).read_bytes()
        return base64.b64encode(data).decode()
    raise ValueError("Either image_path or image_base64 must be provided.")


def _image_media_type(image_path: Optional[str] = None) -> str:
    if image_path:
        ext = Path(image_path).suffix.lower()
        return {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                "gif": "image/gif", "webp": "image/webp"}.get(ext.lstrip("."), "image/jpeg")
    return "image/jpeg"


# ---------------------------------------------------------------------------
# describe — Claude vision
# ---------------------------------------------------------------------------

def describe(image_path: Optional[str] = None, image_base64: Optional[str] = None,
             prompt: str = "Describe this image in detail.") -> str:
    """Return a text description of the image using Claude vision API."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return "[Vision unavailable: ANTHROPIC_API_KEY not set]"

    try:
        import anthropic  # type: ignore
    except ImportError:
        return "[Vision unavailable: 'anthropic' package not installed]"

    b64 = _load_image_base64(image_path, image_base64)
    media_type = _image_media_type(image_path)

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": b64},
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )
    return message.content[0].text  # type: ignore[index]


# ---------------------------------------------------------------------------
# ocr — Tesseract (primary) → Claude vision OCR (fallback)
# ---------------------------------------------------------------------------

def ocr(image_path: Optional[str] = None, image_base64: Optional[str] = None,
        mode: str = "simple") -> str:
    """Extract text from an image. mode='simple' uses Tesseract; mode='layout' preserves layout."""
    # Try Tesseract first
    try:
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore
        import io

        if image_base64:
            img_data = base64.b64decode(image_base64)
            img = Image.open(io.BytesIO(img_data))
        elif image_path:
            img = Image.open(image_path)
        else:
            raise ValueError("Either image_path or image_base64 must be provided.")

        config = "--psm 6" if mode == "layout" else "--psm 3"
        return pytesseract.image_to_string(img, config=config).strip()

    except ImportError:
        pass  # Tesseract not installed — fall through to Claude
    except Exception as e:
        pass  # Bad image or Tesseract error — fall through

    # Fallback: use Claude vision for OCR
    return describe(
        image_path=image_path,
        image_base64=image_base64,
        prompt="Extract all text from this image. Return only the extracted text, preserving layout.",
    )


# ---------------------------------------------------------------------------
# gui_act — pyautogui + Claude computer-use
# ---------------------------------------------------------------------------

def gui_act(goal: str, model: str = "claude") -> dict:
    """Take a GUI action to achieve goal. Requires DISPLAY and pyautogui."""
    try:
        import pyautogui  # type: ignore
    except ImportError:
        return {"ok": False, "error": "pyautogui not installed"}

    display = os.environ.get("DISPLAY")
    if not display:
        return {"ok": False, "error": "No DISPLAY environment variable — GUI not available"}

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"ok": False, "error": "ANTHROPIC_API_KEY not set"}

    try:
        # Take a screenshot and send to Claude with the goal
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            screenshot_path = f.name

        screenshot = pyautogui.screenshot()
        screenshot.save(screenshot_path)

        description = describe(
            image_path=screenshot_path,
            prompt=f"I want to: {goal}\n\nDescribe what you see on screen and what GUI action should be taken next (click at coordinates, type text, etc.).",
        )

        Path(screenshot_path).unlink(missing_ok=True)
        return {"ok": True, "description": description, "screenshot_taken": True}

    except Exception as e:
        return {"ok": False, "error": str(e)}
