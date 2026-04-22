# 🎓 E-Learning AI System

Hệ thống học trực tuyến thông minh tích hợp AI — nhận diện trạng thái học sinh, xác thực giọng nói, nhận diện khuôn mặt, gợi ý khóa học.

## 📐 Kiến trúc

```
┌─────────────┐     ┌─────────────────┐     ┌────────────────────────────┐
│  Frontend   │────▶│  Backend API    │────▶│  AI Services (Python)      │
│  React/Vite │     │  Node/Express   │     │  ┌──────────────────────┐  │
│  :3000      │     │  :5000          │     │  │ Vision API    :5001  │  │
└─────────────┘     └────────┬────────┘     │  │ Voice API     :5002  │  │
                             │              │  │ Recommend API :5003  │  │
                      ┌──────▼──────┐       │  │ Face API      :5004  │  │
                      │  MongoDB    │       │  └──────────────────────┘  │
                      │  :27017     │       └────────────────────────────┘
                      └─────────────┘
```

## ⚙️ Yêu cầu

| Phần mềm      | Phiên bản  |
|----------------|------------|
| Python         | 3.10+      |
| Node.js        | 18+        |
| MongoDB        | 6+         |
| pip            | latest     |
| Git            | latest     |

## � Cấu trúc dự án

```
D:\AI\
├── assets/                     # Video nguồn để train
│   └── video.MOV
├── extract_frames.py           # Bước 1: Trích xuất frames từ video
├── auto_label.py               # Bước 2: Auto-labeling bằng YOLO
├── train_model.py              # Bước 3: Train YOLO custom model
├── export_tfjs.py              # Export model sang TF.js/ONNX
├── voice_auth.py               # Voice Authentication module
├── learning_behavior.py        # Learning Behavior Analysis module
├── yolo11n.pt                  # YOLO pretrained model
├── output/
│   ├── frames/                 # Frames trích xuất
│   ├── labeled/dataset/        # Dataset YOLO format
│   │   └── data.yaml
│   ├── models/                 # Trained models (.pt, .onnx)
│   │   └── student_state_best.pt
│   └── learning_models/        # CF + Behavioral models
├── data/
│   ├── voice/                  # Voiceprint database
│   ├── learning/               # Learning behavior data
│   └── faces/                  # Face recognition data
├── models/
│   └── voice/                  # ECAPA-TDNN model cache
│
└── elearning/                  # ← Web Application
    ├── ai-services/            # Python FastAPI (Vision, Voice, Recommend, Face)
    │   ├── vision_api.py       # Port 5001
    │   ├── voice_api.py        # Port 5002
    │   ├── recommendation_api.py # Port 5003
    │   ├── face_api.py         # Port 5004
    │   └── requirements.txt
    ├── backend/                # Node.js Express API (Port 5000)
    │   ├── server.js
    │   ├── package.json
    │   └── .env
    ├── frontend/               # React Vite (Port 3000)
    │   ├── package.json
    │   └── vite.config.js
    ├── docker-compose.yml
    ├── start.bat               # Script chạy tất cả (Windows)
    └── README.md               # ← File này
```

---

## 🚀 Cài đặt

### 1. Tạo Virtual Environment & cài thư viện Python

```bash
cd D:\AI

# Tạo virtual environment
python -m venv .venv

# Kích hoạt (Windows)
.venv\Scripts\activate

# Cài đặt tất cả thư viện
pip install -r elearning/ai-services/requirements.txt
```

### 2. Cài đặt Node.js dependencies

```bash
# Backend
cd D:\AI\elearning\backend
npm install

# Frontend
cd D:\AI\elearning\frontend
npm install
```

---

## 🧠 Train Models

> **Lưu ý**: Tất cả lệnh train đều chạy từ thư mục `D:\AI` với `.venv` đã kích hoạt.

### Model 1: AI Vision — Nhận diện trạng thái học sinh (YOLO)

Pipeline gồm 3 bước:

#### Bước 1: Trích xuất frames từ video

```bash
cd D:\AI
python extract_frames.py --video assets/video.MOV --output output/frames
```

Tùy chọn:
```bash
# Giới hạn 3000 frames, sample mỗi 3 frames
python extract_frames.py --video assets/video.MOV --output output/frames --target 3000 --sample-rate 3

# Chạy nhanh (giảm chất lượng lọc)
python extract_frames.py --ssim-threshold 0.85 --hash-threshold 8

# Dọn dẹp files intermediate
python extract_frames.py --cleanup
```

Pipeline tự động:
1. Phase 1: Trích xuất raw frames từ video (OpenCV)
2. Phase 2: Loại bỏ frames trùng lặp (Perceptual Hashing)
3. Phase 3: Loại bỏ frames gần giống (SSIM)
4. Phase 4: Chọn top frames chất lượng cao

Output: `output/frames/03_final_frames/`

#### Bước 2: Auto-labeling

```bash
python auto_label.py --input output/frames/03_final_frames --output output/labeled
```

Tùy chọn:
```bash
# Dùng model lớn hơn (chính xác hơn)
python auto_label.py --model yolo11m.pt

# Thay đổi confidence threshold
python auto_label.py --conf 0.35 --label-conf 0.40

# Custom train/val/test split
python auto_label.py --train-ratio 0.7 --val-ratio 0.15
```

Sử dụng YOLO pretrained → detect person + classify trạng thái bằng heuristic rules:
- 0: `focused` — Tập trung
- 1: `distracted` — Mất tập trung
- 2: `drowsy` — Buồn ngủ
- 3: `absent` — Vắng mặt
- 4: `phone_usage` — Dùng điện thoại

Output: `output/labeled/dataset/` (chuẩn YOLO format + `data.yaml`)

#### Bước 3: Train YOLO model

```bash
python train_model.py --data output/labeled/dataset/data.yaml
```

Tùy chọn:
```bash
# Training với model lớn hơn
python train_model.py --model yolo11s.pt --epochs 150

# Custom epochs và batch size
python train_model.py --epochs 200 --batch 8 --imgsz 640

# Training trên GPU cụ thể
python train_model.py --device 0

# Chỉ export (skip training)
python train_model.py --export-only --weights output/training/student_state_v1/weights/best.pt
```

Model sizes:
| Model          | Params  | Tốc độ     |
|----------------|---------|------------|
| `yolo11n.pt`   | ~2.6M   | Nhanh nhất |
| `yolo11s.pt`   | ~9.4M   | Nhanh      |
| `yolo11m.pt`   | ~20.1M  | Trung bình |
| `yolo11l.pt`   | ~25.3M  | Chậm       |
| `yolo11x.pt`   | ~56.9M  | Chính xác nhất |

Output:
- `output/models/student_state_best.pt` — Best model (PyTorch)
- `output/models/student_state_best.onnx` — ONNX format
- `output/training/student_state_v1/` — Training logs & plots

#### Export sang TF.js (tùy chọn)

```bash
python export_tfjs.py
```

---

### Model 2: Voice Authentication — Xác thực giọng nói (ECAPA-TDNN)

```bash
cd D:\AI

# Chạy demo hoàn chỉnh (tạo data mẫu + enrollment + verification)
python voice_auth.py --demo
```

Các chế độ khác:
```bash
# Đăng ký giọng nói từ microphone
python voice_auth.py --enroll --user-id SV001 --name "Nguyen Van A" --role student

# Đăng ký từ file audio
python voice_auth.py --enroll --user-id SV001 --name "Nguyen Van A" --role student --audio-dir data/voice/samples/SV001

# Xác minh danh tính (microphone)
python voice_auth.py --verify --user-id SV001

# Xác minh từ file
python voice_auth.py --verify --user-id SV001 --audio-file test.wav

# Nhận diện (ai đang nói?)
python voice_auth.py --identify --audio-file test.wav

# Liệt kê users đã đăng ký
python voice_auth.py --list
```

Output:
- `data/voice/voiceprint_db.json` — Database voiceprint
- `data/voice/voice_auth_report.json` — Report
- `models/voice/ecapa-tdnn/` — ECAPA-TDNN model (tải tự động lần đầu)

---

### Model 3: Learning Behavior — Gợi ý khóa học (TensorFlow)

```bash
cd D:\AI

# Chạy demo hoàn chỉnh
python learning_behavior.py --demo
```

Tùy chọn:
```bash
# Custom output
python learning_behavior.py --demo --output-dir output/learning_models --data-dir data/learning

# Thay đổi epochs và số students
python learning_behavior.py --demo --epochs 50 --n-students 200
```

Pipeline tự động:
1. Tạo dữ liệu học tập giả lập (200 students, 50 lessons)
2. Train Collaborative Filtering model (Neural Matrix Factorization)
3. Train Behavioral Analytics model (Engagement Prediction)
4. Gợi ý lộ trình cá nhân hóa
5. Export models (SavedModel + TF.js)
6. Tạo web demo

Output:
- `output/learning_models/` — Các models đã train
- `data/learning/dataset.json` — Dataset
- `output/learning_models/demo.html` — Web demo

---

## 🖥️ Chạy hệ thống

### Cấu hình `.env`

File `elearning/backend/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/elearning
JWT_SECRET=elearning_ai_secret_key_2026
JWT_EXPIRES_IN=7d
AI_VISION_URL=http://localhost:5001
AI_VOICE_URL=http://localhost:5002
AI_RECOMMEND_URL=http://localhost:5003
AI_FACE_URL=http://localhost:5004
UPLOAD_DIR=./uploads

# Email SMTP (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME=EduAI Platform
```

### Khởi động MongoDB

```bash
# Cách 1: Chạy trực tiếp
mongod

# Cách 2: Docker
docker run -d -p 27017:27017 --name mongo mongo:7
```

### Chạy từng service (6 terminal)

Kích hoạt `.venv` trước khi chạy các AI services:

**Terminal 1 — AI Vision Service (port 5001):**
```bash
cd D:\AI
.venv\Scripts\activate
cd elearning\ai-services
python vision_api.py
```

**Terminal 2 — AI Voice Service (port 5002):**
```bash
cd D:\AI
.venv\Scripts\activate
cd elearning\ai-services
python voice_api.py
```

**Terminal 3 — AI Recommendation Service (port 5003):**
```bash
cd D:\AI
.venv\Scripts\activate
cd elearning\ai-services
python recommendation_api.py
```

**Terminal 4 — AI Face Service (port 5004):**
```bash
cd D:\AI
.venv\Scripts\activate
cd elearning\ai-services
python face_api.py
```

**Terminal 5 — Backend API (port 5000):**
```bash
cd D:\AI\elearning\backend
node server.js
```

**Terminal 6 — Frontend (port 3000, HTTPS):**
```bash
cd D:\AI\elearning\frontend
npx vite --port 3000 --host 0.0.0.0
```

### Chạy nhanh (Windows)

```bash
cd D:\AI\elearning
start.bat
```

### Chạy bằng Docker Compose

```bash
cd D:\AI\elearning
docker-compose up -d
```

---

## 🌐 Truy cập

| Service            | URL                          |
|--------------------|------------------------------|
| **Frontend**       | https://localhost:3000        |
| **Backend API**    | http://localhost:5000/api     |
| **AI Vision**      | http://localhost:5001/health  |
| **AI Voice**       | http://localhost:5002/health  |
| **AI Recommend**   | http://localhost:5003/health  |
| **AI Face**        | http://localhost:5004/health  |

## 👤 Tài khoản

Đăng ký tài khoản mới tại https://localhost:3000/register

| Role     | Mô tả         |
|----------|----------------|
| student  | Sinh viên      |
| teacher  | Giáo viên      |
| admin    | Quản trị viên  |

## 📁 API Endpoints

### Auth
```
POST   /api/auth/register          # Đăng ký
POST   /api/auth/login             # Đăng nhập email/password
POST   /api/auth/voice-login       # Đăng nhập giọng nói
POST   /api/auth/voice-register    # Đăng ký voiceprint (cần auth)
GET    /api/auth/me                # Thông tin user hiện tại
```

### Courses
```
GET    /api/courses                # Danh sách khóa học
POST   /api/courses                # Tạo khóa học (teacher)
PUT    /api/courses/:id            # Cập nhật
DELETE /api/courses/:id            # Xóa
```

### Classrooms
```
GET    /api/classrooms             # Danh sách lớp học
POST   /api/classrooms             # Tạo lớp học
```

### AI
```
POST   /api/ai/vision/detect-base64   # Nhận diện trạng thái (webcam)
POST   /api/ai/recommend              # Gợi ý khóa học
POST   /api/ai/engagement             # Phân tích mức độ tập trung
```

### Attendance
```
GET    /api/attendance             # Danh sách điểm danh
POST   /api/attendance             # Điểm danh
```

### Assignments
```
GET    /api/assignments            # Danh sách bài tập
POST   /api/assignments            # Tạo bài tập
```

### AI Services (trực tiếp)
```
# Vision (:5001)
GET    /health                     # Kiểm tra service
POST   /detect                     # Detect từ file upload
POST   /detect/base64              # Detect từ base64 webcam
GET    /classes                    # Danh sách classes

# Voice (:5002)
GET    /health
POST   /enroll                     # Đăng ký voiceprint (3+ audio files)
POST   /verify                     # Xác minh 1:1
POST   /identify                   # Nhận diện 1:N
GET    /users                      # Danh sách users

# Recommendation (:5003)
GET    /health
POST   /recommend                  # Gợi ý khóa học
POST   /analyze-engagement         # Phân tích engagement
GET    /subjects                   # Danh sách môn học
GET    /lessons                    # Danh sách bài học

# Face (:5004)
GET    /health
POST   /enroll                     # Đăng ký khuôn mặt (1+ ảnh)
POST   /verify                     # Xác thực khuôn mặt 1:1
POST   /verify-base64              # Xác thực từ webcam (base64)
POST   /identify                   # Nhận diện 1:N
GET    /users                      # Danh sách users
GET    /users/:id/faces            # Lấy ảnh khuôn mặt đã đăng ký
```

## 🤖 Tính năng AI

### 1. Vision — Nhận diện trạng thái học sinh
- **YOLO + OpenCV hybrid**: YOLO phát hiện chính, OpenCV fallback
- **5 trạng thái**: Tập trung, Mất tập trung, Buồn ngủ, Vắng mặt, Dùng điện thoại
- Phát hiện khuôn mặt (frontal + profile), mắt mở/nhắm, hướng đầu

### 2. Voice — Xác thực giọng nói
- **ECAPA-TDNN** embedding (SpeechBrain/VoxCeleb)
- Đăng ký voiceprint (3+ mẫu audio)
- Đăng nhập bằng giọng nói (1:N identification)
- Xác minh danh tính 1:1

### 3. Face — Nhận diện khuôn mặt
- **DeepFace** + **ArcFace** model
- **RetinaFace** detector (chính xác cao)
- Đăng ký khuôn mặt từ webcam/ảnh
- Xác thực điểm danh tự động

### 4. Recommendation — Gợi ý khóa học
- **Collaborative Filtering** (Neural Matrix Factorization)
- **Behavioral Analytics** (Engagement Prediction)
- Gợi ý bài học cá nhân hóa
- Cảnh báo học sinh có nguy cơ

## 🔧 Xử lý lỗi thường gặp

### MongoDB connection refused
```bash
# Kiểm tra MongoDB đang chạy
mongod --version
# Hoặc khởi động lại
net start MongoDB
```

### YOLO model not found
```
⚠️ Model not found: .../student_state_best.pt, using yolo11n.pt
```
→ Hệ thống tự dùng model mặc định. Chạy `train_model.py` để train model custom.

### Port đã bị chiếm
```bash
netstat -ano | findstr :5001
taskkill /PID <PID> /F
```

### Python module not found
```bash
cd D:\AI
.venv\Scripts\activate
pip install -r elearning/ai-services/requirements.txt
```

### Frontend không kết nối Backend
Kiểm tra Backend đang chạy tại port 5000. File `frontend/vite.config.js` cấu hình proxy target — thay IP nếu cần.

## 📊 Tech Stack

| Layer          | Công nghệ                                              |
|----------------|---------------------------------------------------------|
| Frontend       | React 18, Vite 5, Chart.js, Socket.IO Client, Redux    |
| Backend        | Node.js, Express, Mongoose, JWT, Socket.IO              |
| Database       | MongoDB 7                                               |
| AI Vision      | YOLO 11 (Ultralytics 8.4), OpenCV 4.13, FastAPI         |
| AI Voice       | ECAPA-TDNN (SpeechBrain 1.0), librosa 0.11, FastAPI     |
| AI Face        | DeepFace 0.0.99, ArcFace, RetinaFace, FastAPI            |
| AI Recommend   | TensorFlow 2.19, scikit-learn 1.3, FastAPI               |
| Python Runtime | Python 3.10+, PyTorch 2.2, CUDA (tùy chọn)              |
