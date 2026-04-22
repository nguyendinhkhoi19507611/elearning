const nodemailer = require('nodemailer');

// Tạo transporter từ biến môi trường
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true cho port 465, false cho port 587
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

/**
 * Gửi email OTP đặt lại mật khẩu
 * @param {string} toEmail - Email người nhận
 * @param {string} otpCode - Mã OTP 6 chữ số
 * @param {string} userName - Tên người dùng
 */
const sendOtpEmail = async (toEmail, otpCode, userName = '') => {
    const transporter = createTransporter();
    const fromName = process.env.SMTP_FROM_NAME || 'EduAI Platform';

    const mailOptions = {
        from: `"${fromName}" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: `🔐 Mã OTP đặt lại mật khẩu - ${fromName}`,
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 0;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 28px 24px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 600;">🎓 ${fromName}</h1>
                    <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">Hệ thống E-Learning tích hợp AI</p>
                </div>

                <!-- Body -->
                <div style="background: #fff; padding: 28px 24px; border: 1px solid #e8e8e8; border-top: none;">
                    <p style="color: #333; font-size: 15px; margin: 0 0 8px;">Xin chào <strong>${userName || toEmail}</strong>,</p>
                    <p style="color: #666; font-size: 14px; margin: 0 0 24px; line-height: 1.5;">
                        Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng sử dụng mã OTP bên dưới:
                    </p>

                    <!-- OTP Code -->
                    <div style="background: #f7f7ff; border: 2px dashed #667eea; border-radius: 10px; padding: 20px; text-align: center; margin: 0 0 24px;">
                        <p style="color: #888; font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">Mã xác thực OTP</p>
                        <div style="font-size: 36px; font-weight: 700; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                            ${otpCode}
                        </div>
                    </div>

                    <!-- Warning -->
                    <div style="background: #fff8e1; border-left: 4px solid #ffc107; padding: 12px 14px; border-radius: 0 8px 8px 0; margin: 0 0 20px;">
                        <p style="color: #856404; font-size: 13px; margin: 0; line-height: 1.5;">
                            ⏰ Mã OTP có hiệu lực trong <strong>5 phút</strong>.<br>
                            🔒 Không chia sẻ mã này cho bất kỳ ai.
                        </p>
                    </div>

                    <p style="color: #999; font-size: 12px; margin: 0; line-height: 1.5;">
                        Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
                        Tài khoản của bạn vẫn an toàn.
                    </p>
                </div>

                <!-- Footer -->
                <div style="background: #f9f9f9; padding: 16px 24px; border-radius: 0 0 12px 12px; border: 1px solid #e8e8e8; border-top: none; text-align: center;">
                    <p style="color: #aaa; font-size: 11px; margin: 0;">
                        © 2026 ${fromName}. Email tự động, vui lòng không trả lời.
                    </p>
                </div>
            </div>
        `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email OTP đã gửi đến ${toEmail} (messageId: ${info.messageId})`);
    return info;
};

module.exports = { sendOtpEmail };
