"""
Recommendation Service - FastAPI
Learning Behavior Analysis & Personalized Recommendations
"""
import os, sys, json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent))

app = FastAPI(title="Recommendation Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── Load Models & Data ──
DATA_DIR = str(Path(__file__).parent / "data" / "learning")
MODEL_DIR = str(Path(__file__).parent / "output" / "learning_models")

cf_model = None
ba_model = None
engine = None
dataset = None

def load_engine():
    global cf_model, ba_model, engine, dataset
    if engine is not None:
        return engine
    try:
        from learning_behavior import (CollaborativeFilteringModel,
            BehavioralAnalyticsModel, RecommendationEngine, DataGenerator)

        # Load or generate dataset
        ds_path = os.path.join(DATA_DIR, "dataset.json")
        if os.path.exists(ds_path):
            with open(ds_path, "r", encoding="utf-8") as f:
                dataset = json.load(f)
        else:
            gen = DataGenerator()
            dataset = gen.generate()

        # Train models (lightweight, fast on CPU)
        cf_model = CollaborativeFilteringModel(
            n_students=len(dataset["students"]),
            n_lessons=len(dataset["lessons"]))
        cf_model.build()
        cf_model.train(dataset["interactions"], epochs=20)

        ba_model = BehavioralAnalyticsModel()
        ba_model.build_and_train(dataset["students"],
                                 dataset["interactions"], epochs=20)

        engine = RecommendationEngine(cf_model, ba_model, dataset["lessons"])
        print("✅ Recommendation engine loaded")
    except Exception as e:
        print(f"❌ Engine load error: {e}")
    return engine

@app.on_event("startup")
async def startup():
    load_engine()

@app.get("/health")
async def health():
    return {"status": "ok", "service": "recommendation",
            "engine_loaded": engine is not None,
            "timestamp": datetime.now().isoformat()}

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
    """Get personalized learning recommendations based on behavior data."""
    eng = load_engine()
    if eng is None:
        raise HTTPException(503, "Recommendation engine not ready")

    # Build student profile
    avg_score = float(np.mean(data.scores)) if data.scores else 50.0
    if avg_score >= 80: profile = "excellent"
    elif avg_score >= 60: profile = "good"
    elif avg_score >= 40: profile = "average"
    else: profile = "struggling"

    # Map user_id to a student index (hash-based for arbitrary IDs)
    student_idx = abs(hash(data.user_id)) % cf_model.n_students

    student = {
        "id": data.user_id,
        "role": data.role,
        "profile": profile,
        "preferred_subjects": data.preferred_subjects,
        "avg_daily_study_min": data.avg_daily_study_min,
        "login_freq_weekly": data.login_freq_weekly,
        "base_score": avg_score
    }

    # Build interactions from provided data
    interactions = []
    completed_set = set()
    for i, score in enumerate(data.scores):
        lesson_idx = i % len(dataset["lessons"])
        completed_set.add(lesson_idx)
        interactions.append({
            "student_id": data.user_id,
            "lesson_id": f"L{lesson_idx+1:04d}",
            "student_idx": student_idx,
            "lesson_idx": lesson_idx,
            "subject": dataset["lessons"][lesson_idx]["subject"],
            "difficulty": dataset["lessons"][lesson_idx]["difficulty"],
            "score": score,
            "time_spent_min": data.time_spent[i] if i < len(data.time_spent) else 30,
            "completed": score > 30,
            "attempts": 1, "hints_used": 0,
            "forum_posts": data.forum_posts,
            "rating": max(1, min(5, int(score / 20)))
        })

    # Get engagement
    engagement = ba_model.predict_engagement(student, interactions)

    # Get CF recommendations
    rec_diff = "hard" if avg_score >= 80 else "medium" if avg_score >= 60 else "easy"
    cf_recs = cf_model.recommend_lessons(student_idx, completed_set, top_k=10)

    # Build next lessons
    next_lessons = []
    for rec in cf_recs[:5]:
        lesson = dataset["lessons"][rec["lesson_idx"]]
        next_lessons.append({
            "lesson_id": lesson["id"],
            "subject": lesson["subject"],
            "difficulty": lesson["difficulty"],
            "predicted_score": round(rec["predicted_score"], 1),
            "relevance_score": round(rec["predicted_score"], 1),
        })

    # Find weak subjects
    subj_scores = {}
    for x in interactions:
        subj_scores.setdefault(x["subject"], []).append(x["score"])
    weak_subjects = [{"subject": s, "avg_score": round(float(np.mean(sc)), 1),
                      "suggestion": "Cần ôn tập lại" if np.mean(sc) < 50 else "Cần luyện thêm"}
                     for s, sc in subj_scores.items() if np.mean(sc) < 70]

    # Warnings
    warnings = []
    if engagement.get("engagement") == "at_risk":
        warnings.append({"type": "critical", "icon": "🔴",
            "message": "Học sinh có nguy cơ bỏ học cao! Cần hỗ trợ ngay."})
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
        "recommended_difficulty": rec_diff,
        "next_lessons": next_lessons,
        "weak_subjects": sorted(weak_subjects, key=lambda x: x["avg_score"]),
        "warnings": warnings,
        "stats": {
            "avg_score": round(avg_score, 1),
            "total_completed": len(completed_set),
            "total_lessons": len(dataset["lessons"]),
            "completion_rate": round(completion_rate, 3),
        }
    }

@app.post("/analyze-engagement")
async def analyze_engagement(data: BehaviorData):
    """Analyze student engagement level."""
    eng = load_engine()
    if eng is None:
        raise HTTPException(503, "Engine not ready")

    student = {
        "id": data.user_id, "role": data.role,
        "avg_daily_study_min": data.avg_daily_study_min,
        "login_freq_weekly": data.login_freq_weekly,
        "base_score": np.mean(data.scores) if data.scores else 50
    }

    interactions = []
    for i, score in enumerate(data.scores):
        interactions.append({
            "score": score,
            "time_spent_min": data.time_spent[i] if i < len(data.time_spent) else 30,
            "completed": score > 30, "attempts": 1,
            "hints_used": 0, "forum_posts": data.forum_posts
        })

    result = ba_model.predict_engagement(student, interactions)
    return result

@app.get("/subjects")
async def get_subjects():
    from learning_behavior import SUBJECTS, DIFFICULTY_LEVELS
    return {"subjects": SUBJECTS, "difficulty_levels": DIFFICULTY_LEVELS}

@app.get("/lessons")
async def get_lessons():
    if dataset is None:
        raise HTTPException(503, "Data not loaded")
    return {"lessons": dataset["lessons"], "total": len(dataset["lessons"])}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5003)
