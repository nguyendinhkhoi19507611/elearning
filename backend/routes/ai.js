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
