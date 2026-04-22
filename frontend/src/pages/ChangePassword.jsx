import React, { useState } from 'react';
import { authAPI } from '../api/api';
import { FiLock, FiEye, FiEyeOff, FiCheckCircle, FiAlertCircle, FiShield } from 'react-icons/fi';

export default function ChangePassword() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');

        if (newPassword.length < 6) {
            setError('Mật khẩu mới phải có ít nhất 6 ký tự');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp');
            return;
        }

        setLoading(true);
        try {
            const res = await authAPI.changePassword({ currentPassword, newPassword });
            setSuccess(res.data.message);
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        } catch (err) {
            setError(err.response?.data?.error || 'Đổi mật khẩu thất bại');
        } finally { setLoading(false); }
    };

    const passInputStyle = { position: 'relative' };
    const eyeBtnStyle = {
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-muted)', display: 'flex', padding: 4
    };

    return (
        <>
            <div className="page-header">
                <h1 className="page-title"><FiShield size={22} style={{ verticalAlign: -3 }} /> Đổi mật khẩu</h1>
                <p className="page-subtitle">Cập nhật mật khẩu tài khoản của bạn</p>
            </div>

            <div className="card" style={{ maxWidth: 500 }}>
                {/* Success */}
                {success && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'var(--success-light)', border: '1px solid rgba(34,197,94,0.3)',
                        padding: '12px 14px', borderRadius: '10px', marginBottom: '20px',
                        fontSize: '0.87em', color: 'var(--success)'
                    }}>
                        <FiCheckCircle size={16} />
                        <span>{success}</span>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'var(--danger-light)', border: '1px solid rgba(255,77,106,0.3)',
                        padding: '12px 14px', borderRadius: '10px', marginBottom: '20px',
                        fontSize: '0.87em', color: 'var(--danger)'
                    }}>
                        <FiAlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label"><FiLock size={13} /> Mật khẩu hiện tại</label>
                        <div style={passInputStyle}>
                            <input
                                className="form-input"
                                type={showCurrent ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                placeholder="Nhập mật khẩu hiện tại"
                                required
                                style={{ paddingRight: 44 }}
                            />
                            <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={eyeBtnStyle}>
                                {showCurrent ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label"><FiLock size={13} /> Mật khẩu mới</label>
                        <div style={passInputStyle}>
                            <input
                                className="form-input"
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="Ít nhất 6 ký tự"
                                required minLength={6}
                                style={{ paddingRight: 44 }}
                            />
                            <button type="button" onClick={() => setShowNew(!showNew)} style={eyeBtnStyle}>
                                {showNew ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label"><FiLock size={13} /> Xác nhận mật khẩu mới</label>
                        <input
                            className="form-input"
                            type={showNew ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="Nhập lại mật khẩu mới"
                            required minLength={6}
                        />
                        {confirmPassword && newPassword !== confirmPassword && (
                            <p style={{ color: 'var(--danger)', fontSize: '0.78em', marginTop: 4 }}>
                                Mật khẩu không khớp
                            </p>
                        )}
                    </div>

                    <button
                        className="btn btn-primary btn-block"
                        disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                        style={{ marginTop: 8 }}
                    >
                        {loading
                            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Đang xử lý...</>
                            : <><FiLock size={14} /> Đổi mật khẩu</>
                        }
                    </button>
                </form>
            </div>
        </>
    );
}
