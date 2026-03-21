const express = require('express');
const router = express.Router();
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

// Kiểm tra lịch học có đang trong khung giờ hôm nay không
function isScheduledNow(schedule) {
    if (!schedule || !schedule.startTime || !schedule.endTime) return false;
    const now = new Date();
    // Vietnam timezone: UTC+7
    const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const todayDow = vnNow.getUTCDay(); // 0=Sun,1=Mon,...
    if (!schedule.dayOfWeek || !schedule.dayOfWeek.includes(todayDow)) return false;
    const [sh, sm] = schedule.startTime.split(':').map(Number);
    const [eh, em] = schedule.endTime.split(':').map(Number);
    const nowMin = vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    return nowMin >= startMin && nowMin < endMin;
}

// ── GET /api/classrooms — List classrooms (filtered by role) ──
router.get('/', auth, async (req, res) => {
    try {
        let query = { isActive: true };
        if (req.user.role === 'teacher') query.teacher = req.user._id;
        else if (req.user.role === 'student') query.students = req.user._id;

        const classrooms = await Classroom.find(query)
            .populate('teacher', 'name email avatar')
            .populate('students', 'name email avatar')
            .populate('createdBy', 'name')
            .sort('-createdAt');

        // Auto-reset isLive nếu hết giờ
        const updated = classrooms.map(c => {
            const obj = c.toObject();
            obj.isScheduledNow = isScheduledNow(c.schedule);
            // Nếu đang LIVE mà hết giờ => tự tắt (chỉ trả về false, không save DB ở đây)
            if (obj.meeting?.isLive && !obj.isScheduledNow) {
                obj.meeting.isLive = false;
                // Auto-save trong background
                Classroom.findByIdAndUpdate(c._id, { 'meeting.isLive': false, 'meeting.endedAt': new Date() }).exec();
            }
            return obj;
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/classrooms/:id — Single classroom ──
router.get('/:id', auth, async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.id)
            .populate('teacher', 'name email avatar')
            .populate('students', 'name email avatar role')
            .populate('meeting.participants.user', 'name avatar');
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
        res.json(classroom);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/classrooms — Create classroom (admin) ──
router.post('/', auth, authorize('admin'), async (req, res) => {
    try {
        const { name, subject, description, teacherId, studentIds, schedule, settings } = req.body;

        // Validate teacher
        const teacher = await User.findById(teacherId);
        if (!teacher || teacher.role !== 'teacher') {
            return res.status(400).json({ error: 'Invalid teacher' });
        }

        // Validate students
        if (studentIds && studentIds.length > 0) {
            const students = await User.find({ _id: { $in: studentIds }, role: 'student' });
            if (students.length !== studentIds.length) {
                return res.status(400).json({ error: 'Some students not found' });
            }
        }

        const classroom = new Classroom({
            name, subject, description,
            teacher: teacherId,
            students: studentIds || [],
            schedule: schedule || { dayOfWeek: [1], startTime: '08:00', endTime: '10:00' },
            settings: settings || {},
            createdBy: req.user._id,
        });

        await classroom.save();
        await classroom.populate('teacher', 'name email avatar');
        await classroom.populate('students', 'name email avatar');
        res.status(201).json(classroom);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/classrooms/:id — Update classroom (admin) ──
router.put('/:id', auth, authorize('admin'), async (req, res) => {
    try {
        const updates = req.body;
        const classroom = await Classroom.findByIdAndUpdate(req.params.id, updates, { new: true })
            .populate('teacher', 'name email avatar')
            .populate('students', 'name email avatar');
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
        res.json(classroom);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/classrooms/:id — Delete classroom (admin) ──
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
    try {
        await Classroom.findByIdAndUpdate(req.params.id, { isActive: false });
        res.json({ message: 'Classroom deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/classrooms/:id/students — Add students ──
router.post('/:id/students', auth, authorize('admin'), async (req, res) => {
    try {
        const { studentIds } = req.body;
        const classroom = await Classroom.findById(req.params.id);
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

        const newIds = studentIds.filter(id => !classroom.students.includes(id));
        classroom.students.push(...newIds);
        await classroom.save();
        await classroom.populate('students', 'name email avatar');
        res.json(classroom);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/classrooms/:id/students/:studentId — Remove student ──
router.delete('/:id/students/:studentId', auth, authorize('admin'), async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.id);
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
        classroom.students = classroom.students.filter(s => s.toString() !== req.params.studentId);
        await classroom.save();
        res.json(classroom);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/classrooms/:id/meeting/start — Start meeting ──
router.post('/:id/meeting/start', auth, async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.id);
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

        // Only teacher of this class or admin can start
        const isTeacher = classroom.teacher.toString() === req.user._id.toString();
        if (req.user.role !== 'admin' && !isTeacher) {
            return res.status(403).json({ error: 'Chỉ giáo viên của lớp hoặc admin mới bắt đầu được' });
        }

        // Kiểm tra lịch học — admin bỏ qua hạn chế này
        if (req.user.role !== 'admin' && !isScheduledNow(classroom.schedule)) {
            const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
            const schedDays = classroom.schedule.dayOfWeek.map(d => days[d]).join(', ');
            return res.status(400).json({
                error: `Chưa đến giờ học. Lịch học: ${schedDays} từ ${classroom.schedule.startTime} - ${classroom.schedule.endTime}`
            });
        }

        classroom.meeting.isLive = true;
        classroom.meeting.startedAt = new Date();
        classroom.meeting.endedAt = null;
        classroom.meeting.participants = [];
        await classroom.save();

        const io = req.app.get('io');
        io.to(`classroom_${req.params.id}`).emit('meetingStarted', {
            classroomId: req.params.id,
            startedBy: req.user.name,
        });

        res.json({ message: 'Meeting started', classroom });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/classrooms/:id/meeting/end — End meeting ──
router.post('/:id/meeting/end', auth, async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.id);
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

        // Teacher của lớp hoặc admin mới được kết thúc
        const isTeacher = classroom.teacher.toString() === req.user._id.toString();
        if (req.user.role !== 'admin' && !isTeacher) {
            return res.status(403).json({ error: 'Chỉ giáo viên của lớp hoặc admin mới kết thúc được' });
        }

        classroom.meeting.isLive = false;
        classroom.meeting.endedAt = new Date();
        await classroom.save();

        const io = req.app.get('io');
        io.to(`classroom_${req.params.id}`).emit('meetingEnded', {
            classroomId: req.params.id,
        });

        res.json({ message: 'Meeting ended', classroom });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/classrooms/live/now — Get classrooms with active meeting ──
router.get('/live/now', auth, async (req, res) => {
    try {
        const classrooms = await Classroom.find({ 'meeting.isLive': true, isActive: true })
            .populate('teacher', 'name email avatar')
            .populate('students', 'name email avatar');
        res.json(classrooms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
