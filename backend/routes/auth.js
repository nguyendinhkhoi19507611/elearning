const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const User = require('../models/User');
const OtpToken = require('../models/OtpToken'); // [BUG-04 FIX] MongoDB-backed OTP
const { auth } = require('../middleware/auth');
const { sendOtpEmail } = require('../utils/mailer');

const router = express.Router();
const upload = multer({ dest: 'uploads/voice/', limits: { fileSize: 10 * 1024 * 1024 } });

// [BUG-04 FIX] OTP nay ưu trong MongoDB (TTL 5 phút) thay vì in-memory Map
// Không cần otpStore nữa — dùng OtpToken model

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
        // [BUG-12 FIX] Dung async unlink (ignore error) thay vi unlinkSync de tranh crash
        if (req.file) fs.unlink(req.file.path, () => {});
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

// ── Forgot Password (gửi OTP) ──
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Vui lòng nhập email' });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ error: 'Email không tồn tại trong hệ thống' });

        if (user.isActive === false)
            return res.status(403).json({ error: 'Tài khoản đã bị khóa' });

        const code = String(Math.floor(100000 + Math.random() * 900000));

        // [BUG-04 FIX] Luu OTP vao MongoDB (TTL 5 phut) thay vi Map
        await OtpToken.findOneAndDelete({ email: email.toLowerCase() }); // xoa OTP cu neu co
        await OtpToken.create({ email: email.toLowerCase(), code });

        if (process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_USER !== 'your_email@gmail.com') {
            try {
                await sendOtpEmail(email, code, user.name);
                console.log(`📧 OTP đã gửi email thật đến: ${email}`);
            } catch (mailErr) {
                console.error('❌ Gửi email thất bại:', mailErr.message);
                console.log(`📧 Fallback — OTP cho ${email}: ${code}`);
            }
        } else {
            console.log(`\n📧 ════════════════════════════════════════`);
            console.log(`📧  OTP cho ${email}: ${code}`);
            console.log(`📧  Hết hạn sau 5 phút`);
            console.log(`📧  ⚠️  Cấu hình SMTP trong .env để gửi email thật`);
            console.log(`📧 ════════════════════════════════════════\n`);
        }

        res.json({ success: true, message: 'Mã OTP đã được gửi đến email của bạn' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Reset Password (xác thực OTP + đặt mật khẩu mới) ──
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword)
            return res.status(400).json({ error: 'Thiếu thông tin' });

        if (newPassword.length < 6)
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });

        // [BUG-04 FIX] Tra cuu OTP tu MongoDB
        const stored = await OtpToken.findOne({ email: email.toLowerCase() });
        if (!stored)
            return res.status(400).json({ error: 'Chưa yêu cầu OTP hoặc OTP đã hết hạn' });

        if (stored.code !== otp.trim())
            return res.status(400).json({ error: 'Mã OTP không đúng' });

        // OTP hợp lệ → đổi mật khẩu
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ error: 'Tài khoản không tồn tại' });

        user.password = newPassword; // pre-save hook sẽ hash
        await user.save();

        // Xóa OTP đã dùng
        await OtpToken.findOneAndDelete({ email: email.toLowerCase() });

        console.log(`✅ Password reset thành công cho: ${email}`);
        res.json({ success: true, message: 'Đặt lại mật khẩu thành công! Hãy đăng nhập lại.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Change Password (khi đã đăng nhập) ──
router.post('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword)
            return res.status(400).json({ error: 'Thiếu thông tin' });

        if (newPassword.length < 6)
            return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });

        // Kiểm tra mật khẩu hiện tại
        const isMatch = await req.user.comparePassword(currentPassword);
        if (!isMatch)
            return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });

        if (currentPassword === newPassword)
            return res.status(400).json({ error: 'Mật khẩu mới phải khác mật khẩu hiện tại' });

        req.user.password = newPassword; // pre-save hook sẽ hash
        await req.user.save();

        res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
