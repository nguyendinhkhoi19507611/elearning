import React, { useState, useEffect } from 'react';
import { usersAPI, authAPI } from '../../api/api';
import {
    FiPlus, FiEdit2, FiLock, FiUnlock, FiTrash2,
    FiX, FiUser, FiMail, FiLock as FiLockIcon,
    FiCheckCircle, FiAlertCircle, FiShield,
    FiEye, FiEyeOff, FiSearch, FiSave
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

const ROLE_OPTIONS = [
    { value: 'student', label: 'Sinh viên', badgeClass: 'badge-info' },
    { value: 'teacher', label: 'Giáo viên', badgeClass: 'badge-success' },
    { value: 'admin', label: 'Quản trị viên', badgeClass: 'badge-purple' },
];

const roleLabel = (r) => ROLE_OPTIONS.find(o => o.value === r)?.label || r;
const roleBadge = (r) => ROLE_OPTIONS.find(o => o.value === r)?.badgeClass || 'badge-neutral';

const initCreateForm = { name: '', email: '', password: '', role: 'student' };

export default function AdminUsers() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [filter, setFilter] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Create modal
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState(initCreateForm);
    const [createError, setCreateError] = useState('');
    const [createLoading, setCreateLoading] = useState(false);
    const [showCreatePass, setShowCreatePass] = useState(false);

    // Edit modal
    const [editUser, setEditUser] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', role: 'student' });
    const [editError, setEditError] = useState('');
    const [editLoading, setEditLoading] = useState(false);

    // Lock confirm
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

    // ── Filtered display ──
    const displayed = users.filter(u =>
        !search ||
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
    );

    // ── Create user ──
    const handleCreate = async () => {
        if (!createForm.name || !createForm.email || !createForm.password) {
            setCreateError('Vui lòng điền đầy đủ thông tin'); return;
        }
        if (createForm.password.length < 6) {
            setCreateError('Mật khẩu phải có ít nhất 6 ký tự'); return;
        }
        setCreateLoading(true); setCreateError('');
        try {
            await authAPI.register({ name: createForm.name, email: createForm.email, password: createForm.password, role: createForm.role });
            setShowCreate(false);
            setCreateForm(initCreateForm);
            loadUsers();
        } catch (e) {
            setCreateError(e.response?.data?.error || e.response?.data?.message || 'Tạo tài khoản thất bại');
        }
        setCreateLoading(false);
    };

    // ── Open edit modal ──
    const openEdit = (u) => {
        setEditUser(u);
        setEditForm({ name: u.name, role: u.role });
        setEditError('');
    };

    // ── Save edit ──
    const handleEdit = async () => {
        if (!editForm.name.trim()) { setEditError('Tên không được để trống'); return; }
        setEditLoading(true); setEditError('');
        try {
            const res = await usersAPI.update(editUser._id, { name: editForm.name, role: editForm.role });
            setUsers(prev => prev.map(u => u._id === editUser._id ? { ...u, ...res.data.user } : u));
            setEditUser(null);
        } catch (e) {
            setEditError(e.response?.data?.error || 'Cập nhật thất bại');
        }
        setEditLoading(false);
    };

    // ── Toggle lock ──
    const handleToggleLock = async () => {
        if (!lockTarget) return;
        setLockLoading(true);
        try {
            const res = await usersAPI.toggleLock(lockTarget._id);
            setUsers(prev => prev.map(u => u._id === lockTarget._id ? { ...u, isActive: res.data.isActive } : u));
            setLockTarget(null);
        } catch (e) {
            alert(e.response?.data?.error || 'Lỗi khi thay đổi trạng thái');
        }
        setLockLoading(false);
    };

    const isSelf = (u) => u._id === currentUser?._id;

    return (
        <>
            {/* ── Page header ── */}
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">Quản lý người dùng</h1>
                        <p className="page-subtitle">{users.length} người dùng trong hệ thống</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => { setShowCreate(true); setCreateForm(initCreateForm); setCreateError(''); }}>
                        <FiPlus size={15} /> Tạo tài khoản
                    </button>
                </div>
            </div>

            {/* ── Filters + Search ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    {[{ val: '', label: 'Tất cả' }, { val: 'student', label: 'Sinh viên' }, { val: 'teacher', label: 'Giáo viên' }, { val: 'admin', label: 'Admin' }].map(r => (
                        <button key={r.val} className={`btn btn-sm ${filter === r.val ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(r.val)}>
                            {r.label}
                        </button>
                    ))}
                </div>
                <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '7px 12px' }}>
                    <FiSearch size={14} color="var(--text-muted)" />
                    <input style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.875em', width: '100%' }}
                        placeholder="Tìm theo tên, email..." value={search} onChange={e => setSearch(e.target.value)} />
                    {search && <FiX size={13} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setSearch('')} />}
                </div>
            </div>

            {/* ── Table ── */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div className="empty-state"><div className="spinner" /></div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Người dùng</th>
                                    <th>Email</th>
                                    <th>Vai trò</th>
                                    <th>Voice</th>
                                    <th>Trạng thái</th>
                                    <th>Đăng nhập</th>
                                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayed.map(u => (
                                    <tr key={u._id} style={{ opacity: u.isActive === false ? 0.55 : 1 }}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 34, height: 34, borderRadius: '50%',
                                                    background: u.isActive === false ? 'var(--text-muted)'
                                                        : u.role === 'admin' ? 'var(--purple)'
                                                            : u.role === 'teacher' ? 'var(--success)' : 'var(--accent)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.85em', fontWeight: 700, flexShrink: 0, color: 'white',
                                                    position: 'relative'
                                                }}>
                                                    {u.name?.[0]?.toUpperCase()}
                                                    {u.isActive === false && (
                                                        <div style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--danger)', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <FiLock size={8} color="white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.88em' }}>{u.name}</div>
                                                    {isSelf(u) && <span style={{ fontSize: '0.68em', color: 'var(--accent)' }}>Tài khoản của bạn</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>{u.email}</td>
                                        <td>
                                            <span className={`badge ${roleBadge(u.role)}`}>
                                                {u.role === 'admin' && <FiShield size={9} />}
                                                {roleLabel(u.role)}
                                            </span>
                                        </td>
                                        <td>
                                            {u.voiceRegistered
                                                ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: '0.8em' }}><FiCheckCircle size={13} /> Đã đăng ký</span>
                                                : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.8em' }}><FiAlertCircle size={13} /> Chưa đăng ký</span>}
                                        </td>
                                        <td>
                                            {u.isActive === false
                                                ? <span className="badge badge-danger"><FiLock size={9} /> Đã khóa</span>
                                                : <span className="badge badge-success"><FiCheckCircle size={9} /> Hoạt động</span>}
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>{u.stats?.loginCount || 0} lần</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                {/* Edit */}
                                                <button
                                                    className="btn btn-outline btn-sm btn-icon"
                                                    title="Chỉnh sửa"
                                                    onClick={() => openEdit(u)}
                                                >
                                                    <FiEdit2 size={13} />
                                                </button>
                                                {/* Lock/Unlock */}
                                                {!isSelf(u) && (
                                                    <button
                                                        className={`btn btn-sm btn-icon ${u.isActive === false ? 'btn-success' : 'btn-warning'}`}
                                                        title={u.isActive === false ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                                                        onClick={() => setLockTarget(u)}
                                                        style={{ color: u.isActive === false ? undefined : '#000' }}
                                                    >
                                                        {u.isActive === false ? <FiUnlock size={13} /> : <FiLock size={13} />}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {displayed.length === 0 && (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty-state" style={{ padding: '40px 20px' }}>
                                                <div className="empty-state-icon"><FiUser size={24} /></div>
                                                <div className="empty-state-title">Không tìm thấy người dùng</div>
                                                <div className="empty-state-sub">{search ? `Không có kết quả cho "${search}"` : 'Tạo tài khoản đầu tiên'}</div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ══════════════ CREATE MODAL ══════════════ */}
            {showCreate && (
                <Modal onClose={() => setShowCreate(false)} title={<><FiPlus size={15} color="var(--accent)" /> Tạo tài khoản mới</>}>
                    {createError && <ErrorBox msg={createError} />}

                    <div className="form-group">
                        <label className="form-label"><FiShield size={13} /> Vai trò</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {ROLE_OPTIONS.map(o => (
                                <button key={o.value} type="button"
                                    className={`btn btn-sm ${createForm.role === o.value ? 'btn-primary' : 'btn-outline'}`}
                                    style={{ flex: 1 }}
                                    onClick={() => setCreateForm({ ...createForm, role: o.value })}>
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label"><FiUser size={13} /> Họ và tên *</label>
                        <input className="form-input" placeholder="VD: Nguyễn Văn A" value={createForm.name}
                            onChange={e => setCreateForm({ ...createForm, name: e.target.value })} autoFocus />
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
                        <div className="form-hint">Mật khẩu tạm thời, người dùng có thể đổi sau khi đăng nhập</div>
                    </div>

                    {/* Preview */}
                    {(createForm.name || createForm.email) && (
                        <div style={previewBox}>
                            <div style={{ width: 38, height: 38, borderRadius: '50%', background: createForm.role === 'admin' ? 'var(--purple)' : createForm.role === 'teacher' ? 'var(--success)' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                {createForm.name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.875em' }}>{createForm.name || '—'}</div>
                                <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{createForm.email || '—'}</div>
                            </div>
                            <span className={`badge ${roleBadge(createForm.role)}`}>{roleLabel(createForm.role)}</span>
                        </div>
                    )}

                    <div style={modalFooterStyle}>
                        <button className="btn btn-outline" onClick={() => setShowCreate(false)}>Hủy</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={createLoading || !createForm.name || !createForm.email || !createForm.password}>
                            {createLoading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Đang tạo...</> : <><FiPlus size={14} /> Tạo tài khoản</>}
                        </button>
                    </div>
                </Modal>
            )}

            {/* ══════════════ EDIT MODAL ══════════════ */}
            {editUser && (
                <Modal onClose={() => setEditUser(null)} title={<><FiEdit2 size={15} color="var(--accent)" /> Chỉnh sửa tài khoản</>}>
                    {editError && <ErrorBox msg={editError} />}

                    {/* Current user info */}
                    <div style={{ ...previewBox, marginBottom: 20 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: editUser.role === 'admin' ? 'var(--purple)' : editUser.role === 'teacher' ? 'var(--success)' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                            {editUser.name?.[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.78em', color: 'var(--text-muted)' }}>Email (không thể đổi)</div>
                            <div style={{ fontSize: '0.875em', fontWeight: 600 }}>{editUser.email}</div>
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
                            <div style={{ padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: 8, fontSize: '0.85em', color: 'var(--text-muted)' }}>
                                Không thể thay đổi vai trò của chính mình
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: 8 }}>
                                {ROLE_OPTIONS.map(o => (
                                    <button key={o.value} type="button"
                                        className={`btn btn-sm ${editForm.role === o.value ? 'btn-primary' : 'btn-outline'}`}
                                        style={{ flex: 1 }}
                                        onClick={() => setEditForm({ ...editForm, role: o.value })}>
                                        {o.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={modalFooterStyle}>
                        <button className="btn btn-outline" onClick={() => setEditUser(null)}>Hủy</button>
                        <button className="btn btn-primary" onClick={handleEdit} disabled={editLoading || !editForm.name.trim()}>
                            {editLoading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Đang lưu...</> : <><FiSave size={14} /> Lưu thay đổi</>}
                        </button>
                    </div>
                </Modal>
            )}

            {/* ══════════════ LOCK CONFIRM MODAL ══════════════ */}
            {lockTarget && (
                <Modal onClose={() => setLockTarget(null)} title={
                    lockTarget.isActive === false
                        ? <><FiUnlock size={15} color="var(--success)" /> Mở khóa tài khoản</>
                        : <><FiLock size={15} color="var(--warning)" /> Khóa tài khoản</>
                } maxWidth={420}>
                    <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
                        <div style={{
                            width: 60, height: 60, borderRadius: '50%', margin: '0 auto 16px',
                            background: lockTarget.isActive === false ? 'var(--success-light)' : 'var(--warning-light)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {lockTarget.isActive === false
                                ? <FiUnlock size={26} color="var(--success)" />
                                : <FiLock size={26} color="var(--warning)" />}
                        </div>

                        <div style={{ fontWeight: 700, fontSize: '1.05em', marginBottom: 8 }}>
                            {lockTarget.isActive === false ? 'Xác nhận mở khóa?' : 'Xác nhận khóa tài khoản?'}
                        </div>

                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', padding: '10px 16px', borderRadius: 10, marginBottom: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: '0.85em' }}>
                                {lockTarget.name?.[0]}
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.875em' }}>{lockTarget.name}</div>
                                <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>{lockTarget.email}</div>
                            </div>
                        </div>

                        <div style={{ fontSize: '0.84em', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {lockTarget.isActive === false
                                ? 'Người dùng sẽ có thể đăng nhập trở lại vào hệ thống.'
                                : 'Người dùng sẽ không thể đăng nhập vào hệ thống cho đến khi được mở khóa.'}
                        </div>
                    </div>

                    <div style={modalFooterStyle}>
                        <button className="btn btn-outline" onClick={() => setLockTarget(null)}>Hủy</button>
                        <button
                            className={`btn ${lockTarget.isActive === false ? 'btn-success' : 'btn-warning'}`}
                            onClick={handleToggleLock}
                            disabled={lockLoading}
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

/* ── Shared Modal wrapper ── */
function Modal({ children, onClose, title, maxWidth = 500 }) {
    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={{ ...modalStyle, maxWidth }} onClick={e => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.97em' }}>
                        {title}
                    </h3>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, borderRadius: 6, display: 'flex' }} onClick={onClose}>
                        <FiX size={17} />
                    </button>
                </div>
                <div style={{ padding: '20px 24px' }}>{children}</div>
            </div>
        </div>
    );
}

function ErrorBox({ msg }) {
    return (
        <div style={{ background: 'var(--danger-light)', border: '1px solid rgba(255,77,106,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.84em', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiAlertCircle size={14} style={{ flexShrink: 0 }} /> {msg}
        </div>
    );
}

/* ── Styles ── */
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)', padding: 20 };
const modalStyle = { background: 'var(--bg-card)', borderRadius: 16, width: '100%', border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', animation: 'fadeSlideUp 0.25s ease' };
const modalHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--border)' };
const modalFooterStyle = { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' };
const previewBox = { background: 'var(--bg-primary)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 };
const eyeBtnStyle = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 };
