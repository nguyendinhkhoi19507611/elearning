"""
Voice AI Service - FastAPI
Voice Authentication API (ECAPA-TDNN)
"""
import os, sys, io, json, shutil, tempfile
from pathlib import Path
from datetime import datetime
from typing import Optional, List

import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

app = FastAPI(title="Voice AI Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── Voice Auth Engine ──
DATA_DIR = os.environ.get("VOICE_DATA_DIR",
    str(Path(__file__).parent.parent.parent / "data" / "voice"))
MODEL_DIR = os.environ.get("VOICE_MODEL_DIR",
    str(Path(__file__).parent.parent.parent / "models" / "voice"))

voice_auth = None

def get_auth():
    global voice_auth
    if voice_auth is None:
        from voice_auth import VoiceAuthenticator
        voice_auth = VoiceAuthenticator(
            data_dir=DATA_DIR, model_dir=MODEL_DIR, threshold=0.70)
        print(f"✅ Voice Auth loaded: {DATA_DIR}")
    return voice_auth

@app.on_event("startup")
async def startup():
    get_auth()

@app.get("/health")
async def health():
    auth = get_auth()
    return {"status": "ok", "service": "voice-ai",
            "registered_users": len(auth.db.users),
            "ecapa_loaded": auth.feature_extractor.ecapa_model is not None,
            "timestamp": datetime.now().isoformat()}

# ── Enrollment ──
@app.post("/enroll")
async def enroll(user_id: str = Form(...), name: str = Form(...),
                 role: str = Form("student"),
                 files: List[UploadFile] = File(...)):
    """Register voiceprint from audio files (min 3, recommended 5+)."""
    if len(files) < 3:
        raise HTTPException(400, "Need at least 3 audio samples")
    if role not in ["student", "teacher", "admin"]:
        raise HTTPException(400, "Role must be: student, teacher, admin")

    auth = get_auth()
    # Save uploaded files temporarily
    temp_dir = tempfile.mkdtemp()
    audio_files = []
    try:
        for i, f in enumerate(files):
            path = os.path.join(temp_dir, f"sample_{i+1:02d}.wav")
            with open(path, "wb") as out:
                content = await f.read()
                out.write(content)
            audio_files.append(path)

        result = auth.enroll_from_files(user_id, name, role, audio_files)
        return result
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

# ── Verification (1:1) ──
@app.post("/verify")
async def verify(user_id: str = Form(...), file: UploadFile = File(...),
                 threshold: float = Form(0.70)):
    """Verify identity - compare voice against specific user's voiceprint."""
    auth = get_auth()
    temp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    try:
        content = await file.read()
        temp.write(content); temp.close()
        result = auth.verify(user_id=user_id, audio_path=temp.name,
                             threshold=threshold)
        return result
    finally:
        os.unlink(temp.name)

# ── Identification (1:N) ──
@app.post("/identify")
async def identify(file: UploadFile = File(...), threshold: float = Form(0.70)):
    """Identify speaker from all registered users."""
    auth = get_auth()
    temp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    try:
        content = await file.read()
        temp.write(content); temp.close()
        result = auth.identify(audio_path=temp.name, threshold=threshold)
        return result
    finally:
        os.unlink(temp.name)

# ── User Management ──
@app.get("/users")
async def list_users():
    auth = get_auth()
    return {"users": auth.db.list_users(), "total": len(auth.db.users)}

@app.delete("/users/{user_id}")
async def delete_user(user_id: str):
    auth = get_auth()
    if auth.db.remove_user(user_id):
        return {"success": True, "message": f"Removed {user_id}"}
    raise HTTPException(404, f"User {user_id} not found")

@app.get("/users/{user_id}")
async def get_user(user_id: str):
    auth = get_auth()
    user = auth.db.get_user(user_id)
    if not user:
        raise HTTPException(404, f"User {user_id} not found")
    return {"user_id": user_id, "name": user["name"], "role": user["role"],
            "enrollment_samples": user["enrollment_samples"],
            "enrolled_at": user["enrolled_at"],
            "last_verified": user.get("last_verified")}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)
