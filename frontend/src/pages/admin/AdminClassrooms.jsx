import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { classroomsAPI, usersAPI } from '../../api/api';
import {
    FiPlus, FiVideo, FiClock, FiTrash2, FiPlay, FiSearch,
    FiX, FiUsers, FiUserPlus, FiAlertCircle
} from 'react-icons/fi';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const initForm = () => ({ name: '', subject: '', description: '', teacherId: '', dayOfWeek: [], startTime: '', endTime: '', studentIds: [] });

export default function AdminClassrooms() {
    const navigate = useNavigate();
    const [classrooms, setClassrooms] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAddStudentModal, setShowAddStudentModal] = useState(null);
    const [form, setForm] = useState(initForm());
    const [studentSearch, setStudentSearch] = useState('');

    // Delete confirmation modal state
    const [deleteTarget, setDeleteTarget] = useState(null); // classroom object
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const [cr, tr, st] = await Promise.all([
            classroomsAPI.getAll().then(r => r.data).catch(() => []),
            usersAPI.getAll({ role: 'teacher' }).then(r => r.data.users || r.data).catch(() => []),
            usersAPI.getAll({ role: 'student' }).then(r => r.data.users || r.data).catch(() => []),
        ]);
        setClassrooms(cr); setTeachers(tr); setStudents(st);
        setLoading(false);
    };

    const createClassroom = async () => {
        if (!form.name || !form.subject || !form.teacherId) return;
        try {
            await classroomsAPI.create({
                name: form.name, subject: form.subject, description: form.description,
                teacherId: form.teacherId, studentIds: form.studentIds,
                schedule: { dayOfWeek: form.dayOfWeek, startTime: form.startTime, endTime: form.endTime }
            });
            setShowCreateModal(false);
            setForm(initForm());
            loadData();
        } catch (e) {
            console.error('Create classroom error:', e);
        }
    };

    // Open delete modal
    const openDeleteModal = (classroom) => {
        setDeleteTarget(classroom);
        setDeleteError('');
    };

    // Confirm delete
    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        setDeleteError('');
        try {
            await classroomsAPI.remove(deleteTarget._id);
            setDeleteTarget(null);
            loadData();
        } catch (e) {
            setDeleteError(e.response?.data?.error || e.message || 'Xóa lớp học thất bại');
        }
        setDeleteLoading(false);
    };

    const startMeeting = async (id) => {
        try {
            await classroomsAPI.startMeeting(id);
        } catch (e) { console.error(e); }
        navigate(`/meeting/${id}`);
    };

    const addStudentsToClass = async (roomId, ids) => {
        await classroomsAPI.addStudents(roomId, ids).catch(console.error);
        setShowAddStudentModal(null);
        setForm(f => ({ ...f, studentIds: [] }));
        loadData();
    };

    const removeStudent = async (roomId, studentId) => {
        await classroomsAPI.removeStudent(roomId, studentId).catch(console.error);
        loadData();
    };

    if (loading) return <div className="card"><div className="empty-state"><div className="spinner" /></div></div>;

    return (
        <>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">Quản lý lớp học</h1>
                        <p className="page-subtitle">{classrooms.length} lớp học trong hệ thống</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <FiPlus size={15} /> Tạo lớp học
                    </button>
                </div>
            </div>

            {classrooms.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"><FiVideo size={24} /></div>
                        <div className="empty-state-title">Chưa có lớp học nào</div>
                        <div className="empty-state-sub" style={{ marginBottom: 16 }}>Tạo lớp học đầu tiên để bắt đầu!</div>
                        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}><FiPlus size={14} /> Tạo lớp học</button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-2">
                    {classrooms.map(c => (
                        <div className="card" key={c._id} style={{ borderLeft: `4px solid ${c.meeting?.isLive ? 'var(--success)' : 'var(--accent)'}`, position: 'relative' }}>
                            {c.meeting?.isLive && <div style={{ position: 'absolute', top: 14, right: 14 }}><span className="live-dot">LIVE</span></div>}
                            <div style={{ fontWeight: 700, fontSize: '1.05em', marginBottom: 6, paddingRight: c.meeting?.isLive ? 64 : 0 }}>{c.name}</div>
                            <div style={{ fontSize: '0.83em', color: 'var(--text-muted)', marginBottom: 10 }}>Môn: {c.subject}{c.description && ` • ${c.description}`}</div>

                            {c.schedule?.startTime && (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, fontSize: '0.8em', color: 'var(--text-secondary)' }}>
                                    <FiClock size={12} />
                                    {c.schedule?.dayOfWeek?.map(d => DAYS[d]).join(', ')} &bull; {c.schedule.startTime} - {c.schedule.endTime}
                                </div>
                            )}

                            {/* Teacher */}
                            {c.teacher && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', padding: '8px 10px', borderRadius: 8, marginBottom: 10 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8em', fontWeight: 700, color: 'white' }}>{c.teacher?.name?.[0]}</div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.83em' }}>{c.teacher?.name}</div>
                                        <div style={{ fontSize: '0.7em', color: 'var(--text-muted)' }}>{c.teacher?.email}</div>
                                    </div>
                                </div>
                            )}

                            {/* Students */}
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontSize: '0.8em', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <FiUsers size={12} /> Sinh viên ({c.students?.length || 0})
                                    </span>
                                    <button className="btn btn-outline btn-sm" style={{ padding: '2px 8px', fontSize: '0.72em' }} onClick={() => setShowAddStudentModal(c._id)}>
                                        <FiUserPlus size={11} /> Thêm
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {c.students?.slice(0, 6).map(s => (
                                        <span key={s._id} style={{ background: 'var(--bg-primary)', padding: '3px 8px', borderRadius: 6, fontSize: '0.72em', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {s.name}
                                            <FiX size={9} style={{ cursor: 'pointer', color: 'var(--danger)' }} onClick={() => removeStudent(c._id, s._id)} />
                                        </span>
                                    ))}
                                    {c.students?.length > 6 && <span style={{ background: 'var(--bg-primary)', padding: '3px 8px', borderRadius: 6, fontSize: '0.72em', color: 'var(--text-muted)' }}>+{c.students.length - 6}</span>}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary btn-sm" onClick={() => startMeeting(c._id)}>
                                    <FiPlay size={13} /> {c.meeting?.isLive ? 'Tham gia' : 'Bắt đầu'}
                                </button>
                                <button
                                    className="btn btn-danger btn-sm btn-icon"
                                    title="Xóa lớp học"
                                    onClick={() => openDeleteModal(c)}
                                    style={{ padding: '7px 10px' }}
                                >
                                    <FiTrash2 size={13} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Delete Confirmation Modal ── */}
            {deleteTarget && (
                <div style={overlay} onClick={() => !deleteLoading && setDeleteTarget(null)}>
                    <div style={{ ...modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div style={modalHeader}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
                                <FiTrash2 size={16} /> Xóa lớp học
                            </h3>
                            <FiX style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => !deleteLoading && setDeleteTarget(null)} />
                        </div>
                        <div style={modalBody}>
                            <div style={{ textAlign: 'center', paddingBottom: 8 }}>
                                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <FiTrash2 size={24} color="var(--danger)" />
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '1.05em', marginBottom: 8 }}>
                                    Xác nhận xóa lớp học?
                                </div>
                                <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: '10px 16px', marginBottom: 12, display: 'inline-block' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.95em' }}>{deleteTarget.name}</div>
                                    <div style={{ fontSize: '0.78em', color: 'var(--text-muted)' }}>Môn: {deleteTarget.subject}</div>
                                </div>
                                <div style={{ fontSize: '0.84em', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    Lớp học sẽ bị xóa khỏi hệ thống. Hành động này không thể hoàn tác.
                                </div>
                            </div>

                            {deleteError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--danger-light)', border: '1px solid rgba(255,77,106,0.3)', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: '0.84em', color: 'var(--danger)' }}>
                                    <FiAlertCircle size={14} /> {deleteError}
                                </div>
                            )}
                        </div>
                        <div style={modalFooter}>
                            <button className="btn btn-outline" onClick={() => !deleteLoading && setDeleteTarget(null)}>Hủy</button>
                            <button className="btn btn-danger" onClick={handleDelete} disabled={deleteLoading}>
                                {deleteLoading
                                    ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Đang xóa...</>
                                    : <><FiTrash2 size={14} /> Xóa lớp học</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Create Modal ── */}
            {showCreateModal && (
                <div style={overlay} onClick={() => setShowCreateModal(false)}>
                    <div style={modal} onClick={e => e.stopPropagation()}>
                        <div style={modalHeader}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiVideo size={16} /> Tạo lớp học mới</h3>
                            <FiX style={{ cursor: 'pointer' }} onClick={() => setShowCreateModal(false)} />
                        </div>
                        <div style={modalBody}>
                            {[['Tên lớp học *', 'name', 'VD: Toán cao cấp A1'], ['Môn học *', 'subject', 'VD: Toán cao cấp'], ['Mô tả', 'description', 'Mô tả ngắn...']].map(([label, key, ph]) => (
                                <div className="form-group" key={key}>
                                    <label className="form-label">{label}</label>
                                    <input className="form-input" placeholder={ph} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
                                </div>
                            ))}
                            <div className="form-group">
                                <label className="form-label">Giáo viên *</label>
                                <select className="form-input" value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })}>
                                    <option value="">-- Chọn giáo viên --</option>
                                    {teachers.map(t => <option key={t._id} value={t._id}>{t.name} ({t.email})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Lịch học</label>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                                    {DAYS.map((d, i) => (
                                        <button key={i} className={`btn btn-sm ${form.dayOfWeek.includes(i) ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '4px 10px', fontSize: '0.78em' }}
                                            onClick={() => setForm({ ...form, dayOfWeek: form.dayOfWeek.includes(i) ? form.dayOfWeek.filter(x => x !== i) : [...form.dayOfWeek, i] })}>
                                            {d}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <input type="time" className="form-input" style={{ flex: 1 }} value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
                                    <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8em' }}>→</span>
                                    <input type="time" className="form-input" style={{ flex: 1 }} value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Sinh viên ({form.studentIds.length} đã chọn)</label>
                                <div style={{ maxHeight: 140, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                                    {students.map(s => (
                                        <label key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', cursor: 'pointer', fontSize: '0.85em', borderRadius: 6, background: form.studentIds.includes(s._id) ? 'var(--accent-light)' : 'transparent' }}>
                                            <input type="checkbox" checked={form.studentIds.includes(s._id)} onChange={e => setForm({ ...form, studentIds: e.target.checked ? [...form.studentIds, s._id] : form.studentIds.filter(id => id !== s._id) })} />
                                            {s.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>({s.email})</span>
                                        </label>
                                    ))}
                                    {students.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16, fontSize: '0.85em' }}>Không có sinh viên</div>}
                                </div>
                            </div>
                        </div>
                        <div style={modalFooter}>
                            <button className="btn btn-outline" onClick={() => setShowCreateModal(false)}>Hủy</button>
                            <button className="btn btn-primary" onClick={createClassroom} disabled={!form.name || !form.subject || !form.teacherId}>
                                <FiPlus size={14} /> Tạo lớp học
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add Students Modal ── */}
            {showAddStudentModal && (() => {
                const cls = classrooms.find(c => c._id === showAddStudentModal);
                const existIds = cls?.students?.map(s => s._id) || [];
                const available = students.filter(s => !existIds.includes(s._id)).filter(s =>
                    s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.email.toLowerCase().includes(studentSearch.toLowerCase())
                );
                return (
                    <div style={overlay} onClick={() => { setShowAddStudentModal(null); setStudentSearch(''); setForm(f => ({ ...f, studentIds: [] })); }}>
                        <div style={{ ...modal, width: 460 }} onClick={e => e.stopPropagation()}>
                            <div style={modalHeader}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiUserPlus size={15} /> Thêm sinh viên — {cls?.name}</h3>
                                <FiX style={{ cursor: 'pointer' }} onClick={() => { setShowAddStudentModal(null); setStudentSearch(''); setForm(f => ({ ...f, studentIds: [] })); }} />
                            </div>
                            <div style={modalBody}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                                    <FiSearch size={15} color="var(--text-muted)" />
                                    <input style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', flex: 1, outline: 'none', fontSize: '0.875em' }}
                                        placeholder="Tìm sinh viên..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                                </div>
                                <div style={{ maxHeight: 280, overflow: 'auto' }}>
                                    {available.map(s => (
                                        <label key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', background: form.studentIds.includes(s._id) ? 'var(--accent-light)' : 'transparent', marginBottom: 2 }}>
                                            <input type="checkbox" checked={form.studentIds.includes(s._id)} onChange={e => setForm({ ...form, studentIds: e.target.checked ? [...form.studentIds, s._id] : form.studentIds.filter(id => id !== s._id) })} />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.85em' }}>{s.name}</div>
                                                <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>{s.email}</div>
                                            </div>
                                        </label>
                                    ))}
                                    {available.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24, fontSize: '0.875em' }}>Không có sinh viên phù hợp</div>}
                                </div>
                            </div>
                            <div style={modalFooter}>
                                <button className="btn btn-outline" onClick={() => { setShowAddStudentModal(null); setStudentSearch(''); setForm(f => ({ ...f, studentIds: [] })); }}>Hủy</button>
                                <button className="btn btn-primary" disabled={form.studentIds.length === 0} onClick={() => addStudentsToClass(showAddStudentModal, form.studentIds)}>
                                    <FiUserPlus size={14} /> Thêm {form.studentIds.length > 0 ? form.studentIds.length + ' SV' : ''}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </>
    );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: 20 };
const modal = { background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', animation: 'fadeSlideUp 0.25s ease' };
const modalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' };
const modalBody = { padding: '20px 24px' };
const modalFooter = { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border)' };
