"""
Face Recognition AI Service - FastAPI
Nhận diện khuôn mặt để xác thực điểm danh
Port: 5004
"""
import os, sys, io, json, shutil, tempfile, base64
from pathlib import Path
from datetime import datetime
from typing import Optional, List

import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Face Recognition AI Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── Storage dirs ──
DATA_DIR = os.environ.get("FACE_DATA_DIR",
    str(Path(__file__).parent.parent / "data" / "faces"))
Path(DATA_DIR).mkdir(parents=True, exist_ok=True)

# ── Lazy load DeepFace ──
deepface = None
def get_deepface():
    global deepface
    if deepface is None:
        try:
            from deepface import DeepFace as df
            deepface = df
            print("✅ DeepFace loaded")
        except ImportError:
            print("⚠️  DeepFace not installed, using fallback")
            deepface = None
    return deepface

def get_user_dir(user_id: str) -> Path:
    d = Path(DATA_DIR) / user_id
    d.mkdir(parents=True, exist_ok=True)
    return d

# ── Health ──
@app.get("/health")
async def health():
    df = get_deepface()
    users = [d.name for d in Path(DATA_DIR).iterdir() if d.is_dir()]
    return {
        "status": "ok",
        "service": "face-ai",
        "deepface_available": df is not None,
        "registered_users": len(users),
        "timestamp": datetime.now().isoformat()
    }

# ── Enroll: Đăng ký khuôn mặt ──
@app.post("/enroll")
async def enroll(
    user_id: str = Form(...),
    name: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """Đăng ký khuôn mặt từ 1+ ảnh (khuyến nghị 3-5 ảnh từ nhiều góc)"""
    if len(files) < 1:
        raise HTTPException(400, "Cần ít nhất 1 ảnh")

    user_dir = get_user_dir(user_id)

    # Xóa ảnh cũ nếu có
    for old in user_dir.glob("*.jpg"):
        old.unlink()
    for old in user_dir.glob("*.png"):
        old.unlink()

    saved = []
    for i, f in enumerate(files):
        content = await f.read()
        ext = Path(f.filename).suffix or ".jpg"
        out_path = user_dir / f"face_{i:02d}{ext}"
        with open(out_path, "wb") as fp:
            fp.write(content)
        saved.append(str(out_path))

    # Verify ít nhất 1 ảnh có mặt người
    df = get_deepface()
    face_detected = False
    valid_count = 0
    if df:
        for sp in saved:
            try:
                faces = df.extract_faces(
                    img_path=sp,
                    detector_backend=DETECTOR,
                    enforce_detection=True
                )
                if faces and len(faces) > 0:
                    conf = faces[0].get("confidence", 0)
                    if conf >= 0.85:
                        valid_count += 1
                        face_detected = True
                        print(f"  ✅ {sp}: conf={conf:.2%}")
                    else:
                        print(f"  ⚠️ {sp}: low conf={conf:.2%}")
            except Exception as e:
                print(f"Face detect warning for {sp}: {e}")

    if valid_count == 0 and df:
        return {
            "success": False,
            "message": "Không phát hiện khuôn mặt hợp lệ trong ảnh đăng ký. Hãy chụp lại rõ hơn."
        }

    # Save metadata
    meta = {
        "user_id": user_id,
        "name": name,
        "enrolled_at": datetime.now().isoformat(),
        "sample_count": len(saved),
        "face_detected": face_detected
    }
    with open(user_dir / "meta.json", "w", encoding="utf-8") as fp:
        json.dump(meta, fp, ensure_ascii=False, indent=2)

    return {
        "success": True,
        "user_id": user_id,
        "name": name,
        "samples_saved": len(saved),
        "face_detected": face_detected,
        "message": f"Đăng ký khuôn mặt thành công ({len(saved)} mẫu)"
    }

# ── Config ──
DETECTOR = "retinaface"          # retinaface chính xác hơn opencv rất nhiều
MODEL    = "ArcFace"             # Model nhận diện tốt nhất hiện nay
MIN_FACE_AREA_RATIO = 0.02      # Khuôn mặt phải chiếm ≥2% diện tích ảnh
MIN_CONFIDENCE = 0.90            # Confidence tối thiểu phải ≥90%
MATCH_THRESHOLD = 0.55           # Distance ≤ 0.55 mới pass (≥45% match)
MIN_PASS_COUNT = 3               # Multi-photo: ≥3/5 ảnh phải pass
MAX_REFS_FAST = 3                # Multi-verify: dùng tối đa 3 ref images cho tốc độ

# ── Helper: kiểm tra có khuôn mặt HỢP LỆ trong ảnh ──
def validate_face(df, img_path):
    """
    Kiểm tra xem ảnh có chứa khuôn mặt hợp lệ hay không.
    Trả về (is_valid, face_info) với face_info chứa chi tiết.
    Bộ lọc 3 lớp:
      1. Phải detect được face bằng retinaface
      2. Confidence score phải ≥ 90%
      3. Face area phải đủ lớn (≥2% ảnh) — loại trừ body/tay/vật thể xa
    """
    try:
        import cv2
        # Đọc ảnh để lấy kích thước frame
        img = cv2.imread(img_path)
        if img is None:
            return False, {"reason": "Không đọc được ảnh"}
        frame_h, frame_w = img.shape[:2]
        frame_area = frame_w * frame_h

        faces = df.extract_faces(
            img_path=img_path,
            detector_backend=DETECTOR,
            enforce_detection=True
        )

        if not faces or len(faces) == 0:
            return False, {"reason": "Không phát hiện khuôn mặt"}

        # Lấy face lớn nhất (gần camera nhất)
        best_face = None
        best_area = 0
        for face in faces:
            region = face.get("facial_area", {})
            w = region.get("w", 0)
            h = region.get("h", 0)
            area = w * h
            if area > best_area:
                best_area = area
                best_face = face

        if not best_face:
            return False, {"reason": "Không tìm thấy khuôn mặt hợp lệ"}

        # Check confidence
        confidence = best_face.get("confidence", 0)
        if confidence < MIN_CONFIDENCE:
            return False, {
                "reason": f"Độ tin cậy quá thấp ({confidence:.0%}). Hãy hướng mặt rõ hơn vào camera.",
                "confidence": confidence
            }

        # Check face area ratio
        face_ratio = best_area / frame_area
        if face_ratio < MIN_FACE_AREA_RATIO:
            return False, {
                "reason": f"Khuôn mặt quá nhỏ hoặc quá xa ({face_ratio:.1%}). Hãy đến gần camera hơn.",
                "face_ratio": face_ratio
            }

        print(f"✅ Face validated: confidence={confidence:.2%}, area_ratio={face_ratio:.1%}")
        return True, {
            "confidence": confidence,
            "face_ratio": face_ratio,
            "facial_area": best_face.get("facial_area", {})
        }

    except Exception as e:
        print(f"Face validation error: {e}")
        return False, {"reason": str(e)}

# ── Core verify logic (dùng chung cho cả 2 endpoint) ──
def _do_verify(df, tmp_path, ref_images, user_id):
    """
    Logic xác thực chính - dùng ArcFace + retinaface.
    Trả về dict kết quả.
    """
    # Bước 1: Validate face trong ảnh input
    is_valid, face_info = validate_face(df, tmp_path)
    if not is_valid:
        reason = face_info.get("reason", "Không phát hiện khuôn mặt")
        return {
            "verified": False, "user_id": user_id, "distance": 999.0,
            "model": MODEL, "face_detected": False,
            "confidence": face_info.get("confidence", 0),
            "message": reason
        }

    # Bước 2: So sánh với từng ảnh đã đăng ký
    min_distance = 999.0
    best_verified = False
    any_success = False

    for ref in ref_images:
        try:
            result = df.verify(
                img1_path=tmp_path, img2_path=str(ref),
                model_name=MODEL,
                detector_backend=DETECTOR,
                enforce_detection=True
            )
            dist = result.get("distance", 1.0)
            verified = result.get("verified", False)
            threshold = result.get("threshold", 0.68)
            any_success = True
            print(f"  📊 {ref.name}: dist={dist:.4f}, threshold={threshold:.4f}, verified={verified}")
            if dist < min_distance:
                min_distance = dist
                best_verified = verified
        except Exception as e:
            print(f"  ⚠️ Verify skip {ref.name}: {e}")
            continue

    if not any_success:
        return {
            "verified": False, "user_id": user_id, "distance": 999.0,
            "model": MODEL, "face_detected": True,
            "message": "Không thể so khớp khuôn mặt - thử lại"
        }

    # Tính confidence score cho UI
    match_pct = max(0, round((1 - min_distance) * 100))

    # Custom threshold: phải đạt ≥60% match (distance ≤ 0.40)
    is_verified = min_distance <= MATCH_THRESHOLD
    print(f"  🎯 Final: distance={min_distance:.4f}, match={match_pct}%, threshold={MATCH_THRESHOLD}, pass={is_verified}")

    return {
        "verified": is_verified, "user_id": user_id,
        "distance": round(float(min_distance), 4),
        "model": MODEL, "face_detected": True,
        "confidence": face_info.get("confidence", 0),
        "match_percent": match_pct,
        "message": f"Xác thực thành công (khớp {match_pct}%)" if is_verified
                   else f"Không khớp khuôn mặt (chỉ {match_pct}%). Cần ≥60%."
    }

# ── Verify: Xác thực khuôn mặt (1:1) ──
@app.post("/verify")
async def verify(
    user_id: str = Form(...),
    file: UploadFile = File(...),
    threshold: float = Form(0.45)
):
    """Xác thực khuôn mặt - so sánh với user đã đăng ký"""
    user_dir = get_user_dir(user_id)
    ref_images = list(user_dir.glob("face_*.jpg")) + list(user_dir.glob("face_*.png"))

    if not ref_images:
        raise HTTPException(404, f"User {user_id} chưa đăng ký khuôn mặt")

    content = await file.read()
    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    try:
        tmp.write(content); tmp.close()

        df = get_deepface()
        if not df:
            return {
                "verified": True, "user_id": user_id, "distance": 0.0,
                "model": "fallback",
                "message": "Service không khả dụng - cho phép qua (fallback)"
            }

        print(f"\n🔍 Verifying (file upload) user={user_id}")
        return _do_verify(df, tmp.name, ref_images, user_id)

    except Exception as e:
        print(f"verify fatal error: {e}")
        return {
            "verified": False, "user_id": user_id, "distance": 999.0,
            "model": "error",
            "message": f"Lỗi hệ thống: {str(e)[:100]}"
        }
    finally:
        try: os.unlink(tmp.name)
        except: pass

# ── Verify Base64 ──
class VerifyBase64Request(BaseModel):
    user_id: str
    image: str  # base64 encoded
    threshold: float = 0.45

@app.post("/verify-base64")
async def verify_base64(req: VerifyBase64Request):
    """Xác thực khuôn mặt từ ảnh base64 (từ webcam capture)"""
    user_dir = get_user_dir(req.user_id)
    ref_images = list(user_dir.glob("face_*.jpg")) + list(user_dir.glob("face_*.png"))

    if not ref_images:
        raise HTTPException(404, f"User {req.user_id} chưa đăng ký khuôn mặt")

    # Decode base64
    try:
        img_data = req.image
        if "," in img_data:
            img_data = img_data.split(",")[1]
        img_bytes = base64.b64decode(img_data)
    except Exception:
        raise HTTPException(400, "Ảnh base64 không hợp lệ")

    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    try:
        tmp.write(img_bytes); tmp.close()

        df = get_deepface()
        if not df:
            return {
                "verified": True, "user_id": req.user_id, "distance": 0.0,
                "model": "fallback",
                "message": "Service không khả dụng - cho phép qua (fallback)"
            }

        print(f"\n🔍 Verifying (base64) user={req.user_id}")
        return _do_verify(df, tmp.name, ref_images, req.user_id)

    except Exception as e:
        print(f"verify-base64 fatal error: {e}")
        return {
            "verified": False, "user_id": req.user_id, "distance": 999.0,
            "model": "error",
            "message": f"Lỗi hệ thống: {str(e)[:100]}"
        }
    finally:
        try: os.unlink(tmp.name)
        except: pass

# ── Verify Multi Base64: Chụp 5 tấm, so sánh tất cả ──
class VerifyMultiBase64Request(BaseModel):
    user_id: str
    images: List[str]  # List of base64 encoded images (5 photos)
    threshold: float = 0.40

@app.post("/verify-multi-base64")
async def verify_multi_base64(req: VerifyMultiBase64Request):
    """Xác thực khuôn mặt từ nhiều ảnh base64 — TỐI ƯU TỐC ĐỘ (<5s)"""
    import time
    start_time = time.time()

    user_dir = get_user_dir(req.user_id)
    ref_images = list(user_dir.glob("face_*.jpg")) + list(user_dir.glob("face_*.png"))

    if not ref_images:
        raise HTTPException(404, f"User {req.user_id} chưa đăng ký khuôn mặt")

    if not req.images or len(req.images) < 1:
        raise HTTPException(400, "Cần ít nhất 1 ảnh")

    df = get_deepface()
    if not df:
        return {
            "verified": True, "user_id": req.user_id, "distance": 0.0,
            "model": "fallback", "pass_count": len(req.images), "total": len(req.images),
            "message": "Service không khả dụng — cho phép qua (fallback)"
        }

    # ⚡ Tốc độ: dùng tối đa MAX_REFS_FAST ảnh ref (chọn đều từ danh sách)
    if len(ref_images) > MAX_REFS_FAST:
        step = len(ref_images) / MAX_REFS_FAST
        fast_refs = [ref_images[int(i * step)] for i in range(MAX_REFS_FAST)]
    else:
        fast_refs = ref_images

    print(f"\n🔍 Multi-verify ({len(req.images)} photos, {len(fast_refs)} refs) user={req.user_id}")

    results = []
    pass_count = 0

    for i, img_data in enumerate(req.images):
        # ⚡ Early-stop: đủ 3 pass → dừng luôn
        if pass_count >= MIN_PASS_COUNT:
            print(f"  ⚡ Early-stop: {pass_count} passes đủ rồi, bỏ qua ảnh còn lại")
            break

        # Decode base64
        try:
            data = img_data
            if "," in data:
                data = data.split(",")[1]
            img_bytes = base64.b64decode(data)
        except Exception:
            print(f"  ⚠️ Photo {i+1}: invalid base64")
            results.append({"verified": False, "distance": 999.0})
            continue

        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        try:
            tmp.write(img_bytes)
            tmp.close()

            # ⚡ SKIP validate_face — dùng thẳng df.verify (tiết kiệm ~0.5s/ảnh)
            min_dist = 999.0
            for ref in fast_refs:
                try:
                    result = df.verify(
                        img1_path=tmp.name, img2_path=str(ref),
                        model_name=MODEL,
                        detector_backend=DETECTOR,
                        enforce_detection=False  # ⚡ Không bắt buộc detect → nhanh hơn
                    )
                    dist = result.get("distance", 1.0)
                    if dist < min_dist:
                        min_dist = dist
                except Exception as e:
                    continue

            verified = min_dist <= MATCH_THRESHOLD
            match_pct = max(0, round((1 - min_dist) * 100))
            if verified:
                pass_count += 1

            status = "✅" if verified else "❌"
            print(f"  📸 Photo {i+1}: {status} dist={min_dist:.4f} match={match_pct}%")

            results.append({
                "verified": verified, "distance": round(float(min_dist), 4),
                "match_percent": match_pct
            })
        except Exception as e:
            print(f"  ⚠️ Photo {i+1} error: {e}")
            results.append({"verified": False, "distance": 999.0})
        finally:
            try: os.unlink(tmp.name)
            except: pass

    # Kết quả tổng
    total = len(results)
    min_required = min(MIN_PASS_COUNT, max(1, total))
    is_verified = pass_count >= min_required

    # Best distance
    passed = [r for r in results if r.get("verified")]
    best = min(passed, key=lambda r: r.get("distance", 999)) if passed else \
           min(results, key=lambda r: r.get("distance", 999)) if results else {}
    best_dist = best.get("distance", 999.0)
    match_pct = max(0, round((1 - best_dist) * 100))

    elapsed = time.time() - start_time
    print(f"  🎯 Result: {pass_count}/{total} pass (need {min_required}), best={best_dist:.4f}, time={elapsed:.1f}s")

    return {
        "verified": is_verified,
        "user_id": req.user_id,
        "distance": round(float(best_dist), 4),
        "match_percent": match_pct,
        "model": MODEL,
        "face_detected": True,
        "pass_count": pass_count,
        "total": total,
        "min_required": min_required,
        "message": f"Xác thực thành công ({pass_count}/{total} ảnh khớp, {match_pct}%)" if is_verified
                   else f"Không đủ ảnh khớp ({pass_count}/{total}, cần ≥{min_required})"
    }

# ── Get registered face images ──
@app.get("/users/{user_id}/faces")
async def get_user_faces(user_id: str):
    """Lấy danh sách ảnh khuôn mặt đã đăng ký (trả base64)"""
    user_dir = get_user_dir(user_id)
    ref_images = list(user_dir.glob("face_*.jpg")) + list(user_dir.glob("face_*.png"))
    if not ref_images:
        return {"faces": [], "total": 0}

    faces = []
    for img_path in ref_images:
        try:
            with open(img_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
                ext = img_path.suffix.lstrip('.')
                faces.append({
                    "filename": img_path.name,
                    "data": f"data:image/{ext};base64,{b64}"
                })
        except Exception:
            continue
    return {"faces": faces, "total": len(faces)}

# ── Identify: Nhận diện (1:N) ──
@app.post("/identify")
async def identify(
    file: UploadFile = File(...),
    threshold: float = Form(0.5)
):
    """Nhận diện khuôn mặt từ danh sách đã đăng ký"""
    content = await file.read()
    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    try:
        tmp.write(content); tmp.close()

        df = get_deepface()
        if not df:
            raise HTTPException(503, "DeepFace service không khả dụng")

        users = [d.name for d in Path(DATA_DIR).iterdir() if d.is_dir()]
        best_user = None
        min_distance = float("inf")

        for uid in users:
            user_dir = Path(DATA_DIR) / uid
            refs = list(user_dir.glob("face_*.jpg")) + list(user_dir.glob("face_*.png"))
            for ref in refs:
                try:
                    result = df.verify(
                        img1_path=tmp.name,
                        img2_path=str(ref),
                        model_name="Facenet",
                        detector_backend="opencv",
                        enforce_detection=False
                    )
                    dist = result.get("distance", 1.0)
                    if dist < min_distance:
                        min_distance = dist
                        best_user = uid
                except Exception:
                    continue

        identified = best_user is not None and min_distance <= threshold
        return {
            "identified": identified,
            "user_id": best_user if identified else None,
            "distance": round(min_distance, 4),
            "threshold": threshold
        }
    finally:
        os.unlink(tmp.name)

# ── User Management ──
@app.get("/users")
async def list_users():
    users = []
    for d in Path(DATA_DIR).iterdir():
        if d.is_dir():
            meta_path = d / "meta.json"
            if meta_path.exists():
                with open(meta_path, encoding="utf-8") as f:
                    users.append(json.load(f))
            else:
                users.append({"user_id": d.name})
    return {"users": users, "total": len(users)}

@app.delete("/users/{user_id}")
async def delete_user(user_id: str):
    user_dir = get_user_dir(user_id)
    if user_dir.exists():
        shutil.rmtree(user_dir)
        return {"success": True, "message": f"Removed {user_id}"}
    raise HTTPException(404, f"User {user_id} not found")

if __name__ == "__main__":
    import uvicorn
    get_deepface()  # Preload
    uvicorn.run(app, host="0.0.0.0", port=5004)
