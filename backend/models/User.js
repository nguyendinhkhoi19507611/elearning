const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
    // [D1] Mã định danh thực tế
    studentId: { type: String, unique: true, sparse: true, trim: true }, // VD: SV001234
    teacherId: { type: String, unique: true, sparse: true, trim: true }, // VD: GV00012
    department: { type: String, trim: true },   // Khoa / Bộ môn
    phone: { type: String, trim: true },
    avatar: String,
    voiceRegistered: { type: Boolean, default: false },
    voiceId: String, // links to voice AI service
    faceRegistered: { type: Boolean, default: false },
    faceId: String, // links to face AI service
    preferredSubjects: [String],
    subjects: [{ type: String, trim: true }],  // Môn dạy (cho giáo viên)
    enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    // Learning stats
    stats: {
        totalStudyMin: { type: Number, default: 0 },
        loginCount: { type: Number, default: 0 },
        avgScore: { type: Number, default: 0 },
        lastActive: Date,
        engagementLevel: { type: String, enum: ['high', 'medium', 'low', 'at_risk'], default: 'medium' },
    },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
