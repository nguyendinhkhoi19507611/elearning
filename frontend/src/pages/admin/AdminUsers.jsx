import React, { useState, useEffect } from 'react';
import { usersAPI, authAPI } from '../../api/api';
import {
    FiPlus, FiEdit2, FiLock, FiUnlock, FiX, FiUser, FiMail,
    FiLock as FiLockIcon, FiCheckCircle, FiAlertCircle, FiShield,
    FiEye, FiEyeOff, FiSearch, FiSave, FiUsers, FiFilter,
    FiCamera, FiMic,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

const ROLE_OPTIONS = [
    { value: 'student', label: 'Sinh viên',    color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.25)' },
    { value: 'teacher', label: 'Giáo viên',    color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
    { value: 'admin',   label: 'Quản trị viên',color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' },
];

const roleOpt = (r) => ROLE_OPTIONS.find(o => o.value === r) || ROLE_OPTIONS[0];

const initCreateForm = { name: '', email: '', password: '', role: 'student', studentId: '', teacherId: '', subjects: '' };

/* ── Avatar with initials ── */
function Avatar({ name, role, locked, size = 36 }) {
    const rc = roleOpt(role);
    const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
    return (
        <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
                width: size, height: size, borderRadius: '50%',
                background: locked ? 'rgba(100,116,139,0.4)' : `linear-gradient(135deg, ${rc.color}cc, ${rc.color}88)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: `${size * 0.36}px`, color: '#fff',
                border: `2px solid ${locked ? 'rgba(100,116,139,0.2)' : rc.border}`,
                boxShadow: locked ? 'none' : `0 0 12px ${rc.bg}`,
            }}>
                {initials}
            </div>
            {locked && (
                <div style={{
                    position: 'absolute', bottom: -1, right: -1,
                    width: 14, height: 14, borderRadius: '50%',
                    background: 'var(--danger)', border: '2px solid var(--bg-card)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <FiLock size={7} color="#fff" />
                </div>
            )}
        </div>
    );
}

/* ── Role chip ── */
function RoleChip({ role }) {
    const rc = roleOpt(role);
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 99, fontSize: '0.68em', fontWeight: 700,
            background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`,
        }}>
            {role === 'admin' && <FiShield size={9} />}
            {rc.label}
        </span>
    );
}

/* ── Biometric status ── */
function BioStatus({ registered, label }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75em', fontWeight: 600 }}>
            <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: registered ? 'var(--success)' : 'rgba(100,116,139,0.4)',
                boxShadow: registered ? '0 0 5px var(--success)' : 'none',
            }} />
            <span style={{ color: registered ? 'var(--success)' : 'var(--text-muted)' }}>
                {registered ? label : '—'}
            </span>
        </div>
    );
}

/* ── Modal wrapper ── */
function Modal({ children, onClose, title, maxWidth = 500 }) {
    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0,
            background: 'rgba(30,27,75,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000, backdropFilter: 'blur(8px)', padding: 20,
            animation: 'fadeIn 0.2s ease',
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth,
                border: '1px solid var(--border-strong)',
                boxShadow: 'var(--shadow-lg)',
                animation: 'fadeSlideUp 0.25s ease',
                position: 'relative', overflow: 'hidden',
            }}>
                {/* Top glow line */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-purple)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.97em', fontWeight: 700, margin: 0 }}>
                        {title}
                    </h3>
                    <button onClick={onClose} style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', padding: '5px 7px',
                        display: 'flex', alignItems: 'center', transition: 'all 0.15s ease',
                    }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-light)'; e.currentTarget.style.color = 'var(--danger)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                        <FiX size={15} />
                    </button>
                </div>
                <div style={{ padding: '22px 24px' }}>{children}</div>
            </div>
        </div>
    );
}

function ErrorBox({ msg }) {
    return (
        <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderLeft: '3px solid var(--danger)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            fontSize: '0.84em', color: 'var(--danger)',
            display: 'flex', alignItems: 'center', gap: 8,
        }}>
            <FiAlertCircle size={14} style={{ flexShrink: 0 }} /> {msg}
        </div>
    );
}

function RoleSelector({ value, onChange }) {
    return (
        <div style={{ display: 'flex', gap: 8 }}>
            {ROLE_OPTIONS.map(o => (
                <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{
                    flex: 1, padding: '9px 0', borderRadius: 10, fontWeight: 600, fontSize: '0.82em', cursor: 'pointer',
                    border: `1px solid ${value === o.value ? o.border : 'var(--border-strong)'}`,
                    background: value === o.value ? o.bg : 'transparent',
                    color: value === o.value ? o.color : 'var(--text-muted)',
                    transition: 'all 0.18s ease',
                }}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

const eyeBtnStyle = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 };
const modalFooter = { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' };

export default function AdminUsers() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [filter, setFilter] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState(initCreateForm);
    const [createError, setCreateError] = useState('');
    const [createLoading, setCreateLoading] = useState(false);
    const [showCreatePass, setShowCreatePass] = useState(false);

    const [editUser, setEditUser] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', role: 'student' });
    const [editError, setEditError] = useState('');
    const [editLoading, setEditLoading] = useState(false);

    const [lockTarget, setLockTarget] = useState(null);
    const [lockLoading, setLockLoading] = useState(false);

    const loadUsers = () => {
        setLoading(true);
        usersAPI.getAll(filter ? { role: filter } : {})
            .then(r => setUsers(r.data.users || r.data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadUsers(); }, [filter]);

    const displayed = users.filter(u =>
        !search ||
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.studentId?.toLowerCase().includes(search.toLowerCase()) ||
        u.teacherId?.toLowerCase().includes(search.toLowerCase())
    );

    const handleCreate = async () => {
        if (!createForm.name || !createForm.email || !createForm.password) { setCreateError('Vui lòng điền đầy đủ thông tin'); return; }
        if (createForm.password.length < 6) { setCreateError('Mật khẩu phải có ít nhất 6 ký tự'); return; }
        setCreateLoading(true); setCreateError('');
        try {
            const res = await authAPI.register({ name: createForm.name, email: createForm.email, password: createForm.password, role: createForm.role });
            const newUserId = res.data.user?._id;
            if (newUserId) {
                const updateData = {};
                if (createForm.studentId) updateData.studentId = createForm.studentId;
                if (createForm.teacherId) updateData.teacherId = createForm.teacherId;
                if (createForm.subjects) updateData.subjects = createForm.subjects.split(',').map(s => s.trim()).filter(Boolean);
                if (Object.keys(updateData).length > 0) {
                    await usersAPI.update(newUserId, updateData).catch(() => {});
                }
            }
            setShowCreate(false); setCreateForm(initCreateForm); loadUsers();
        } catch (e) { setCreateError(e.response?.data?.error || e.response?.data?.message || 'Tạo tài khoản thất bại'); }
        setCreateLoading(false);
    };

    const openEdit = (u) => {
        setEditUser(u);
        setEditForm({ name: u.name, role: u.role, studentId: u.studentId || '', teacherId: u.teacherId || '', subjects: (u.subjects || []).join(', ') });
        setEditError('');
    };

    const handleEdit = async () => {
        if (!editForm.name.trim()) { setEditError('Tên không được để trống'); return; }
        setEditLoading(true); setEditError('');
        try {
            const updateData = { name: editForm.name, role: editForm.role, studentId: editForm.studentId || undefined, teacherId: editForm.teacherId || undefined };
            if (editForm.subjects !== undefined) updateData.subjects = editForm.subjects.split(',').map(s => s.trim()).filter(Boolean);
            const res = await usersAPI.update(editUser._id, updateData);
            setUsers(prev => prev.map(u => u._id === editUser._id ? { ...u, ...res.data.user } : u));
            setEditUser(null);
        } catch (e) { setEditError(e.response?.data?.error || 'Cập nhật thất bại'); }
        setEditLoading(false);
    };

    const handleToggleLock = async () => {
        if (!lockTarget) return;
        setLockLoading(true);
        try {
            const res = await usersAPI.toggleLock(lockTarget._id);
            setUsers(prev => prev.map(u => u._id === lockTarget._id ? { ...u, isActive: res.data.isActive } : u));
            setLockTarget(null);
        } catch (e) { alert(e.response?.data?.error || 'Lỗi khi thay đổi trạng thái'); }
        setLockLoading(false);
    };

    const isSelf = (u) => u._id === currentUser?._id;

    const counts = {
        all: users.length,
        student: users.filter(u => u.role === 'student').length,
        teacher: users.filter(u => u.role === 'teacher').length,
        admin:   users.filter(u => u.role === 'admin').length,
    };

    const filterTabs = [
        { val: '',        label: 'Tất cả',      count: counts.all },
        { val: 'student', label: 'Sinh viên',   count: counts.student },
        { val: 'teacher', label: 'Giáo viên',   count: counts.teacher },
        { val: 'admin',   label: 'Admin',        count: counts.admin },
    ];

    return (
        <>
            {/* ── Header ── */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ fontSize: '1.6em', fontWeight: 900, letterSpacing: '-0.5px', margin: 0 }}>Quản lý người dùng</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875em', marginTop: 5 }}>
                            {users.length} tài khoản trong hệ thống
                        </p>
                    </div>
                    <button className="btn btn-primary" onClick={() => { setShowCreate(true); setCreateForm(initCreateForm); setCreateError(''); }}>
                        <FiPlus size={15} /> Tạo tài khoản
                    </button>
                </div>
            </div>

            {/* ── Filter + Search bar ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Role tabs */}
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
                    {filterTabs.map(t => {
                        const active = filter === t.val;
                        return (
                            <button key={t.val} onClick={() => setFilter(t.val)} style={{
                                padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                fontWeight: 600, fontSize: '0.8em',
                                background: active ? 'var(--accent)' : 'transparent',
                                color: active ? '#fff' : 'var(--text-muted)',
                                transition: 'all 0.18s ease',
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                {t.label}
                                <span style={{
                                    padding: '1px 6px', borderRadius: 99, fontSize: '0.8em', fontWeight: 700,
                                    background: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                                    color: active ? '#fff' : 'var(--text-muted)',
                                }}>
                                    {t.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Search */}
                <div style={{
                    flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
                    borderRadius: 12, padding: '9px 14px', transition: 'all 0.18s ease',
                }}
                    onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                >
                    <FiSearch size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <input style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.875em', width: '100%' }}
                        placeholder="Tìm theo tên, email, mã số..." value={search} onChange={e => setSearch(e.target.value)} />
                    {search && (
                        <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
                            <FiX size={13} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── User Table ── */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 40 }}>
                        {[1,2,3,4].map(k => (
                            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div className="skeleton skeleton-text w-1/3" />
                                    <div className="skeleton skeleton-text w-1/2 sm" />
                                </div>
                                <div className="skeleton" style={{ width: 64, height: 22, borderRadius: 99 }} />
                                <div className="skeleton" style={{ width: 80, height: 22, borderRadius: 99 }} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    {['Người dùng', 'Mã số', 'Vai trò', 'Sinh trắc học', 'Trạng thái', ''].map((h, i) => (
                                        <th key={i} style={{
                                            padding: '13px 18px', textAlign: i === 5 ? 'right' : 'left',
                                            fontSize: '0.68em', fontWeight: 700, textTransform: 'uppercase',
                                            letterSpacing: '0.9px', color: 'var(--text-muted)',
                                            borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {displayed.map((u, idx) => {
                                    const locked = u.isActive === false;
                                    const self = isSelf(u);
                                    return (
                                        <tr key={u._id} style={{
                                            opacity: locked ? 0.6 : 1,
                                            transition: 'background 0.15s ease',
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.018)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            {/* User info */}
                                            <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <Avatar name={u.name} role={u.role} locked={locked} size={36} />
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.875em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            {u.name}
                                                            {self && <span style={{ fontSize: '0.65em', background: 'var(--accent-light)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>Bạn</span>}
                                                        </div>
                                                        <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', marginTop: 2 }}>{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* ID */}
                                            <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
                                                <div style={{ fontSize: '0.8em' }}>
                                                    {u.studentId && <div style={{ color: 'var(--info)', fontWeight: 600, fontFamily: 'monospace' }}>{u.studentId}</div>}
                                                    {u.teacherId && <div style={{ color: 'var(--success)', fontWeight: 600, fontFamily: 'monospace' }}>{u.teacherId}</div>}
                                                    {!u.studentId && !u.teacherId && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                </div>
                                            </td>

                                            {/* Role */}
                                            <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
                                                <RoleChip role={u.role} />
                                            </td>

                                            {/* Biometrics */}
                                            <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <BioStatus registered={u.voiceRegistered} label="Giọng nói" />
                                                    <BioStatus registered={u.faceRegistered} label="Khuôn mặt" />
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    padding: '4px 10px', borderRadius: 99, fontSize: '0.72em', fontWeight: 700,
                                                    background: locked ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                                                    color: locked ? 'var(--danger)' : 'var(--success)',
                                                    border: `1px solid ${locked ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
                                                }}>
                                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                                                    {locked ? 'Đã khóa' : 'Hoạt động'}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                    <button title="Chỉnh sửa" onClick={() => openEdit(u)} style={{
                                                        width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-strong)',
                                                        background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                                                    >
                                                        <FiEdit2 size={13} />
                                                    </button>

                                                    {!self && (
                                                        <button title={locked ? 'Mở khóa' : 'Khóa tài khoản'} onClick={() => setLockTarget(u)} style={{
                                                            width: 32, height: 32, borderRadius: 8,
                                                            border: `1px solid ${locked ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
                                                            background: locked ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                                                            cursor: 'pointer',
                                                            color: locked ? 'var(--success)' : 'var(--warning)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            transition: 'all 0.15s ease',
                                                        }}
                                                            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.2)'}
                                                            onMouseLeave={e => e.currentTarget.style.filter = ''}
                                                        >
                                                            {locked ? <FiUnlock size={13} /> : <FiLock size={13} />}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {displayed.length === 0 && (
                                    <tr>
                                        <td colSpan={6}>
                                            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                                                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                                    <FiUsers size={24} style={{ color: 'var(--text-muted)' }} />
                                                </div>
                                                <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5, fontSize: '0.9em' }}>
                                                    Không tìm thấy người dùng
                                                </div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.82em' }}>
                                                    {search ? `Không có kết quả cho "${search}"` : 'Tạo tài khoản đầu tiên'}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ══════ CREATE MODAL ══════ */}
            {showCreate && (
                <Modal onClose={() => setShowCreate(false)} title={<><FiPlus size={15} color="var(--accent)" /> Tạo tài khoản mới</>}>
                    {createError && <ErrorBox msg={createError} />}

                    <div className="form-group">
                        <label className="form-label"><FiShield size={13} /> Vai trò</label>
                        <RoleSelector value={createForm.role} onChange={v => setCreateForm({ ...createForm, role: v })} />
                    </div>

                    <div className="form-group">
                        <label className="form-label"><FiUser size={13} /> Họ và tên *</label>
                        <input className="form-input" placeholder="VD: Nguyễn Văn A"
                            value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} autoFocus />
                    </div>

                    <div className="form-group">
                        <label className="form-label"><FiMail size={13} /> Email *</label>
                        <input className="form-input" type="email" placeholder={`VD: ${createForm.role}@school.edu.vn`}
                            value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} />
                    </div>

                    <div className="form-group">
                        <label className="form-label"><FiLockIcon size={13} /> Mật khẩu *</label>
                        <div style={{ position: 'relative' }}>
                            <input className="form-input" type={showCreatePass ? 'text' : 'password'}
                                placeholder="Tối thiểu 6 ký tự" value={createForm.password}
                                onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                                style={{ paddingRight: 44 }}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                            <button type="button" onClick={() => setShowCreatePass(!showCreatePass)} style={eyeBtnStyle}>
                                {showCreatePass ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                            </button>
                        </div>
                        <div className="form-hint">Người dùng có thể tự đổi mật khẩu sau khi đăng nhập</div>
                    </div>

                    {createForm.role === 'student' && (
                        <div className="form-group">
                            <label className="form-label">🎓 Mã sinh viên</label>
                            <input className="form-input" placeholder="VD: SV001234"
                                value={createForm.studentId} onChange={e => setCreateForm({ ...createForm, studentId: e.target.value })} />
                            <div className="form-hint">Có thể điền sau trong phần chỉnh sửa</div>
                        </div>
                    )}
                    {createForm.role === 'teacher' && (
                        <>
                            <div className="form-group">
                                <label className="form-label">👨‍🏫 Mã giáo viên</label>
                                <input className="form-input" placeholder="VD: GV00012"
                                    value={createForm.teacherId} onChange={e => setCreateForm({ ...createForm, teacherId: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">📚 Môn dạy</label>
                                <input className="form-input" placeholder="VD: Toán cao cấp, Vật lý, Hóa học"
                                    value={createForm.subjects} onChange={e => setCreateForm({ ...createForm, subjects: e.target.value })} />
                                <div className="form-hint">Phân cách bằng dấu phẩy. Dùng để lọc giáo viên khi tạo lớp</div>
                            </div>
                        </>
                    )}

                    {/* Preview */}
                    {(createForm.name || createForm.email) && (
                        <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                            <Avatar name={createForm.name} role={createForm.role} size={36} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.875em' }}>{createForm.name || '—'}</div>
                                <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{createForm.email || '—'}</div>
                            </div>
                            <RoleChip role={createForm.role} />
                        </div>
                    )}

                    <div style={modalFooter}>
                        <button className="btn btn-outline" onClick={() => setShowCreate(false)}>Hủy</button>
                        <button className="btn btn-primary" onClick={handleCreate}
                            disabled={createLoading || !createForm.name || !createForm.email || !createForm.password}>
                            {createLoading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Đang tạo...</> : <><FiPlus size={14} /> Tạo tài khoản</>}
                        </button>
                    </div>
                </Modal>
            )}

            {/* ══════ EDIT MODAL ══════ */}
            {editUser && (
                <Modal onClose={() => setEditUser(null)} title={<><FiEdit2 size={15} color="var(--accent)" /> Chỉnh sửa tài khoản</>}>
                    {editError && <ErrorBox msg={editError} />}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20 }}>
                        <Avatar name={editUser.name} role={editUser.role} locked={editUser.isActive === false} size={40} />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9em' }}>{editUser.name}</div>
                            <div style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>{editUser.email}</div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label"><FiUser size={13} /> Họ và tên</label>
                        <input className="form-input" value={editForm.name}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            placeholder="Nhập tên mới..." autoFocus />
                    </div>

                    <div className="form-group">
                        <label className="form-label"><FiShield size={13} /> Vai trò</label>
                        {isSelf(editUser) ? (
                            <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, fontSize: '0.84em', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                ⚠️ Không thể thay đổi vai trò của chính mình
                            </div>
                        ) : (
                            <RoleSelector value={editForm.role} onChange={v => setEditForm({ ...editForm, role: v })} />
                        )}
                    </div>

                    {(editForm.role === 'student' || editUser?.role === 'student') && (
                        <div className="form-group">
                            <label className="form-label">Mã sinh viên</label>
                            <input className="form-input" value={editForm.studentId || ''}
                                onChange={e => setEditForm({ ...editForm, studentId: e.target.value })}
                                placeholder="VD: SV001234" />
                        </div>
                    )}
                    {(editForm.role === 'teacher' || editUser?.role === 'teacher') && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Mã giáo viên</label>
                                <input className="form-input" value={editForm.teacherId || ''}
                                    onChange={e => setEditForm({ ...editForm, teacherId: e.target.value })}
                                    placeholder="VD: GV00012" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">📚 Môn dạy</label>
                                <input className="form-input" value={editForm.subjects || ''}
                                    onChange={e => setEditForm({ ...editForm, subjects: e.target.value })}
                                    placeholder="VD: Toán cao cấp, Vật lý, Hóa học" />
                                <div className="form-hint">Phân cách bằng dấu phẩy</div>
                            </div>
                        </>
                    )}

                    <div style={modalFooter}>
                        <button className="btn btn-outline" onClick={() => setEditUser(null)}>Hủy</button>
                        <button className="btn btn-primary" onClick={handleEdit} disabled={editLoading || !editForm.name.trim()}>
                            {editLoading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Đang lưu...</> : <><FiSave size={14} /> Lưu thay đổi</>}
                        </button>
                    </div>
                </Modal>
            )}

            {/* ══════ LOCK CONFIRM ══════ */}
            {lockTarget && (
                <Modal onClose={() => setLockTarget(null)} title={
                    lockTarget.isActive === false
                        ? <><FiUnlock size={15} color="var(--success)" /> Mở khóa tài khoản</>
                        : <><FiLock size={15} color="var(--warning)" /> Khóa tài khoản</>
                } maxWidth={420}>
                    <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 18px',
                            background: lockTarget.isActive === false ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                            border: `2px solid ${lockTarget.isActive === false ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {lockTarget.isActive === false
                                ? <FiUnlock size={26} color="var(--success)" />
                                : <FiLock size={26} color="var(--warning)" />}
                        </div>

                        <div style={{ fontWeight: 700, fontSize: '1.05em', marginBottom: 10 }}>
                            {lockTarget.isActive === false ? 'Xác nhận mở khóa?' : 'Xác nhận khóa tài khoản?'}
                        </div>

                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--bg-primary)', padding: '10px 16px', borderRadius: 12, marginBottom: 14, border: '1px solid var(--border)' }}>
                            <Avatar name={lockTarget.name} role={lockTarget.role} size={32} />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.875em' }}>{lockTarget.name}</div>
                                <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>{lockTarget.email}</div>
                            </div>
                        </div>

                        <div style={{ fontSize: '0.84em', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {lockTarget.isActive === false
                                ? 'Người dùng sẽ có thể đăng nhập trở lại vào hệ thống.'
                                : 'Người dùng sẽ không thể đăng nhập cho đến khi được mở khóa.'}
                        </div>
                    </div>

                    <div style={modalFooter}>
                        <button className="btn btn-outline" onClick={() => setLockTarget(null)}>Hủy</button>
                        <button
                            className={`btn ${lockTarget.isActive === false ? 'btn-success' : 'btn-warning'}`}
                            onClick={handleToggleLock} disabled={lockLoading}
                        >
                            {lockLoading
                                ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Đang xử lý...</>
                                : lockTarget.isActive === false
                                    ? <><FiUnlock size={14} /> Mở khóa</>
                                    : <><FiLock size={14} /> Khóa tài khoản</>}
                        </button>
                    </div>
                </Modal>
            )}
        </>
    );
}
