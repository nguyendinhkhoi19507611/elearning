const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentName: { type: String, required: true },
    studentEmail: { type: String },
    status: {
        type: String,
        enum: ['present', 'absent', 'late', 'excused'],
        default: 'absent'
    },
    verifiedAt: Date,          // Thời điểm xác thực khuôn mặt thành công
    faceVerified: { type: Boolean, default: false },
    faceDistance: Number,      // Khoảng cách nhận diện (càng nhỏ càng giống)
    joinedAt: Date,            // Thời điểm vào phòng
    notes: String,
});

const attendanceSessionSchema = new mongoose.Schema({
    classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Thời gian điểm danh
    date: { type: Date, required: true },           // Ngày học
    startTime: { type: String, required: true },    // "11:00"
    endTime: { type: String, required: true },      // "11:05"
    startedAt: { type: Date, required: true },      // Thời điểm bắt đầu thực tế
    endedAt: Date,                                  // Thời điểm kết thúc thực tế

    status: {
        type: String,
        enum: ['active', 'ended', 'cancelled'],
        default: 'active'
    },

    // Danh sách điểm danh
    records: [attendanceRecordSchema],

    // File export
    exportedFile: String,   // Path file CSV/XLSX sau khi xuất

    // Settings
    requireFaceVerify: { type: Boolean, default: true },
    lateAfterMinutes: { type: Number, default: 0 }, // Vào sau N phút thì tính trễ
}, { timestamps: true });

// Index
attendanceSessionSchema.index({ classroom: 1, date: -1 });
attendanceSessionSchema.index({ status: 1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
