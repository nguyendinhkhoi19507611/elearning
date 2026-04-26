import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { classroomsAPI, usersAPI } from '../../api/api';
import {
    FiPlus, FiVideo, FiClock, FiTrash2, FiPlay, FiSearch,
    FiX, FiUsers, FiUserPlus, FiAlertCircle, FiBookOpen,
    FiCalendar, FiChevronRight, FiChevronLeft, FiGrid,
} from 'react-icons/fi';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_FULL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const initForm = () => ({ name: '', subject: '', description: '', teacherId: '', dayOfWeek: [], startTime: '', endTime: '', studentIds: [], classCode: '', semester: '', startDate: '', endDate: '' });

function getSession(t) {
    if (!t) return 'other';
    const h = parseInt(t.split(':')[0], 10);
    if (h < 12) return 'morning';
    if (h < 18) return 'afternoon';
    return 'evening';
}
function getMondayOf(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0); return d;
}
function fmt(date) { return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }); }

function WeekSchedule({ classrooms, classIndexMap }) {
    const navigate = useNavigate();
    const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()));
    const weekDates = WEEK_ORDER.map(dow => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + (dow === 0 ? 6 : dow - 1)); return { dow, date: d }; });
    const todayStr = new Date().toDateString();
    const sessions = [
        { key: 'morning', label: 'Sáng', time: '06:00 – 11:59' },
        { key: 'afternoon', label: 'Chiều', time: '12:00 – 17:59' },
        { key: 'evening', label: 'Tối', time: '18:00 – 21:59' },
    ];
    const lookup = {};
    classrooms.forEach(c => {
        (c.schedule?.dayOfWeek || []).forEach(dow => {
            const sess = getSession(c.schedule?.startTime);
            if (!lookup[dow]) lookup[dow] = {};
            if (!lookup[dow][sess]) lookup[dow][sess] = [];
            lookup[dow][sess].push(c);
        });
    });
    // Helper: kiểm tra lớp có nằm trong khoảng ngày của cell không
    const isClassActiveOnDate = (c, cellDate) => {
        const d = new Date(cellDate); d.setHours(0, 0, 0, 0);
        if (c.schedule?.startDate) {
            const sd = new Date(c.schedule.startDate); sd.setHours(0, 0, 0, 0);
            if (d < sd) return false;
        }
        if (c.schedule?.endDate) {
            const ed = new Date(c.schedule.endDate); ed.setHours(23, 59, 59, 999);
            if (d > ed) return false;
        }
        return true;
    };
    const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); };
    const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); };
    const goToday = () => setWeekStart(getMondayOf(new Date()));
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                <button onClick={goToday} className="btn btn-sm btn-outline" style={{ fontWeight: 700 }}><FiCalendar size={13} /> Hôm nay</button>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={prevWeek} className="btn btn-sm btn-outline" style={{ padding: '7px 12px' }}><FiChevronLeft size={14} /></button>
                    <button onClick={nextWeek} className="btn btn-sm btn-outline" style={{ padding: '7px 12px' }}><FiChevronRight size={14} /></button>
                </div>
                <span style={{ fontSize: '0.85em', fontWeight: 700, color: 'var(--text-secondary)' }}>Tuần: {fmt(weekStart)} – {fmt(weekDates[6].date)} / {weekStart.getFullYear()}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.8em', color: 'var(--text-muted)' }}>{classrooms.length} lớp học</span>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'auto' }}>
                <div style={{ minWidth: 700 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7,1fr)', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ padding: '12px 8px', fontSize: '0.7em', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', textAlign: 'center', borderRight: '1px solid var(--border)' }}>Ca học</div>
                        {weekDates.map(({ dow, date }, i) => {
                            const isToday = date.toDateString() === todayStr;
                            return (<div key={i} style={{ padding: '12px 8px', textAlign: 'center', borderRight: i < 6 ? '1px solid var(--border)' : 'none', background: isToday ? 'var(--accent-light)' : 'transparent' }}>
                                <div style={{ fontSize: '0.73em', fontWeight: 800, color: isToday ? 'var(--accent)' : 'var(--text-secondary)' }}>{DAY_FULL[dow]}</div>
                                <div style={{ fontSize: '0.7em', marginTop: 2, color: isToday ? 'var(--accent)' : 'var(--text-muted)', fontWeight: isToday ? 700 : 400 }}>{fmt(date)}{isToday && <span style={{ marginLeft: 4, display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', verticalAlign: 'middle' }} />}</div>
                            </div>);
                        })}
                    </div>
                    {sessions.map((sess, si) => (
                        <div key={sess.key} style={{ display: 'grid', gridTemplateColumns: '80px repeat(7,1fr)', borderBottom: si < 2 ? '1px solid var(--border)' : 'none', minHeight: 120 }}>
                            <div style={{ padding: '14px 6px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-purple-soft)' }}>
                                <div style={{ fontSize: '0.78em', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 3 }}>{sess.label}</div>
                                <div style={{ fontSize: '0.6em', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>{sess.time}</div>
                            </div>
                            {weekDates.map(({ dow, date }, ci) => {
                                const isToday = date.toDateString() === todayStr;
                                const cellClasses = (lookup[dow]?.[sess.key] || []).filter(c => isClassActiveOnDate(c, date));
                                return (
                                    <div key={ci} style={{ borderRight: ci < 6 ? '1px solid var(--border)' : 'none', padding: 6, background: isToday ? 'rgba(124,58,237,0.03)' : 'transparent', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 120 }}>
                                        {cellClasses.map(c => {
                                            const live = c.meeting?.isLive;
                                            const gi = classIndexMap[c._id] ?? 0;
                                            const accent = ACCENT_COLORS[gi % ACCENT_COLORS.length];
                                            return (
                                                <div key={c._id} onClick={() => navigate(`/admin/classroom/${c._id}`)}
                                                    style={{ borderRadius: 8, padding: '7px 9px', background: live ? 'rgba(16,185,129,0.15)' : `${accent}18`, border: `1px solid ${live ? 'rgba(16,185,129,0.35)' : `${accent}33`}`, cursor: 'pointer', transition: 'all 0.15s', position: 'relative', overflow: 'hidden' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = live ? 'rgba(16,185,129,0.25)' : `${accent}2e`; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = live ? 'rgba(16,185,129,0.15)' : `${accent}18`; e.currentTarget.style.transform = ''; }}>
                                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: live ? 'var(--success)' : accent, borderRadius: '0 2px 2px 0' }} />
                                                    <div style={{ paddingLeft: 6 }}>
                                                        {live && <div style={{ marginBottom: 2 }}><span className="live-dot" style={{ fontSize: '0.55em' }}>LIVE</span></div>}
                                                        <div style={{ fontSize: '0.75em', fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>{c.name}</div>
                                                        <div style={{ fontSize: '0.65em', color: live ? 'var(--success)' : accent, fontWeight: 600 }}>{c.subject}</div>
                                                        {c.teacher?.name && <div style={{ fontSize: '0.62em', color: 'var(--text-muted)', marginTop: 1 }}>GV: {c.teacher.name}</div>}
                                                        {c.schedule?.startTime && <div style={{ fontSize: '0.62em', color: 'var(--text-muted)', marginTop: 1 }}>{c.schedule.startTime}–{c.schedule.endTime}</div>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
                {classrooms.filter(c => c.schedule?.startTime).map(c => {
                    const gi = classIndexMap[c._id] ?? 0;
                    const accent = ACCENT_COLORS[gi % ACCENT_COLORS.length];
                    return (<div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75em' }}><div style={{ width: 10, height: 10, borderRadius: 3, background: accent, flexShrink: 0 }} /><span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{c.name}</span></div>);
                })}
            </div>
        </div>
    );
}

const CARD_GRADIENTS = [
    'linear-gradient(135deg, #7c3aed, #a78bfa)',
    'linear-gradient(135deg, #0891b2, #22d3ee)',
    'linear-gradient(135deg, #7e22ce, #c084fc)',
    'linear-gradient(135deg, #059669, #34d399)',
    'linear-gradient(135deg, #d97706, #fbbf24)',
    'linear-gradient(135deg, #0284c7, #38bdf8)',
];
const ACCENT_COLORS = ['#7c3aed', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#0ea5e9'];

/* ── Modal ── */
function Modal({ title, onClose, children, maxWidth = 560 }) {
    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000, backdropFilter: 'blur(8px)', padding: 20,
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth,
                maxHeight: '90vh', overflow: 'auto',
                border: '1px solid var(--border-strong)',
                boxShadow: 'var(--shadow-lg)',
                position: 'relative', animation: 'fadeSlideUp 0.25s ease',
            }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--gradient-purple)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.97em', fontWeight: 700, margin: 0 }}>{title}</h3>
                    <button onClick={onClose} style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8,
                        cursor: 'pointer', color: 'var(--text-muted)', padding: '5px 7px', display: 'flex',
                        transition: 'all 0.15s ease',
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
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [view, setView] = useState('schedule');
    const [filterDay, setFilterDay] = useState(null);

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
        if (!form.startTime || !form.endTime) {
            alert('Vui lòng nhập thời gian bắt đầu và kết thúc');
            return;
        }
        try {
            console.log('Creating classroom with data:', form);
            await classroomsAPI.create({
                name: form.name, subject: form.subject, description: form.description,
                teacherId: form.teacherId, studentIds: form.studentIds,
                classCode: form.classCode || undefined,
                semester: form.semester || undefined,
                schedule: {
                    dayOfWeek: form.dayOfWeek, startTime: form.startTime, endTime: form.endTime,
                    startDate: form.startDate || undefined,
                    endDate: form.endDate || undefined,
                }
            });
            alert('✅ Lớp học tạo thành công!');
            setShowCreateModal(false); 
            setForm(initForm()); 
            loadData();
        } catch (e) { 
            const errorMsg = e.response?.data?.error || e.message || 'Lỗi không xác định';
            console.error('❌ Error creating classroom:', {
                status: e.response?.status,
                message: errorMsg,
                fullError: e
            });
            alert(`❌ Lỗi: ${errorMsg}`);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true); setDeleteError('');
        try {
            await classroomsAPI.remove(deleteTarget._id);
            setDeleteTarget(null); loadData();
        } catch (e) { setDeleteError(e.response?.data?.error || 'Xóa lớp học thất bại'); }
        setDeleteLoading(false);
    };

    const startMeeting = async (id) => {
        try { await classroomsAPI.startMeeting(id); } catch (e) { console.error(e); }
        navigate(`/meeting/${id}`);
    };

    const addStudentsToClass = async (roomId, ids) => {
        await classroomsAPI.addStudents(roomId, ids).catch(console.error);
        setShowAddStudentModal(null); setForm(f => ({ ...f, studentIds: [] })); loadData();
    };

    const removeStudent = async (roomId, studentId) => {
        await classroomsAPI.removeStudent(roomId, studentId).catch(console.error);
        loadData();
    };

    const liveCount = classrooms.filter(c => c.meeting?.isLive).length;

    const classIndexMap = Object.fromEntries(classrooms.map((c, i) => [c._id, i]));
    const displayed = filterDay === null ? classrooms : classrooms.filter(c => c.schedule?.dayOfWeek?.includes(filterDay));

    return (
        <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
                <div>
                    <h1 style={{ fontSize: '1.6em', fontWeight: 900, letterSpacing: '-0.5px', margin: 0 }}>Quản lý lớp học</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875em', marginTop: 5 }}>
                        {classrooms.length} lớp học trong hệ thống
                        {liveCount > 0 && <span style={{ marginLeft: 10, color: 'var(--success)', fontWeight: 700 }}>• {liveCount} đang LIVE</span>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* View toggle */}
                    <div style={{ display: 'flex', gap: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
                        {[{ k: 'schedule', icon: <FiCalendar size={13} />, label: 'Thời khóa biểu' }, { k: 'cards', icon: <FiGrid size={13} />, label: 'Thẻ lớp học' }].map(({ k, icon, label }) => (
                            <button key={k} onClick={() => setView(k)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8em', transition: 'all 0.18s', background: view === k ? 'var(--accent)' : 'transparent', color: view === k ? '#fff' : 'var(--text-muted)' }}>{icon}{label}</button>
                        ))}
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <FiPlus size={15} /> Tạo lớp học
                    </button>
                </div>
            </div>

            {/* Day filter (cards view) */}
            {view === 'cards' && !loading && classrooms.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
                    <button onClick={() => setFilterDay(null)} style={{ padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.78em', background: filterDay === null ? 'var(--accent)' : 'rgba(255,255,255,0.05)', color: filterDay === null ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s' }}>Tất cả</button>
                    {DAYS.map((d, i) => (
                        <button key={i} onClick={() => setFilterDay(filterDay === i ? null : i)} style={{ padding: '6px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.78em', background: filterDay === i ? 'var(--accent)' : 'rgba(255,255,255,0.05)', color: filterDay === i ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s' }}>{d}</button>
                    ))}
                </div>
            )}

            {/* Skeleton */}
            {loading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
                    {[1, 2, 3, 4].map(k => (
                        <div key={k} style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <div className="skeleton" style={{ height: 110 }} />
                            <div style={{ padding: '16px 20px' }}>
                                <div className="skeleton skeleton-text w-3/4" />
                                <div className="skeleton skeleton-text w-1/2 sm" />
                                <div className="skeleton" style={{ height: 36, borderRadius: 10, marginTop: 16 }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty */}
            {!loading && classrooms.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border)' }}>
                    <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                        <FiBookOpen size={30} color="var(--accent)" />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.05em', marginBottom: 8 }}>Chưa có lớp học nào</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875em', marginBottom: 20 }}>Tạo lớp học đầu tiên để bắt đầu</div>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}><FiPlus size={14} /> Tạo lớp học</button>
                </div>
            )}

            {/* Schedule View */}
            {!loading && classrooms.length > 0 && view === 'schedule' && (
                <WeekSchedule classrooms={classrooms} classIndexMap={classIndexMap} />
            )}

            {/* Cards */}
            {!loading && classrooms.length > 0 && view === 'cards' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
                    {classrooms.map((c, idx) => {
                        const live = c.meeting?.isLive;
                        const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
                        const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];
                        const initials = c.name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'LH';
                        const days = c.schedule?.dayOfWeek?.map(d => DAYS[d]).join(', ') || '';

                        return (
                            <div key={c._id} style={{
                                borderRadius: 20, overflow: 'hidden',
                                border: `1px solid ${live ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`,
                                background: 'var(--bg-card)',
                                transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
                                position: 'relative',
                                boxShadow: live ? '0 0 0 1px rgba(16,185,129,0.15), 0 4px 24px rgba(16,185,129,0.08)' : 'none',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 14px 36px rgba(0,0,0,0.28), 0 0 0 1px ${accent}22`; e.currentTarget.style.borderColor = `${accent}33`; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = live ? '0 0 0 1px rgba(16,185,129,0.15), 0 4px 24px rgba(16,185,129,0.08)' : 'none'; e.currentTarget.style.borderColor = live ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'; }}
                            >
                                {/* Banner */}
                                <div style={{ height: 110, background: gradient, padding: '18px 20px', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                                    onClick={() => navigate(`/admin/classroom/${c._id}`)}>
                                    <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 80% 20%, ${accent}33 0%, transparent 60%)` }} />
                                    <div style={{ position: 'absolute', bottom: -20, right: -10, width: 100, height: 100, borderRadius: '50%', background: `${accent}18`, border: `1px solid ${accent}22` }} />

                                    {/* LIVE / status */}
                                    <div style={{ position: 'absolute', top: 14, right: 14 }}>
                                        {live ? <span className="live-dot">LIVE</span> : null}
                                    </div>

                                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1em', color: '#fff', letterSpacing: '-0.5px' }}>
                                        {initials}
                                    </div>
                                </div>

                                {/* Body */}
                                <div style={{ padding: '16px 20px 18px' }}>
                                    {/* Tags */}
                                    {(c.classCode || c.semester) && (
                                        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                                            {c.classCode && <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: '0.64em', fontWeight: 700, background: `${accent}18`, color: accent, border: `1px solid ${accent}33` }}>{c.classCode}</span>}
                                            {c.semester && <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: '0.64em', fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)' }}>{c.semester}</span>}
                                        </div>
                                    )}

                                    <div style={{ fontWeight: 800, fontSize: '0.97em', marginBottom: 4, lineHeight: 1.3, cursor: 'pointer' }} onClick={() => navigate(`/admin/classroom/${c._id}`)}>{c.name}</div>
                                    <div style={{ fontSize: '0.78em', color: accent, fontWeight: 600, marginBottom: 12 }}>{c.subject}</div>

                                    {/* Meta */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                                        {c.schedule?.startTime && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.77em', color: 'var(--text-muted)' }}>
                                                <FiCalendar size={12} style={{ color: accent, flexShrink: 0 }} />
                                                {days} • {c.schedule.startTime} – {c.schedule.endTime}
                                            </div>
                                        )}
                                        {c.teacher && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.77em', color: 'var(--text-muted)' }}>
                                                <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6em', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{c.teacher.name?.[0]}</div>
                                                {c.teacher.name}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.77em', color: 'var(--text-muted)' }}>
                                            <FiUsers size={12} style={{ color: accent, flexShrink: 0 }} />
                                            {c.students?.length || 0} sinh viên
                                        </div>
                                    </div>

                                    {/* Student avatars */}
                                    {c.students?.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                                            <div style={{ display: 'flex' }}>
                                                {c.students.slice(0, 5).map((s, si) => (
                                                    <div key={s._id} title={s.name} style={{
                                                        width: 26, height: 26, borderRadius: '50%',
                                                        background: `hsl(${si * 60 + 200}, 60%, 45%)`,
                                                        border: '2px solid var(--bg-card)',
                                                        marginLeft: si === 0 ? 0 : -8,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.62em', fontWeight: 700, color: '#fff',
                                                    }}>
                                                        {s.name?.[0]?.toUpperCase()}
                                                    </div>
                                                ))}
                                            </div>
                                            {c.students.length > 5 && (
                                                <span style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>+{c.students.length - 5}</span>
                                            )}
                                            <button style={{
                                                marginLeft: 'auto', background: 'none', border: `1px dashed ${accent}55`,
                                                borderRadius: 99, padding: '2px 10px', fontSize: '0.68em', fontWeight: 600,
                                                color: accent, cursor: 'pointer',
                                            }} onClick={() => setShowAddStudentModal(c._id)}>
                                                + Thêm SV
                                            </button>
                                        </div>
                                    )}

                                    <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />

                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {live ? (
                                            <button className="btn btn-sm" style={{ flex: 1, background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border: 'none', fontWeight: 700 }}
                                                onClick={() => navigate(`/meeting/${c._id}`)}>
                                                <FiVideo size={13} /> Vào lớp
                                            </button>
                                        ) : (
                                            <button className="btn btn-primary btn-sm" style={{ flex: 1 }}
                                                onClick={() => startMeeting(c._id)}>
                                                <FiPlay size={13} /> Bắt đầu
                                            </button>
                                        )}
                                        {c.students?.length === 0 && (
                                            <button className="btn btn-outline btn-sm btn-icon" title="Thêm sinh viên"
                                                onClick={() => setShowAddStudentModal(c._id)} style={{ padding: '0 12px' }}>
                                                <FiUserPlus size={13} />
                                            </button>
                                        )}
                                        <button className="btn btn-sm btn-icon" title="Xóa lớp học"
                                            onClick={() => { setDeleteTarget(c); setDeleteError(''); }}
                                            style={{ padding: '0 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)' }}>
                                            <FiTrash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                {live && (
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,transparent,#10b981,transparent)', filter: 'blur(1px)' }} />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Delete Modal ── */}
            {deleteTarget && (
                <Modal title={<><FiTrash2 size={15} color="var(--danger)" /> Xóa lớp học</>}
                    onClose={() => !deleteLoading && setDeleteTarget(null)} maxWidth={420}>
                    <div style={{ textAlign: 'center', paddingBottom: 8 }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                            <FiTrash2 size={26} color="var(--danger)" />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1.05em', marginBottom: 12 }}>Xác nhận xóa lớp học?</div>
                        <div style={{ display: 'inline-block', background: 'var(--bg-primary)', borderRadius: 12, padding: '10px 20px', marginBottom: 14, border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95em' }}>{deleteTarget.name}</div>
                            <div style={{ fontSize: '0.78em', color: 'var(--text-muted)' }}>Môn: {deleteTarget.subject}</div>
                        </div>
                        <div style={{ fontSize: '0.84em', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            Lớp học sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.
                        </div>
                        {deleteError && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', marginTop: 14, fontSize: '0.84em', color: 'var(--danger)' }}>
                                <FiAlertCircle size={14} /> {deleteError}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                        <button className="btn btn-outline" onClick={() => !deleteLoading && setDeleteTarget(null)}>Hủy</button>
                        <button className="btn btn-danger" onClick={handleDelete} disabled={deleteLoading}>
                            {deleteLoading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Đang xóa...</> : <><FiTrash2 size={14} /> Xóa lớp học</>}
                        </button>
                    </div>
                </Modal>
            )}

            {/* ── Create Modal ── */}
            {showCreateModal && (
                <Modal title={<><FiVideo size={15} color="var(--accent)" /> Tạo lớp học mới</>}
                    onClose={() => setShowCreateModal(false)}>
                    {[['Tên lớp học *', 'name', 'VD: Toán cao cấp A1'], ['Môn học *', 'subject', 'VD: Toán cao cấp'], ['Mô tả', 'description', 'Mô tả ngắn...']].map(([label, key, ph]) => (
                        <div className="form-group" key={key}>
                            <label className="form-label">{label}</label>
                            <input className="form-input" placeholder={ph} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
                        </div>
                    ))}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Mã lớp</label>
                            <input className="form-input" placeholder="VD: CS101-2024A" value={form.classCode} onChange={e => setForm({ ...form, classCode: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Học kỳ</label>
                            <input className="form-input" placeholder="VD: HK1 2024-2025" value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Giáo viên *</label>
                        <select className="form-input" value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })}>
                            <option value="">-- Chọn giáo viên --</option>
                            {(() => {
                                const subjectLower = form.subject?.toLowerCase().trim();
                                const filtered = subjectLower
                                    ? teachers.filter(t => (t.subjects || []).some(s => s.toLowerCase().includes(subjectLower)))
                                    : [];
                                const list = filtered.length > 0 ? filtered : teachers;
                                return list.map(t => <option key={t._id} value={t._id}>{t.name} ({t.email}){filtered.length > 0 && (t.subjects || []).length > 0 ? ` — ${t.subjects.join(', ')}` : ''}</option>);
                            })()}
                        </select>
                        {form.subject && teachers.some(t => (t.subjects || []).length > 0) && (
                            <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', marginTop: 4 }}>
                                {teachers.filter(t => (t.subjects || []).some(s => s.toLowerCase().includes(form.subject?.toLowerCase().trim()))).length > 0
                                    ? `🟢 Lọc theo môn "${form.subject}"`
                                    : `⚠️ Không có GV theo môn "${form.subject}" — hiện tất cả`}
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label className="form-label">Lịch học</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                            {DAYS.map((d, i) => (
                                <button key={i} type="button"
                                    className={`btn btn-sm ${form.dayOfWeek.includes(i) ? 'btn-primary' : 'btn-outline'}`}
                                    style={{ padding: '5px 11px', fontSize: '0.78em' }}
                                    onClick={() => setForm({ ...form, dayOfWeek: form.dayOfWeek.includes(i) ? form.dayOfWeek.filter(x => x !== i) : [...form.dayOfWeek, i] })}>
                                    {d}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <input type="time" className="form-input" style={{ flex: 1 }} value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85em', fontWeight: 600 }}>→</span>
                            <input type="time" className="form-input" style={{ flex: 1 }} value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Ngày bắt đầu</label>
                            <input type="date" className="form-input" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Ngày kết thúc</label>
                            <input type="date" className="form-input" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Sinh viên ({form.studentIds.length} đã chọn)</label>
                        <div style={{ maxHeight: 140, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
                            {students.map(s => (
                                <label key={s._id} style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                                    cursor: 'pointer', fontSize: '0.85em', borderRadius: 8,
                                    background: form.studentIds.includes(s._id) ? 'var(--accent-light)' : 'transparent',
                                    transition: 'background 0.15s',
                                }}>
                                    <input type="checkbox" checked={form.studentIds.includes(s._id)}
                                        onChange={e => setForm({ ...form, studentIds: e.target.checked ? [...form.studentIds, s._id] : form.studentIds.filter(id => id !== s._id) })} />
                                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7em', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{s.name?.[0]}</div>
                                    {s.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>({s.email})</span>
                                </label>
                            ))}
                            {students.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16, fontSize: '0.85em' }}>Không có sinh viên</div>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                        <button className="btn btn-outline" onClick={() => setShowCreateModal(false)}>Hủy</button>
                        <button className="btn btn-primary" onClick={createClassroom} disabled={!form.name || !form.subject || !form.teacherId}>
                            <FiPlus size={14} /> Tạo lớp học
                        </button>
                    </div>
                </Modal>
            )}

            {/* ── Add Students Modal ── */}
            {showAddStudentModal && (() => {
                const cls = classrooms.find(c => c._id === showAddStudentModal);
                const existIds = cls?.students?.map(s => s._id) || [];
                const available = students
                    .filter(s => !existIds.includes(s._id))
                    .filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.email.toLowerCase().includes(studentSearch.toLowerCase()));
                const onClose = () => { setShowAddStudentModal(null); setStudentSearch(''); setForm(f => ({ ...f, studentIds: [] })); };
                return (
                    <Modal title={<><FiUserPlus size={15} color="var(--accent)" /> Thêm sinh viên — {cls?.name}</>} onClose={onClose} maxWidth={460}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-primary)', borderRadius: 10, padding: '9px 14px', marginBottom: 14, border: '1px solid var(--border)' }}>
                            <FiSearch size={14} color="var(--text-muted)" />
                            <input style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', flex: 1, outline: 'none', fontSize: '0.875em' }}
                                placeholder="Tìm sinh viên..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                        </div>
                        <div style={{ maxHeight: 300, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {available.map(s => (
                                <label key={s._id} style={{
                                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                                    borderRadius: 10, cursor: 'pointer',
                                    background: form.studentIds.includes(s._id) ? 'var(--accent-light)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${form.studentIds.includes(s._id) ? 'var(--border-accent)' : 'transparent'}`,
                                    transition: 'all 0.15s ease',
                                }}>
                                    <input type="checkbox" checked={form.studentIds.includes(s._id)}
                                        onChange={e => setForm({ ...form, studentIds: e.target.checked ? [...form.studentIds, s._id] : form.studentIds.filter(id => id !== s._id) })} />
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75em', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{s.name?.[0]}</div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.875em' }}>{s.name}</div>
                                        <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>{s.email}</div>
                                    </div>
                                </label>
                            ))}
                            {available.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 28, fontSize: '0.875em' }}>Không có sinh viên phù hợp</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                            <button className="btn btn-outline" onClick={onClose}>Hủy</button>
                            <button className="btn btn-primary" disabled={form.studentIds.length === 0}
                                onClick={() => addStudentsToClass(showAddStudentModal, form.studentIds)}>
                                <FiUserPlus size={14} /> Thêm {form.studentIds.length > 0 ? form.studentIds.length + ' SV' : ''}
                            </button>
                        </div>
                    </Modal>
                );
            })()}
        </>
    );
}
