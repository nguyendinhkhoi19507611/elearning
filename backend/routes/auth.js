const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ dest: 'uploads/voice/', limits: { fileSize: 10 * 1024 * 1024 } });

const generateToken = (user) => {
    return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
};

// ── Register ──
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (await User.findOne({ email }))
            return res.status(400).json({ error: 'Email already exists' });

        const user = await User.create({ name, email, password, role: role || 'student' });
        const token = generateToken(user);
        res.status(201).json({ token, user });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ── Login (email/password) ──
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password)))
            return res.status(401).json({ error: 'Invalid credentials' });

        if (user.isActive === false)
            return res.status(403).json({ error: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.' });

        user.stats.loginCount += 1;
        user.stats.lastActive = new Date();
        await user.save();

        const token = generateToken(user);
        res.json({ token, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Voice Login ──
router.post('/voice-login', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Audio file required' });

        // Send to Voice AI service for identification
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path));
        formData.append('threshold', '0.55'); // Lower threshold for browser audio

        const aiRes = await axios.post(`${process.env.AI_VOICE_URL}/identify`, formData, {
            headers: formData.getHeaders(), timeout: 30000
        });

        // Cleanup
        fs.unlinkSync(req.file.path);

        console.log('Voice identify result:', JSON.stringify(aiRes.data, null, 2));

        if (!aiRes.data.identified) {
            return res.status(401).json({
                error: 'Voice not recognized',
                details: aiRes.data,
                hint: aiRes.data.best_match
                    ? `Best match: ${aiRes.data.best_match.name} (${(aiRes.data.best_match.similarity * 100).toFixed(1)}%)`
                    : 'No matches found'
            });
        }

        const voiceUserId = aiRes.data.best_match.user_id;
        const user = await User.findOne({ voiceId: voiceUserId });
        if (!user) return res.status(401).json({ error: 'No account linked to this voice' });

        user.stats.loginCount += 1;
        user.stats.lastActive = new Date();
        await user.save();

        const token = generateToken(user);
        res.json({
            token, user,
            voice: {
                similarity: aiRes.data.best_match.similarity,
                name: aiRes.data.best_match.name
            }
        });
    } catch (err) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: err.message });
    }
});

// ── Voice Register ──
router.post('/voice-register', auth, upload.array('audio', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length < 3)
            return res.status(400).json({ error: 'Need at least 3 audio samples' });

        const formData = new FormData();
        formData.append('user_id', req.user._id.toString());
        formData.append('name', req.user.name);
        formData.append('role', req.user.role);
        req.files.forEach(f => formData.append('files', fs.createReadStream(f.path)));

        const aiRes = await axios.post(`${process.env.AI_VOICE_URL}/enroll`, formData, {
            headers: formData.getHeaders(), timeout: 60000
        });

        // Cleanup
        req.files.forEach(f => fs.unlinkSync(f.path));

        if (aiRes.data.success) {
            req.user.voiceRegistered = true;
            req.user.voiceId = req.user._id.toString();
            await req.user.save();
        }

        res.json({ success: aiRes.data.success, enrollment: aiRes.data });
    } catch (err) {
        if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) { } });
        res.status(500).json({ error: err.message });
    }
});

// ── Get current user ──
router.get('/me', auth, (req, res) => { res.json({ user: req.user }); });

module.exports = router;
