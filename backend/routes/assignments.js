const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Assignment = require('../models/Assignment');
const Classroom = require('../models/Classroom');
const { auth, authorize } = require('../middleware/auth');

// Multer cho file đính kèm
const assignStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'assignments');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `assign_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    }
});
const upload = multer({ storage: assignStorage, limits: { fileSize: 50 * 1024 * 1024 } });

// ── GET /api/assignments/classroom/:classroomId ── Lấy bài tập theo lớp
router.get('/classroom/:classroomId', auth, async (req, res) => {
    try {
        const { classroomId } = req.params;
        const classroom = await Classroom.findById(classroomId);
        if (!classroom) return res.status(404).json({ error: 'Không tìm thấy lớp học' });

        const isTeacher = classroom.teacher.toString() === req.user._id.toString();
        const isStudent = classroom.students.map(s => s.toString()).includes(req.user._id.toString());
        const isAdmin = req.user.role === 'admin';
        if (!isTeacher && !isStudent && !isAdmin)
            return res.status(403).json({ error: 'Không có quyền truy cập' });

        const query = { classroom: classroomId };
        if (isStudent) query.isPublished = true;

        // [BUG-02 FIX] Dùng .lean() thay vì .select() với dot-notation trên nested array
        // Mongoose không hỗ trợ "-submissions.content" — dùng lean + manual projection
        const assignments = await Assignment.find(query)
            .lean()
            .sort({ dueDate: 1 });

        if (isStudent) {
            // Student: ẩn submissions người khác, chỉ giữ submission của mình
            const result = assignments.map(a => {
                const mySub = a.submissions.find(
                    s => s.student.toString() === req.user._id.toString()
                );
                // Xóa submissions rồi gắn lại chỉ mySubmission
                const { submissions, ...rest } = a;
                rest.mySubmission = mySub || null;
                return rest;
            });
            return res.json(result);
        }

        // Teacher/Admin: ẩn nội dung file submission (privacy), giữ submissions[] để đếm
        const result = assignments.map(a => ({
            ...a,
            submissions: a.submissions.map(s => ({
                _id: s._id, student: s.student, studentName: s.studentName,
                studentId: s.studentId, fileName: s.fileName, submittedAt: s.submittedAt,
                status: s.status, score: s.score, maxScore: s.maxScore,
                feedback: s.feedback, gradedAt: s.gradedAt,
                // content & fileUrl ẩn khỏi teacher list (chỉ hiện khi chấm điểm cụ thể)
            }))
        }));
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/assignments ── Tạo bài tập (Teacher/Admin)
router.post('/', auth, authorize('teacher', 'admin'), upload.array('attachments', 5), async (req, res) => {
    try {
        const { classroomId, title, description, type, dueDate, maxScore, allowLate, latePenaltyPercent } = req.body;

        const classroom = await Classroom.findById(classroomId);
        if (!classroom) return res.status(404).json({ error: 'Không tìm thấy lớp học' });
        if (req.user.role === 'teacher' && classroom.teacher.toString() !== req.user._id.toString())
            return res.status(403).json({ error: 'Chỉ giáo viên của lớp mới có thể tạo bài tập' });

        const attachments = (req.files || []).map(f => ({
            url: `/uploads/assignments/${f.filename}`,
            name: f.originalname,
            size: f.size,
        }));

        const assignment = await Assignment.create({
            classroom: classroomId,
            teacher: req.user._id,
            title, description,
            type: type || 'homework',
            dueDate: new Date(dueDate),
            maxScore: Number(maxScore) || 100,
            allowLate: allowLate === 'true',
            latePenaltyPercent: Number(latePenaltyPercent) || 0,
            attachments,
        });

        // Emit socket event cho student
        const io = req.app.get('io');
        if (io) io.to(`classroom_${classroomId}`).emit('newAssignment', {
            classroomId, classroomName: classroom.name,
            assignmentId: assignment._id, title,
            dueDate: assignment.dueDate,
        });

        res.status(201).json(assignment);
    } catch (err) {
        req.files?.forEach(f => fs.unlink(f.path, () => {}));
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/assignments/:id ── Sửa bài tập
router.put('/:id', auth, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { title, description, dueDate, maxScore, allowLate, isPublished } = req.body;
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) return res.status(404).json({ error: 'Không tìm thấy bài tập' });
        if (req.user.role === 'teacher' && assignment.teacher.toString() !== req.user._id.toString())
            return res.status(403).json({ error: 'Không có quyền sửa' });

        if (title) assignment.title = title;
        if (description !== undefined) assignment.description = description;
        if (dueDate) assignment.dueDate = new Date(dueDate);
        if (maxScore) assignment.maxScore = Number(maxScore);
        if (allowLate !== undefined) assignment.allowLate = allowLate;
        if (isPublished !== undefined) assignment.isPublished = isPublished;
        await assignment.save();
        res.json(assignment);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/assignments/:id ──
router.delete('/:id', auth, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const a = await Assignment.findById(req.params.id);
        if (!a) return res.status(404).json({ error: 'Không tìm thấy bài tập' });
        if (req.user.role === 'teacher' && a.teacher.toString() !== req.user._id.toString())
            return res.status(403).json({ error: 'Không có quyền xóa' });
        await a.deleteOne();
        res.json({ message: 'Đã xóa bài tập' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/assignments/:id/submit ── Sinh viên nộp bài
router.post('/:id/submit', auth, authorize('student'), upload.single('file'), async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) return res.status(404).json({ error: 'Không tìm thấy bài tập' });
        if (!assignment.isPublished) return res.status(403).json({ error: 'Bài tập chưa được công bố' });

        const now = new Date();
        const isLate = now > assignment.dueDate;
        if (isLate && !assignment.allowLate)
            return res.status(400).json({ error: 'Đã quá hạn nộp bài' });

        // Xóa submission cũ nếu có
        assignment.submissions = assignment.submissions.filter(
            s => s.student.toString() !== req.user._id.toString()
        );

        const fileUrl = req.file ? `/uploads/assignments/${req.file.filename}` : undefined;
        assignment.submissions.push({
            student: req.user._id,
            studentName: req.user.name,
            studentId: req.user.studentId,
            content: req.body.content,
            fileUrl,
            fileName: req.file?.originalname,
            status: isLate ? 'late' : 'submitted',
        });
        await assignment.save();

        // Emit cho teacher
        const io = req.app.get('io');
        if (io) io.to(`classroom_${assignment.classroom}`).emit('assignmentSubmitted', {
            assignmentId: assignment._id, title: assignment.title,
            studentName: req.user.name,
        });

        const mySub = assignment.submissions.find(
            s => s.student.toString() === req.user._id.toString()
        );
        res.json({ message: 'Nộp bài thành công', submission: mySub });
    } catch (err) {
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/assignments/:id/grade/:studentId ── Giáo viên chấm điểm
router.post('/:id/grade/:studentId', auth, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { score, feedback } = req.body;
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) return res.status(404).json({ error: 'Không tìm thấy bài tập' });
        if (req.user.role === 'teacher' && assignment.teacher.toString() !== req.user._id.toString())
            return res.status(403).json({ error: 'Không có quyền chấm điểm' });

        const sub = assignment.submissions.find(
            s => s.student.toString() === req.params.studentId
        );
        if (!sub) return res.status(404).json({ error: 'Không tìm thấy bài làm' });

        const scoreNum = Number(score);
        if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > (assignment.maxScore || 100)) {
            return res.status(400).json({ error: `Điểm phải từ 0 đến ${assignment.maxScore || 100}` });
        }

        sub.score = scoreNum;
        sub.maxScore = assignment.maxScore;
        sub.feedback = feedback;
        sub.gradedAt = new Date();
        sub.gradedBy = req.user._id;
        sub.status = 'graded';
        await assignment.save();

        // [N6] Emit thông báo chấm điểm cho student
        const io = req.app.get('io');
        if (io) io.to(`user_${req.params.studentId}`).emit('assignmentGraded', {
            assignmentId: assignment._id,
            title: assignment.title,
            score: Number(score),
            maxScore: assignment.maxScore,
            feedback,
        });

        // [BUG-05 FIX] Tính avgScore trên TẤT CẢ lớp của sinh viên (không chỉ lớp hiện tại)
        const User = require('../models/User');
        const studentClassrooms = await Classroom.find({ students: req.params.studentId }).select('_id');
        const classroomIds = studentClassrooms.map(c => c._id);
        const allAssignments = await Assignment.find({ classroom: { $in: classroomIds } });
        const studentSubs = allAssignments.flatMap(a =>
            a.submissions.filter(s => s.student.toString() === req.params.studentId && s.score !== null && s.maxScore)
        );
        if (studentSubs.length > 0) {
            const avgScore = studentSubs.reduce((sum, s) => sum + (s.score / s.maxScore * 100), 0) / studentSubs.length;
            await User.findByIdAndUpdate(req.params.studentId, { 'stats.avgScore': Math.round(avgScore) });
        }

        res.json({ message: 'Chấm điểm thành công', submission: sub });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/assignments/:id/submissions ── Giáo viên xem tất cả bài nộp
router.get('/:id/submissions', auth, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id)
            .populate('submissions.student', 'name email studentId');
        if (!assignment) return res.status(404).json({ error: 'Không tìm thấy bài tập' });

        // [N8] Load all students in classroom → show who hasn't submitted
        const classroom = await Classroom.findById(assignment.classroom)
            .populate('students', 'name email studentId');
        const totalStudents = classroom?.students?.length || 0;

        // Map submissions nhanh
        const subMap = {};
        for (const s of assignment.submissions) {
            const sid = s.student?._id?.toString() || s.student?.toString();
            if (sid) subMap[sid] = s;
        }

        // Danh sách đầy đủ: all students + trạng thái nộp bài
        const allStudents = (classroom?.students || []).map(st => ({
            student: { _id: st._id, name: st.name, email: st.email, studentId: st.studentId },
            submission: subMap[st._id.toString()] || null,
            status: subMap[st._id.toString()]?.status || 'not_submitted',
        }));

        res.json({
            assignment: { title: assignment.title, dueDate: assignment.dueDate, maxScore: assignment.maxScore, type: assignment.type },
            students: allStudents,
            totalStudents,
            submittedCount: Object.keys(subMap).length,
            gradedCount: Object.values(subMap).filter(s => s.score !== null && s.score !== undefined).length,
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
