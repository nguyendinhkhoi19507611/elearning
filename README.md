# 🎓 E-Learning AI System

Hệ thống học trực tuyến thông minh tích hợp AI — nhận diện trạng thái học sinh, xác thực giọng nói, gợi ý khóa học.

## 📐 Kiến trúc

```
┌─────────────┐     ┌─────────────────┐     ┌────────────────────────────┐
│  Frontend   │────▶│  Backend API    │────▶│  AI Services (Python)      │
│  React/Vite │     │  Node/Express   │     │  ┌──────────────────────┐  │
│  :3000      │     │  :5000          │     │  │ Vision API    :5001  │  │
└─────────────┘     └────────┬────────┘     │  │ Voice API     :5002  │  │
                             │              │  │ Recommend API :5003  │  │
                      ┌──────▼──────┐       │  └──────────────────────┘  │
                      │  MongoDB    │       └────────────────────────────┘
                      │  :27017     │
                      └─────────────┘
```

## ⚙️ Yêu cầu

| Phần mềm      | Phiên bản  |
|----------------|------------|
| Node.js        | ≥ 18       |
| Python         | ≥ 3.10     |
| MongoDB        | ≥ 6        |
| pip            | latest     |
| Git            | latest     |

## 🚀 Cài đặt & Chạy

### 1. Clone & cấu trúc thư mục

```
elearning/
├── ai-services/        # Python FastAPI (Vision, Voice, Recommend)
├── backend/            # Node.js Express API
├── frontend/           # React Vite
├── docker-compose.yml
└── start.bat           # Script chạy tất cả (Windows)
```

### 2. Cài đặt dependencies

```bash
# Backend (Node.js)
cd elearning/backend
npm install

# Frontend (React)
cd elearning/frontend
npm install

# AI Services (Python)
cd elearning/ai-services
pip install -r requirements.txt
```

### 3. Cấu hình

File `backend/.env` (đã có sẵn):

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/elearning
JWT_SECRET=elearning_ai_secret_key_2026
JWT_EXPIRES_IN=7d
AI_VISION_URL=http://localhost:5001
AI_VOICE_URL=http://localhost:5002
AI_RECOMMEND_URL=http://localhost:5003
UPLOAD_DIR=./uploads
```

### 4. Chuẩn bị YOLO model

Vision API cần file YOLO model tại:

```
D:\AI\output\models\student_state_best.pt
```

Nếu không có, hệ thống sẽ tự dùng `yolo11n.pt` (tải từ internet lần đầu).

Để thay đổi đường dẫn:

```bash
set YOLO_MODEL_PATH=path/to/your/model.pt
```

### 5. Khởi động MongoDB

```bash
# Cách 1: Chạy trực tiếp
mongod

# Cách 2: Docker
docker run -d -p 27017:27017 --name mongo mongo:7
```

### 6. Chạy từng service

Mở **5 terminal riêng biệt**, chạy theo thứ tự:

**Terminal 1 — AI Vision Service (port 5001):**
```bash
cd elearning/ai-services
python vision_api.py
```

**Terminal 2 — AI Voice Service (port 5002):**
```bash
cd elearning/ai-services
python voice_api.py
```

**Terminal 3 — AI Recommendation Service (port 5003):**
```bash
cd elearning/ai-services
python recommendation_api.py
```

**Terminal 4 — Backend API (port 5000):**
```bash
cd elearning/backend
node server.js
```

**Terminal 5 — Frontend (port 3000):**
```bash
cd elearning/frontend
npx vite --port 3000
```

### 7. Chạy nhanh (Windows)

```bash
cd elearning
start.bat
```

Script tự động cài dependencies, khởi động tất cả services và mở 5 terminal.

### 8. Chạy bằng Docker Compose

```bash
cd elearning
docker-compose up -d
```

## 🌐 Truy cập

| Service            | URL                          |
|--------------------|------------------------------|
| **Frontend**       | http://localhost:3000         |
| **Backend API**    | http://localhost:5000/api     |
| **AI Vision**      | http://localhost:5001/health  |
| **AI Voice**       | http://localhost:5002/health  |
| **AI Recommend**   | http://localhost:5003/health  |

## 👤 Tài khoản mặc định

Đăng ký tài khoản mới tại http://localhost:3000/register

| Role     | Tạo tại        |
|----------|----------------|
| student  | Trang đăng ký  |
| teacher  | Trang đăng ký  |
| admin    | Trang đăng ký  |

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

### AI
```
POST   /api/ai/vision/detect-base64   # Nhận diện trạng thái (webcam)
POST   /api/ai/recommend              # Gợi ý khóa học
POST   /api/ai/engagement             # Phân tích mức độ tập trung
```

### AI Services (trực tiếp)
```
GET    /health                     # Kiểm tra service
POST   /detect/base64              # Vision: detect từ base64
POST   /enroll                     # Voice: đăng ký voiceprint
POST   /identify                   # Voice: nhận diện giọng nói
POST   /verify                     # Voice: xác minh 1:1
GET    /users                      # Voice: danh sách users
```

## 🤖 Tính năng AI

### 1. Vision — Nhận diện trạng thái học sinh
- **YOLO + OpenCV hybrid**: YOLO phát hiện chính, OpenCV fallback
- **5 trạng thái**: Tập trung, Mất tập trung, Buồn ngủ, Vắng mặt, Dùng điện thoại
- Phát hiện khuôn mặt (frontal + profile), mắt mở/nhắm, hướng đầu

### 2. Voice — Xác thực giọng nói
- **ECAPA-TDNN** embedding (SpeechBrain)
- Đăng ký voiceprint (5 mẫu × 5 giây)
- Đăng nhập bằng giọng nói (1:N identification)
- Xác minh danh tính 1:1

### 3. Recommendation — Gợi ý khóa học
- Phân tích lịch sử học tập
- Gợi ý cá nhân hóa

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
→ Hệ thống tự dùng model mặc định. Để dùng model custom, đặt file `.pt` đúng đường dẫn.

### AI Service port đã bị chiếm
```bash
# Kiểm tra port
netstat -ano | findstr :5001
# Kill process
taskkill /PID <PID> /F
```

### Python module not found
```bash
pip install -r ai-services/requirements.txt
```

### Frontend không kết nối Backend
Kiểm tra Backend đang chạy tại port 5000 và file `frontend/src/api/api.js` trỏ đúng URL.

## 📊 Tech Stack

| Layer      | Công nghệ                                      |
|------------|------------------------------------------------|
| Frontend   | React 18, Vite 5, Chart.js, Socket.IO Client  |
| Backend    | Node.js, Express, Mongoose, JWT, Socket.IO     |
| Database   | MongoDB 7                                      |
| AI Vision  | YOLO (Ultralytics), OpenCV, FastAPI            |
| AI Voice   | ECAPA-TDNN (SpeechBrain), librosa, FastAPI     |
| AI Recommend | TensorFlow, scikit-learn, FastAPI            |
