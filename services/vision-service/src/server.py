"""
Vision service HTTP server.
Runs on port 3003 (default). Called by mastra-tools.ts visionAnalyzeTool.
"""
from __future__ import annotations

import os
from typing import Optional

try:
    from fastapi import FastAPI, HTTPException  # type: ignore
    from pydantic import BaseModel  # type: ignore
    import uvicorn  # type: ignore
except ImportError as e:
    raise SystemExit(f"Missing dependency: {e}\nRun: pip install fastapi uvicorn pydantic") from e

from vision import describe, ocr, gui_act

app = FastAPI(title="open-greg vision service", version="1.0.0")


class AnalyzeRequest(BaseModel):
    imageBase64: Optional[str] = None
    imagePath: Optional[str] = None
    prompt: Optional[str] = None
    mode: Optional[str] = "describe"  # "describe" | "ocr"


class ComputerUseRequest(BaseModel):
    action: str  # "screenshot" | "click" | "type" | "scroll"
    coordinate: Optional[list[int]] = None
    text: Optional[str] = None
    goal: Optional[str] = None


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    if not req.imageBase64 and not req.imagePath:
        raise HTTPException(status_code=400, detail="imageBase64 or imagePath required")

    mode = req.mode or "describe"

    if mode == "ocr":
        text = ocr(image_path=req.imagePath, image_base64=req.imageBase64)
        return {"ok": True, "text": text}
    else:
        prompt = req.prompt or "Describe this image in detail."
        description = describe(image_path=req.imagePath, image_base64=req.imageBase64, prompt=prompt)
        return {"ok": True, "description": description}


@app.post("/computer-use")
def computer_use(req: ComputerUseRequest):
    if req.action == "screenshot":
        try:
            import pyautogui  # type: ignore
            import tempfile, base64
            from pathlib import Path
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
                path = f.name
            pyautogui.screenshot(path)
            data = base64.b64encode(Path(path).read_bytes()).decode()
            Path(path).unlink(missing_ok=True)
            return {"ok": True, "screenshot": data}
        except ImportError:
            return {"ok": False, "error": "pyautogui not installed"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    elif req.action in ("click", "scroll"):
        try:
            import pyautogui  # type: ignore
            if not req.coordinate or len(req.coordinate) < 2:
                return {"ok": False, "error": "coordinate required for click/scroll"}
            x, y = req.coordinate[0], req.coordinate[1]
            if req.action == "click":
                pyautogui.click(x, y)
            else:
                pyautogui.scroll(3, x=x, y=y)
            return {"ok": True}
        except ImportError:
            return {"ok": False, "error": "pyautogui not installed"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    elif req.action == "type":
        try:
            import pyautogui  # type: ignore
            if not req.text:
                return {"ok": False, "error": "text required for type action"}
            pyautogui.typewrite(req.text, interval=0.05)
            return {"ok": True}
        except ImportError:
            return {"ok": False, "error": "pyautogui not installed"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    elif req.action == "gui_act" and req.goal:
        result = gui_act(req.goal)
        return result

    return {"ok": False, "error": f"Unknown action: {req.action}"}


if __name__ == "__main__":
    port = int(os.environ.get("VISION_SERVICE_PORT", "3003"))
    uvicorn.run(app, host="0.0.0.0", port=port)
