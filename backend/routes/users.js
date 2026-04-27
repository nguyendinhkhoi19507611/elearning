const express = require('express');
const User = require('../models/User');
const Course = require('../models/Course');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// [B3 FIX] QUAN TRỌNG: Các route cụ thể PHẢI khai báo TRƯỚC /:id
// Nếu để sau, Express sẽ match "admin" và "profile" như userId → lỗi

// Get dashboard stats (admin)
router.get('/admin/stats', auth, authorize('admin'), async (req, res) => {
    try {
        const [totalUsers, students, teachers, courses] = await Promise.all([
            User.countDocuments(), User.countDocuments({ role: 'student' }),
            User.countDocuments({ role: 'teacher' }), Course.countDocuments()
        ]);
        const voiceRegistered = await User.countDocuments({ voiceRegistered: true });
        const faceRegistered = await User.countDocuments({ faceRegistered: true });
        const engagementDist = {
            high: await User.countDocuments({ 'stats.engagementLevel': 'high' }),
            medium: await User.countDocuments({ 'stats.engagementLevel': 'medium' }),
            low: await User.countDocuments({ 'stats.engagementLevel': 'low' }),
            at_risk: await User.countDocuments({ 'stats.engagementLevel': 'at_risk' }),
        };
        res.json({ totalUsers, students, teachers, courses, voiceRegistered, faceRegistered, engagementDist });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// [E3] GET /api/users/profile/me — Lấy profile bản thân
router.get('/profile/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password');
        // [BUG-14 FIX] Bỏ populate('enrolledCourses') — field legacy không dùng trong hệ thống classroom
        res.json({ user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// [E3] PUT /api/users/profile/me — Cập nhật profile bản thân
router.put('/profile/me', auth, async (req, res) => {
    try {
        const allowed = ['name', 'phone', 'department', 'preferredSubjects', 'avatar'];
        const updates = {};
        allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

        const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
        res.json({ user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get all users (admin only)
router.get('/', auth, authorize('admin'), async (req, res) => {
    try {
        const { role, page = 1, limit = 50, search } = req.query;
        const query = role ? { role } : {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { studentId: { $regex: search, $options: 'i' } },
                { teacherId: { $regex: search, $options: 'i' } },
            ];
        }
        const users = await User.find(query).select('-password')
            .skip((page - 1) * limit).limit(parseInt(limit)).sort('-createdAt');
        const total = await User.countDocuments(query);
        res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        // [BUG-14 FIX] Bỏ populate('enrolledCourses') — field legacy không dùng
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update user (admin: name, role, isActive; self: name, phone, department...)
router.put('/:id', auth, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin')
            return res.status(403).json({ error: 'Not authorized' });

        const updates = {};
        ['name', 'preferredSubjects', 'avatar', 'phone', 'department'].forEach(f => {
            if (req.body[f] !== undefined) updates[f] = req.body[f];
        });
        if (req.user.role === 'admin') {
            if (req.body.role) updates.role = req.body.role;
            if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
            // Admin có thể set studentId/teacherId/subjects
            if (req.body.studentId !== undefined) updates.studentId = req.body.studentId || undefined;
            if (req.body.teacherId !== undefined) updates.teacherId = req.body.teacherId || undefined;
            if (req.body.subjects !== undefined) updates.subjects = req.body.subjects;
        }

        const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Toggle lock/unlock account (admin only)
router.patch('/:id/toggle-lock', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        if (req.user._id.toString() === req.params.id)
            return res.status(400).json({ error: 'Cannot lock your own account' });

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.isActive = !user.isActive;
        await user.save();
        res.json({ user, isActive: user.isActive });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete user (admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        if (req.user._id.toString() === req.params.id)
            return res.status(400).json({ error: 'Cannot delete your own account' });

        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
