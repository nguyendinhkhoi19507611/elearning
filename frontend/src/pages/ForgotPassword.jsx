import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../api/api';
import {
    FiMail, FiLock, FiArrowLeft, FiCheckCircle,
    FiAlertCircle, FiShield, FiEye, FiEyeOff, FiBookOpen
} from 'react-icons/fi';

const STEPS = { EMAIL: 0, OTP: 1, NEW_PASS: 2, DONE: 3 };

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [step, setStep] = useState(STEPS.EMAIL);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Step 1: Gửi OTP
    const handleSendOtp = async (e) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const res = await authAPI.forgotPassword(email);
            setStep(STEPS.OTP);
        } catch (err) {
            setError(err.response?.data?.error || 'Không thể gửi OTP');
        } finally { setLoading(false); }
    };

    // Step 2: Xác nhận OTP
    const handleVerifyOtp = (e) => {
        e.preventDefault();
        if (otp.trim().length !== 6) {
            setError('Mã OTP phải có 6 chữ số');
            return;
        }
        setError('');
        setStep(STEPS.NEW_PASS);
    };

    // Step 3: Đặt mật khẩu mới
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        if (newPassword.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp');
            return;
        }
        setLoading(true);
        try {
            await authAPI.resetPassword({ email, otp: otp.trim(), newPassword });
            setStep(STEPS.DONE);
        } catch (err) {
            setError(err.response?.data?.error || 'Không thể đặt lại mật khẩu');
        } finally { setLoading(false); }
    };

    const renderStepIndicator = () => (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            {[0, 1, 2].map(i => (
                <div key={i} style={{
                    width: i <= step ? 32 : 24, height: 6, borderRadius: 3,
                    background: i <= step ? 'var(--accent)' : 'var(--border)',
                    transition: 'all 0.3s ease'
                }} />
            ))}
        </div>
    );

    return (
        <div className="auth-container">
            <div className="auth-card fade-slide-up">
                {/* Logo */}
                <div className="auth-logo">
                    <div className="auth-logo-icon">
                        <FiBookOpen size={22} color="white" />
                    </div>
                    <span className="auth-title">EduAI Platform</span>
                </div>

                {step === STEPS.DONE ? (
                    // ── Step 4: Thành công ──
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
                            background: 'var(--success-light)', border: '2px solid var(--success)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <FiCheckCircle size={28} color="var(--success)" />
                        </div>
                        <h2 className="auth-heading">Đặt lại thành công!</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.9em' }}>
                            Mật khẩu đã được cập nhật. Hãy đăng nhập với mật khẩu mới.
                        </p>
                        <button className="btn btn-primary btn-lg btn-block" onClick={() => navigate('/login')}>
                            <FiArrowLeft size={15} /> Về trang đăng nhập
                        </button>
                    </div>
                ) : (
                    <>
                        <h2 className="auth-heading">Quên mật khẩu</h2>
                        <p className="auth-subheading">
                            {step === STEPS.EMAIL && 'Nhập email để nhận mã OTP'}
                            {step === STEPS.OTP && 'Nhập mã OTP đã gửi đến email'}
                            {step === STEPS.NEW_PASS && 'Tạo mật khẩu mới cho tài khoản'}
                        </p>

                        {renderStepIndicator()}

                        {/* Error */}
                        {error && (
                            <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                background: 'var(--danger-light)', border: '1px solid rgba(255,77,106,0.3)',
                                padding: '12px 14px', borderRadius: '10px', marginBottom: '20px',
                                fontSize: '0.84em', color: 'var(--danger)'
                            }}>
                                <FiAlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* ── Step 1: Nhập Email ── */}
                        {step === STEPS.EMAIL && (
                            <form onSubmit={handleSendOtp}>
                                <div className="form-group">
                                    <label className="form-label"><FiMail size={13} /> Email đăng ký</label>
                                    <div className="form-input-icon">
                                        <span className="icon"><FiMail size={15} /></span>
                                        <input
                                            className="form-input"
                                            type="email" value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="your@email.com"
                                            required autoFocus
                                        />
                                    </div>
                                </div>
                                <button className="btn btn-primary btn-lg btn-block" disabled={loading} style={{ marginTop: 8 }}>
                                    {loading
                                        ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Đang gửi...</>
                                        : 'Gửi mã OTP'
                                    }
                                </button>
                            </form>
                        )}

                        {/* ── Step 2: Nhập OTP ── */}
                        {step === STEPS.OTP && (
                            <form onSubmit={handleVerifyOtp}>
                                <div className="form-group">
                                    <label className="form-label"><FiShield size={13} /> Mã OTP (6 chữ số)</label>
                                    <input
                                        className="form-input"
                                        type="text" value={otp}
                                        onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="000000"
                                        maxLength={6}
                                        required autoFocus
                                        style={{ textAlign: 'center', fontSize: '1.5em', letterSpacing: 8, fontWeight: 700 }}
                                    />
                                    <p style={{ fontSize: '0.78em', color: 'var(--text-muted)', marginTop: 6 }}>
                                        Đã gửi đến <strong>{email}</strong>. Mã có hiệu lực 5 phút.
                                    </p>
                                </div>
                                <button className="btn btn-primary btn-lg btn-block" disabled={loading} style={{ marginTop: 8 }}>
                                    Xác nhận OTP
                                </button>
                                <button type="button" className="btn btn-outline btn-block" style={{ marginTop: 8 }}
                                    onClick={handleSendOtp} disabled={loading}>
                                    Gửi lại mã OTP
                                </button>
                            </form>
                        )}

                        {/* ── Step 3: Mật khẩu mới ── */}
                        {step === STEPS.NEW_PASS && (
                            <form onSubmit={handleResetPassword}>
                                <div className="form-group">
                                    <label className="form-label"><FiLock size={13} /> Mật khẩu mới</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            className="form-input"
                                            type={showPass ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder="Ít nhất 6 ký tự"
                                            required autoFocus minLength={6}
                                            style={{ paddingRight: 44 }}
                                        />
                                        <button type="button" onClick={() => setShowPass(!showPass)} style={{
                                            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'var(--text-muted)', display: 'flex', padding: 4
                                        }}>
                                            {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label"><FiLock size={13} /> Xác nhận mật khẩu</label>
                                    <input
                                        className="form-input"
                                        type={showPass ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Nhập lại mật khẩu"
                                        required minLength={6}
                                    />
                                </div>
                                <button className="btn btn-primary btn-lg btn-block" disabled={loading} style={{ marginTop: 8 }}>
                                    {loading
                                        ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Đang xử lý...</>
                                        : 'Đặt lại mật khẩu'
                                    }
                                </button>
                            </form>
                        )}

                        <div style={{ textAlign: 'center', marginTop: 20 }}>
                            <Link to="/login" style={{ color: 'var(--accent)', fontSize: '0.875em', textDecoration: 'none' }}>
                                <FiArrowLeft size={12} style={{ verticalAlign: -1 }} /> Quay lại đăng nhập
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
