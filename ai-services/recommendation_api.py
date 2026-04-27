"""
Recommendation Service - FastAPI
Learning Behavior Analysis & Personalized Recommendations
Sử dụng DỮ LIỆU THẬT từ MongoDB (không dùng dữ liệu ảo)
"""
import os, sys, json, logging, importlib.util
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from bson import ObjectId

# ── Import learning_behavior directly by file path (venv-safe) ──
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_LB_PATH = os.path.join(_SCRIPT_DIR, "learning_behavior.py")
_LB_AVAILABLE = False
CollaborativeFilteringModel = None
BehavioralAnalyticsModel = None
RecommendationEngine = None

if os.path.isfile(_LB_PATH):
    try:
        _lb_spec = importlib.util.spec_from_file_location("learning_behavior", _LB_PATH)
        _lb_mod = importlib.util.module_from_spec(_lb_spec)
        _lb_spec.loader.exec_module(_lb_mod)
        CollaborativeFilteringModel = _lb_mod.CollaborativeFilteringModel
        BehavioralAnalyticsModel = _lb_mod.BehavioralAnalyticsModel
        RecommendationEngine = _lb_mod.RecommendationEngine
        _LB_AVAILABLE = True
        print(f"✅ learning_behavior loaded from {_LB_PATH}")
    except Exception as _e:
        print(f"⚠️ learning_behavior import error: {_e}")
else:
    # Fallback: try sys.path import
    sys.path.insert(0, _SCRIPT_DIR)
    try:
        from learning_behavior import (CollaborativeFilteringModel,
            BehavioralAnalyticsModel, RecommendationEngine)
        _LB_AVAILABLE = True
        print(f"✅ learning_behavior loaded via sys.path from {_SCRIPT_DIR}")
    except Exception as _e:
        print(f"⚠️ learning_behavior not found at {_LB_PATH} and sys.path import failed: {_e}")

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

        if not _LB_AVAILABLE:
            logger.warning("⚠️ learning_behavior module not available. Using heuristic mode.")
            return True

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
    """Get personalized learning recommendations based on REAL ML models."""

    avg_score = float(np.mean(data.scores)) if data.scores else 50.0

    # ── Heuristic fallback ──
    if engine is None or cf_model is None or ba_model is None:
        return _heuristic_recommend(data, avg_score)

    student_idx = student_id_map.get(data.user_id)
    if student_idx is None:
        return _heuristic_recommend(data, avg_score)

    student = {
        "id": data.user_id, "role": data.role,
        "profile": "excellent" if avg_score >= 80 else "good" if avg_score >= 60 else "average" if avg_score >= 40 else "struggling",
        "preferred_subjects": data.preferred_subjects,
        "avg_daily_study_min": data.avg_daily_study_min,
        "login_freq_weekly": data.login_freq_weekly,
        "base_score": avg_score,
    }

    # Build interactions from real historical data
    interactions = []
    completed_set = set()
    for x in real_interactions:
        if x["student_id"] == data.user_id:
            completed_set.add(x["lesson_idx"])
            interactions.append(x)

    # ════════════════════════════════════════════
    # 1. 🎯 PREDICTED SCORES — CF model per classroom
    # ════════════════════════════════════════════
    predicted_scores = _predict_all_scores(student_idx, completed_set)

    # ════════════════════════════════════════════
    # 2. 📊 OPTIMAL STUDY ORDER — embedding similarity
    # ════════════════════════════════════════════
    optimal_study_order = _compute_optimal_study_order(student_idx, completed_set)

    # ════════════════════════════════════════════
    # 3. 👥 SIMILAR STUDENTS — student embeddings
    # ════════════════════════════════════════════
    similar_students = _find_similar_students(student_idx)

    # ════════════════════════════════════════════
    # 4. 🔮 ENGAGEMENT — behavioral model
    # ════════════════════════════════════════════
    engagement = ba_model.predict_engagement(student, interactions)

    # ════════════════════════════════════════════
    # 5. 📈 SCORE TRAJECTORY — trend prediction
    # ════════════════════════════════════════════
    score_trajectory = _compute_score_trajectory(data.user_id, interactions, predicted_scores)

    # ════════════════════════════════════════════
    # 6. ⏱️ STUDY TIME ESTIMATOR
    # ════════════════════════════════════════════
    study_time_est = _estimate_study_time(student_idx, interactions, predicted_scores)

    # ════════════════════════════════════════════
    # 7. 🔥 RISK HEATMAP — multi-factor
    # ════════════════════════════════════════════
    risk_map = _compute_risk_map(student_idx, interactions, predicted_scores, score_trajectory)

    # ════════════════════════════════════════════
    # 8. 🔗 SUBJECT CLUSTERING — embeddings
    # ════════════════════════════════════════════
    subject_clusters = _cluster_subjects(student_idx, interactions)

    # CF recommendations
    cf_recs = cf_model.recommend_lessons(student_idx, completed_set, top_k=10)
    next_lessons = []
    for rec in cf_recs[:5]:
        lidx = rec["lesson_idx"]
        if lidx < len(lessons_list):
            lesson = lessons_list[lidx]
            next_lessons.append({
                "lesson_id": lesson["id"], "subject": lesson["subject"],
                "name": lesson["name"], "difficulty": lesson["difficulty"],
                "predicted_score": round(rec["predicted_score"], 1),
                "relevance_score": round(rec["predicted_score"], 1),
            })

    # Weak subjects
    subj_scores = {}
    for x in interactions:
        subj_scores.setdefault(x["subject"], []).append(x["score"])
    weak_subjects = [
        {"subject": s, "avg_score": round(float(np.mean(sc)), 1),
         "suggestion": "Cần ôn tập lại" if np.mean(sc) < 50 else "Cần luyện thêm"}
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

    completion_rate = len(completed_set) / max(1, len(lessons_list))

    # ════════════════════════════════════════════
    # 9. 💡 SMART INSIGHTS — synthesize all signals
    # ════════════════════════════════════════════
    smart_insights = _generate_smart_insights(
        avg_score, engagement, score_trajectory, risk_map,
        subject_clusters, similar_students, completion_rate
    )

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
        # ════ ML-powered data ════
        "predicted_scores": predicted_scores,
        "optimal_study_order": optimal_study_order,
        "similar_students": similar_students,
        # ════ ADVANCED ML analytics ════
        "score_trajectory": score_trajectory,
        "study_time_estimates": study_time_est,
        "risk_map": risk_map,
        "subject_clusters": subject_clusters,
        "smart_insights": smart_insights,
        "data_source": "ml_model",
    }


# ═══════════════════════════════════════════════
# ML-POWERED HELPER FUNCTIONS
# ═══════════════════════════════════════════════

def _predict_all_scores(student_idx: int, completed_set: set) -> List[Dict]:
    """🎯 CF model predicts score for every classroom."""
    results = []
    for lidx in range(len(lessons_list)):
        lesson = lessons_list[lidx]
        predicted = cf_model.predict_score(student_idx, lidx)
        results.append({
            "classroom_id": lesson["id"],
            "subject": lesson["subject"],
            "name": lesson["name"],
            "predicted_score": round(predicted, 1),
            "has_actual_score": lidx in completed_set,
            "difficulty": lesson["difficulty"],
        })
    results.sort(key=lambda x: x["predicted_score"], reverse=True)
    return results


def _compute_optimal_study_order(student_idx: int, completed_set: set) -> List[Dict]:
    """📊 Lesson embeddings → personalized study order."""
    try:
        student_emb = cf_model.get_student_embedding(student_idx)
        items = []
        for lidx in range(len(lessons_list)):
            if lidx in completed_set:
                continue
            lesson = lessons_list[lidx]
            lesson_emb = cf_model.get_lesson_embedding(lidx)
            cos_sim = float(np.dot(student_emb, lesson_emb) /
                          (np.linalg.norm(student_emb) * np.linalg.norm(lesson_emb) + 1e-8))
            pred_score = cf_model.predict_score(student_idx, lidx)
            priority = cos_sim * 0.4 + (pred_score / 100) * 0.6
            items.append({
                "classroom_id": lesson["id"], "subject": lesson["subject"],
                "name": lesson["name"], "priority_score": round(priority, 3),
                "affinity": round(cos_sim, 3), "predicted_score": round(pred_score, 1),
                "difficulty": lesson["difficulty"],
                "reason": _study_reason(cos_sim, pred_score),
            })
        items.sort(key=lambda x: x["priority_score"], reverse=True)
        for i, item in enumerate(items):
            item["rank"] = i + 1
        return items
    except Exception as e:
        logger.warning(f"Study order failed: {e}")
        return []


def _study_reason(affinity: float, pred_score: float) -> str:
    if affinity > 0.7 and pred_score > 70:
        return "Rất phù hợp & dự đoán điểm cao"
    elif affinity > 0.5 and pred_score > 50:
        return "Khá phù hợp, nên học sớm"
    elif affinity > 0.3:
        return "Cần luyện tập thêm để nâng điểm"
    elif pred_score < 40:
        return "Dự đoán khó khăn — cần ôn kỹ lý thuyết"
    else:
        return "Ưu tiên trung bình"


def _find_similar_students(target_idx: int) -> Dict:
    """👥 Student embeddings + cosine similarity → peer analysis."""
    try:
        target_emb = cf_model.get_student_embedding(target_idx)
        sims = []
        for sidx in range(len(real_students)):
            if sidx == target_idx:
                continue
            other_emb = cf_model.get_student_embedding(sidx)
            cos_sim = float(np.dot(target_emb, other_emb) /
                          (np.linalg.norm(target_emb) * np.linalg.norm(other_emb) + 1e-8))
            sims.append({"idx": sidx, "similarity": cos_sim})
        sims.sort(key=lambda x: x["similarity"], reverse=True)
        top5 = sims[:5]

        peer_scores = []
        for peer in top5:
            pid = real_students[peer["idx"]]["id"] if peer["idx"] < len(real_students) else None
            if pid:
                scores = [x["score"] for x in real_interactions if x["student_id"] == pid]
                peer_scores.extend(scores)

        peer_avg = round(float(np.mean(peer_scores)), 1) if peer_scores else 0
        target_scores = [x["score"] for x in real_interactions if x["student_idx"] == target_idx]
        target_avg = round(float(np.mean(target_scores)), 1) if target_scores else 0
        diff = round(target_avg - peer_avg, 1)

        return {
            "peer_count": len(top5),
            "peer_avg_score": peer_avg,
            "your_avg_score": target_avg,
            "score_diff": diff,
            "comparison": "above" if diff > 5 else "below" if diff < -5 else "similar",
            "avg_similarity": round(float(np.mean([s["similarity"] for s in top5])), 3) if top5 else 0,
            "insight": _peer_insight(diff, peer_avg),
        }
    except Exception as e:
        logger.warning(f"Similar students failed: {e}")
        return {"peer_count": 0, "peer_avg_score": 0, "your_avg_score": 0,
                "score_diff": 0, "comparison": "unknown", "avg_similarity": 0,
                "insight": "Chưa đủ dữ liệu để phân tích"}


def _peer_insight(diff: float, peer_avg: float) -> str:
    if diff > 15:
        return f"Bạn vượt trội hơn nhóm tương tự {diff:.0f} điểm! Tiếp tục phát huy."
    elif diff > 5:
        return f"Bạn đang nhỉnh hơn nhóm tương tự {diff:.0f} điểm."
    elif diff > -5:
        return f"Bạn đang ngang bằng với nhóm tương tự (TB nhóm: {peer_avg:.0f}/100)."
    elif diff > -15:
        return f"Bạn đang thấp hơn nhóm tương tự {abs(diff):.0f} điểm. Cần cố gắng thêm!"
    else:
        return f"Bạn đang thấp hơn nhóm tương tự {abs(diff):.0f} điểm đáng kể. Cần hỗ trợ."


# ═══════════════════════════════════════════════
# ADVANCED ML ANALYTICS (Level 2)
# ═══════════════════════════════════════════════

def _compute_score_trajectory(user_id: str, interactions: List[Dict],
                               predicted_scores: List[Dict]) -> Dict:
    """📈 Linear regression on score timeline → trend prediction."""
    try:
        # Group scores by subject with temporal ordering
        subj_timeline = {}
        for i, x in enumerate(interactions):
            subj_timeline.setdefault(x["subject"], []).append({
                "order": i, "score": x["score"]
            })

        # Overall trajectory via linear regression
        all_scores = [x["score"] for x in interactions]
        if len(all_scores) < 2:
            return {"trend": "insufficient_data", "slope": 0, "subjects": {},
                    "predicted_next": 0, "confidence": 0}

        x_vals = np.arange(len(all_scores), dtype=float)
        y_vals = np.array(all_scores, dtype=float)
        # Linear regression: y = slope * x + intercept
        slope, intercept = np.polyfit(x_vals, y_vals, 1)
        # Predict next score
        predicted_next = float(slope * len(all_scores) + intercept)
        predicted_next = max(0, min(100, predicted_next))

        # R² confidence
        y_pred = slope * x_vals + intercept
        ss_res = float(np.sum((y_vals - y_pred) ** 2))
        ss_tot = float(np.sum((y_vals - np.mean(y_vals)) ** 2))
        r_squared = 1 - (ss_res / (ss_tot + 1e-8))

        # Per-subject trends
        subj_trends = {}
        for subj, timeline in subj_timeline.items():
            if len(timeline) >= 2:
                sx = np.arange(len(timeline), dtype=float)
                sy = np.array([t["score"] for t in timeline], dtype=float)
                s_slope, s_int = np.polyfit(sx, sy, 1)
                subj_trends[subj] = {
                    "slope": round(float(s_slope), 2),
                    "trend": "improving" if s_slope > 1 else "declining" if s_slope < -1 else "stable",
                    "last_score": float(sy[-1]),
                    "predicted_next": round(max(0, min(100, float(s_slope * len(timeline) + s_int))), 1),
                }

        trend_label = "improving" if slope > 1 else "declining" if slope < -1 else "stable"
        return {
            "trend": trend_label,
            "slope": round(float(slope), 3),
            "intercept": round(float(intercept), 1),
            "predicted_next": round(predicted_next, 1),
            "confidence": round(max(0, r_squared), 3),
            "total_data_points": len(all_scores),
            "subjects": subj_trends,
        }
    except Exception as e:
        logger.warning(f"Score trajectory failed: {e}")
        return {"trend": "error", "slope": 0, "subjects": {},
                "predicted_next": 0, "confidence": 0}


def _estimate_study_time(student_idx: int, interactions: List[Dict],
                         predicted_scores: List[Dict]) -> List[Dict]:
    """⏱️ Estimate study hours needed per subject based on peer data."""
    try:
        results = []
        student_emb = cf_model.get_student_embedding(student_idx)

        # Find top 10 similar students for reference
        peer_data = {}  # subject → {scores, study_hours}
        for sidx in range(len(real_students)):
            if sidx == student_idx:
                continue
            other_emb = cf_model.get_student_embedding(sidx)
            sim = float(np.dot(student_emb, other_emb) /
                       (np.linalg.norm(student_emb) * np.linalg.norm(other_emb) + 1e-8))
            if sim < 0.3:
                continue
            pid = real_students[sidx]["id"]
            for x in real_interactions:
                if x["student_id"] == pid:
                    subj = x["subject"]
                    peer_data.setdefault(subj, {"scores": [], "times": [], "count": 0})
                    peer_data[subj]["scores"].append(x["score"])
                    peer_data[subj]["times"].append(x.get("time_spent_min", 30))
                    peer_data[subj]["count"] += 1

        # For each subject, estimate time to reach target
        subj_scores = {}
        for x in interactions:
            subj_scores.setdefault(x["subject"], []).append(x["score"])

        for p in predicted_scores:
            subj = p["subject"]
            current_avg = float(np.mean(subj_scores[subj])) if subj in subj_scores else 0
            target = max(70, current_avg + 15)  # Target: at least 70 or +15
            gap = max(0, target - current_avg)

            # Use peer data to estimate hours/point
            peer_info = peer_data.get(subj, {"scores": [], "times": []})
            if peer_info["scores"] and peer_info["times"]:
                peer_avg_time = float(np.mean(peer_info["times"]))
                peer_avg_score = float(np.mean(peer_info["scores"]))
                # hours per point improvement (from peer data)
                hours_per_point = peer_avg_time / max(1, peer_avg_score) * 0.5
            else:
                hours_per_point = 0.8  # default: ~48min per point

            est_hours = round(gap * hours_per_point / 60, 1)  # min → hours

            if gap > 0:
                results.append({
                    "subject": subj,
                    "current_score": round(current_avg, 1),
                    "target_score": round(target, 1),
                    "gap": round(gap, 1),
                    "estimated_hours": max(1, est_hours),
                    "difficulty": p["difficulty"],
                    "peer_based": bool(peer_info["scores"]),
                })

        results.sort(key=lambda x: x["estimated_hours"])
        return results
    except Exception as e:
        logger.warning(f"Study time estimation failed: {e}")
        return []


def _compute_risk_map(student_idx: int, interactions: List[Dict],
                      predicted_scores: List[Dict],
                      trajectory: Dict) -> List[Dict]:
    """🔥 Multi-factor risk analysis per subject."""
    try:
        subj_scores = {}
        for x in interactions:
            subj_scores.setdefault(x["subject"], []).append(x["score"])

        subj_trends = trajectory.get("subjects", {})
        results = []

        for p in predicted_scores:
            subj = p["subject"]
            actual_scores = subj_scores.get(subj, [])
            actual_avg = float(np.mean(actual_scores)) if actual_scores else 0
            pred_score = p["predicted_score"]
            trend_info = subj_trends.get(subj, {})
            trend_slope = trend_info.get("slope", 0)

            # Multi-factor risk computation
            # Factor 1: Low predicted score (0-40 = high risk)
            score_risk = max(0, (60 - pred_score) / 60) if pred_score < 60 else 0
            # Factor 2: Declining trend
            trend_risk = max(0, min(1, -trend_slope / 5)) if trend_slope < 0 else 0
            # Factor 3: Low actual average
            actual_risk = max(0, (50 - actual_avg) / 50) if actual_avg > 0 and actual_avg < 50 else 0
            # Factor 4: Score variance (inconsistency)
            variance_risk = min(1, float(np.std(actual_scores)) / 30) if len(actual_scores) > 1 else 0.3

            # Weighted combination
            risk_score = (score_risk * 0.35 + trend_risk * 0.25 +
                         actual_risk * 0.25 + variance_risk * 0.15)
            risk_pct = round(risk_score * 100, 1)

            risk_level = "high" if risk_pct > 50 else "medium" if risk_pct > 25 else "low"

            results.append({
                "subject": subj,
                "risk_pct": risk_pct,
                "risk_level": risk_level,
                "predicted_score": pred_score,
                "actual_avg": round(actual_avg, 1) if actual_avg > 0 else None,
                "trend": trend_info.get("trend", "unknown"),
                "factors": {
                    "score_risk": round(score_risk * 100, 1),
                    "trend_risk": round(trend_risk * 100, 1),
                    "actual_risk": round(actual_risk * 100, 1),
                    "variance_risk": round(variance_risk * 100, 1),
                }
            })

        results.sort(key=lambda x: x["risk_pct"], reverse=True)
        return results
    except Exception as e:
        logger.warning(f"Risk map failed: {e}")
        return []


def _cluster_subjects(student_idx: int, interactions: List[Dict]) -> List[Dict]:
    """🔗 Embedding-based subject clustering + strength analysis."""
    try:
        # Get all lesson embeddings and group by subject
        subj_embeddings = {}
        subj_scores = {}
        for lidx in range(len(lessons_list)):
            lesson = lessons_list[lidx]
            subj = lesson["subject"]
            emb = cf_model.get_lesson_embedding(lidx)
            subj_embeddings.setdefault(subj, []).append(emb)

        for x in interactions:
            subj_scores.setdefault(x["subject"], []).append(x["score"])

        # Average embedding per subject
        subj_avg_emb = {}
        for subj, embs in subj_embeddings.items():
            subj_avg_emb[subj] = np.mean(embs, axis=0)

        # Compute pairwise cosine similarity → find clusters
        subjects = list(subj_avg_emb.keys())
        n = len(subjects)
        if n < 2:
            return []

        sim_matrix = np.zeros((n, n))
        for i in range(n):
            for j in range(n):
                ei, ej = subj_avg_emb[subjects[i]], subj_avg_emb[subjects[j]]
                sim_matrix[i][j] = float(np.dot(ei, ej) /
                                        (np.linalg.norm(ei) * np.linalg.norm(ej) + 1e-8))

        # Simple agglomerative clustering: threshold-based
        clusters = []
        assigned = set()
        for i in range(n):
            if i in assigned:
                continue
            cluster = [subjects[i]]
            assigned.add(i)
            for j in range(i + 1, n):
                if j not in assigned and sim_matrix[i][j] > 0.5:
                    cluster.append(subjects[j])
                    assigned.add(j)
            # Compute cluster strength for this student
            cluster_scores = []
            for subj in cluster:
                if subj in subj_scores:
                    cluster_scores.extend(subj_scores[subj])

            avg_score = float(np.mean(cluster_scores)) if cluster_scores else 0
            pred_scores = []
            for subj in cluster:
                for lidx in range(len(lessons_list)):
                    if lessons_list[lidx]["subject"] == subj:
                        pred_scores.append(cf_model.predict_score(student_idx, lidx))
                        break

            avg_pred = float(np.mean(pred_scores)) if pred_scores else 0

            strength = "strong" if avg_score >= 70 or avg_pred >= 70 else \
                       "weak" if avg_score < 50 or avg_pred < 50 else "average"

            clusters.append({
                "subjects": cluster,
                "avg_score": round(avg_score, 1),
                "avg_predicted": round(avg_pred, 1),
                "strength": strength,
                "data_points": len(cluster_scores),
            })

        clusters.sort(key=lambda x: x["avg_score"], reverse=True)
        return clusters
    except Exception as e:
        logger.warning(f"Subject clustering failed: {e}")
        return []


def _generate_smart_insights(avg_score: float, engagement: Dict,
                              trajectory: Dict, risk_map: List[Dict],
                              clusters: List[Dict], similar: Dict,
                              completion_rate: float) -> List[Dict]:
    """💡 Synthesize all ML signals → personalized natural language insights."""
    insights = []

    # Insight from trajectory
    trend = trajectory.get("trend", "unknown")
    slope = trajectory.get("slope", 0)
    pred_next = trajectory.get("predicted_next", 0)
    if trend == "improving" and slope > 0:
        insights.append({
            "icon": "📈", "type": "positive",
            "text": f"Điểm đang tăng +{slope:.1f} mỗi bài. Dự đoán bài tiếp: {pred_next:.0f}/100.",
            "source": "Linear Regression"
        })
    elif trend == "declining":
        insights.append({
            "icon": "📉", "type": "negative",
            "text": f"Điểm đang giảm {abs(slope):.1f} mỗi bài. Cần ôn tập ngay để đảo chiều.",
            "source": "Linear Regression"
        })

    # Insight from risk map
    high_risks = [r for r in risk_map if r["risk_level"] == "high"]
    if high_risks:
        subjects = ", ".join([r["subject"] for r in high_risks[:3]])
        insights.append({
            "icon": "🔥", "type": "warning",
            "text": f"Nguy cơ trượt cao ở: {subjects}. Nên ưu tiên ôn tập.",
            "source": "Multi-factor Risk Analysis"
        })
    elif risk_map and all(r["risk_level"] == "low" for r in risk_map):
        insights.append({
            "icon": "🛡️", "type": "positive",
            "text": "Không có môn nào có nguy cơ trượt cao. An toàn!",
            "source": "Risk Analysis"
        })

    # Insight from clusters
    strong_clusters = [c for c in clusters if c["strength"] == "strong"]
    weak_clusters = [c for c in clusters if c["strength"] == "weak"]
    if strong_clusters:
        strong_subjs = ", ".join(strong_clusters[0]["subjects"][:3])
        insights.append({
            "icon": "💪", "type": "positive",
            "text": f"Thế mạnh: nhóm [{strong_subjs}] — TB {strong_clusters[0]['avg_score']:.0f}/100.",
            "source": "Embedding Clustering"
        })
    if weak_clusters:
        weak_subjs = ", ".join(weak_clusters[0]["subjects"][:3])
        insights.append({
            "icon": "📚", "type": "action",
            "text": f"Cần cải thiện: nhóm [{weak_subjs}] — TB {weak_clusters[0]['avg_score']:.0f}/100.",
            "source": "Embedding Clustering"
        })

    # Insight from peer comparison
    if similar and similar.get("comparison") == "above":
        insights.append({
            "icon": "🏆", "type": "positive",
            "text": f"Bạn vượt nhóm tương tự +{similar['score_diff']:.0f} điểm. Top performer!",
            "source": "Student Embeddings"
        })
    elif similar and similar.get("comparison") == "below":
        insights.append({
            "icon": "🎯", "type": "action",
            "text": f"Nhóm tương tự TB {similar['peer_avg_score']:.0f} điểm. Bạn cần thêm {abs(similar['score_diff']):.0f} điểm để bắt kịp.",
            "source": "Student Embeddings"
        })

    # Insight from engagement
    eng_level = engagement.get("engagement", "unknown")
    eng_conf = engagement.get("confidence", 0)
    if eng_level == "high" and eng_conf > 0.5:
        insights.append({
            "icon": "⚡", "type": "positive",
            "text": f"Mức tương tác xuất sắc (confidence: {eng_conf*100:.0f}%). Giữ vững!",
            "source": "Behavioral Neural Network"
        })
    elif eng_level in ("low", "at_risk"):
        insights.append({
            "icon": "⚠️", "type": "warning",
            "text": "Mức tương tác thấp. Tăng thời gian học và tham gia lớp đều đặn hơn.",
            "source": "Behavioral Neural Network"
        })

    return insights[:6]  # Max 6 insights


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
