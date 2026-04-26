"""
=================================================================
📚 LEARNING BEHAVIOR ANALYSIS SYSTEM
=================================================================
E-Learning AI - Module Phân tích hành vi học tập

Chức năng:
  1. Thu thập & phân tích dữ liệu học tập
  2. Collaborative Filtering (Matrix Factorization)
  3. Behavioral Analytics (Neural Network)
  4. Recommendation Engine (Gợi ý lộ trình cá nhân hóa)
  5. Export model → TensorFlow.js

Tech: TensorFlow, Scikit-learn, NumPy
=================================================================
"""

import os
import sys
import json
import logging
import argparse
import platform
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import numpy as np
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics.pairwise import cosine_similarity

# ─────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────
SUBJECTS = [
    "Toán cao cấp 2", "Vật lý đại cương", "Hóa học đại cương", 
    "Triết học Mác - Lênin", "Kinh tế chính trị", "Pháp luật đại cương", 
    "Lập trình C++", "Cơ sở dữ liệu", "Mạng máy tính", "Hệ điều hành",
    "Cấu trúc dữ liệu và giải thuật", "Phân tích thiết kế hệ thống", 
    "Trí tuệ nhân tạo", "An toàn thông tin", "Phát triển ứng dụng web", 
    "Tiếng Anh chuyên ngành", "Xác suất thống kê", "Đại số tuyến tính", 
    "Kỹ thuật đồ họa", "Thương mại điện tử"
]
DIFFICULTY_LEVELS = ["easy", "medium", "hard", "advanced"]
ENGAGEMENT_LABELS = ["high", "medium", "low", "at_risk"]

NUM_SYNTHETIC_STUDENTS = 200
NUM_SYNTHETIC_LESSONS = 50
EMBEDDING_DIM = 32
EPOCHS = 50
BATCH_SIZE = 32


# ─────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────
def setup_logging(log_dir: str) -> logging.Logger:
    os.makedirs(log_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    logger = logging.getLogger("LearningBehavior")
    logger.setLevel(logging.DEBUG)
    if not logger.handlers:
        fh = logging.FileHandler(
            os.path.join(log_dir, f"learning_{ts}.log"), encoding="utf-8"
        )
        ch = logging.StreamHandler(sys.stdout)
        fmt = logging.Formatter("%(asctime)s | %(levelname)-8s | %(message)s",
                                datefmt="%Y-%m-%d %H:%M:%S")
        fh.setFormatter(fmt); ch.setFormatter(fmt)
        fh.setLevel(logging.DEBUG); ch.setLevel(logging.INFO)
        logger.addHandler(fh); logger.addHandler(ch)
    return logger


# ─────────────────────────────────────────────
# 1. SYNTHETIC DATA GENERATOR
# ─────────────────────────────────────────────
class DataGenerator:
    """Tạo dữ liệu hành vi học tập giả lập."""

    def __init__(self, n_students=NUM_SYNTHETIC_STUDENTS,
                 n_lessons=NUM_SYNTHETIC_LESSONS, seed=42):
        np.random.seed(seed)
        self.n_students = n_students
        self.n_lessons = n_lessons

    def generate(self) -> Dict:
        """Tạo toàn bộ dữ liệu."""
        students = self._gen_students()
        lessons = self._gen_lessons()
        interactions = self._gen_interactions(students, lessons)
        return {"students": students, "lessons": lessons,
                "interactions": interactions}

    def _gen_students(self) -> List[Dict]:
        students = []
        roles = ["student"] * int(self.n_students * 0.85) + \
                ["teacher"] * int(self.n_students * 0.15)
        np.random.shuffle(roles)
        for i in range(self.n_students):
            # Student profile determines behavior patterns
            profile = np.random.choice(
                ["excellent", "good", "average", "struggling"],
                p=[0.15, 0.30, 0.35, 0.20]
            )
            base_score = {"excellent": 85, "good": 70,
                          "average": 55, "struggling": 35}[profile]
            students.append({
                "id": f"U{i+1:04d}",
                "role": roles[i] if i < len(roles) else "student",
                "profile": profile,
                "preferred_subjects": list(np.random.choice(
                    SUBJECTS, size=np.random.randint(2, 5), replace=False)),
                "avg_daily_study_min": max(10, int(
                    np.random.normal(
                        {"excellent": 120, "good": 80,
                         "average": 45, "struggling": 20}[profile], 15))),
                "login_freq_weekly": max(1, int(
                    np.random.normal(
                        {"excellent": 6, "good": 5,
                         "average": 3, "struggling": 1.5}[profile], 1))),
                "base_score": base_score,
            })
        return students

    # def _gen_lessons(self) -> List[Dict]:
    #     lessons = []
    #     for i in range(self.n_lessons):
    #         subj = SUBJECTS[i % len(SUBJECTS)]
    #         diff = DIFFICULTY_LEVELS[min(i // 12, 3)]
    #         lessons.append({
    #             "id": f"L{i+1:04d}",
    #             "subject": subj,
    #             "difficulty": diff,
    #             "difficulty_num": DIFFICULTY_LEVELS.index(diff),
    #             "duration_min": np.random.randint(15, 60),
    #             "max_score": 100,
    #             "prerequisites": [f"L{max(1,i-np.random.randint(1,4)):04d}"]
    #                               if i > 3 else [],
    #         })
    #     return lessons
    # Cập nhật hàm của bạn để sử dụng danh sách này
    def _gen_lessons(self) -> List[Dict]:
        lessons = []
        # Giả sử DIFFICULTY_LEVELS = ["Dễ", "Trung bình", "Khó", "Rất khó"]
        for i in range(self.n_lessons):
            # Lấy môn học xoay vòng từ 20 môn thực tế ở trên
            subj = SUBJECTS[i % len(SUBJECTS)]
            
            # Logic độ khó dựa trên chỉ số bài học
            diff = DIFFICULTY_LEVELS[min(i // 12, 3)]
            
            lessons.append({
                "id": f"L{i+1:04d}",
                "subject": subj,
                "difficulty": diff,
                "difficulty_num": DIFFICULTY_LEVELS.index(diff),
                "duration_min": np.random.randint(15, 60),
                "max_score": 100,
                # Gợi ý bài học trước đó của CÙNG môn học để tạo lộ trình học tập
                "prerequisites": [f"L{max(1, i - len(SUBJECTS) + 1):04d}"] if i >= len(SUBJECTS) else []
            })
        return lessons

    def _gen_interactions(self, students, lessons) -> List[Dict]:
        interactions = []
        for s in students:
            if s["role"] == "teacher":
                continue
            # Each student interacts with ~60-90% of lessons
            n_interact = int(len(lessons) * np.random.uniform(0.4, 0.9))
            chosen = np.random.choice(
                len(lessons), size=n_interact, replace=False)

            for li in sorted(chosen):
                lesson = lessons[li]
                # Score depends on profile + difficulty match
                diff_penalty = lesson["difficulty_num"] * 8
                noise = np.random.normal(0, 10)
                score = np.clip(
                    s["base_score"] - diff_penalty + noise, 0, 100)

                # Time spent
                expected_time = lesson["duration_min"]
                time_factor = {"excellent": 0.85, "good": 1.0,
                               "average": 1.2, "struggling": 1.5}
                time_spent = max(5, int(
                    expected_time * time_factor[s["profile"]] +
                    np.random.normal(0, 5)))

                # Completion & interaction
                completed = score > 30 and np.random.random() > 0.1
                interactions.append({
                    "student_id": s["id"],
                    "lesson_id": lesson["id"],
                    "student_idx": int(s["id"][1:]) - 1,
                    "lesson_idx": int(li),
                    "subject": lesson["subject"],
                    "difficulty": lesson["difficulty"],
                    "score": round(float(score), 1),
                    "time_spent_min": int(time_spent),
                    "completed": bool(completed),
                    "attempts": int(np.random.randint(1, 4)),
                    "hints_used": int(max(0, int(
                        np.random.normal(3 - score/30, 1)))),
                    "forum_posts": int(np.random.poisson(
                        {"excellent": 3, "good": 2,
                         "average": 1, "struggling": 0.3}[s["profile"]])),
                    "rating": int(min(5, max(1, int(
                        np.random.normal(score/20, 0.5))))),
                })
        return interactions


# ─────────────────────────────────────────────
# 2. COLLABORATIVE FILTERING MODEL
# ─────────────────────────────────────────────
class CollaborativeFilteringModel:
    """
    Matrix Factorization với Neural Network.
    Học embedding cho students và lessons,
    dự đoán score/rating.
    """

    def __init__(self, n_students: int, n_lessons: int,
                 embedding_dim: int = EMBEDDING_DIM, logger=None):
        self.n_students = n_students
        self.n_lessons = n_lessons
        self.embedding_dim = embedding_dim
        self.logger = logger or logging.getLogger("LearningBehavior")
        self.model = None
        self.history = None

    def build(self):
        """Build Neural Collaborative Filtering model."""
        # Inputs
        student_input = tf.keras.Input(shape=(1,), name="student_id")
        lesson_input = tf.keras.Input(shape=(1,), name="lesson_id")

        # Embeddings
        student_emb = tf.keras.layers.Embedding(
            self.n_students, self.embedding_dim,
            name="student_embedding")(student_input)
        student_emb = tf.keras.layers.Flatten()(student_emb)

        lesson_emb = tf.keras.layers.Embedding(
            self.n_lessons, self.embedding_dim,
            name="lesson_embedding")(lesson_input)
        lesson_emb = tf.keras.layers.Flatten()(lesson_emb)

        # GMF path (dot product)
        gmf = tf.keras.layers.Multiply()([student_emb, lesson_emb])

        # MLP path (deep learning)
        mlp_concat = tf.keras.layers.Concatenate()([student_emb, lesson_emb])
        mlp = tf.keras.layers.Dense(64, activation="relu")(mlp_concat)
        mlp = tf.keras.layers.Dropout(0.2)(mlp)
        mlp = tf.keras.layers.Dense(32, activation="relu")(mlp)
        mlp = tf.keras.layers.Dropout(0.2)(mlp)

        # Combine GMF + MLP
        combined = tf.keras.layers.Concatenate()([gmf, mlp])
        x = tf.keras.layers.Dense(32, activation="relu")(combined)
        output = tf.keras.layers.Dense(1, activation="sigmoid",
                                       name="score_pred")(x)

        self.model = tf.keras.Model(
            inputs=[student_input, lesson_input], outputs=output,
            name="CollaborativeFiltering"
        )
        self.model.compile(
            optimizer=tf.keras.optimizers.Adam(0.001),
            loss="mse", metrics=["mae"]
        )
        self.logger.info(f"  🏗️  CF Model: {self.model.count_params():,} params")

    def train(self, interactions: List[Dict], epochs=EPOCHS):
        """Train model."""
        student_ids = np.array([x["student_idx"] for x in interactions])
        lesson_ids = np.array([x["lesson_idx"] for x in interactions])
        scores = np.array([x["score"] / 100.0 for x in interactions])

        # Split
        idx = np.arange(len(scores))
        train_idx, val_idx = train_test_split(idx, test_size=0.2, random_state=42)

        self.logger.info(f"  📊 Training CF: {len(train_idx)} train, {len(val_idx)} val")

        self.history = self.model.fit(
            [student_ids[train_idx], lesson_ids[train_idx]],
            scores[train_idx],
            validation_data=(
                [student_ids[val_idx], lesson_ids[val_idx]],
                scores[val_idx]
            ),
            epochs=epochs, batch_size=BATCH_SIZE, verbose=0,
            callbacks=[tf.keras.callbacks.EarlyStopping(
                patience=8, restore_best_weights=True)]
        )

        val_loss = min(self.history.history["val_loss"])
        val_mae = min(self.history.history["val_mae"])
        best_epoch = self.history.history["val_loss"].index(val_loss) + 1
        self.logger.info(f"  ✅ CF trained: val_loss={val_loss:.4f}, "
                         f"val_mae={val_mae:.4f}, best_epoch={best_epoch}")

    def predict_score(self, student_idx: int, lesson_idx: int) -> float:
        pred = self.model.predict(
            [np.array([student_idx]), np.array([lesson_idx])], verbose=0)
        return float(pred[0][0]) * 100

    def get_student_embedding(self, student_idx: int) -> np.ndarray:
        emb_layer = self.model.get_layer("student_embedding")
        return emb_layer.get_weights()[0][student_idx]

    def get_lesson_embedding(self, lesson_idx: int) -> np.ndarray:
        emb_layer = self.model.get_layer("lesson_embedding")
        return emb_layer.get_weights()[0][lesson_idx]

    def recommend_lessons(self, student_idx: int,
                          completed: set, top_k: int = 5) -> List[Dict]:
        """Gợi ý bài học cho student."""
        predictions = []
        for li in range(self.n_lessons):
            if li in completed:
                continue
            score = self.predict_score(student_idx, li)
            predictions.append({"lesson_idx": li, "predicted_score": score})

        predictions.sort(key=lambda x: x["predicted_score"], reverse=True)
        return predictions[:top_k]


# ─────────────────────────────────────────────
# 3. BEHAVIORAL ANALYTICS MODEL
# ─────────────────────────────────────────────
class BehavioralAnalyticsModel:
    """
    Phân tích hành vi học tập.
    Dự đoán engagement level & cảnh báo học kém.
    """

    def __init__(self, logger=None):
        self.logger = logger or logging.getLogger("LearningBehavior")
        self.model = None
        self.scaler = MinMaxScaler()
        self.label_enc = LabelEncoder()
        self.history = None

    def _extract_features(self, student: Dict,
                          interactions: List[Dict]) -> np.ndarray:
        """Trích xuất behavioral features cho 1 student."""
        if not interactions:
            return np.zeros(10)

        scores = [x["score"] for x in interactions]
        times = [x["time_spent_min"] for x in interactions]
        completed = [1 if x["completed"] else 0 for x in interactions]

        return np.array([
            student["avg_daily_study_min"],
            student["login_freq_weekly"],
            np.mean(scores),
            np.std(scores) if len(scores) > 1 else 0,
            np.mean(times),
            np.mean(completed),
            len(interactions),
            np.mean([x["attempts"] for x in interactions]),
            np.mean([x["hints_used"] for x in interactions]),
            np.mean([x["forum_posts"] for x in interactions]),
        ], dtype=np.float32)

    def _get_engagement_label(self, features: np.ndarray) -> str:
        """Xác định engagement level."""
        avg_score, completion, study_time = features[2], features[5], features[0]
        score = avg_score * 0.4 + completion * 30 + min(study_time, 120) / 4
        if score > 65: return "high"
        elif score > 45: return "medium"
        elif score > 25: return "low"
        else: return "at_risk"

    def build_and_train(self, students: List[Dict],
                        all_interactions: List[Dict], epochs=EPOCHS):
        """Build & train engagement prediction model."""
        # Group interactions by student
        student_ints = {}
        for x in all_interactions:
            sid = x["student_id"]
            student_ints.setdefault(sid, []).append(x)

        # Extract features
        X, y_labels = [], []
        for s in students:
            if s["role"] == "teacher":
                continue
            ints = student_ints.get(s["id"], [])
            feat = self._extract_features(s, ints)
            label = self._get_engagement_label(feat)
            X.append(feat)
            y_labels.append(label)

        X = np.array(X)
        X_scaled = self.scaler.fit_transform(X)
        y_encoded = self.label_enc.fit_transform(y_labels)
        y_onehot = tf.keras.utils.to_categorical(y_encoded, num_classes=4)

        # Build model
        self.model = tf.keras.Sequential([
            tf.keras.layers.Input(shape=(10,)),
            tf.keras.layers.Dense(64, activation="relu"),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.Dropout(0.3),
            tf.keras.layers.Dense(32, activation="relu"),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(4, activation="softmax",
                                  name="engagement_pred"),
        ], name="BehavioralAnalytics")

        self.model.compile(
            optimizer="adam", loss="categorical_crossentropy",
            metrics=["accuracy"]
        )

        X_train, X_val, y_train, y_val = train_test_split(
            X_scaled, y_onehot, test_size=0.2, random_state=42)

        self.logger.info(f"  🏗️  Behavioral Model: {self.model.count_params():,} params")
        self.logger.info(f"  📊 Training: {len(X_train)} train, {len(X_val)} val")

        self.history = self.model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=epochs, batch_size=BATCH_SIZE, verbose=0,
            callbacks=[tf.keras.callbacks.EarlyStopping(
                patience=10, restore_best_weights=True)]
        )

        val_acc = max(self.history.history["val_accuracy"])
        self.logger.info(f"  ✅ Behavioral trained: val_accuracy={val_acc:.4f}")

        # Distribution
        dist = {l: y_labels.count(l) for l in ENGAGEMENT_LABELS}
        self.logger.info(f"  📊 Engagement dist: {dist}")

    def predict_engagement(self, student: Dict,
                           interactions: List[Dict]) -> Dict:
        """Dự đoán engagement level."""
        feat = self._extract_features(student, interactions)
        feat_scaled = self.scaler.transform(feat.reshape(1, -1))
        probs = self.model.predict(feat_scaled, verbose=0)[0]

        classes = self.label_enc.classes_
        pred_idx = np.argmax(probs)

        return {
            "engagement": classes[pred_idx],
            "confidence": round(float(probs[pred_idx]), 4),
            "probabilities": {c: round(float(p), 4)
                              for c, p in zip(classes, probs)},
            "features": {
                "avg_study_min": round(float(feat[0]), 1),
                "login_freq": round(float(feat[1]), 1),
                "avg_score": round(float(feat[2]), 1),
                "completion_rate": round(float(feat[5]), 3),
                "total_lessons": int(feat[6]),
                "avg_forum_posts": round(float(feat[9]), 1),
            }
        }


# ─────────────────────────────────────────────
# 4. RECOMMENDATION ENGINE
# ─────────────────────────────────────────────
class RecommendationEngine:
    """
    Gợi ý lộ trình học cá nhân hóa:
    - Nội dung nên học tiếp
    - Mức độ khó phù hợp
    - Cảnh báo học kém hiệu quả
    """

    def __init__(self, cf_model: CollaborativeFilteringModel,
                 ba_model: BehavioralAnalyticsModel,
                 lessons: List[Dict], logger=None):
        self.cf = cf_model
        self.ba = ba_model
        self.lessons = lessons
        self.logger = logger or logging.getLogger("LearningBehavior")

    def recommend(self, student: Dict, interactions: List[Dict],
                  top_k: int = 5) -> Dict:
        """Tạo gợi ý toàn diện cho student."""
        sid = student["id"]
        student_idx = int(sid[1:]) - 1

        # Completed lessons
        completed = {x["lesson_idx"] for x in interactions}
        scores = [x["score"] for x in interactions]

        # 1. Engagement analysis
        engagement = self.ba.predict_engagement(student, interactions)

        # 2. Recommended difficulty
        avg_score = np.mean(scores) if scores else 50
        if avg_score >= 80:
            rec_diff = "hard"
        elif avg_score >= 60:
            rec_diff = "medium"
        elif avg_score >= 40:
            rec_diff = "easy"
        else:
            rec_diff = "easy"

        # 3. CF recommendations
        cf_recs = self.cf.recommend_lessons(student_idx, completed, top_k * 2)

        # 4. Filter & rank by difficulty match
        ranked = []
        for rec in cf_recs:
            lesson = self.lessons[rec["lesson_idx"]]
            diff_match = 1.0 if lesson["difficulty"] == rec_diff else 0.5
            # Prefer subjects student likes
            subj_match = 1.2 if lesson["subject"] in \
                student.get("preferred_subjects", []) else 1.0

            final_score = rec["predicted_score"] * diff_match * subj_match
            ranked.append({
                "lesson_id": lesson["id"],
                "subject": lesson["subject"],
                "difficulty": lesson["difficulty"],
                "predicted_score": round(rec["predicted_score"], 1),
                "relevance_score": round(final_score, 1),
            })

        ranked.sort(key=lambda x: x["relevance_score"], reverse=True)

        # 5. Warnings
        warnings = []
        if engagement["engagement"] == "at_risk":
            warnings.append({
                "type": "critical", "icon": "🔴",
                "message": "Học sinh có nguy cơ bỏ học cao! Cần hỗ trợ ngay."
            })
        elif engagement["engagement"] == "low":
            warnings.append({
                "type": "warning", "icon": "🟡",
                "message": "Mức độ tương tác thấp. Nên tăng cường hoạt động."
            })

        if avg_score < 40:
            warnings.append({
                "type": "warning", "icon": "📉",
                "message": f"Điểm trung bình thấp ({avg_score:.0f}/100). "
                           f"Nên ôn tập lại kiến thức cơ bản."
            })

        completion_rate = engagement["features"]["completion_rate"]
        if completion_rate < 0.5:
            warnings.append({
                "type": "info", "icon": "📋",
                "message": f"Tỷ lệ hoàn thành thấp ({completion_rate:.0%}). "
                           f"Hãy hoàn thành bài tập trước khi học tiếp."
            })

        # 6. Learning path
        weak_subjects = self._find_weak_subjects(interactions)

        return {
            "student_id": sid,
            "student_name": student.get("name", sid),
            "engagement": engagement,
            "recommended_difficulty": rec_diff,
            "next_lessons": ranked[:top_k],
            "weak_subjects": weak_subjects,
            "warnings": warnings,
            "stats": {
                "avg_score": round(avg_score, 1),
                "total_completed": len(completed),
                "total_lessons": len(self.lessons),
                "completion_rate": round(completion_rate, 3),
            }
        }

    def _find_weak_subjects(self, interactions: List[Dict]) -> List[Dict]:
        subj_scores = {}
        for x in interactions:
            subj = x["subject"]
            subj_scores.setdefault(subj, []).append(x["score"])

        weak = []
        for subj, sc in subj_scores.items():
            avg = np.mean(sc)
            if avg < 50:
                weak.append({"subject": subj, "avg_score": round(avg, 1),
                             "suggestion": "Cần ôn tập lại từ đầu"})
            elif avg < 70:
                weak.append({"subject": subj, "avg_score": round(avg, 1),
                             "suggestion": "Cần luyện tập thêm"})

        weak.sort(key=lambda x: x["avg_score"])
        return weak


# ─────────────────────────────────────────────
# 5. MODEL EXPORTER (TF.js + SavedModel)
# ─────────────────────────────────────────────
class ModelExporter:
    """Export models cho TensorFlow.js deployment."""

    def __init__(self, output_dir: str = "output/learning_models",
                 logger=None):
        self.output_dir = output_dir
        self.logger = logger or logging.getLogger("LearningBehavior")

    def export_all(self, cf_model, ba_model, metadata: Dict):
        """Export tất cả models."""
        os.makedirs(self.output_dir, exist_ok=True)

        results = {}

        # 1. CF Model → SavedModel → TF.js
        self.logger.info("\n  📦 [1/2] Exporting Collaborative Filtering...")
        cf_dir = os.path.join(self.output_dir, "cf_model")
        tf.saved_model.save(cf_model.model, cf_dir)
        results["cf_savedmodel"] = cf_dir
        self.logger.info(f"  ✅ CF SavedModel: {cf_dir}")

        # TF.js conversion
        try:
            tfjs_cf = os.path.join(self.output_dir, "cf_tfjs")
            self._convert_to_tfjs(cf_dir, tfjs_cf, cf_model.model)
            results["cf_tfjs"] = tfjs_cf
        except Exception as e:
            self.logger.warning(f"  ⚠️  CF TF.js export failed: {e}")
            results["cf_tfjs"] = f"FAILED: {e}"

        # 2. Behavioral Model → SavedModel → TF.js
        self.logger.info("\n  📦 [2/2] Exporting Behavioral Analytics...")
        ba_dir = os.path.join(self.output_dir, "ba_model")
        tf.saved_model.save(ba_model.model, ba_dir)
        results["ba_savedmodel"] = ba_dir
        self.logger.info(f"  ✅ BA SavedModel: {ba_dir}")

        try:
            tfjs_ba = os.path.join(self.output_dir, "ba_tfjs")
            self._convert_to_tfjs(ba_dir, tfjs_ba, ba_model.model)
            results["ba_tfjs"] = tfjs_ba
        except Exception as e:
            self.logger.warning(f"  ⚠️  BA TF.js export failed: {e}")
            results["ba_tfjs"] = f"FAILED: {e}"

        # 3. Metadata
        meta_path = os.path.join(self.output_dir, "metadata.json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        results["metadata"] = meta_path
        self.logger.info(f"  ✅ Metadata: {meta_path}")

        return results

    def _convert_to_tfjs(self, saved_model_dir, output_dir, keras_model=None):
        """Convert SavedModel → TF.js LayersModel."""
        try:
            import tensorflowjs as tfjs
            os.makedirs(output_dir, exist_ok=True)
            if keras_model is not None:
                tfjs.converters.save_keras_model(keras_model, output_dir)
            else:
                tfjs.converters.convert_tf_saved_model(
                    saved_model_dir, output_dir)
            self.logger.info(f"  ✅ TF.js: {output_dir}")
        except (ImportError, Exception) as e:
            # Fallback: save as Keras .keras format
            self.logger.info(f"  ℹ️  TF.js conversion unavailable ({e}), saving .keras format")
            os.makedirs(output_dir, exist_ok=True)
            keras_path = os.path.join(output_dir, "model.keras")
            if keras_model is not None:
                keras_model.save(keras_path)
            self.logger.info(f"  ✅ Keras (convert to tfjs later): {keras_path}")


# ─────────────────────────────────────────────
# 6. WEB DEMO GENERATOR
# ─────────────────────────────────────────────
def generate_web_demo(output_dir: str, sample_recs: List[Dict], logger):
    """Tạo web demo HTML."""
    html_path = os.path.join(output_dir, "demo.html")
    # Generate JSON data for demo
    demo_data = json.dumps(sample_recs[:5], indent=2, ensure_ascii=False)

    html = f'''<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📚 Learning Behavior Analysis - Demo</title>
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ font-family:'Segoe UI',sans-serif; background:#0f172a; color:#e2e8f0; min-height:100vh; }}
.container {{ max-width:1200px; margin:0 auto; padding:20px; }}
h1 {{ text-align:center; padding:30px 0; font-size:2em;
     background:linear-gradient(135deg,#6366f1,#8b5cf6,#a78bfa);
     -webkit-background-clip:text; -webkit-text-fill-color:transparent; }}
.grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(350px,1fr)); gap:20px; }}
.card {{ background:#1e293b; border-radius:16px; padding:24px;
        border:1px solid #334155; transition:transform 0.2s; }}
.card:hover {{ transform:translateY(-2px); border-color:#6366f1; }}
.card h3 {{ color:#a78bfa; margin-bottom:12px; font-size:1.1em; }}
.badge {{ display:inline-block; padding:4px 12px; border-radius:20px;
         font-size:0.8em; font-weight:600; }}
.badge.high {{ background:#065f46; color:#6ee7b7; }}
.badge.medium {{ background:#1e3a5f; color:#93c5fd; }}
.badge.low {{ background:#78350f; color:#fbbf24; }}
.badge.at_risk {{ background:#7f1d1d; color:#fca5a5; }}
.stat {{ display:flex; justify-content:space-between; padding:8px 0;
        border-bottom:1px solid #334155; }}
.stat-label {{ color:#94a3b8; }}
.stat-value {{ color:#e2e8f0; font-weight:600; }}
.lesson-item {{ background:#0f172a; border-radius:8px; padding:12px;
               margin:8px 0; border-left:3px solid #6366f1; }}
.warning {{ padding:10px; border-radius:8px; margin:6px 0; }}
.warning.critical {{ background:#7f1d1d33; border:1px solid #991b1b; }}
.warning.warning {{ background:#78350f33; border:1px solid #92400e; }}
.warning.info {{ background:#1e3a5f33; border:1px solid #1d4ed8; }}
.progress {{ height:8px; background:#334155; border-radius:4px; overflow:hidden; }}
.progress-bar {{ height:100%; border-radius:4px;
                background:linear-gradient(90deg,#6366f1,#a78bfa); }}
</style>
</head>
<body>
<div class="container">
<h1>📚 Learning Behavior Analysis</h1>
<p style="text-align:center;color:#94a3b8;margin-bottom:30px;">
  AI-Powered Personalized Learning Recommendations
</p>
<div class="grid" id="cards"></div>
</div>
<script>
const data = {demo_data};
const el = document.getElementById("cards");
data.forEach(r => {{
  const eng = r.engagement;
  const warns = (r.warnings||[]).map(w =>
    `<div class="warning ${{w.type}}">${{w.icon}} ${{w.message}}</div>`).join("");
  const lessons = (r.next_lessons||[]).map(l =>
    `<div class="lesson-item">
      <strong>${{l.lesson_id}}</strong> - ${{l.subject}} (${{l.difficulty}})
      <span style="float:right;color:#a78bfa">${{l.predicted_score}}%</span>
    </div>`).join("");
  const weak = (r.weak_subjects||[]).map(w =>
    `<div style="padding:4px 0"><span style="color:#fbbf24">${{w.subject}}</span>: ${{w.avg_score}} - ${{w.suggestion}}</div>`).join("");
  const pct = Math.round((r.stats?.completion_rate||0)*100);
  el.innerHTML += `
  <div class="card">
    <h3>👤 ${{r.student_id}}</h3>
    <div style="margin:10px 0">
      Engagement: <span class="badge ${{eng.engagement}}">${{eng.engagement.toUpperCase()}}</span>
      <span style="color:#94a3b8;margin-left:8px">(${{(eng.confidence*100).toFixed(0)}}%)</span>
    </div>
    <div class="stat"><span class="stat-label">Điểm TB</span><span class="stat-value">${{r.stats?.avg_score||0}}</span></div>
    <div class="stat"><span class="stat-label">Hoàn thành</span><span class="stat-value">${{pct}}%</span></div>
    <div class="progress" style="margin:8px 0"><div class="progress-bar" style="width:${{pct}}%"></div></div>
    <div class="stat"><span class="stat-label">Độ khó phù hợp</span><span class="stat-value">${{r.recommended_difficulty}}</span></div>
    ${{warns ? '<h3 style="margin-top:16px">⚠️ Cảnh báo</h3>'+warns : ''}}
    <h3 style="margin-top:16px">📖 Bài học gợi ý</h3>
    ${{lessons}}
    ${{weak ? '<h3 style="margin-top:16px">📉 Môn yếu</h3>'+weak : ''}}
  </div>`;
}});
</script>
</body>
</html>'''

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    logger.info(f"  ✅ Web demo: {html_path}")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="📚 Learning Behavior Analysis - E-Learning AI")
    parser.add_argument("--demo", action="store_true",
                        help="Chạy demo hoàn chỉnh")
    parser.add_argument("--output-dir", default="output/learning_models")
    parser.add_argument("--data-dir", default="data/learning")
    parser.add_argument("--epochs", type=int, default=EPOCHS)
    parser.add_argument("--n-students", type=int, default=NUM_SYNTHETIC_STUDENTS)
    args = parser.parse_args()

    log_dir = os.path.join(args.data_dir, "logs")
    logger = setup_logging(log_dir)

    logger.info("📚" * 30)
    logger.info("📚  LEARNING BEHAVIOR ANALYSIS SYSTEM")
    logger.info(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("📚" * 30)

    # ── Step 1: Generate Data ──
    logger.info("\n" + "=" * 60)
    logger.info("📊 STEP 1: Tạo dữ liệu học tập")
    logger.info("=" * 60)

    gen = DataGenerator(n_students=args.n_students)
    data = gen.generate()
    logger.info(f"  ✅ Students: {len(data['students'])}")
    logger.info(f"  ✅ Lessons: {len(data['lessons'])}")
    logger.info(f"  ✅ Interactions: {len(data['interactions'])}")

    # Save data
    os.makedirs(args.data_dir, exist_ok=True)
    with open(os.path.join(args.data_dir, "dataset.json"), "w",
              encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # ── Step 2: Train CF Model ──
    logger.info("\n" + "=" * 60)
    logger.info("🤖 STEP 2: Train Collaborative Filtering")
    logger.info("=" * 60)

    cf = CollaborativeFilteringModel(
        n_students=args.n_students,
        n_lessons=len(data["lessons"]),
        logger=logger
    )
    cf.build()
    cf.train(data["interactions"], epochs=args.epochs)

    # ── Step 3: Train Behavioral Model ──
    logger.info("\n" + "=" * 60)
    logger.info("🧠 STEP 3: Train Behavioral Analytics")
    logger.info("=" * 60)

    ba = BehavioralAnalyticsModel(logger=logger)
    ba.build_and_train(data["students"], data["interactions"],
                       epochs=args.epochs)

    # ── Step 4: Generate Recommendations ──
    logger.info("\n" + "=" * 60)
    logger.info("💡 STEP 4: Gợi ý lộ trình học cá nhân hóa")
    logger.info("=" * 60)

    engine = RecommendationEngine(cf, ba, data["lessons"], logger=logger)

    # Group interactions by student
    student_ints = {}
    for x in data["interactions"]:
        student_ints.setdefault(x["student_id"], []).append(x)

    sample_recs = []
    students_only = [s for s in data["students"] if s["role"] == "student"]

    for s in students_only[:10]:  # Demo 10 students
        ints = student_ints.get(s["id"], [])
        rec = engine.recommend(s, ints)
        sample_recs.append(rec)

        eng_emoji = {"high": "🟢", "medium": "🔵",
                     "low": "🟡", "at_risk": "🔴"}
        logger.info(
            f"\n  👤 {s['id']} ({s['profile']}) "
            f"{eng_emoji.get(rec['engagement']['engagement'], '⚪')} "
            f"{rec['engagement']['engagement']} "
            f"| Score: {rec['stats']['avg_score']:.0f} "
            f"| Diff: {rec['recommended_difficulty']}"
        )
        for w in rec["warnings"]:
            logger.info(f"     {w['icon']} {w['message']}")
        for l in rec["next_lessons"][:3]:
            logger.info(
                f"     📖 {l['lesson_id']} {l['subject']:12s} "
                f"({l['difficulty']:8s}) → {l['predicted_score']:.0f}%"
            )

    # Save recommendations
    rec_path = os.path.join(args.output_dir, "sample_recommendations.json")
    os.makedirs(args.output_dir, exist_ok=True)
    with open(rec_path, "w", encoding="utf-8") as f:
        json.dump(sample_recs, f, indent=2, ensure_ascii=False, default=str)
    logger.info(f"\n  💾 Recommendations: {rec_path}")

    # ── Step 5: Export Models ──
    logger.info("\n" + "=" * 60)
    logger.info("📦 STEP 5: Export Models")
    logger.info("=" * 60)

    exporter = ModelExporter(output_dir=args.output_dir, logger=logger)
    metadata = {
        "timestamp": datetime.now().isoformat(),
        "system": "Learning Behavior Analysis",
        "models": {
            "collaborative_filtering": {
                "type": "Neural Collaborative Filtering",
                "n_students": args.n_students,
                "n_lessons": len(data["lessons"]),
                "embedding_dim": EMBEDDING_DIM,
            },
            "behavioral_analytics": {
                "type": "Engagement Prediction",
                "input_features": 10,
                "output_classes": ENGAGEMENT_LABELS,
            },
        },
        "subjects": SUBJECTS,
        "difficulty_levels": DIFFICULTY_LEVELS,
    }
    export_results = exporter.export_all(cf, ba, metadata)

    # ── Step 6: Web Demo ──
    logger.info("\n" + "=" * 60)
    logger.info("🌐 STEP 6: Web Demo")
    logger.info("=" * 60)
    generate_web_demo(args.output_dir, sample_recs, logger)

    # ── Summary ──
    logger.info("\n" + "🎉" * 30)
    logger.info("✅ LEARNING BEHAVIOR ANALYSIS - HOÀN TẤT!")
    logger.info("🎉" * 30)
    logger.info(f"\n  📂 Output: {args.output_dir}")
    logger.info(f"  📊 Data: {args.data_dir}")
    for k, v in export_results.items():
        logger.info(f"  📦 {k}: {v}")


if __name__ == "__main__":
    main()
