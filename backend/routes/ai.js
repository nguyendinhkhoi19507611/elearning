const express = require('express');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const Session = require('../models/Session');
const { auth } = require('../middleware/auth');
const router = express.Router();
const upload = multer({ dest: 'uploads/frames/', limits: { fileSize: 5 * 1024 * 1024 } });

// ── Vision: Detect student state from image ──
router.post('/vision/detect', auth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Image required' });

        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path));
        formData.append('confidence', req.body.confidence || '0.5');

        const aiRes = await axios.post(`${process.env.AI_VISION_URL}/detect`, formData, {
            headers: formData.getHeaders(), timeout: 15000
        });
        fs.unlinkSync(req.file.path);

        // Save to session if sessionId provided
        if (req.body.sessionId) {
            const session = await Session.findById(req.body.sessionId);
            if (session) {
                const studentState = session.studentStates.find(
                    s => s.student.toString() === req.user._id.toString());
                if (studentState && aiRes.data.detections.length > 0) {
                    const det = aiRes.data.detections[0];
                    studentState.states.push({
                        state: det.class_name, confidence: det.confidence, timestamp: new Date()
                    });
                    // Check alerts
                    const recentStates = studentState.states.slice(-10);
                    const distractedCount = recentStates.filter(
                        s => ['distracted', 'phone_usage', 'drowsy'].includes(s.state)).length;
                    if (distractedCount >= 6) {
                        studentState.alerts.push({
                            message: `${req.user.name} mất tập trung trong ${distractedCount * 5} giây`,
                            type: 'warning', timestamp: new Date()
                        });
                        // Emit via socket
                        const io = req.app.get('io');
                        if (io) io.to(`session_${req.body.sessionId}`).emit('alert', {
                            studentId: req.user._id, studentName: req.user.name,
                            message: `Mất tập trung trong ${distractedCount * 5} giây`,
                            state: det.class_name
                        });
                    }
                    // Update avg attention
                    const focused = studentState.states.filter(s => s.state === 'focused').length;
                    studentState.avgAttention = Math.round((focused / studentState.states.length) * 100);
                    await session.save();
                }
            }
        }
        res.json(aiRes.data);
    } catch (err) {
        if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) { }
        res.status(500).json({ error: err.message });
    }
});

// ── Vision: Detect from base64 (webcam) ──
router.post('/vision/detect-base64', auth, async (req, res) => {
    try {
        const aiRes = await axios.post(`${process.env.AI_VISION_URL}/detect/base64`, {
            image: req.body.image, confidence: req.body.confidence || 0.5
        }, { timeout: 15000 });

        const primaryState = aiRes.data.primary_state;

        // Save to session if applicable - always process (including absent)
        if (req.body.sessionId && primaryState) {
            const session = await Session.findById(req.body.sessionId);
            if (session) {
                const studentState = session.studentStates.find(
                    s => s.student.toString() === req.user._id.toString());
                if (studentState) {
                    const det = primaryState;
                    studentState.states.push({
                        state: det.class_name, confidence: det.confidence, timestamp: new Date()
                    });

                    // Check alerts - absent also counts as not paying attention
                    const recentStates = studentState.states.slice(-10);
                    const problemStates = ['distracted', 'phone_usage', 'drowsy', 'absent'];
                    const problemCount = recentStates.filter(
                        s => problemStates.includes(s.state)).length;

                    if (problemCount >= 6) {
                        const dominantState = recentStates
                            .filter(s => problemStates.includes(s.state))
                            .reduce((acc, s) => { acc[s.state] = (acc[s.state] || 0) + 1; return acc; }, {});
                        const worstState = Object.entries(dominantState)
                            .sort((a, b) => b[1] - a[1])[0][0];

                        const stateMessages = {
                            absent: `${req.user.name} rời khỏi màn hình (${problemCount * 5} giây)`,
                            distracted: `${req.user.name} mất tập trung trong ${problemCount * 5} giây`,
                            drowsy: `${req.user.name} có dấu hiệu buồn ngủ`,
                            phone_usage: `${req.user.name} đang sử dụng điện thoại`
                        };

                        studentState.alerts.push({
                            message: stateMessages[worstState] || `${req.user.name} không tập trung`,
                            type: worstState === 'absent' ? 'danger' : 'warning',
                            timestamp: new Date()
                        });

                        // Emit via socket
                        const io = req.app.get('io');
                        if (io) io.to(`session_${req.body.sessionId}`).emit('alert', {
                            studentId: req.user._id, studentName: req.user.name,
                            message: stateMessages[worstState],
                            state: worstState, type: worstState === 'absent' ? 'danger' : 'warning'
                        });
                    }

                    // Update avg attention (only 'focused' counts as attentive)
                    const focused = studentState.states.filter(s => s.state === 'focused').length;
                    studentState.avgAttention = Math.round((focused / studentState.states.length) * 100);
                    await session.save();

                    // Real-time emit
                    const io = req.app.get('io');
                    if (io) io.to(`session_${req.body.sessionId}`).emit('studentState', {
                        studentId: req.user._id, studentName: req.user.name,
                        state: det.class_name, confidence: det.confidence,
                        avgAttention: studentState.avgAttention,
                        noPersonDetected: aiRes.data.no_person_detected,
                        consecutiveAbsent: aiRes.data.consecutive_absent
                    });
                }
            }
        }
        res.json(aiRes.data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Recommendation ──
router.post('/recommend', auth, async (req, res) => {
    try {
        const payload = {
            user_id: req.user._id.toString(),
            avg_daily_study_min: req.user.stats?.totalStudyMin || 60,
            login_freq_weekly: Math.min(7, req.user.stats?.loginCount || 1),
            scores: req.body.scores || [],
            time_spent: req.body.time_spent || [],
            completed_lessons: req.body.completed_lessons || [],
            forum_posts: req.body.forum_posts || 0,
            role: req.user.role,
            preferred_subjects: req.user.preferredSubjects || []
        };

        const aiRes = await axios.post(`${process.env.AI_RECOMMEND_URL}/recommend`, payload,
            { timeout: 30000 });
        res.json(aiRes.data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Engagement Analysis ──
router.post('/engagement', auth, async (req, res) => {
    try {
        const payload = {
            user_id: req.user._id.toString(),
            avg_daily_study_min: req.body.studyMin || 60,
            login_freq_weekly: req.body.loginFreq || 3,
            scores: req.body.scores || [],
            time_spent: req.body.timeSpent || [],
            role: req.user.role
        };
        const aiRes = await axios.post(`${process.env.AI_RECOMMEND_URL}/analyze-engagement`,
            payload, { timeout: 15000 });

        // Update user engagement
        if (aiRes.data.engagement) {
            req.user.stats.engagementLevel = aiRes.data.engagement;
            await req.user.save();
        }
        res.json(aiRes.data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── [D6] GET /api/ai/my-data — Tổng hợp data thực tế từ DB → gọi AI ──
router.get('/my-data', auth, async (req, res) => {
    try {
        const userId = req.user._id;
        const AttendanceSession = require('../models/Attendance');
        const Assignment = require('../models/Assignment');
        const Classroom = require('../models/Classroom');

        // 1. Lấy tất cả lớp học của user
        const classroomQuery = req.user.role === 'teacher'
            ? { teacher: userId }
            : { students: userId };
        const classrooms = await Classroom.find({ ...classroomQuery, isActive: true })
            .select('_id name subject');

        const classroomIds = classrooms.map(c => c._id);

        // 2. Lấy điểm từ bài tập đã chấm
        const assignments = await Assignment.find({
            classroom: { $in: classroomIds },
            isPublished: true,
        }).lean();

        const scores = [];
        const timeSpent = [];
        const completedLessons = [];
        const subjectScores = {};  // subject → [scores]

        for (const assign of assignments) {
            const mySub = assign.submissions?.find(
                s => s.student.toString() === userId.toString() && s.score !== null
            );
            if (mySub) {
                const pct = Math.round((mySub.score / (mySub.maxScore || assign.maxScore || 100)) * 100);
                scores.push(pct);
                timeSpent.push(30); // default 30 min per assignment
                completedLessons.push(assign._id.toString());

                // Map by classroom subject
                const cls = classrooms.find(c => c._id.toString() === assign.classroom.toString());
                if (cls?.subject) {
                    if (!subjectScores[cls.subject]) subjectScores[cls.subject] = [];
                    subjectScores[cls.subject].push(pct);
                }
            }
        }

        // 3. Tính tỉ lệ điểm danh → thêm vào scores nếu ít bài tập
        const attSessions = await AttendanceSession.find({
            classroom: { $in: classroomIds }
        }).select('records').lean();

        let attendedCount = 0;
        let totalSessions = attSessions.length;
        for (const sess of attSessions) {
            const rec = sess.records?.find(r => r.student.toString() === userId.toString());
            if (rec?.status === 'present') attendedCount++;
        }
        const attendanceRate = totalSessions > 0 ? Math.round(attendedCount / totalSessions * 100) : 70;

        // 4. User stats
        const avgDailyStudy = req.user.stats?.totalStudyMin
            ? Math.round(req.user.stats.totalStudyMin / Math.max(1, req.user.stats.loginCount || 1))
            : 45;
        const loginFreq = Math.min(7, req.user.stats?.loginCount || 1);

        // Nếu không có scores từ bài tập → dùng attendance rate như một điểm
        if (scores.length === 0) {
            scores.push(attendanceRate);
            timeSpent.push(avgDailyStudy);
        }

        // 5. Gọi AI recommendation (chỉ lấy engagement analysis)
        let engagement = null;
        try {
            const payload = {
                user_id: userId.toString(),
                avg_daily_study_min: avgDailyStudy,
                login_freq_weekly: loginFreq,
                scores,
                time_spent: timeSpent,
                completed_lessons: completedLessons,
                forum_posts: 0,
                role: req.user.role,
                preferred_subjects: req.user.preferredSubjects || [],
            };
            const aiRes = await axios.post(`${process.env.AI_RECOMMEND_URL}/recommend`, payload, { timeout: 30000 });
            engagement = aiRes.data.engagement || null;

            // Update engagement level trong DB
            if (engagement?.engagement) {
                await req.user.constructor.findByIdAndUpdate(userId, {
                    'stats.engagementLevel': engagement.engagement
                });
            }
        } catch (aiErr) {
            console.warn('[AI my-data] AI service unavailable, using local data only:', aiErr.message);
        }

        // 6. Tính toán dữ liệu THẬT từ DB — không dùng dataset giả
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

        // Weak subjects — môn có điểm TB < 70 (từ dữ liệu thật)
        const weakSubjects = [];
        for (const [subject, subScores] of Object.entries(subjectScores)) {
            const avg = Math.round(subScores.reduce((a, b) => a + b, 0) / subScores.length);
            if (avg < 70) {
                let suggestion = '';
                if (avg < 40) suggestion = 'Cần ôn tập lại kiến thức cơ bản ngay';
                else if (avg < 55) suggestion = 'Nên luyện thêm bài tập và xem lại lý thuyết';
                else suggestion = 'Gần đạt yêu cầu, cần luyện tập thêm một chút';
                weakSubjects.push({ subject, avg_score: avg, suggestion });
            }
        }
        weakSubjects.sort((a, b) => a.avg_score - b.avg_score);

        // Gợi ý tiếp theo — dựa trên lớp học THẬT mà sinh viên đang tham gia
        const nextLessons = [];
        for (const cls of classrooms) {
            const clsAssignments = assignments.filter(a => a.classroom.toString() === cls._id.toString());
            const clsScores = subjectScores[cls.subject] || [];
            const clsAvg = clsScores.length > 0 ? Math.round(clsScores.reduce((a, b) => a + b, 0) / clsScores.length) : null;

            // Tính bài chưa nộp
            const notSubmitted = clsAssignments.filter(a => {
                const sub = a.submissions?.find(s => s.student.toString() === userId.toString());
                return !sub;
            }).length;

            let difficulty = 'medium';
            let predicted = 70;
            if (clsAvg !== null) {
                if (clsAvg >= 85) { difficulty = 'hard'; predicted = Math.min(95, clsAvg + 5); }
                else if (clsAvg >= 60) { difficulty = 'medium'; predicted = Math.round(clsAvg * 1.05); }
                else { difficulty = 'easy'; predicted = Math.round(clsAvg * 1.1); }
            }

            nextLessons.push({
                classroom_id: cls._id,
                classroom_name: cls.name,
                subject: cls.subject || cls.name,
                difficulty,
                predicted_score: Math.min(100, predicted),
                total_assignments: clsAssignments.length,
                not_submitted: notSubmitted,
                avg_score: clsAvg,
            });
        }
        // Sắp xếp: ưu tiên lớp có bài chưa nộp, sau đó lớp điểm thấp
        nextLessons.sort((a, b) => (b.not_submitted - a.not_submitted) || ((a.avg_score ?? 999) - (b.avg_score ?? 999)));

        // Warnings — cảnh báo dựa trên dữ liệu thật
        const warnings = [];
        if (engagement?.engagement === 'at_risk') {
            warnings.push({ type: 'critical', icon: '🔴', message: 'Mức độ tương tác rất thấp! Cần tăng cường học tập ngay.' });
        } else if (engagement?.engagement === 'low') {
            warnings.push({ type: 'warning', icon: '🟡', message: 'Mức độ tương tác thấp. Nên tham gia lớp học và làm bài tập thường xuyên hơn.' });
        }
        if (avgScore > 0 && avgScore < 50) {
            warnings.push({ type: 'warning', icon: '📉', message: `Điểm trung bình thấp (${avgScore}/100). Cần ôn tập lại kiến thức.` });
        }
        if (attendanceRate < 80 && totalSessions > 0) {
            warnings.push({ type: 'warning', icon: '📋', message: `Tỉ lệ điểm danh chỉ ${attendanceRate}%. Cần đi học đầy đủ hơn.` });
        }
        const totalNotSubmitted = assignments.filter(a => !a.submissions?.find(s => s.student.toString() === userId.toString())).length;
        if (totalNotSubmitted > 0) {
            warnings.push({ type: 'warning', icon: '📝', message: `Còn ${totalNotSubmitted} bài tập chưa nộp. Hãy hoàn thành sớm!` });
        }

        res.json({
            engagement,
            next_lessons: nextLessons,
            weak_subjects: weakSubjects,
            warnings,
            stats: {
                avg_score: avgScore,
                total_completed: scores.length,
                total_lessons: assignments.length,
                completion_rate: assignments.length > 0 ? Math.round(scores.length / assignments.length * 100) / 100 : 0,
            },
            meta: {
                classrooms: classrooms.map(c => ({ id: c._id, name: c.name, subject: c.subject })),
                attendanceRate,
                totalAssignments: assignments.length,
                gradedAssignments: scores.length,
                subjectScores,
                totalNotSubmitted,
            }
        });
    } catch (err) {
        console.error('[AI my-data] error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── AI Services Health ──
router.get('/health', async (req, res) => {
    const checks = {};
    const services = [
        { name: 'vision', url: process.env.AI_VISION_URL },
        { name: 'voice', url: process.env.AI_VOICE_URL },
        { name: 'recommendation', url: process.env.AI_RECOMMEND_URL },
    ];
    for (const svc of services) {
        try {
            const r = await axios.get(`${svc.url}/health`, { timeout: 5000 });
            checks[svc.name] = { status: 'ok', ...r.data };
        } catch (e) { checks[svc.name] = { status: 'down', error: e.message }; }
    }
    res.json({ services: checks });
});

module.exports = router;
