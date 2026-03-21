const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: String,
    startTime: { type: Date, default: Date.now },
    endTime: Date,
    isLive: { type: Boolean, default: false },
    // Student states tracked by AI
    studentStates: [{
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        states: [{
            state: { type: String, enum: ['focused', 'distracted', 'drowsy', 'absent', 'phone_usage'] },
            confidence: Number,
            timestamp: { type: Date, default: Date.now },
        }],
        avgAttention: { type: Number, default: 0 },
        alerts: [{ message: String, type: String, timestamp: Date }],
    }],
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
