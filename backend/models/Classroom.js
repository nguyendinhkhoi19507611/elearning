const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    description: { type: String, default: '' },
    // [D1] Mã lớp, học kỳ, năm học
    classCode: { type: String, unique: true, sparse: true, trim: true }, // VD: CS101-2024A
    semester: { type: String, trim: true },     // VD: HK1 2024-2025
    academicYear: { type: String, trim: true }, // VD: 2024-2025
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Schedule
    schedule: {
        dayOfWeek: [{ type: Number, min: 0, max: 6 }], // 0=Sun, 1=Mon...
        startTime: { type: String, required: true },     // "08:00"
        endTime: { type: String, required: true },       // "10:00"
        startDate: Date,
        endDate: Date,
    },

    // Meeting state
    meeting: {
        isLive: { type: Boolean, default: false },
        startedAt: Date,
        endedAt: Date,
        participants: [{
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            role: { type: String, enum: ['teacher', 'student'] },
            joinedAt: Date,
            leftAt: Date,
            cameraOn: { type: Boolean, default: true },
            micOn: { type: Boolean, default: true },
        }],
    },

    // Settings
    settings: {
        cameraRequired: { type: Boolean, default: true },
        autoRecord: { type: Boolean, default: false },
        maxStudents: { type: Number, default: 50 },
        aiMonitoring: { type: Boolean, default: true },
    },

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Recordings
    recordings: [{
        filename: String,
        originalName: String,
        size: Number,
        duration: Number, // seconds
        url: String,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        uploadedByName: String,
        createdAt: { type: Date, default: Date.now },
    }],
}, { timestamps: true });

// Index for schedule queries
classroomSchema.index({ 'schedule.dayOfWeek': 1, 'schedule.startTime': 1 });
classroomSchema.index({ teacher: 1 });
classroomSchema.index({ students: 1 });

module.exports = mongoose.model('Classroom', classroomSchema);
