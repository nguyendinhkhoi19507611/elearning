const mongoose = require('mongoose');

// ── Submission (bài làm của sinh viên) ──
const submissionSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentName: String,
    studentId: String,      // mã SV
    // Nội dung nộp
    content: String,        // text / link
    fileUrl: String,        // đường dẫn file upload
    fileName: String,
    submittedAt: { type: Date, default: Date.now },
    // Chấm điểm
    score: { type: Number, default: null },     // null = chưa chấm
    maxScore: Number,
    feedback: String,
    gradedAt: Date,
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
        type: String,
        enum: ['submitted', 'late', 'graded', 'returned'],
        default: 'submitted'
    },
}, { timestamps: true });

// ── Assignment (bài tập của giáo viên) ──
const assignmentSchema = new mongoose.Schema({
    classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: {
        type: String,
        enum: ['homework', 'quiz', 'project', 'exam'],
        default: 'homework'
    },
    // Thời hạn
    assignedAt: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    // Điểm
    maxScore: { type: Number, default: 100 },
    // File đính kèm (đề bài)
    attachments: [{
        url: String,
        name: String,
        size: Number,
    }],
    // Cài đặt
    allowLate: { type: Boolean, default: false },
    latePenaltyPercent: { type: Number, default: 0 },  // % trừ điểm mỗi ngày trễ
    isPublished: { type: Boolean, default: true },

    // Bài làm của sinh viên
    submissions: [submissionSchema],
}, { timestamps: true });

// Index
assignmentSchema.index({ classroom: 1, dueDate: -1 });
assignmentSchema.index({ classroom: 1, isPublished: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
