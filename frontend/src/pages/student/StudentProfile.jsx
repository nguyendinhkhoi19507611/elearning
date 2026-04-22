import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { profileAPI } from '../../api/api';
import {
    FiUser, FiMail, FiSave, FiLock, FiCamera, FiCheckCircle,
    FiAlertCircle, FiPhone, FiBook, FiHash
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const ROLE_LABELS = { student: 'Sinh viên', teacher: 'Giáo viên', admin: 'Quản trị viên' };

export default function StudentProfile() {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        department: user?.department || '',
    });
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        profileAPI.get()
            .then(r => {
                const u = r.data.user;
                setProfile(u);
                setForm({ name: u.name || '', phone: u.phone || '', department: u.department || '' });
            })
            .catch(() => {});
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setSaving(true); setError(''); setSuccess('');
        try {
            const res = await profileAPI.update({
                name: form.name.trim(),
                phone: form.phone.trim(),
                department: form.department.trim(),
            });
            const updated = res.data.user;
            setProfile(updated);
            localStorage.setItem('user', JSON.stringify(updated));
            if (setUser) setUser(updated);
            setSuccess('Đã cập nhật thông tin thành công!');
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.error || 'Cập nhật thất bại');
        } finally {
            setSaving(false);
        }
    };

    const u = profile || user;
    const initials = u?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const joinDate = u?.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    }) : '—';

    // Info rows hiển thị
    const infoRows = [
        { icon: <FiMail size={13} />, label: 'Email', value: u?.email },
        u?.studentId && { icon: <FiHash size={13} />, label: 'Mã sinh viên', value: u.studentId },
        u?.teacherId && { icon: <FiHash size={13} />, label: 'Mã giáo viên', value: u.teacherId },
        u?.department && { icon: <FiBook size={13} />, label: 'Khoa/Bộ môn', value: u.department },
        u?.phone && { icon: <FiPhone size={13} />, label: 'Điện thoại', value: u.phone },
        { icon: <FiCamera size={13} />, label: 'Khuôn mặt', value: u?.faceRegistered ? '✅ Đã đăng ký' : '❌ Chưa đăng ký' },
        { icon: <FiUser size={13} />, label: 'Tham gia', value: joinDate },
    ].filter(Boolean);

    // AI stats
    const aiStats = [
        { label: 'Hoạt động', value: u?.stats?.engagementLevel?.toUpperCase() || '—', color: 'var(--info)' },
        { label: 'Tổng thời gian học', value: u?.stats?.totalStudyMin ? `${u.stats.totalStudyMin} phút` : '—', color: 'var(--accent)' },
        { label: 'Điểm TB', value: u?.stats?.avgScore ? `${u.stats.avgScore}/100` : '—', color: 'var(--success)' },
        { label: 'Số lần đăng nhập', value: u?.stats?.loginCount || 0, color: 'var(--warning)' },
    ];

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Hồ sơ cá nhân</h1>
                <p className="page-subtitle">Quản lý thông tin tài khoản của bạn</p>
            </div>

            <div className="grid grid-2" style={{ maxWidth: 900, alignItems: 'start' }}>
                {/* Left — Avatar + readonly info */}
                <div>
                    <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
                        <div style={{
                            width: 90, height: 90, borderRadius: '50%', margin: '0 auto 16px',
                            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '2em', fontWeight: 800, color: '#fff',
                            boxShadow: 'var(--shadow-accent)'
                        }}>
                            {initials}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1.1em', marginBottom: 4 }}>{u?.name}</div>
                        <div style={{ marginBottom: 16 }}>
                            <span className={`badge badge-${u?.role === 'admin' ? 'danger' : u?.role === 'teacher' ? 'success' : 'accent'}`}>
                                {ROLE_LABELS[u?.role] || u?.role}
                            </span>
                        </div>
                        <div style={{ textAlign: 'left', fontSize: '0.84em' }}>
                            {infoRows.map((row, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '8px 0', borderBottom: i < infoRows.length - 1 ? '1px solid var(--border)' : 'none'
                                }}>
                                    <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{row.icon}</span>
                                    <span style={{ color: 'var(--text-muted)', width: 100, flexShrink: 0 }}>{row.label}</span>
                                    <span style={{ fontWeight: 500 }}>{row.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI Stats */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">📊 Thống kê học tập</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                            {aiStats.map((s, i) => (
                                <div key={i} style={{
                                    background: 'var(--bg-primary)', borderRadius: 10,
                                    padding: '12px', textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '1.3em', fontWeight: 800, color: s.color }}>{s.value}</div>
                                    <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right — Edit form */}
                <div>
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div className="card-header">
                            <div className="card-title"><FiUser size={15} color="var(--accent)" /> Chỉnh sửa thông tin</div>
                        </div>

                        {success && (
                            <div className="notice notice-success" style={{ marginBottom: 16 }}>
                                <FiCheckCircle size={15} /> <span>{success}</span>
                            </div>
                        )}
                        {error && (
                            <div className="notice notice-danger" style={{ marginBottom: 16 }}>
                                <FiAlertCircle size={15} /> <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label"><FiUser size={13} /> Họ và tên*</label>
                                <input className="form-input" value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="Nhập họ và tên" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label"><FiPhone size={13} /> Số điện thoại</label>
                                <input className="form-input" value={form.phone}
                                    onChange={e => setForm({ ...form, phone: e.target.value })}
                                    placeholder="VD: 0901234567" />
                            </div>
                            <div className="form-group">
                                <label className="form-label"><FiBook size={13} /> Khoa/Bộ môn</label>
                                <input className="form-input" value={form.department}
                                    onChange={e => setForm({ ...form, department: e.target.value })}
                                    placeholder="VD: Khoa Công nghệ thông tin" />
                            </div>

                            {/* Read-only: email, studentId/teacherId (chỉ admin mới đổi được) */}
                            <div className="form-group">
                                <label className="form-label"><FiMail size={13} /> Email</label>
                                <input className="form-input" value={u?.email || ''} disabled
                                    style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                                <div className="form-hint">Email không thể thay đổi</div>
                            </div>
                            {(u?.studentId || u?.teacherId) && (
                                <div className="form-group">
                                    <label className="form-label"><FiHash size={13} /> Mã {u?.studentId ? 'sinh viên' : 'giáo viên'}</label>
                                    <input className="form-input" value={u?.studentId || u?.teacherId || ''} disabled
                                        style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                                    <div className="form-hint">Liên hệ admin để thay đổi mã số</div>
                                </div>
                            )}

                            <button className="btn btn-primary btn-block" disabled={saving || !form.name.trim()}>
                                {saving ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Đang lưu...</> : <><FiSave size={14} /> Lưu thay đổi</>}
                            </button>
                        </form>
                    </div>

                    {/* Security */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title"><FiLock size={15} color="var(--accent)" /> Bảo mật</div>
                        </div>
                        <button className="btn btn-outline btn-block" onClick={() => navigate(`/${u?.role}/change-password`)}>
                            <FiLock size={14} /> Đổi mật khẩu
                        </button>
                        {!u?.faceRegistered && (
                            <button className="btn btn-outline btn-block" style={{ marginTop: 8 }} onClick={() => navigate('/student/face')}>
                                <FiCamera size={14} /> Đăng ký khuôn mặt
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
