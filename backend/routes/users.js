const express = require('express');
const User = require('../models/User');
const Course = require('../models/Course');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// Get all users (admin only)
router.get('/', auth, authorize('admin'), async (req, res) => {
    try {
        const { role, page = 1, limit = 20 } = req.query;
        const query = role ? { role } : {};
        const users = await User.find(query).select('-password')
            .skip((page - 1) * limit).limit(parseInt(limit)).sort('-createdAt');
        const total = await User.countDocuments(query);
        res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password')
            .populate('enrolledCourses', 'title subject');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update user (admin: name, role, isActive; self: name)
router.put('/:id', auth, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin')
            return res.status(403).json({ error: 'Not authorized' });

        const updates = {};
        ['name', 'preferredSubjects', 'avatar'].forEach(f => {
            if (req.body[f] !== undefined) updates[f] = req.body[f];
        });
        if (req.user.role === 'admin') {
            if (req.body.role) updates.role = req.body.role;
            if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
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

// Get dashboard stats (admin)
router.get('/admin/stats', auth, authorize('admin'), async (req, res) => {
    try {
        const [totalUsers, students, teachers, courses] = await Promise.all([
            User.countDocuments(), User.countDocuments({ role: 'student' }),
            User.countDocuments({ role: 'teacher' }), Course.countDocuments()
        ]);
        const voiceRegistered = await User.countDocuments({ voiceRegistered: true });
        const engagementDist = {
            high: await User.countDocuments({ 'stats.engagementLevel': 'high' }),
            medium: await User.countDocuments({ 'stats.engagementLevel': 'medium' }),
            low: await User.countDocuments({ 'stats.engagementLevel': 'low' }),
            at_risk: await User.countDocuments({ 'stats.engagementLevel': 'at_risk' }),
        };
        res.json({ totalUsers, students, teachers, courses, voiceRegistered, engagementDist });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
