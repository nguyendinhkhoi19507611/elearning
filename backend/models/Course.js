const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    subject: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'advanced'], default: 'medium' },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    maxStudents: { type: Number, default: 50 },
    schedule: { day: String, startTime: String, endTime: String },
    isActive: { type: Boolean, default: true },
    enableCamera: { type: Boolean, default: true },
    enableVoiceAuth: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);
