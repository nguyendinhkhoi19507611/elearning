# PHÂN TÍCH SAI SỐ DỰ ĐOÁN CỦA CÁC MÔ HÌNH AI TRONG HỆ THỐNG

## 1. TỔNG QUAN CÁC MÔ HÌNH AI

Hệ thống E-Learning tích hợp 4 mô hình/công nghệ AI chính nhằm phục vụ nhiều mục đích khác nhau. Mỗi mô hình đều có nguy cơ xảy ra sai số trong quá trình nhận diện và dự đoán:

| Thành phần | Mô hình / Công nghệ | Mục đích |
|---|---|---|
| AI Vision | YOLOv11 + OpenCV | Nhận diện trạng thái sinh viên (tập trung, buồn ngủ, vắng, dùng điện thoại) |
| AI Recommendation | Neural Collaborative Filtering (NCF) | Gợi ý bài học cá nhân hóa |
| AI Behavior | DNN Classifier | Phân tích mức độ gắn kết học tập (Engagement Level) |
| AI Voice | SpeechBrain | Xác thực danh tính qua giọng nói |

## 2. CÁC LOẠI SAI SỐ DỰ ĐOÁN THEO TỪNG MÔ HÌNH

### 2.1. Sai số AI Vision (YOLOv11 + OpenCV)

**Mô tả:** Nhận diện trạng thái khuôn mặt và hành vi qua webcam.

**Nguyên nhân sai:**

| # | Nguyên nhân | Giải thích | Mức độ ảnh hưởng |
|---|---|---|---|
| 1 | **Điều kiện ánh sáng** | Thiếu sáng, ngược sáng hoặc ánh sáng nhấp nháy làm mất nét khuôn mặt → không nhận diện được | Cao |
| 2 | **Góc quay camera** | Sinh viên để camera quá thấp/cao, hoặc quay nửa mặt → OpenCV không nhận diện được `frontalface` | Cao |
| 3 | **Vật cản (Occlusion)** | Sinh viên đeo khẩu trang, kính râm, hoặc tóc che mắt → nhầm lẫn trạng thái (VD: tưởng nhắm mắt / buồn ngủ) | Trung bình |
| 4 | **Nhầm lẫn hành vi** | Cúi xuống ghi chép bài có thể bị YOLO nhầm thành "buồn ngủ" (drowsy) hoặc "dùng điện thoại" | Trung bình |

### 2.2. Sai số AI Recommendation (NCF)

**Mô tả:** Gợi ý lộ trình và bài học sử dụng Neural Collaborative Filtering.

**Nguyên nhân sai:**

| # | Nguyên nhân | Giải thích | Mức độ ảnh hưởng |
|---|---|---|---|
| 1 | **Cold-start problem** | Sinh viên mới hoặc bài học mới chưa có lịch sử tương tác. Mô hình phải đoán mò → sai lệch cao | Cao |
| 2 | **Data sparsity** | Dữ liệu tương tác giữa SV-bài học quá thưa thớt, không đủ để học Embedding chính xác | Cao |
| 3 | **Bias độ khó** | Hệ thống thiên vị gợi ý các bài học dễ (có nhiều người qua) cho tất cả mọi người | Trung bình |
| 4 | **Sự thay đổi đột ngột** | Khả năng của SV đột ngột tăng lên (học offline) nhưng NCF chưa kịp cập nhật trọng số | Trung bình |

### 2.3. Sai số AI Behavioral Analytics (DNN Classifier)

**Mô tả:** Phân loại mức độ gắn kết (High, Medium, Low, At_risk).

**Nguyên nhân sai:**

| # | Nguyên nhân | Giải thích | Mức độ ảnh hưởng |
|---|---|---|---|
| 1 | **Fake engagement** | SV treo máy, mở tab để đó nhưng không thực sự học → DNN vẫn tính là có thời gian học cao | Cao |
| 2 | **Thiếu feature ngữ cảnh** | Không phân biệt được SV đọc tài liệu lâu vì khó hiểu (cần giúp đỡ) hay vì tập trung cao độ | Trung bình |
| 3 | **Mất cân bằng dữ liệu** | Đa số SV nằm ở mức Medium/High, rất ít SV At_risk → DNN dễ đoán nhầm nhóm At_risk thành Low | Cao |

### 2.4. Sai số AI Voice (SpeechBrain)

**Mô tả:** Xác thực giọng nói khi tham gia lớp học hoặc điểm danh.

**Nguyên nhân sai:**

| # | Nguyên nhân | Giải thích | Mức độ ảnh hưởng |
|---|---|---|---|
| 1 | **Nhiễu nền (Background Noise)** | Tiếng quạt, tiếng ồn ngoài đường, tạp âm làm méo đặc trưng MFCC của giọng nói | Cao |
| 2 | **Chất lượng Microphone** | Mic rẻ tiền, bị rè, khoảng cách nói quá xa hoặc quá gần gây vỡ tiếng (clipping) | Trung bình |
| 3 | **Thay đổi giọng sinh lý** | SV bị ốm, cảm cúm, khản tiếng hoặc vừa ngủ dậy → SpeechBrain từ chối xác thực (False Rejection) | Trung bình |

## 3. BẢNG TỔNG HỢP SAI SỐ VÀ ĐỘ CHÍNH XÁC KỲ VỌNG

| Mô hình AI | Lỗi phổ biến nhất | Độ chính xác (Accuracy) dự kiến | Điều kiện tối ưu |
|---|---|---|---|
| AI Vision | Nhầm cúi mặt thành buồn ngủ | 80% - 85% | Đủ sáng, góc cam thẳng mặt |
| AI Recommendation | Gợi ý sai do Cold-start | 70% - 75% | > 10 bài học/sinh viên |
| AI Behavior | Đánh giá sai do treo máy | 75% - 80% | SV tương tác liên tục |
| AI Voice | Khước từ sai do tiếng ồn | 85% - 90% | Môi trường yên tĩnh, mic tốt |

## 4. CÁC BIỆN PHÁP GIẢM SAI SỐ ĐÃ ÁP DỤNG

### 4.1. Cơ chế Fallback và Ngưỡng tin cậy (Confidence Threshold)
- **Vision & Voice:** Đặt ngưỡng `confidence > 50%` cho YOLO và `similarity_score > 0.65` cho SpeechBrain. Nếu dưới ngưỡng, yêu cầu thử lại hoặc chuyển sang xác thực thủ công.
- **Recommendation:** Khi gặp Cold-start, fallback về gợi ý dựa trên Rule-based (các bài học phổ biến nhất của môn).

### 4.2. Xử lý dữ liệu và Chống nhiễu
- **Voice:** Áp dụng bộ lọc nhiễu (noise reduction) sơ bộ trước khi đẩy vào Librosa/SpeechBrain.
- **Behavior:** Lọc bỏ các session có `time_spent` quá dài bất thường (nghi ngờ treo máy) trước khi đưa vào training DNN.

## 5. ĐỀ XUẤT CẢI THIỆN TRONG TƯƠNG LAI

| # | Đề xuất | Ưu tiên | Mô tả |
|---|---|---|---|
| 1 | Active Liveness | Cao | (Vision) Yêu cầu chớp mắt/quay đầu để chống dùng ảnh giả điểm danh |
| 2 | Cross-validation | Cao | (Behavior) Kết hợp điểm số thực tế với thời gian học để loại bỏ fake engagement |
| 3 | Hybrid Recommendation | TB | (Recommendation) Kết hợp NCF với Content-based để giảm ảnh hưởng của data sparsity |
| 4 | Multi-modal Auth | TB | Kết hợp đồng thời Voice và Face để tăng tỷ lệ xác thực thành công |

## 6. KẾT LUẬN

Hệ thống đã tích hợp 4 mô hình AI phục vụ các mục đích độc lập. Dù mỗi mô hình đối mặt với những loại sai số đặc thù (nhiễu vật lý đối với Vision/Voice, hoặc thiếu hụt dữ liệu đối với NCF/Behavior), việc thiết lập ngưỡng tin cậy (confidence threshold) và cơ chế dự phòng (fallback) giúp hệ thống vẫn duy trì hoạt động ổn định và mang lại giá trị thực tiễn cao cho trải nghiệm E-Learning.
