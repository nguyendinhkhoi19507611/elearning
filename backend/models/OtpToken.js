const mongoose = require('mongoose');

// [BUG-04 FIX] OTP lưu trong MongoDB với TTL tự xóa sau 5 phút
// Thay thế in-memory Map bị mất sau restart
const otpSchema = new mongoose.Schema({
    email: { type: String, required: true, lowercase: true, index: true },
    code:  { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 300 }, // TTL: 300 giây = 5 phút
});

module.exports = mongoose.model('OtpToken', otpSchema);
