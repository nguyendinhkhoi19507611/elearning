"""
AI Vision Service - FastAPI
YOLO Student State Detection + OpenCV Fallback Analysis
Hybrid approach: YOLO for primary detection, OpenCV face/eye analysis as fallback
"""
import os, sys, io, time, base64, json, tempfile, math
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List, Tuple

import numpy as np
import cv2
from PIL import Image
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Add parent dir for model access
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

app = FastAPI(title="AI Vision Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── Model & Cascade Loading ──
MODEL_PATH = os.environ.get("YOLO_MODEL_PATH",
    str(Path(__file__).parent.parent.parent / "output" / "models" / "student_state_best.pt"))
CLASSES = ["focused", "distracted", "drowsy", "absent", "phone_usage"]
CLASS_COLORS = {"focused": "#22c55e", "distracted": "#f97316",
                "drowsy": "#ef4444", "absent": "#6b7280", "phone_usage": "#a855f7"}

yolo_model = None
face_cascade = None
eye_cascade = None
profile_cascade = None

def load_model():
    global yolo_model
    if yolo_model is None:
        try:
            from ultralytics import YOLO
            if os.path.exists(MODEL_PATH):
                yolo_model = YOLO(MODEL_PATH)
                print(f"✅ YOLO model loaded: {MODEL_PATH}")
            else:
                print(f"⚠️ Model not found: {MODEL_PATH}, using yolo11n.pt")
                yolo_model = YOLO("yolo11n.pt")
        except Exception as e:
            print(f"❌ Model load error: {e}")
    return yolo_model

def load_cascades():
    """Load OpenCV Haar cascades for face and eye detection."""
    global face_cascade, eye_cascade, profile_cascade
    cv2_data = cv2.data.haarcascades
    
    if face_cascade is None:
        face_cascade = cv2.CascadeClassifier(cv2_data + 'haarcascade_frontalface_default.xml')
        print("✅ Face cascade loaded")
    if eye_cascade is None:
        eye_cascade = cv2.CascadeClassifier(cv2_data + 'haarcascade_eye.xml')
        print("✅ Eye cascade loaded")
    if profile_cascade is None:
        profile_cascade = cv2.CascadeClassifier(cv2_data + 'haarcascade_profileface.xml')
        print("✅ Profile face cascade loaded")

@app.on_event("startup")
async def startup():
    load_model()
    load_cascades()

# ── Helper: sanitize numpy types for JSON ──

def sanitize(obj):
    """Convert numpy types to Python native for JSON serialization."""
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [sanitize(v) for v in obj]
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, (np.bool_,)):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

# ── CV Analysis Functions ──

def analyze_face_cv(img: np.ndarray) -> Dict:
    """
    Analyze image using OpenCV to determine student state.
    Returns: dict with state info including face_detected, eyes_detected, head_pose, etc.
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)  # Improve detection in varying lighting
    
    result = {
        "face_detected": False,
        "face_count": 0,
        "eyes_detected": False,
        "eye_count": 0,
        "face_centered": False,
        "face_size_ratio": 0.0,
        "looking_at_screen": False,
        "profile_detected": False,
        "head_tilted": False,
        "inferred_state": "absent",
        "confidence": 0.0,
        "analysis_details": {}
    }
    
    # 1. Detect frontal face
    faces = face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60),
        flags=cv2.CASCADE_SCALE_IMAGE
    )
    
    # 2. Detect profile face (side view → distracted)
    profiles_left = profile_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
    )
    # Flip for right profile
    gray_flipped = cv2.flip(gray, 1)
    profiles_right = profile_cascade.detectMultiScale(
        gray_flipped, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
    )
    
    has_frontal = len(faces) > 0
    has_profile = len(profiles_left) > 0 or len(profiles_right) > 0
    
    if has_frontal:
        # Use the largest face
        face = max(faces, key=lambda f: int(f[2]) * int(f[3]))
        fx, fy, fw, fh = int(face[0]), int(face[1]), int(face[2]), int(face[3])
        
        result["face_detected"] = True
        result["face_count"] = int(len(faces))
        
        # Face size ratio (how much of frame the face occupies)
        face_area = int(fw) * int(fh)
        frame_area = int(w) * int(h)
        result["face_size_ratio"] = round(float(face_area / frame_area), 4)
        
        # Face center position
        face_cx = float(fx + fw / 2)
        face_cy = float(fy + fh / 2)
        center_x_ratio = float(face_cx / w)
        center_y_ratio = float(face_cy / h)
        
        # Is face centered? (within 30% of center)
        result["face_centered"] = bool(0.25 < center_x_ratio < 0.75 and 0.15 < center_y_ratio < 0.75)
        
        # 3. Detect eyes within face region
        face_roi_gray = gray[fy:fy+fh, fx:fx+fw]
        # Only search upper 60% of face for eyes
        eye_region = face_roi_gray[0:int(fh*0.6), :]
        
        eyes = eye_cascade.detectMultiScale(
            eye_region, scaleFactor=1.1, minNeighbors=4, 
            minSize=(15, 15), maxSize=(fw//2, fh//3)
        )
        
        result["eye_count"] = int(len(eyes))
        result["eyes_detected"] = bool(len(eyes) >= 1)
        
        # 4. Check head tilt (face aspect ratio)
        aspect_ratio = float(fw / fh)
        result["head_tilted"] = bool(aspect_ratio > 1.3 or aspect_ratio < 0.6)
        
        # 5. Check if face is very low in frame (head down → drowsy)
        face_bottom_ratio = float((fy + fh) / h)
        head_down = bool(center_y_ratio > 0.65)
        
        # 6. Analysis details
        result["analysis_details"] = {
            "face_center_x": round(float(center_x_ratio), 3),
            "face_center_y": round(float(center_y_ratio), 3),
            "face_aspect_ratio": round(float(aspect_ratio), 3),
            "face_size_pct": round(float(result["face_size_ratio"] * 100), 1),
            "head_down": head_down,
            "eye_count": int(len(eyes))
        }
        
        # ── State Inference Logic ──
        
        if head_down and not result["eyes_detected"]:
            # Head is down, can't see eyes → DROWSY
            result["inferred_state"] = "drowsy"
            result["confidence"] = 0.82
        elif not result["eyes_detected"] and result["face_centered"]:
            # Face centered but eyes closed → DROWSY
            result["inferred_state"] = "drowsy"
            result["confidence"] = 0.75
        elif result["head_tilted"]:
            # Head tilted significantly → DROWSY or DISTRACTED
            if head_down:
                result["inferred_state"] = "drowsy"
                result["confidence"] = 0.78
            else:
                result["inferred_state"] = "distracted"
                result["confidence"] = 0.72
        elif not result["face_centered"]:
            # Face not centered (looking away) → DISTRACTED
            result["inferred_state"] = "distracted"
            result["confidence"] = 0.70
        elif result["eyes_detected"] and result["face_centered"]:
            # Eyes open, face centered → FOCUSED
            result["inferred_state"] = "focused"
            result["confidence"] = 0.80
            result["looking_at_screen"] = True
        else:
            # Fallback
            result["inferred_state"] = "focused"
            result["confidence"] = 0.60
            
    elif has_profile:
        # Profile face detected (turned sideways) → DISTRACTED
        result["face_detected"] = True
        result["profile_detected"] = True
        result["face_count"] = int(max(len(profiles_left), len(profiles_right)))
        result["inferred_state"] = "distracted"
        result["confidence"] = 0.80
        result["analysis_details"] = {
            "profile_direction": "left" if len(profiles_left) > 0 else "right",
            "reason": "face_turned_sideways"
        }
    else:
        # No face detected at all → ABSENT
        result["inferred_state"] = "absent"
        result["confidence"] = 0.85
        result["analysis_details"] = {
            "reason": "no_face_detected"
        }
    
    return result


# ── State Tracking ──
_state_tracker = {
    "count": 0,
    "last_state": None,
    "consecutive_absent": 0,
    "consecutive_same": 0,
    "last_detection_time": None
}

def build_primary_state(class_name: str, confidence: float, bbox=[0,0,0,0], 
                         method="yolo") -> Dict:
    """Build a standardized primary_state response."""
    return {
        "class_name": str(class_name),
        "confidence": round(float(confidence), 4),
        "bbox": [int(b) for b in bbox],
        "color": CLASS_COLORS.get(class_name, "#ffffff"),
        "detection_method": str(method)
    }


# ── API Endpoints ──

@app.get("/health")
async def health():
    return {
        "status": "ok", "service": "ai-vision", 
        "model_loaded": yolo_model is not None,
        "cascades_loaded": face_cascade is not None,
        "classes": CLASSES, 
        "version": "2.0.0 (YOLO + OpenCV Hybrid)",
        "timestamp": datetime.now().isoformat()
    }

class DetectionResult(BaseModel):
    class_name: str
    confidence: float
    bbox: list
    color: str

@app.post("/detect")
async def detect_image(file: UploadFile = File(...), confidence: float = 0.3):
    """Detect student state from uploaded image."""
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Invalid image")

    model = load_model()
    results = model(img, conf=confidence, verbose=False)

    detections = []
    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            cls_name = CLASSES[cls_id] if cls_id < len(CLASSES) else f"class_{cls_id}"
            detections.append({
                "class_name": cls_name, "confidence": round(conf, 4),
                "bbox": [round(x1), round(y1), round(x2), round(y2)],
                "color": CLASS_COLORS.get(cls_name, "#ffffff")
            })

    # Summary
    states = {}
    for d in detections:
        cn = d["class_name"]
        if cn not in states or d["confidence"] > states[cn]["confidence"]:
            states[cn] = d

    return {"success": True, "detections": detections,
            "summary": list(states.values()), "count": len(detections),
            "timestamp": datetime.now().isoformat()}


@app.post("/detect/base64")
async def detect_base64(data: dict):
    """
    Detect student state from base64 webcam image.
    Uses HYBRID approach:
    1. YOLO model for primary detection (if confident)
    2. OpenCV face/eye analysis as fallback (when YOLO is unsure)
    
    States detected:
    - focused: eyes open, face centered, looking at screen
    - distracted: face turned away, not looking at screen, profile face
    - drowsy: eyes closed, head down, head tilted
    - absent: no face/person detected at all
    - phone_usage: YOLO-detected phone usage
    """
    global _state_tracker
    
    img_b64 = data.get("image", "")
    yolo_conf = data.get("confidence", 0.3)  # Lower threshold for more detections

    if "," in img_b64:
        img_b64 = img_b64.split(",")[1]

    img_bytes = base64.b64decode(img_b64)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Invalid image data")

    now = datetime.now()
    
    # ─── Step 1: YOLO Detection ───
    model = load_model()
    results = model(img, conf=yolo_conf, verbose=False)

    yolo_detections = []
    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            cls_name = CLASSES[cls_id] if cls_id < len(CLASSES) else f"class_{cls_id}"
            yolo_detections.append({
                "class_name": cls_name, "confidence": round(conf, 4),
                "bbox": [round(x1), round(y1), round(x2), round(y2)],
                "color": CLASS_COLORS.get(cls_name, "#ffffff")
            })

    # ─── Step 2: OpenCV Face/Eye Analysis (always run) ───
    cv_analysis = analyze_face_cv(img)
    
    # ─── Step 3: Decide final state using YOLO + CV ───
    
    detection_method = "hybrid"
    
    if yolo_detections:
        # YOLO found something
        best_yolo = max(yolo_detections, key=lambda x: x["confidence"])
        
        if best_yolo["confidence"] >= 0.5:
            # High confidence YOLO → trust YOLO
            primary = build_primary_state(
                best_yolo["class_name"], best_yolo["confidence"],
                best_yolo["bbox"], method="yolo"
            )
            detection_method = "yolo"
        else:
            # Low confidence YOLO → combine with CV analysis
            yolo_state = best_yolo["class_name"]
            cv_state = cv_analysis["inferred_state"]
            
            if yolo_state == cv_state:
                # Both agree → boost confidence
                combined_conf = min(0.95, (best_yolo["confidence"] + cv_analysis["confidence"]) / 1.5)
                primary = build_primary_state(
                    yolo_state, combined_conf,
                    best_yolo["bbox"], method="hybrid_agree"
                )
            else:
                # They disagree → use CV for face-related states, YOLO for phone
                if yolo_state == "phone_usage":
                    primary = build_primary_state(
                        "phone_usage", best_yolo["confidence"],
                        best_yolo["bbox"], method="yolo_phone"
                    )
                elif cv_analysis["face_detected"]:
                    # CV has face info, trust it for drowsy/distracted/focused
                    primary = build_primary_state(
                        cv_state, cv_analysis["confidence"],
                        best_yolo["bbox"], method="cv_override"
                    )
                else:
                    primary = build_primary_state(
                        best_yolo["class_name"], best_yolo["confidence"],
                        best_yolo["bbox"], method="yolo_fallback"
                    )
    else:
        # YOLO found nothing → rely entirely on CV analysis
        primary = build_primary_state(
            cv_analysis["inferred_state"], cv_analysis["confidence"],
            method="cv_only"
        )
        detection_method = "cv_only"
    
    # ─── Step 4: State tracking ───
    current_state = primary["class_name"]
    
    if current_state == "absent":
        _state_tracker["consecutive_absent"] += 1
        # Boost absent confidence over time
        primary["confidence"] = round(min(0.99, primary["confidence"] + 
            _state_tracker["consecutive_absent"] * 0.03), 4)
    else:
        _state_tracker["consecutive_absent"] = 0
    
    if current_state == _state_tracker["last_state"]:
        _state_tracker["consecutive_same"] += 1
    else:
        _state_tracker["consecutive_same"] = 0
    
    _state_tracker["last_state"] = current_state
    _state_tracker["count"] += 1
    _state_tracker["last_detection_time"] = now
    
    no_person = bool(current_state == "absent" and not cv_analysis["face_detected"])

    return sanitize({
        "success": True,
        "detections": yolo_detections,
        "primary_state": primary,
        "count": len(yolo_detections),
        "no_person_detected": no_person,
        "consecutive_absent": int(_state_tracker["consecutive_absent"]),
        "detection_method": str(detection_method),
        "cv_analysis_summary": {
            "face_detected": bool(cv_analysis["face_detected"]),
            "profile_detected": bool(cv_analysis["profile_detected"]),
            "eyes_detected": bool(cv_analysis["eyes_detected"]),
            "eye_count": int(cv_analysis["eye_count"]),
            "face_centered": bool(cv_analysis["face_centered"]),
            "head_tilted": bool(cv_analysis["head_tilted"]),
        },
        "timestamp": now.isoformat()
    })


@app.get("/classes")
async def get_classes():
    return {"classes": CLASSES, "colors": CLASS_COLORS}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
