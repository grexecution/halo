"""Vision service stubs — real implementation requires Pillow, Tesseract, PaddleOCR, pyautogui."""
from typing import Optional


def describe(image_path: str) -> str:
    """Return a text description of the image at image_path."""
    raise NotImplementedError("Real describe requires a VLM. Set dryRun=True for tests.")


def ocr(image_path: str, mode: str = "simple") -> str:
    """OCR an image. mode='simple' uses Tesseract; mode='layout' uses PaddleOCR."""
    raise NotImplementedError("Real OCR requires Tesseract/PaddleOCR.")


def gui_act(goal: str, model: str = "claude") -> dict:
    """Take a GUI action to achieve goal using pyautogui + VLM."""
    raise NotImplementedError("Real GUI requires pyautogui + VLM.")
