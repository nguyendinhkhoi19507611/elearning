const express = require('express');
const Course = require('../models/Course');
const Session = require('../models/Session');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// Create course (teacher/admin)
router.post('/', auth, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const course = await Course.create({ ...req.body, teacher: req.user._id });
        res.status(201).json({ course });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// Get all courses
router.get('/', auth, async (req, res) => {
    try {
        const { subject, page = 1, limit = 20 } = req.query;
        const query = subject ? { subject, isActive: true } : { isActive: true };
        if (req.user.role === 'student') query.students = req.user._id;
        if (req.user.role === 'teacher') query.teacher = req.user._id;

        const courses = await Course.find(query).populate('teacher', 'name email')
            .skip((page - 1) * limit).limit(parseInt(limit));
        const total = await Course.countDocuments(query);
        res.json({ courses, total });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get course by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const course = await Course.findById(req.params.id)
            .populate('teacher', 'name email').populate('students', 'name email role stats');
        if (!course) return res.status(404).json({ error: 'Course not found' });
        res.json({ course });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Enroll student
router.post('/:id/enroll', auth, authorize('student'), async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ error: 'Course not found' });
        if (course.students.includes(req.user._id))
            return res.status(400).json({ error: 'Already enrolled' });
        if (course.students.length >= course.maxStudents)
            return res.status(400).json({ error: 'Course is full' });

        course.students.push(req.user._id);
        await course.save();
        req.user.enrolledCourses.push(course._id);
        await req.user.save();
        res.json({ message: 'Enrolled successfully', course });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Start live session (teacher)
router.post('/:id/session/start', auth, authorize('teacher'), async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        const session = await Session.create({
            course: course._id, teacher: req.user._id,
            title: req.body.title || `${course.title} - Live`,
            isLive: true, startTime: new Date(),
            studentStates: course.students.map(s => ({ student: s, states: [], avgAttention: 100 })),
        });
        res.status(201).json({ session });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// End session
router.post('/session/:id/end', auth, authorize('teacher'), async (req, res) => {
    try {
        const session = await Session.findByIdAndUpdate(req.params.id,
            { isLive: false, endTime: new Date() }, { new: true });
        res.json({ session });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get session with student states
router.get('/session/:id', auth, async (req, res) => {
    try {
        const session = await Session.findById(req.params.id)
            .populate('course', 'title subject')
            .populate('studentStates.student', 'name email');
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json({ session });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get active sessions for a course
router.get('/:id/sessions', auth, async (req, res) => {
    try {
        const sessions = await Session.find({ course: req.params.id })
            .sort('-startTime').limit(20).populate('teacher', 'name');
        res.json({ sessions });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
