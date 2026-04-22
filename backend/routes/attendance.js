const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const AttendanceSession = require('../models/Attendance');
const Classroom = require('../models/Classroom');
const { auth, authorize } = require('../middleware/auth');

const FACE_AI_URL = process.env.AI_FACE_URL || 'http://localhost:5004';

// Multer for face images
const faceStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'faces');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `face_${req.user._id}_${Date.now()}.jpg`)
});
const uploadFace = multer({ storage: faceStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── POST /api/attendance/face/enroll — Đăng ký khuôn mặt ──
router.post('/face/enroll', auth, uploadFace.array('images', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0)
            return res.status(400).json({ error: 'Cần ít nhất 1 ảnh khuôn mặt' });

        const form = new FormData();
        form.append('user_id', req.user._id.toString());
        form.append('name', req.user.name);

        for (const file of req.files) {
            form.append('files', fs.createReadStream(file.path), {
                filename: file.filename, contentType: 'image/jpeg'
            });
        }

        const aiRes = await axios.post(`${FACE_AI_URL}/enroll`, form, {
            headers: form.getHeaders(), timeout: 30000
        });

        // Cleanup temp files
        req.files.forEach(f => fs.unlink(f.path, () => { }));

        if (aiRes.data.success) {
            await User.findByIdAndUpdate(req.user._id, {
                faceRegistered: true,
                faceId: req.user._id.toString()
            });
        }

        res.json({ ...aiRes.data, message: 'Đăng ký khuôn mặt thành công!' });
    } catch (err) {
        req.files?.forEach(f => fs.unlink(f.path, () => { }));
        console.error('Face enroll error:', err.message);
        res.status(500).json({ error: err.response?.data?.detail || err.message });
    }
});

// ── GET /api/attendance/face/my-faces — Lấy ảnh khuôn mặt đã đăng ký ──
router.get('/face/my-faces', auth, async (req, res) => {
    try {
        const aiRes = await axios.get(`${FACE_AI_URL}/users/${req.user._id}/faces`, { timeout: 15000 });
        res.json(aiRes.data);
    } catch (err) {
        console.error('Get faces error:', err.message);
        res.json({ faces: [], total: 0 });
    }
});

// ── POST /api/attendance/face/verify-base64 — Xác thực khuôn mặt từ webcam (1 ảnh) ──
router.post('/face/verify-base64', auth, async (req, res) => {
    try {
        const { image, threshold } = req.body;
        if (!image) return res.status(400).json({ error: 'Thiếu ảnh' });

        const user = await User.findById(req.user._id);
        if (!user.faceRegistered)
            return res.status(400).json({ error: 'Chưa đăng ký khuôn mặt. Vui lòng đăng ký trước.' });

        const aiRes = await axios.post(`${FACE_AI_URL}/verify-base64`, {
            user_id: req.user._id.toString(),
            image,
            threshold: threshold || 0.4
        }, { timeout: 60000 });

        res.json(aiRes.data);
    } catch (err) {
        console.error('Face verify error:', err.message);
        res.status(500).json({ error: err.response?.data?.detail || err.message });
    }
});

// ── POST /api/attendance/face/verify-multi-base64 — Xác thực khuôn mặt từ 5 ảnh ──
router.post('/face/verify-multi-base64', auth, async (req, res) => {
    try {
        const { images } = req.body;
        if (!images || !Array.isArray(images) || images.length === 0)
            return res.status(400).json({ error: 'Cần ít nhất 1 ảnh' });

        const user = await User.findById(req.user._id);
        if (!user.faceRegistered)
            return res.status(400).json({ error: 'Chưa đăng ký khuôn mặt. Vui lòng đăng ký trước.' });

        const aiRes = await axios.post(`${FACE_AI_URL}/verify-multi-base64`, {
            user_id: req.user._id.toString(),
            images,
            threshold: 0.4
        }, { timeout: 120000 }); // 120s vì cần verify nhiều ảnh

        res.json(aiRes.data);
    } catch (err) {
        console.error('Face multi-verify error:', err.message);
        res.status(500).json({ error: err.response?.data?.detail || err.message });
    }
});

// ── POST /api/attendance/sessions — Tạo phiên điểm danh (giáo viên) ──
router.post('/sessions', auth, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { classroomId, startTime, endTime, lateAfterMinutes, requireFaceVerify } = req.body;

        const classroom = await Classroom.findById(classroomId)
            .populate('students', 'name email faceRegistered');
        if (!classroom) return res.status(404).json({ error: 'Không tìm thấy lớp' });

        // Kiểm tra không có session đang active
        const existing = await AttendanceSession.findOne({
            classroom: classroomId,
            status: 'active'
        });
        if (existing) return res.status(400).json({ error: 'Đã có phiên điểm danh đang chạy' });

        const now = new Date();
        const session = await AttendanceSession.create({
            classroom: classroomId,
            teacher: req.user._id,
            date: now,
            startTime,
            endTime,
            startedAt: now,
            requireFaceVerify: requireFaceVerify !== false,
            lateAfterMinutes: lateAfterMinutes || 0,
            records: classroom.students.map(s => ({
                student: s._id,
                studentName: s.name,
                studentEmail: s.email,
                status: 'absent'
            }))
        });

        // Notify via socket — bao gồm classroomName để student notification hiển thị đúng
        const io = req.app.get('io');
        io.to(`classroom_${classroomId}`).emit('attendanceStarted', {
            sessionId: session._id,
            classroomId,
            classroomName: classroom.name,
            startTime,
            endTime,
            requireFaceVerify: session.requireFaceVerify,
            lateAfterMinutes: session.lateAfterMinutes
        });

        // [BUG-03 FIX] Tính thời gian tự kết thúc đúng múi giờ VN (UTC+7)
        // endTime là "HH:MM" theo giờ VN → chuyển sang UTC để so sánh với now (UTC)
        const [eh, em] = endTime.split(':').map(Number);
        const nowUtcMs = now.getTime();
        // Xây dựng thời điểm kết thúc theo giờ VN = UTC+7: VN HH:MM = UTC (HH-7):MM
        const endMsUtc = new Date(now);
        endMsUtc.setUTCHours(eh - 7, em, 0, 0);
        // Nếu đã qua nửa đêm VN, cộng thêm 1 ngày
        if (endMsUtc.getTime() <= nowUtcMs) endMsUtc.setUTCDate(endMsUtc.getUTCDate() + 1);
        const msLeft = endMsUtc.getTime() - nowUtcMs;

        if (msLeft > 0) {
            setTimeout(async () => {
                await endAttendanceSession(session._id, classroomId, io);
            }, msLeft);
        }

        res.status(201).json({ session, message: `Điểm danh bắt đầu từ ${startTime} đến ${endTime}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/attendance/sessions/:id/checkin — Sinh viên điểm danh ──
router.post('/sessions/:id/checkin', auth, async (req, res) => {
    try {
        const session = await AttendanceSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Không tìm thấy phiên điểm danh' });
        if (session.status !== 'active') return res.status(400).json({ error: 'Phiên điểm danh đã kết thúc' });

        const { faceVerified, faceDistance } = req.body;
        const now = new Date();

        // [BUG-11 FIX] Tính trễ đúng múi giờ VN (UTC+7)
        const lateMinutesAfterStart = session.lateAfterMinutes || 0;
        let isLate = false;
        if (lateMinutesAfterStart > 0) {
            // Chỉ tính trễ khi giáo viên đặt thời gian trễ > 0 phút
            const [sh, sm] = session.startTime.split(':').map(Number);
            const lateThreshold = new Date(session.date);
            lateThreshold.setUTCHours(sh - 7, sm + lateMinutesAfterStart, 0, 0);
            isLate = now > lateThreshold;
        }
        // Khi lateAfterMinutes = 0 → luôn present, không bao giờ late

        const record = session.records.find(r => r.student.toString() === req.user._id.toString());
        if (!record) return res.status(400).json({ error: 'Bạn không thuộc lớp này' });
        if (record.status === 'present') return res.json({ message: 'Đã điểm danh rồi', status: 'present' });

        record.status = isLate ? 'late' : 'present';
        record.verifiedAt = now;
        record.joinedAt = now;
        record.faceVerified = faceVerified || false;
        record.faceDistance = faceDistance;

        await session.save();

        // Notify teacher
        const io = req.app.get('io');
        io.to(`classroom_${session.classroom}`).emit('studentCheckedIn', {
            studentId: req.user._id,
            studentName: req.user.name,
            status: record.status,
            faceVerified: record.faceVerified
        });

        res.json({
            message: isLate ? 'Điểm danh trễ' : 'Điểm danh thành công',
            status: record.status,
            faceVerified: record.faceVerified
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/attendance/sessions/:id/end — Kết thúc điểm danh (giáo viên) ──
router.post('/sessions/:id/end', auth, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const session = await AttendanceSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Không tìm thấy phiên điểm danh' });

        const io = req.app.get('io');
        const result = await endAttendanceSession(session._id, session.classroom.toString(), io);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/attendance/sessions — Lấy danh sách sessions ──
router.get('/sessions', auth, async (req, res) => {
    try {
        const { classroomId, status } = req.query;
        const query = {};
        if (classroomId) query.classroom = classroomId;
        if (status) query.status = status;
        if (req.user.role === 'teacher') query.teacher = req.user._id;

        const sessions = await AttendanceSession.find(query)
            .populate('classroom', 'name subject')
            .sort('-createdAt')
            .limit(50);
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/attendance/sessions/:id — Chi tiết session ──
router.get('/sessions/:id', auth, async (req, res) => {
    try {
        const session = await AttendanceSession.findById(req.params.id)
            .populate('classroom', 'name subject')
            .populate('teacher', 'name');
        if (!session) return res.status(404).json({ error: 'Không tìm thấy' });
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/attendance/sessions/:id/export — Xuất file điểm danh CSV ──
router.get('/sessions/:id/export', auth, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const session = await AttendanceSession.findById(req.params.id)
            .populate('classroom', 'name subject');
        if (!session) return res.status(404).json({ error: 'Không tìm thấy' });

        const classroom = session.classroom;
        const dateStr = new Date(session.date).toLocaleDateString('vi-VN');

        // Build CSV
        const rows = [
            [`Điểm danh: ${classroom?.name || ''} - ${classroom?.subject || ''}`],
            [`Ngày: ${dateStr}  |  Giờ: ${session.startTime} - ${session.endTime}`],
            [],
            ['STT', 'Họ tên', 'Email', 'Trạng thái', 'Xác thực khuôn mặt', 'Giờ điểm danh']
        ];

        session.records.forEach((r, i) => {
            const statusLabel = {
                present: 'Có mặt', late: 'Trễ', absent: 'Vắng', excused: 'Nghỉ phép'
            }[r.status] || r.status;

            rows.push([
                i + 1,
                r.studentName,
                r.studentEmail || '',
                statusLabel,
                r.faceVerified ? 'Đã xác thực' : 'Chưa xác thực',
                r.verifiedAt ? new Date(r.verifiedAt).toLocaleTimeString('vi-VN') : ''
            ]);
        });

        // Summary
        const present = session.records.filter(r => r.status === 'present').length;
        const late = session.records.filter(r => r.status === 'late').length;
        const absent = session.records.filter(r => r.status === 'absent').length;
        rows.push([]);
        rows.push(['', 'Tổng có mặt:', present + late, 'Vắng:', absent]);

        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const filename = `diemdanh_${classroom?.name || 'lop'}_${dateStr.replace(/\//g, '-')}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.send('\uFEFF' + csv); // BOM for Excel UTF-8
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Helper: Kết thúc phiên điểm danh ──
async function endAttendanceSession(sessionId, classroomId, io) {
    const session = await AttendanceSession.findById(sessionId);
    if (!session || session.status !== 'active') return;

    session.status = 'ended';
    session.endedAt = new Date();
    await session.save();

    io?.to(`classroom_${classroomId}`).emit('attendanceEnded', {
        sessionId,
        records: session.records.map(r => ({
            studentId: r.student,
            studentName: r.studentName,
            status: r.status,
            faceVerified: r.faceVerified
        }))
    });

    return { session, message: 'Phiên điểm danh đã kết thúc' };
}

// ── GET /api/attendance/classroom/:classroomId — Teacher xem lịch sử điểm danh toàn lớp ──
router.get('/classroom/:classroomId', auth, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const sessions = await AttendanceSession.find({ classroom: req.params.classroomId })
            .sort({ date: -1 }).lean();
        res.json(sessions);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/attendance/classroom/:classroomId/me — Student xem lịch sử điểm danh của mình ──
router.get('/classroom/:classroomId/me', auth, authorize('student'), async (req, res) => {
    try {
        const sessions = await AttendanceSession.find({ classroom: req.params.classroomId })
            .sort({ date: -1 }).lean();

        const records = sessions.map(session => {
            const myRecord = session.records.find(
                r => r.student.toString() === req.user._id.toString()
            );
            return {
                _id: session._id,
                sessionDate: session.date,
                startTime: session.startTime,
                endTime: session.endTime,
                status: myRecord?.status || 'absent',
                checkedInAt: myRecord?.verifiedAt || myRecord?.joinedAt,
                faceVerified: myRecord?.faceVerified || false,
                createdAt: session.createdAt,
            };
        });
        res.json(records);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

