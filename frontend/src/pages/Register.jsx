import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiUser, FiMail, FiLock, FiBookOpen, FiAlertCircle, FiEye, FiEyeOff, FiInfo } from 'react-icons/fi';

export default function Register() {
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            // [A7] Luôn đăng ký role='student' — giáo viên do admin tạo
            await register(form.name, form.email, form.password, 'student');
            navigate('/student');
        } catch (err) {
            setError(err.response?.data?.error || 'Đăng ký thất bại');
        } finally { setLoading(false); }
    };

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

                <h2 className="auth-heading">Tạo tài khoản sinh viên</h2>
                <p className="auth-subheading">Bắt đầu hành trình học tập cùng AI</p>

                {/* [A7] Policy notice */}
                <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: 'var(--accent-light)', border: '1px solid var(--border-accent)',
                    padding: '10px 14px', borderRadius: '10px', marginBottom: '20px',
                    fontSize: '0.82em', color: 'var(--accent)'
                }}>
                    <FiInfo size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>Đây là đăng ký tài khoản <strong>sinh viên</strong>. Tài khoản giáo viên do quản trị viên tạo.</span>
                </div>

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

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label"><FiUser size={13} /> Họ và tên</label>
                        <div className="form-input-icon">
                            <span className="icon"><FiUser size={15} /></span>
                            <input
                                className="form-input"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="Nguyễn Văn A"
                                required autoComplete="name"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label"><FiMail size={13} /> Email</label>
                        <div className="form-input-icon">
                            <span className="icon"><FiMail size={15} /></span>
                            <input
                                className="form-input"
                                type="email" value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                placeholder="your@email.com"
                                required autoComplete="email"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label"><FiLock size={13} /> Mật khẩu</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="form-input"
                                type={showPass ? 'text' : 'password'}
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                placeholder="Tối thiểu 6 ký tự"
                                minLength={6} required autoComplete="new-password"
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

                    <button className="btn btn-primary btn-lg btn-block" disabled={loading}>
                        {loading
                            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Đang tạo...</>
                            : 'Tạo tài khoản sinh viên'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.84em', color: 'var(--text-muted)' }}>
                    Đã có tài khoản?{' '}
                    <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Đăng nhập</Link>
                </p>
            </div>
        </div>
    );
}
