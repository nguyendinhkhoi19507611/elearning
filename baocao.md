# BÁO CÁO CHUYÊN ĐỀ TỐT NGHIỆP

## HỆ THỐNG E-LEARNING TÍCH HỢP TRÍ TUỆ NHÂN TẠO

---

## KẾ HOẠCH THỰC HIỆN

**Thời gian:** 21/3/2026 – 16/5/2026

| Tuần | Nội dung công việc | Chi tiết thực hiện |
|:---:|---|---|
| **1, 2, 3** | Khảo sát đề tài, hoàn thiện giao diện dự kiến | - Khảo sát các hệ thống e-learning hiện có (Google Classroom, Zoom, MS Teams) để tham khảo tính năng và giao diện.<br>- Phân tích yêu cầu chức năng: quản lý người dùng, lớp học trực tuyến, điểm danh AI, gợi ý lộ trình.<br>- Thiết kế wireframe/mockup giao diện cho 3 vai trò: Admin, Giáo viên, Sinh viên.<br>- Thiết kế cơ sở dữ liệu MongoDB (ERD), xác định các collection và mối quan hệ.<br>- Dựng project frontend (React + Vite) và backend (Express + MongoDB). |
| **4, 5** | Tìm hiểu và ứng dụng AI | - Nghiên cứu mô hình YOLO (You Only Look Once) cho bài toán nhận diện trạng thái khuôn mặt sinh viên (tập trung, mất tập trung, buồn ngủ, vắng mặt, sử dụng điện thoại).<br>- Nghiên cứu OpenCV Haar Cascades (frontalface, profileface, eye) để phân tích chi tiết khuôn mặt (hướng nhìn, mắt mở/nhắm, nghiêng đầu).<br>- Tìm hiểu TensorFlow/Keras cho mô hình Neural Collaborative Filtering (NCF) – gợi ý bài học dựa trên lịch sử tương tác.<br>- Tìm hiểu mô hình Behavioral Analytics (DNN Classifier) – phân tích hành vi và dự đoán mức độ gắn kết học tập.<br>- Nghiên cứu SpeechBrain cho nhận dạng giọng nói (Voice Authentication).<br>- Huấn luyện và đánh giá từng mô hình AI trên tập dữ liệu mẫu. |
| **6** | Tích hợp AI vào hệ thống | - Xây dựng 3 microservice AI bằng FastAPI (Python): Vision API (port 5001), Voice API (port 5002), Recommendation API (port 5003).<br>- Tích hợp AI Vision vào phòng học trực tuyến: gửi frame webcam qua base64, nhận trạng thái sinh viên realtime qua Socket.IO.<br>- Tích hợp AI Recommendation vào dashboard sinh viên: hiển thị bài học gợi ý, cảnh báo, môn yếu.<br>- Tích hợp Voice Authentication vào hệ thống đăng ký/xác thực giọng nói.<br>- Kết nối WebRTC cho video call peer-to-peer trong phòng học. |
| **7** | Kiểm thử hệ thống | - Kiểm thử chức năng đăng nhập, phân quyền (Admin / Giáo viên / Sinh viên).<br>- Kiểm thử tạo/xóa/sửa lớp học, quản lý người dùng, khóa tài khoản.<br>- Kiểm thử phòng học trực tuyến: video call, chat, chia sẻ màn hình, bật/tắt camera/mic.<br>- Kiểm thử AI Vision: accuracy nhận diện trạng thái, hiển thị cảnh báo cho giáo viên.<br>- Kiểm thử AI Recommendation: kết quả gợi ý có phù hợp với profile sinh viên không.<br>- Kiểm thử responsive trên các thiết bị: desktop (Chrome, Firefox), mobile (iOS Safari, Android Chrome).<br>- Sửa lỗi và tối ưu hiệu năng. |
| **8** | Hoàn thiện tài liệu, chuẩn bị báo cáo môn Chuyên đề tốt nghiệp | - Viết báo cáo: mô hình AI, giao diện, kiến trúc hệ thống, so sánh và đánh giá kết quả.<br>- Chuẩn bị slide trình bày, demo hệ thống trực tiếp.<br>- Kiểm tra lần cuối và nộp sản phẩm hoàn chỉnh.<br>- Quay video demo các tính năng chính. |

---

## CÔNG NGHỆ SỬ DỤNG

### 1. Ngôn ngữ lập trình
- **JavaScript (Node.js)** — Backend xử lý API, xác thực, quản lý dữ liệu.
- **JavaScript (React)** — Frontend giao diện người dùng SPA.
- **Python** — Backend xử lý AI (nhận diện khuôn mặt, phân tích hành vi, giọng nói).

### 2. Cơ sở dữ liệu
- **MongoDB (NoSQL)** — Giúp lưu trữ dữ liệu người dùng và tài liệu học tập có cấu trúc linh hoạt, dễ dàng mở rộng. Sử dụng Mongoose ODM để thao tác dữ liệu.

### 3. Thư viện xử lý dữ liệu & AI

| Thư viện | Phiên bản | Mục đích |
|---|---|---|
| **TensorFlow / Keras** | ≥ 2.15.0 | Xây dựng và huấn luyện mô hình Neural Collaborative Filtering (NCF) và Behavioral Analytics (DNN Classifier) |
| **Ultralytics (YOLOv11)** | ≥ 8.0.0 | Nhận diện trạng thái sinh viên từ webcam (focused, distracted, drowsy, absent, phone_usage) |
| **OpenCV** | ≥ 4.8.0 | Phân tích khuôn mặt bằng Haar Cascades (frontalface, profileface, eye), xử lý ảnh |
| **PyTorch** | ≥ 2.0.0 | Backend engine cho YOLO và SpeechBrain |
| **SpeechBrain** | ≥ 1.0.0 | Nhận dạng và xác thực giọng nói (Voice Authentication) |
| **Librosa** | ≥ 0.10.0 | Trích xuất đặc trưng âm thanh (MFCC, spectrogram) |
| **Scikit-learn** | ≥ 1.3.0 | Chuẩn hóa dữ liệu (MinMaxScaler), mã hóa nhãn (LabelEncoder), chia tập train/test |
| **NumPy** | ≥ 1.24.0 | Tính toán ma trận, xử lý dữ liệu |
| **Pillow** | ≥ 10.0.0 | Xử lý ảnh đầu vào |
| **FastAPI** | 0.104.1 | Framework API cho các microservice AI |
| **Uvicorn** | 0.24.0 | ASGI server chạy FastAPI |

### 4. Thư viện Giao diện (Frontend)

| Thư viện | Phiên bản | Mục đích |
|---|---|---|
| **React** | ^18.2.0 | Core UI framework, xây dựng giao diện SPA |
| **React DOM** | ^18.2.0 | Render React component vào DOM trình duyệt |
| **React Router DOM** | ^6.21.0 | Điều hướng trang (routing SPA) |
| **Redux Toolkit** | ^2.11.2 | Quản lý state toàn cục (sidebar, theme, UI) |
| **React Redux** | ^9.2.0 | Kết nối Redux store với React components |
| **Axios** | ^1.6.2 | HTTP client gọi API tới backend |
| **Socket.IO Client** | ^4.7.2 | WebSocket realtime (phòng họp, chat, AI monitoring) |
| **React Icons** | ^4.12.0 | Bộ icon (Feather Icons, Font Awesome...) |
| **Chart.js** | ^4.4.1 | Vẽ biểu đồ thống kê trên dashboard |
| **React-Chartjs-2** | ^5.2.0 | Wrapper Chart.js cho React |
| **React Hot Toast** | ^2.4.1 | Hiển thị thông báo toast popup |

### 5. Thư viện Backend (Node.js)

| Thư viện | Phiên bản | Mục đích |
|---|---|---|
| **Express** | ^4.18.2 | Web framework xử lý API REST |
| **Mongoose** | ^8.0.3 | ODM kết nối và thao tác MongoDB |
| **Socket.IO** | ^4.7.2 | WebSocket server cho realtime (meeting, signaling WebRTC) |
| **JSON Web Token (JWT)** | ^9.0.2 | Xác thực người dùng bằng token |
| **bcryptjs** | ^2.4.3 | Mã hóa mật khẩu (hash + salt) |
| **Multer** | ^1.4.5 | Upload file (ảnh, audio) |
| **CORS** | ^2.8.5 | Cho phép Cross-Origin request |
| **Helmet** | ^7.1.0 | Bảo mật HTTP headers |
| **Express Rate Limit** | ^7.1.4 | Giới hạn số request để chống tấn công DOS |
| **Morgan** | ^1.10.0 | Ghi log HTTP request |

### 6. Môi trường phát triển

| Công cụ | Mục đích |
|---|---|
| **Visual Studio Code** | IDE chính để viết code frontend, backend, AI |
| **MongoDB Compass** | Quản lý và xem dữ liệu MongoDB (GUI) |
| **Postman** | Test API endpoints |
| **Draw.io** | Vẽ sơ đồ ERD, luồng xử lý AI |
| **Vite** (v5.0.8) | Build tool & dev server cho React (nhanh hơn Webpack) |
| **Nodemon** (v3.0.2) | Tự động restart backend khi code thay đổi |
| **Git / GitHub** | Quản lý phiên bản mã nguồn |
| **Chrome DevTools** | Debug frontend, kiểm tra WebRTC, Console log |

---

## THIẾT KẾ CƠ SỞ DỮ LIỆU

### Sơ đồ quan hệ thực thể (ERD)

> File ERD dạng draw.io: **erd_elearning.xml** (mở bằng draw.io)

### Mô tả các Collection (MongoDB)

#### 1. Collection: `users`
Lưu thông tin tất cả người dùng trong hệ thống.

| Trường | Kiểu dữ liệu | Mô tả |
|---|---|---|
| _id | ObjectId | Khóa chính (tự động tạo) |
| name | String | Họ tên người dùng |
| email | String (unique) | Email đăng nhập |
| password | String (hashed) | Mật khẩu đã mã hóa bcrypt |
| role | Enum: student / teacher / admin | Vai trò trong hệ thống |
| avatar | String | Đường dẫn ảnh đại diện |
| voiceRegistered | Boolean | Đã đăng ký giọng nói chưa |
| voiceId | String | ID liên kết với Voice AI Service |
| preferredSubjects | [String] | Danh sách môn học yêu thích |
| enrolledCourses | [ObjectId → Course] | Khóa học đã đăng ký |
| stats.totalStudyMin | Number | Tổng số phút đã học |
| stats.loginCount | Number | Số lần đăng nhập |
| stats.avgScore | Number | Điểm trung bình |
| stats.lastActive | Date | Lần hoạt động cuối |
| stats.engagementLevel | Enum: high / medium / low / at_risk | Mức độ gắn kết (AI dự đoán) |
| isActive | Boolean | Tài khoản có bị khóa không |
| createdAt / updatedAt | Date | Timestamp tự động |

#### 2. Collection: `classrooms`
Lưu thông tin lớp học và trạng thái phòng họp.

| Trường | Kiểu dữ liệu | Mô tả |
|---|---|---|
| _id | ObjectId | Khóa chính |
| name | String | Tên lớp học |
| subject | String | Môn học |
| description | String | Mô tả lớp học |
| teacher | ObjectId → User | Giáo viên phụ trách |
| students | [ObjectId → User] | Danh sách sinh viên |
| schedule.dayOfWeek | [Number: 0-6] | Ngày học trong tuần (0=CN, 1=T2...) |
| schedule.startTime | String | Giờ bắt đầu (VD: "08:00") |
| schedule.endTime | String | Giờ kết thúc (VD: "10:00") |
| meeting.isLive | Boolean | Lớp đang diễn ra không |
| meeting.startedAt | Date | Thời điểm bắt đầu meeting |
| meeting.endedAt | Date | Thời điểm kết thúc meeting |
| meeting.participants | [Embedded] | Danh sách người tham gia (user, role, joinedAt, camera, mic) |
| settings.cameraRequired | Boolean | Yêu cầu bật camera |
| settings.aiMonitoring | Boolean | Bật giám sát AI |
| settings.maxStudents | Number | Số sinh viên tối đa |
| isActive | Boolean | Lớp có bị xóa (soft delete) |
| createdBy | ObjectId → User | Người tạo lớp |

#### 3. Collection: `courses`
Lưu thông tin khóa học / bài giảng.

| Trường | Kiểu dữ liệu | Mô tả |
|---|---|---|
| _id | ObjectId | Khóa chính |
| title | String | Tên khóa học |
| description | String | Mô tả |
| subject | String | Môn học |
| difficulty | Enum: easy / medium / hard / advanced | Độ khó |
| teacher | ObjectId → User | Giáo viên tạo |
| students | [ObjectId → User] | Sinh viên đăng ký |
| maxStudents | Number | Giới hạn sinh viên |
| isActive | Boolean | Trạng thái hoạt động |

#### 4. Collection: `sessions`
Lưu lịch sử buổi học và trạng thái AI theo dõi.

| Trường | Kiểu dữ liệu | Mô tả |
|---|---|---|
| _id | ObjectId | Khóa chính |
| course | ObjectId → Course | Thuộc khóa học nào |
| teacher | ObjectId → User | Giáo viên dạy |
| title | String | Tiêu đề buổi học |
| startTime | Date | Bắt đầu |
| endTime | Date | Kết thúc |
| isLive | Boolean | Đang diễn ra |
| studentStates | [Embedded] | Trạng thái từng sinh viên (do AI theo dõi) |
| studentStates[].student | ObjectId → User | Sinh viên |
| studentStates[].states[] | Embedded Array | Lịch sử trạng thái: state, confidence, timestamp |
| studentStates[].avgAttention | Number | Điểm tập trung trung bình |
| studentStates[].alerts | [Embedded] | Cảnh báo AI đã gửi |

### Mối quan hệ giữa các Collection

```
User (1) ──── teacher ────▶ (N) Classroom
User (N) ◀── students ──── (N) Classroom
User (1) ──── teacher ────▶ (N) Course
User (N) ◀── students ──── (N) Course
Course (1) ── course ─────▶ (N) Session
User (1) ──── teacher ────▶ (N) Session
User (N) ◀── student ──── (N) Session.studentStates
```

---

## DATA WORKFLOW (Luồng dữ liệu tổng thể)

```
Sinh viên / Giáo viên (Browser)
        │
        ▼
┌──────────────────────────┐
│  Frontend (React + Vite) │  Port 3000
│  - SPA, React Router     │
│  - Redux (state mgmt)    │
│  - Socket.IO Client      │
│  - WebRTC (video P2P)    │
└────────┬─────────────────┘
         │ REST API (Axios) + WebSocket (Socket.IO)
         ▼
┌──────────────────────────┐     ┌──────────────────────────┐
│  Backend (Express.js)    │     │  MongoDB                 │
│  - JWT Auth              │◀───▶│  - users                 │
│  - REST API routes       │     │  - classrooms            │
│  - Socket.IO Server      │     │  - courses               │
│  - WebRTC Signaling      │     │  - sessions              │
│  Port 5000               │     └──────────────────────────┘
└────┬─────────┬───────┬───┘
     │         │       │
     ▼         ▼       ▼
┌─────────┐ ┌──────┐ ┌───────────────┐
│ Vision  │ │Voice │ │ Recommendation│
│ API     │ │ API  │ │ API           │
│ :5001   │ │:5002 │ │ :5003         │
│ YOLO +  │ │Speech│ │ NCF + BA      │
│ OpenCV  │ │Brain │ │ TensorFlow    │
└─────────┘ └──────┘ └───────────────┘
  FastAPI     FastAPI    FastAPI
  (Python)    (Python)   (Python)
```

---

## CÁC MÔ HÌNH AI SỬ DỤNG

### 1. AI Vision — Nhận diện trạng thái sinh viên

| Thuộc tính | Chi tiết |
|---|---|
| **Phương pháp** | Hybrid: YOLO + OpenCV Haar Cascades |
| **Model chính** | YOLOv11 (Ultralytics) — student_state_best.pt |
| **Model phụ** | OpenCV: haarcascade_frontalface, haarcascade_profileface, haarcascade_eye |
| **Input** | Frame webcam (base64 image, 640×480) |
| **Output** | 5 trạng thái: focused, distracted, drowsy, absent, phone_usage + confidence % |
| **Logic kết hợp** | YOLO ≥ 50% confidence → tin YOLO. Dưới 50% → kết hợp OpenCV. YOLO thấy phone → ưu tiên phone_usage |
| **Theo dõi liên tục** | Gửi frame mỗi 3-5 giây qua Socket.IO, kết quả hiển thị badge realtime trên video sinh viên |

### 2. AI Recommendation — Gợi ý lộ trình học tập

| Thuộc tính | Chi tiết |
|---|---|
| **Model 1** | Neural Collaborative Filtering (NCF) — TensorFlow/Keras |
| **Kiến trúc NCF** | Student Embedding (32-dim) + Lesson Embedding (32-dim) → GMF Path (dot product) + MLP Path (Dense 64→32) → Combine → Sigmoid → Score |
| **Model 2** | Behavioral Analytics — DNN Classifier (TensorFlow + Scikit-learn) |
| **Kiến trúc BA** | 10 features → MinMaxScaler → Dense 64 → BatchNorm → Dropout → Dense 32 → Softmax(4 classes) |
| **Input** | Dữ liệu hành vi: scores, thời gian học, tần suất đăng nhập, bài hoàn thành, bài đăng forum... |
| **Output** | Bài học gợi ý (Top-5), mức độ gắn kết (High/Medium/Low/At_risk), môn yếu, cảnh báo |

### 3. AI Voice — Xác thực giọng nói

| Thuộc tính | Chi tiết |
|---|---|
| **Framework** | SpeechBrain |
| **Chức năng** | Đăng ký giọng nói (enrollment) và xác thực danh tính bằng giọng nói (verification) |
| **Input** | File audio WAV/WebM từ microphone |
| **Output** | Khớp/không khớp giọng nói + confidence score |
