import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { profileAPI } from '../api/api';
import {
    FiUser, FiMail, FiSave, FiLock, FiCheckCircle,
    FiAlertCircle, FiPhone, FiBook, FiHash, FiShield,
    FiCalendar, FiActivity, FiClock, FiAward, FiEdit3,
    FiChevronRight,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const ROLE_META = {
    student: { label: 'Sinh viên',    color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   gradient: 'linear-gradient(135deg,#0891b2,#06b6d4)' },
    teacher: { label: 'Giáo viên',    color: '#10b981', bg: 'rgba(16,185,129,0.12)',  gradient: 'linear-gradient(135deg,#059669,#10b981)' },
    admin:   { label: 'Quản trị viên',color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
};

export default function UserProfile() {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', department: user?.department || '' });
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        profileAPI.get().then(r => {
            const u = r.data.user;
            setProfile(u);
            setForm({ name: u.name || '', phone: u.phone || '', department: u.department || '' });
        }).catch(() => {});
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setSaving(true); setError(''); setSuccess('');
        try {
            const res = await profileAPI.update({ name: form.name.trim(), phone: form.phone.trim(), department: form.department.trim() });
            const updated = res.data.user;
            setProfile(updated);
            localStorage.setItem('user', JSON.stringify(updated));
            if (setUser) setUser(updated);
            setSuccess('Đã cập nhật thông tin thành công!');
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.error || 'Cập nhật thất bại');
        } finally { setSaving(false); }
    };

    const u = profile || user;
    const rm = ROLE_META[u?.role] || ROLE_META.student;
    const initials = u?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
    const joinDate = u?.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

    const statItems = [
        { label: 'Đăng nhập', value: u?.stats?.loginCount || 0, icon: <FiActivity size={14} />, color: '#7c3aed' },
        { label: 'Giờ học', value: u?.stats?.totalStudyMin ? `${Math.round(u.stats.totalStudyMin / 60)}h` : '0h', icon: <FiClock size={14} />, color: '#10b981' },
        { label: 'Điểm TB', value: u?.stats?.avgScore != null ? u.stats.avgScore : '—', icon: <FiAward size={14} />, color: '#f59e0b' },
        { label: 'Mức độ', value: u?.stats?.engagementLevel?.toUpperCase() || '—', icon: <FiActivity size={14} />, color: '#06b6d4' },
    ];

    const infoRows = [
        { icon: <FiMail size={13} />, label: 'Email', value: u?.email },
        u?.studentId && { icon: <FiHash size={13} />, label: 'Mã sinh viên', value: u.studentId },
        u?.teacherId && { icon: <FiHash size={13} />, label: 'Mã giáo viên', value: u.teacherId },
        u?.department && { icon: <FiBook size={13} />, label: 'Khoa/Bộ môn', value: u.department },
        u?.phone && { icon: <FiPhone size={13} />, label: 'Điện thoại', value: u.phone },
        { icon: <FiCalendar size={13} />, label: 'Tham gia', value: joinDate },
    ].filter(Boolean);

    return (
        <>
            {/* ── Page header ── */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: '1.6em', fontWeight: 900, letterSpacing: '-0.5px', margin: 0 }}>Hồ sơ cá nhân</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875em', marginTop: 5 }}>Quản lý thông tin tài khoản của bạn</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, maxWidth: 960, alignItems: 'start' }}>

                {/* ── Left column ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Avatar card */}
                    <div style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 20, overflow: 'hidden', position: 'relative',
                    }}>
                        {/* Top gradient banner */}
                        <div style={{ height: 80, background: rm.gradient, position: 'relative' }}>
                            <div style={{ position: 'absolute', inset: 0, background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
                        </div>

                        <div style={{ padding: '0 24px 24px', textAlign: 'center' }}>
                            {/* Avatar overlapping banner */}
                            <div style={{
                                width: 80, height: 80, borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.8em', fontWeight: 900, color: '#fff',
                                border: '4px solid var(--bg-card)',
                                boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
                                margin: '-40px auto 14px',
                                position: 'relative',
                            }}>
                                {initials}
                                {/* Online indicator */}
                                <div style={{ position: 'absolute', bottom: 3, right: 3, width: 14, height: 14, borderRadius: '50%', background: 'var(--success)', border: '3px solid var(--bg-card)', boxShadow: '0 0 6px var(--success)' }} />
                            </div>

                            <div style={{ fontWeight: 800, fontSize: '1.05em', marginBottom: 6 }}>{u?.name}</div>

                            {/* Role badge */}
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 99, background: rm.bg, color: rm.color, fontSize: '0.75em', fontWeight: 700, border: `1px solid ${rm.color}33`, marginBottom: 20 }}>
                                {u?.role === 'admin' && <FiShield size={11} />}
                                {rm.label}
                            </div>

                            {/* Info rows */}
                            <div style={{ textAlign: 'left' }}>
                                {infoRows.map((row, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < infoRows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                        <span style={{ color: rm.color, flexShrink: 0 }}>{row.icon}</span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.79em', width: 90, flexShrink: 0 }}>{row.label}</span>
                                        <span style={{ fontWeight: 500, fontSize: '0.84em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Activity stats */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px' }}>
                        <div style={{ fontSize: '0.82em', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                            <FiActivity size={14} color="var(--accent)" /> Thống kê hoạt động
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {statItems.map((s, i) => (
                                <div key={i} style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6, color: s.color }}>{s.icon}</div>
                                    <div style={{ fontSize: '1.3em', fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
                                    <div style={{ fontSize: '0.67em', color: 'var(--text-muted)', marginTop: 3, fontWeight: 600 }}>{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Right column ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Edit form */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}>
                        {/* Card top glow */}
                        <div style={{ height: 2, background: 'var(--gradient-purple)' }} />

                        <div style={{ padding: '22px 26px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 22 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FiEdit3 size={15} color="var(--accent)" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.9em' }}>Chỉnh sửa thông tin</div>
                                    <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>Cập nhật thông tin cá nhân</div>
                                </div>
                            </div>

                            {success && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', marginBottom: 18, fontSize: '0.84em', color: 'var(--success)' }}>
                                    <FiCheckCircle size={15} /> {success}
                                </div>
                            )}
                            {error && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', marginBottom: 18, fontSize: '0.84em', color: 'var(--danger)' }}>
                                    <FiAlertCircle size={15} /> {error}
                                </div>
                            )}

                            <form onSubmit={handleSave}>
                                <div className="form-group">
                                    <label className="form-label"><FiUser size={13} /> Họ và tên *</label>
                                    <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nhập họ và tên" required />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                    <div className="form-group">
                                        <label className="form-label"><FiPhone size={13} /> Điện thoại</label>
                                        <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0901234567" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label"><FiBook size={13} /> Khoa/Bộ môn</label>
                                        <input className="form-input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="VD: CNTT" />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label"><FiMail size={13} /> Email</label>
                                    <input className="form-input" value={u?.email || ''} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                                    <div className="form-hint">Email không thể thay đổi</div>
                                </div>

                                {(u?.studentId || u?.teacherId) && (
                                    <div className="form-group">
                                        <label className="form-label"><FiHash size={13} /> Mã {u?.studentId ? 'sinh viên' : 'giáo viên'}</label>
                                        <input className="form-input" value={u?.studentId || u?.teacherId || ''} disabled style={{ opacity: 0.5, cursor: 'not-allowed', fontFamily: 'monospace' }} />
                                        <div className="form-hint">Liên hệ admin để thay đổi mã số</div>
                                    </div>
                                )}

                                <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 4 }} disabled={saving || !form.name.trim()}>
                                    {saving ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Đang lưu...</> : <><FiSave size={14} /> Lưu thay đổi</>}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Security card */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 22px' }}>
                        <div style={{ fontSize: '0.82em', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                            <FiLock size={14} color="var(--accent)" /> Bảo mật tài khoản
                        </div>

                        <button onClick={() => navigate(`/${u?.role}/change-password`)} style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '13px 16px', borderRadius: 12, border: '1px solid var(--border-strong)',
                            background: 'var(--bg-primary)', cursor: 'pointer', transition: 'all 0.18s ease',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.background = 'var(--accent-light)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--bg-primary)'; }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FiLock size={15} color="var(--accent)" />
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.875em' }}>Đổi mật khẩu</div>
                                    <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>Cập nhật mật khẩu đăng nhập</div>
                                </div>
                            </div>
                            <FiChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
