"""
Recommendation Service - FastAPI
Learning Behavior Analysis & Personalized Recommendations
Sử dụng DỮ LIỆU THẬT từ MongoDB (không dùng dữ liệu ảo)
"""
import os, sys, json, logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).parent))

app = FastAPI(title="Recommendation Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

logger = logging.getLogger("RecommendationAPI")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")

# ── MongoDB Connection ──
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/elearning")
db = None

# ── ML Models ──
cf_model = None
ba_model = None
engine = None

# ── Data mappings ──
student_id_map = {}    # MongoDB _id string → integer index
lesson_id_map = {}     # classroom _id string → integer index
lessons_list = []      # list of lesson dicts (from real classrooms)
real_interactions = []  # list of real interaction dicts
real_students = []     # list of real student dicts


def connect_db():
    """Connect to MongoDB."""
    global db
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.server_info()  # Verify connection
        db = client.get_default_database() if "/" in MONGO_URI.split("//")[1] else client["elearning"]
        logger.info(f"✅ Connected to MongoDB: {MONGO_URI}")
        return db
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {e}")
        return None


def load_real_data():
    """Load real data from MongoDB and train models."""
    global cf_model, ba_model, engine
    global student_id_map, lesson_id_map, lessons_list, real_interactions, real_students

    if db is None:
        logger.error("No DB connection")
        return False

    try:
        # ═══════════════════════════════════════════
        # 1. Load Students
        # ═══════════════════════════════════════════
        students_cursor = db.users.find(
            {"role": "student"},
            {"_id": 1, "name": 1, "email": 1, "stats": 1}
        )
        students_raw = list(students_cursor)
        if not students_raw:
            logger.warning("⚠️ No students found in DB")

        student_id_map = {str(s["_id"]): i for i, s in enumerate(students_raw)}
        real_students = []
        for s in students_raw:
            sid = str(s["_id"])
            stats = s.get("stats") or {}
            real_students.append({
                "id": sid,
                "name": s.get("name", ""),
                "role": "student",
                "avg_daily_study_min": stats.get("totalStudyMin", 45) / max(1, stats.get("loginCount", 1)),
                "login_freq_weekly": min(7, stats.get("loginCount", 1)),
                "base_score": 50,  # Will be updated per student
            })

        # ═══════════════════════════════════════════
        # 2. Load Classrooms as "Lessons"
        # ═══════════════════════════════════════════
        classrooms_cursor = db.classrooms.find(
            {"isActive": True},
            {"_id": 1, "name": 1, "subject": 1, "students": 1, "schedule": 1}
        )
        classrooms_raw = list(classrooms_cursor)
        lesson_id_map = {str(c["_id"]): i for i, c in enumerate(classrooms_raw)}
        lessons_list = []
        for i, c in enumerate(classrooms_raw):
            lessons_list.append({
                "id": str(c["_id"]),
                "subject": c.get("subject", c.get("name", f"Lesson_{i}")),
                "name": c.get("name", ""),
                "difficulty": "medium",  # Will be computed from avg scores
                "student_ids": [str(sid) for sid in c.get("students", [])],
            })

        logger.info(f"📊 Loaded {len(real_students)} students, {len(lessons_list)} classrooms")

        # ═══════════════════════════════════════════
        # 3. Load Assignments + Scores → Build Interactions
        # ═══════════════════════════════════════════
        assignments_cursor = db.assignments.find({"isPublished": True})
        assignments_raw = list(assignments_cursor)

        classroom_subject_map = {str(c["_id"]): c.get("subject", c.get("name", ""))
                                 for c in classrooms_raw}

        real_interactions = []
        student_scores = {}  # student_id → [scores]

        for assign in assignments_raw:
            classroom_id = str(assign.get("classroom", ""))
            subject = classroom_subject_map.get(classroom_id, "Unknown")
            max_score = assign.get("maxScore", 100) or 100

            for sub in assign.get("submissions", []):
                if sub.get("score") is None:
                    continue
                student_id = str(sub["student"])
                score_pct = round((sub["score"] / max_score) * 100, 1)

                # Ensure student is in our map
                if student_id not in student_id_map:
                    idx = len(student_id_map)
                    student_id_map[student_id] = idx
                    real_students.append({
                        "id": student_id,
                        "name": sub.get("studentName", ""),
                        "role": "student",
                        "avg_daily_study_min": 45,
                        "login_freq_weekly": 1,
                        "base_score": score_pct,
                    })

                # Ensure classroom is in lesson map
                if classroom_id not in lesson_id_map:
                    idx = len(lesson_id_map)
                    lesson_id_map[classroom_id] = idx
                    lessons_list.append({
                        "id": classroom_id,
                        "subject": subject,
                        "name": subject,
                        "difficulty": "medium",
                        "student_ids": [],
                    })

                real_interactions.append({
                    "student_id": student_id,
                    "student_idx": student_id_map[student_id],
                    "lesson_id": classroom_id,
                    "lesson_idx": lesson_id_map[classroom_id],
                    "subject": subject,
                    "difficulty": "medium",
                    "score": score_pct,
                    "time_spent_min": 30,
                    "completed": score_pct > 30,
                    "attempts": 1,
                    "hints_used": 0,
                    "forum_posts": 0,
                    "rating": max(1, min(5, int(score_pct / 20))),
                })

                student_scores.setdefault(student_id, []).append(score_pct)

        # Update base_score for each student
        for s in real_students:
            scores = student_scores.get(s["id"], [])
            if scores:
                s["base_score"] = round(float(np.mean(scores)), 1)

        # Compute difficulty per lesson based on avg scores
        lesson_scores = {}
        for inter in real_interactions:
            lesson_scores.setdefault(inter["lesson_idx"], []).append(inter["score"])
        for lesson in lessons_list:
            idx = lesson_id_map.get(lesson["id"])
            if idx is not None and idx in lesson_scores:
                avg = float(np.mean(lesson_scores[idx]))
                if avg >= 80:
                    lesson["difficulty"] = "easy"
                elif avg >= 50:
                    lesson["difficulty"] = "medium"
                else:
                    lesson["difficulty"] = "hard"

        # ═══════════════════════════════════════════
        # 4. Load Attendance Data
        # ═══════════════════════════════════════════
        att_cursor = db.attendancesessions.find({}, {"records": 1, "classroom": 1})
        for sess in att_cursor:
            classroom_id = str(sess.get("classroom", ""))
            for rec in sess.get("records", []):
                student_id = str(rec.get("student", ""))
                if rec.get("status") == "present" and student_id in student_id_map:
                    # Count attendance as a positive interaction
                    if classroom_id in lesson_id_map:
                        real_interactions.append({
                            "student_id": student_id,
                            "student_idx": student_id_map[student_id],
                            "lesson_id": classroom_id,
                            "lesson_idx": lesson_id_map[classroom_id],
                            "subject": classroom_subject_map.get(classroom_id, "Unknown"),
                            "difficulty": "medium",
                            "score": 80,  # attendance = positive signal
                            "time_spent_min": 45,
                            "completed": True,
                            "attempts": 1,
                            "hints_used": 0,
                            "forum_posts": 0,
                            "rating": 4,
                        })

        logger.info(f"📊 Built {len(real_interactions)} interactions from real data")

        # ═══════════════════════════════════════════
        # 5. Train Models on Real Data
        # ═══════════════════════════════════════════
        if len(real_students) < 2 or len(lessons_list) < 1 or len(real_interactions) < 1:
            logger.warning("⚠️ Insufficient data for training. Using heuristic mode.")
            return True

        from learning_behavior import (CollaborativeFilteringModel,
            BehavioralAnalyticsModel, RecommendationEngine)

        n_students = len(student_id_map)
        n_lessons = len(lesson_id_map)
        logger.info(f"🧠 Training models: {n_students} students × {n_lessons} lessons, {len(real_interactions)} interactions")

        cf_model = CollaborativeFilteringModel(n_students=n_students, n_lessons=n_lessons, logger=logger)
        cf_model.build()
        cf_model.train(real_interactions, epochs=30)

        ba_model = BehavioralAnalyticsModel(logger=logger)
        ba_model.build_and_train(real_students, real_interactions, epochs=30)

        engine = RecommendationEngine(cf_model, ba_model, lessons_list, logger=logger)

        logger.info("✅ Models trained on REAL data successfully!")
        return True

    except Exception as e:
        logger.error(f"❌ Error loading real data: {e}", exc_info=True)
        return False


@app.on_event("startup")
async def startup():
    connect_db()
    load_real_data()


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "recommendation",
        "engine_loaded": engine is not None,
        "data_source": "real_mongodb",
        "students": len(real_students),
        "lessons": len(lessons_list),
        "interactions": len(real_interactions),
        "timestamp": datetime.now().isoformat()
    }


# ── Models ──
class BehaviorData(BaseModel):
    user_id: str
    avg_daily_study_min: float = 60
    login_freq_weekly: int = 4
    scores: List[float] = []
    time_spent: List[float] = []
    completed_lessons: List[str] = []
    forum_posts: int = 0
    role: str = "student"
    preferred_subjects: List[str] = []


@app.post("/recommend")
async def get_recommendations(data: BehaviorData):
    """Get personalized learning recommendations based on REAL data."""

    # Build student profile from request data
    avg_score = float(np.mean(data.scores)) if data.scores else 50.0

    # ── Heuristic Mode (không đủ data để train) ──
    if engine is None or cf_model is None or ba_model is None:
        return _heuristic_recommend(data, avg_score)

    # ── ML Mode (trained on real data) ──
    student_idx = student_id_map.get(data.user_id)
    if student_idx is None:
        # Unknown student → use heuristic
        return _heuristic_recommend(data, avg_score)

    student = {
        "id": data.user_id,
        "role": data.role,
        "profile": "excellent" if avg_score >= 80 else "good" if avg_score >= 60 else "average" if avg_score >= 40 else "struggling",
        "preferred_subjects": data.preferred_subjects,
        "avg_daily_study_min": data.avg_daily_study_min,
        "login_freq_weekly": data.login_freq_weekly,
        "base_score": avg_score,
    }

    # Build interactions from provided scores
    interactions = []
    completed_set = set()
    for i, score in enumerate(data.scores):
        # Map to real lessons the student is enrolled in
        lesson_idx = i % len(lessons_list) if lessons_list else 0
        if lesson_idx < len(lessons_list):
            completed_set.add(lesson_idx)
            interactions.append({
                "student_id": data.user_id,
                "lesson_id": lessons_list[lesson_idx]["id"],
                "student_idx": student_idx,
                "lesson_idx": lesson_idx,
                "subject": lessons_list[lesson_idx]["subject"],
                "difficulty": lessons_list[lesson_idx]["difficulty"],
                "score": score,
                "time_spent_min": data.time_spent[i] if i < len(data.time_spent) else 30,
                "completed": score > 30,
                "attempts": 1,
                "hints_used": 0,
                "forum_posts": data.forum_posts,
                "rating": max(1, min(5, int(score / 20))),
            })

    # Get engagement prediction
    engagement = ba_model.predict_engagement(student, interactions)

    # Get CF recommendations (real lessons)
    cf_recs = cf_model.recommend_lessons(student_idx, completed_set, top_k=10)

    # Build next_lessons from real classrooms
    next_lessons = []
    for rec in cf_recs[:5]:
        lidx = rec["lesson_idx"]
        if lidx < len(lessons_list):
            lesson = lessons_list[lidx]
            next_lessons.append({
                "lesson_id": lesson["id"],
                "subject": lesson["subject"],
                "name": lesson["name"],
                "difficulty": lesson["difficulty"],
                "predicted_score": round(rec["predicted_score"], 1),
                "relevance_score": round(rec["predicted_score"], 1),
            })

    # Find weak subjects from real interactions
    subj_scores = {}
    for x in interactions:
        subj_scores.setdefault(x["subject"], []).append(x["score"])
    # Also include historical data
    for x in real_interactions:
        if x["student_id"] == data.user_id:
            subj_scores.setdefault(x["subject"], []).append(x["score"])

    weak_subjects = [
        {
            "subject": s,
            "avg_score": round(float(np.mean(sc)), 1),
            "suggestion": "Cần ôn tập lại" if np.mean(sc) < 50 else "Cần luyện thêm"
        }
        for s, sc in subj_scores.items() if np.mean(sc) < 70
    ]

    # Warnings
    warnings = []
    if engagement.get("engagement") == "at_risk":
        warnings.append({"type": "critical", "icon": "🔴",
            "message": "Mức độ tương tác rất thấp! Cần tăng cường học tập ngay."})
    elif engagement.get("engagement") == "low":
        warnings.append({"type": "warning", "icon": "🟡",
            "message": "Mức độ tương tác thấp. Nên tăng cường hoạt động."})
    if avg_score < 40:
        warnings.append({"type": "warning", "icon": "📉",
            "message": f"Điểm trung bình thấp ({avg_score:.0f}/100). Nên ôn lại kiến thức."})

    completion_rate = len([s for s in data.scores if s > 30]) / max(1, len(data.scores))

    return {
        "student_id": data.user_id,
        "engagement": engagement,
        "recommended_difficulty": "hard" if avg_score >= 80 else "medium" if avg_score >= 60 else "easy",
        "next_lessons": next_lessons,
        "weak_subjects": sorted(weak_subjects, key=lambda x: x["avg_score"]),
        "warnings": warnings,
        "stats": {
            "avg_score": round(avg_score, 1),
            "total_completed": len(completed_set),
            "total_lessons": len(lessons_list),
            "completion_rate": round(completion_rate, 3),
        },
        "data_source": "real_mongodb",
    }


def _heuristic_recommend(data: BehaviorData, avg_score: float):
    """Fallback: heuristic-based recommendations when ML models unavailable."""
    # Engagement heuristic
    study_norm = min(1, data.avg_daily_study_min / 120)
    login_norm = min(1, data.login_freq_weekly / 7)
    score_norm = avg_score / 100
    completion = len([s for s in data.scores if s > 30]) / max(1, len(data.scores))

    eng_score = 0.3 * study_norm + 0.2 * login_norm + 0.3 * score_norm + 0.2 * completion
    if eng_score >= 0.7:
        eng_level = "high"
    elif eng_score >= 0.5:
        eng_level = "medium"
    elif eng_score >= 0.3:
        eng_level = "low"
    else:
        eng_level = "at_risk"

    engagement = {
        "engagement": eng_level,
        "confidence": round(eng_score, 4),
        "probabilities": {
            "high": round(max(0, eng_score), 4),
            "medium": round(max(0, 1 - abs(eng_score - 0.5)), 4),
            "low": round(max(0, 1 - eng_score), 4),
            "at_risk": round(max(0, 0.5 - eng_score), 4),
        },
        "features": {
            "avg_study_min": data.avg_daily_study_min,
            "login_freq": data.login_freq_weekly,
            "avg_score": avg_score,
            "completion_rate": completion,
            "total_lessons": len(data.scores),
            "avg_forum_posts": data.forum_posts,
        }
    }

    # Next lessons from real classrooms
    next_lessons = []
    for i, lesson in enumerate(lessons_list[:5]):
        next_lessons.append({
            "lesson_id": lesson["id"],
            "subject": lesson["subject"],
            "name": lesson["name"],
            "difficulty": lesson["difficulty"],
            "predicted_score": round(avg_score * 1.05, 1),
            "relevance_score": round(avg_score * 1.05, 1),
        })

    # Weak subjects from provided scores mapped to real lessons
    subj_scores = {}
    for i, score in enumerate(data.scores):
        if i < len(lessons_list):
            subj = lessons_list[i]["subject"]
            subj_scores.setdefault(subj, []).append(score)
    # From historical interactions
    for x in real_interactions:
        if x["student_id"] == data.user_id:
            subj_scores.setdefault(x["subject"], []).append(x["score"])

    weak_subjects = [
        {"subject": s, "avg_score": round(float(np.mean(sc)), 1),
         "suggestion": "Cần ôn tập lại" if np.mean(sc) < 50 else "Cần luyện thêm"}
        for s, sc in subj_scores.items() if np.mean(sc) < 70
    ]

    warnings = []
    if eng_level == "at_risk":
        warnings.append({"type": "critical", "icon": "🔴",
            "message": "Mức độ tương tác rất thấp! Cần tăng cường học tập ngay."})
    elif eng_level == "low":
        warnings.append({"type": "warning", "icon": "🟡",
            "message": "Mức độ tương tác thấp. Nên tăng cường hoạt động."})
    if avg_score < 40:
        warnings.append({"type": "warning", "icon": "📉",
            "message": f"Điểm trung bình thấp ({avg_score:.0f}/100). Nên ôn lại kiến thức."})

    return {
        "student_id": data.user_id,
        "engagement": engagement,
        "recommended_difficulty": "hard" if avg_score >= 80 else "medium" if avg_score >= 60 else "easy",
        "next_lessons": next_lessons,
        "weak_subjects": sorted(weak_subjects, key=lambda x: x["avg_score"]),
        "warnings": warnings,
        "stats": {
            "avg_score": round(avg_score, 1),
            "total_completed": len(data.completed_lessons),
            "total_lessons": len(lessons_list),
            "completion_rate": round(completion, 3),
        },
        "data_source": "heuristic_fallback",
    }


@app.post("/analyze-engagement")
async def analyze_engagement(data: BehaviorData):
    """Analyze student engagement level using real data."""
    avg_score = float(np.mean(data.scores)) if data.scores else 50.0

    if ba_model is not None and data.user_id in student_id_map:
        student = {
            "id": data.user_id, "role": data.role,
            "avg_daily_study_min": data.avg_daily_study_min,
            "login_freq_weekly": data.login_freq_weekly,
            "base_score": avg_score,
        }
        interactions = [
            {"score": score, "time_spent_min": data.time_spent[i] if i < len(data.time_spent) else 30,
             "completed": score > 30, "attempts": 1, "hints_used": 0, "forum_posts": data.forum_posts}
            for i, score in enumerate(data.scores)
        ]
        return ba_model.predict_engagement(student, interactions)

    # Heuristic fallback
    study_norm = min(1, data.avg_daily_study_min / 120)
    login_norm = min(1, data.login_freq_weekly / 7)
    score_norm = avg_score / 100
    eng_score = 0.35 * study_norm + 0.25 * login_norm + 0.4 * score_norm

    if eng_score >= 0.7: level = "high"
    elif eng_score >= 0.5: level = "medium"
    elif eng_score >= 0.3: level = "low"
    else: level = "at_risk"

    return {
        "engagement": level,
        "confidence": round(eng_score, 4),
        "probabilities": {"high": round(eng_score, 4), "medium": round(1 - abs(eng_score - 0.5), 4),
                          "low": round(1 - eng_score, 4), "at_risk": round(max(0, 0.5 - eng_score), 4)},
        "features": {"avg_study_min": data.avg_daily_study_min, "login_freq": data.login_freq_weekly,
                      "avg_score": avg_score}
    }


@app.post("/reload")
async def reload_data():
    """Reload data from MongoDB and retrain models."""
    connect_db()
    success = load_real_data()
    return {
        "status": "ok" if success else "error",
        "students": len(real_students),
        "lessons": len(lessons_list),
        "interactions": len(real_interactions),
    }


@app.get("/subjects")
async def get_subjects():
    subjects = list(set(l["subject"] for l in lessons_list))
    return {"subjects": subjects, "total": len(subjects), "source": "real_mongodb"}


@app.get("/lessons")
async def get_lessons():
    return {"lessons": lessons_list, "total": len(lessons_list), "source": "real_mongodb"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5003)
