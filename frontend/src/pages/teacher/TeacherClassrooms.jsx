import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { classroomsAPI } from '../../api/api';
import {
    FiVideo, FiClock, FiPlay, FiSquare, FiUsers, FiAlertCircle,
    FiCalendar, FiX, FiCheck, FiChevronRight, FiBookOpen,
    FiGrid, FiList, FiChevronLeft,
} from 'react-icons/fi';

const DAYS_LABEL = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
// Display order: T2..T7, CN = dayOfWeek [1,2,3,4,5,6,0]
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_FULL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const CARD_GRADIENTS = [
    'linear-gradient(135deg,#1e1b4b,#312e81)',
    'linear-gradient(135deg,#0c1a2e,#0f4c75)',
    'linear-gradient(135deg,#1a0a2e,#4a1c6e)',
    'linear-gradient(135deg,#0a2e1f,#0c4a2e)',
    'linear-gradient(135deg,#2e1a0a,#4a2e0c)',
    'linear-gradient(135deg,#0a1e2e,#0c3a4a)',
];
const ACCENT_COLORS = ['#6366f1', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#0ea5e9'];

/* ── Time session helper ── */
function getSession(timeStr) {
    if (!timeStr) return 'other';
    const h = parseInt(timeStr.split(':')[0], 10);
    if (h < 12) return 'morning';
    if (h < 18) return 'afternoon';
    return 'evening';
}

/* ── Get Monday of a given date ── */
function getMondayOf(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

/* ── Format dd/mm ── */
function fmt(date) {
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

/* ─────────────────────────────────────────
   Weekly Timetable Component
───────────────────────────────────────────*/
function WeekSchedule({ classrooms, role, classIndexMap }) {
    const navigate = useNavigate();
    const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()));

    const weekDates = WEEK_ORDER.map((dow, i) => {
        const d = new Date(weekStart);
        // weekStart is Monday (dow=1), so offset:
        // Mon=0, Tue=1 ... Sat=5, Sun=6 → but WEEK_ORDER=[1,2,3,4,5,6,0]
        // index 0→+0, 1→+1,...,5→+5, 6→+6 but Sun needs -1 from weekStart+7
        const offset = dow === 0 ? 6 : dow - 1;
        d.setDate(weekStart.getDate() + offset);
        return { dow, date: d };
    });

    const todayDow = new Date().getDay();
    const todayStr = new Date().toDateString();

    const sessions = [
        { key: 'morning', label: 'Sáng', time: '06:00 – 11:59' },
        { key: 'afternoon', label: 'Chiều', time: '12:00 – 17:59' },
        { key: 'evening', label: 'Tối', time: '18:00 – 21:59' },
    ];

    // Build lookup: dow → session → classes[]
    const lookup = {};
    classrooms.forEach((c, gi) => {
        (c.schedule?.dayOfWeek || []).forEach(dow => {
            const sess = getSession(c.schedule?.startTime);
            if (!lookup[dow]) lookup[dow] = {};
            if (!lookup[dow][sess]) lookup[dow][sess] = [];
            lookup[dow][sess].push({ ...c, _globalIdx: classIndexMap[c._id] ?? gi });
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

    const weekEndDate = weekDates[6].date;
    const weekLabel = `${fmt(weekStart)} – ${fmt(weekEndDate)} / ${weekStart.getFullYear()}`;

    return (
        <div>
            {/* ── Toolbar ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                <button onClick={goToday} className="btn btn-sm btn-outline" style={{ fontWeight: 700 }}>
                    <FiCalendar size={13} /> Hôm nay
                </button>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={prevWeek} className="btn btn-sm btn-outline" style={{ padding: '7px 12px' }}>
                        <FiChevronLeft size={14} />
                    </button>
                    <button onClick={nextWeek} className="btn btn-sm btn-outline" style={{ padding: '7px 12px' }}>
                        <FiChevronRight size={14} />
                    </button>
                </div>
                <div style={{ fontSize: '0.85em', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Tuần: {weekLabel}
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '0.8em', color: 'var(--text-muted)' }}>
                    {classrooms.length} lớp học • {classrooms.filter(c => c.schedule?.startTime).length} có lịch
                </div>
            </div>

            {/* ── Grid ── */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden' }}>
                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7,1fr)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ padding: '12px 8px', fontSize: '0.72em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                        Ca học
                    </div>
                    {weekDates.map(({ dow, date }, i) => {
                        const isToday = date.toDateString() === todayStr;
                        return (
                            <div key={i} style={{
                                padding: '12px 8px', textAlign: 'center',
                                borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                                background: isToday ? 'rgba(99,102,241,0.08)' : 'transparent',
                            }}>
                                <div style={{
                                    fontSize: '0.75em', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5,
                                    color: isToday ? 'var(--accent)' : 'var(--text-secondary)',
                                }}>
                                    {DAY_FULL[dow]}
                                </div>
                                <div style={{
                                    fontSize: '0.72em', marginTop: 2,
                                    color: isToday ? 'var(--accent)' : 'var(--text-muted)',
                                    fontWeight: isToday ? 700 : 400,
                                }}>
                                    {fmt(date)}
                                    {isToday && <span style={{ marginLeft: 4, display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', verticalAlign: 'middle' }} />}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Session rows */}
                {sessions.map((sess, si) => (
                    <div key={sess.key} style={{ display: 'grid', gridTemplateColumns: '80px repeat(7,1fr)', borderBottom: si < 2 ? '1px solid var(--border)' : 'none', minHeight: 110 }}>
                        {/* Session label */}
                        <div style={{
                            padding: '16px 8px', borderRight: '1px solid var(--border)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(255,255,255,0.015)',
                            position: 'sticky', left: 0,
                        }}>
                            <div style={{ fontSize: '0.8em', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 3 }}>{sess.label}</div>
                            <div style={{ fontSize: '0.62em', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>{sess.time}</div>
                        </div>

                        {/* Day cells */}
                        {weekDates.map(({ dow, date }, ci) => {
                            const isToday = date.toDateString() === todayStr;
                            const cellClasses = (lookup[dow]?.[sess.key] || []).filter(c => isClassActiveOnDate(c, date));
                            return (
                                <div key={ci} style={{
                                    borderRight: ci < 6 ? '1px solid var(--border)' : 'none',
                                    padding: '6px',
                                    background: isToday ? 'rgba(99,102,241,0.025)' : 'transparent',
                                    display: 'flex', flexDirection: 'column', gap: 4,
                                    minHeight: 110,
                                }}>
                                    {cellClasses.map(c => {
                                        const live = c.meeting?.isLive;
                                        const idx = c._globalIdx ?? 0;
                                        const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];
                                        return (
                                            <div key={c._id} onClick={() => navigate(live ? `/meeting/${c._id}` : `/${role}/classroom/${c._id}`)} style={{
                                                borderRadius: 8, padding: '7px 9px',
                                                background: live
                                                    ? 'rgba(16,185,129,0.15)'
                                                    : `${accent}18`,
                                                border: `1px solid ${live ? 'rgba(16,185,129,0.35)' : `${accent}33`}`,
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
                                                position: 'relative', overflow: 'hidden',
                                            }}
                                                onMouseEnter={e => { e.currentTarget.style.background = live ? 'rgba(16,185,129,0.25)' : `${accent}2e`; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = live ? 'rgba(16,185,129,0.15)' : `${accent}18`; e.currentTarget.style.transform = ''; }}
                                            >
                                                {/* accent left bar */}
                                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: live ? 'var(--success)' : accent, borderRadius: '0 2px 2px 0' }} />
                                                <div style={{ paddingLeft: 6 }}>
                                                    {live && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                                            <span className="live-dot" style={{ fontSize: '0.55em' }}>LIVE</span>
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.75em', fontWeight: 700, lineHeight: 1.2, color: 'var(--text-primary)', marginBottom: 2 }}>
                                                        {c.name}
                                                    </div>
                                                    <div style={{ fontSize: '0.65em', color: live ? 'var(--success)' : accent, fontWeight: 600 }}>
                                                        {c.subject}
                                                    </div>
                                                    {c.schedule?.startTime && (
                                                        <div style={{ fontSize: '0.63em', color: 'var(--text-muted)', marginTop: 2 }}>
                                                            {c.schedule.startTime} – {c.schedule.endTime}
                                                        </div>
                                                    )}
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

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                {classrooms.filter(c => c.schedule?.startTime).map((c, gi) => {
                    const idx = c._globalIdx ?? gi;
                    const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];
                    return (
                        <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75em' }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: accent, flexShrink: 0 }} />
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{c.name}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────
   Class Card (reused)
───────────────────────────────────────────*/
function ClassCard({ c, idx, role, onStart, startError }) {
    const navigate = useNavigate();
    const [hovered, setHovered] = useState(false);
    const [endConfirmOpen, setEndConfirmOpen] = useState(false);
    const [endLoading, setEndLoading] = useState(false);
    const [endErr, setEndErr] = useState('');

    const live = c.meeting?.isLive;
    const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
    const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];
    const initials = c.name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'LH';
    const days = c.schedule?.dayOfWeek?.map(d => DAYS_LABEL[d]).join(', ') || '';

    const handleEnd = async () => {
        setEndLoading(true); setEndErr('');
        try {
            await classroomsAPI.endMeeting(c._id);
            setEndConfirmOpen(false);
            window.location.reload();
        } catch (e) { setEndErr(e.response?.data?.error || 'Lỗi'); }
        setEndLoading(false);
    };

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                borderRadius: 20, overflow: 'hidden',
                border: `1px solid ${live ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`,
                background: 'var(--bg-card)',
                boxShadow: hovered ? `0 16px 40px rgba(0,0,0,0.35), 0 0 0 1px ${accent}22` : live ? '0 0 0 1px rgba(16,185,129,0.2)' : 'none',
                transform: hovered ? 'translateY(-4px)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                position: 'relative',
            }}
        >
            <div style={{ height: 110, background: gradient, padding: '18px 20px', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => navigate(`/${role}/classroom/${c._id}`)}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 80% 20%,${accent}33 0%,transparent 60%)` }} />
                <div style={{ position: 'absolute', bottom: -20, right: -10, width: 100, height: 100, borderRadius: '50%', background: `${accent}18` }} />
                <div style={{ position: 'absolute', top: 14, right: 14 }}>
                    {live ? <span className="live-dot">LIVE</span>
                        : c.isScheduledNow ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: '0.65em', fontWeight: 700, background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.35)' }}><FiClock size={9} />Đến giờ</span>
                            : null}
                </div>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1em', color: '#fff' }}>{initials}</div>
            </div>

            <div style={{ padding: '16px 20px 18px', cursor: 'pointer' }} onClick={() => navigate(`/${role}/classroom/${c._id}`)}>
                <div style={{ fontWeight: 800, fontSize: '0.97em', marginBottom: 4, lineHeight: 1.3 }}>{c.name}</div>
                <div style={{ fontSize: '0.78em', color: accent, fontWeight: 600, marginBottom: 12 }}>{c.subject}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    {days && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.77em', color: 'var(--text-muted)' }}><FiCalendar size={12} style={{ color: accent, flexShrink: 0 }} />{days}{c.schedule?.startTime && ` • ${c.schedule.startTime}–${c.schedule.endTime}`}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.77em', color: 'var(--text-muted)' }}><FiUsers size={12} style={{ color: accent, flexShrink: 0 }} />{c.students?.length || 0} sinh viên</div>
                </div>
                <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />
                {startError && <div style={{ display: 'flex', gap: 7, marginBottom: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: '0.78em', color: 'var(--danger)' }}><FiAlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />{startError}</div>}

                {endConfirmOpen ? (
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '0.8em', fontWeight: 600, color: 'var(--danger)', marginBottom: 10 }}>⚠️ Kết thúc buổi học?</div>
                        {endErr && <div style={{ fontSize: '0.76em', color: 'var(--danger)', marginBottom: 8 }}>{endErr}</div>}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={handleEnd} disabled={endLoading}>{endLoading ? <><span className="spinner" style={{ width: 12, height: 12 }} />Đang kết thúc...</> : <><FiCheck size={12} />Xác nhận</>}</button>
                            <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setEndConfirmOpen(false); }}><FiX size={12} />Hủy</button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                        {live ? (
                            <>
                                <button className="btn btn-sm" style={{ flex: 1, background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border: 'none', fontWeight: 700 }} onClick={() => navigate(`/meeting/${c._id}`)}><FiPlay size={13} />Vào lớp</button>
                                <button className="btn btn-sm btn-danger btn-icon" title="Kết thúc" onClick={() => setEndConfirmOpen(true)} style={{ padding: '0 14px' }}><FiSquare size={13} /></button>
                            </>
                        ) : (
                            <button className={`btn btn-sm ${c.isScheduledNow ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1, fontWeight: 600 }} onClick={() => onStart(c._id)}><FiPlay size={13} />{c.isScheduledNow ? 'Bắt đầu lớp học' : 'Bắt đầu (ngoài giờ)'}</button>
                        )}
                        <button className="btn btn-outline btn-sm btn-icon" onClick={() => navigate(`/${role}/classroom/${c._id}`)} style={{ padding: '0 12px' }}><FiChevronRight size={14} /></button>
                    </div>
                )}
            </div>
            {live && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,transparent,#10b981,transparent)', filter: 'blur(1px)' }} />}
        </div>
    );
}

/* ─────────────────────────────────────────
   Main Page
───────────────────────────────────────────*/
export default function TeacherClassrooms() {
    const navigate = useNavigate();
    const [classrooms, setClassrooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startErrors, setStartErrors] = useState({});
    const [view, setView] = useState('schedule'); // 'cards' | 'schedule'
    const [filterDay, setFilterDay] = useState(null); // null = all

    useEffect(() => {
        classroomsAPI.getAll().then(r => setClassrooms(r.data)).catch(console.error).finally(() => setLoading(false));
    }, []);

    const startMeeting = async (id) => {
        setStartErrors(prev => ({ ...prev, [id]: '' }));
        try { await classroomsAPI.startMeeting(id); navigate(`/meeting/${id}`); }
        catch (e) { setStartErrors(prev => ({ ...prev, [id]: e.response?.data?.error || 'Không thể bắt đầu' })); }
    };

    const liveCount = classrooms.filter(c => c.meeting?.isLive).length;
    const classIndexMap = Object.fromEntries(classrooms.map((c, i) => [c._id, i]));

    const filteredClassrooms = (filterDay === null ? classrooms : classrooms.filter(c => c.schedule?.dayOfWeek?.includes(filterDay))).filter(c => !c.isExpired);

    return (
        <>
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
                <div>
                    <h1 style={{ fontSize: '1.6em', fontWeight: 900, letterSpacing: '-0.5px', margin: 0 }}>Lớp học của tôi</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875em', marginTop: 5 }}>
                        {classrooms.length} lớp phụ trách
                        {liveCount > 0 && <span style={{ marginLeft: 10, color: 'var(--success)', fontWeight: 700 }}>• {liveCount} đang LIVE</span>}
                    </p>
                </div>

                {/* View toggle */}
                <div style={{ display: 'flex', gap: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
                    <button onClick={() => setView('schedule')} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none',
                        cursor: 'pointer', fontWeight: 600, fontSize: '0.8em', transition: 'all 0.18s',
                        background: view === 'schedule' ? 'var(--accent)' : 'transparent',
                        color: view === 'schedule' ? '#fff' : 'var(--text-muted)',
                    }}><FiCalendar size={13} />Thời khóa biểu</button>
                    <button onClick={() => setView('cards')} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none',
                        cursor: 'pointer', fontWeight: 600, fontSize: '0.8em', transition: 'all 0.18s',
                        background: view === 'cards' ? 'var(--accent)' : 'transparent',
                        color: view === 'cards' ? '#fff' : 'var(--text-muted)',
                    }}><FiGrid size={13} />Thẻ lớp học</button>
                </div>
            </div>

            {/* ── Filter by day (cards view) ── */}
            {view === 'cards' && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
                    <button onClick={() => setFilterDay(null)} style={{ padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.78em', transition: 'all 0.15s', background: filterDay === null ? 'var(--accent)' : 'rgba(255,255,255,0.05)', color: filterDay === null ? '#fff' : 'var(--text-muted)' }}>Tất cả</button>
                    {DAYS_LABEL.map((d, i) => (
                        <button key={i} onClick={() => setFilterDay(filterDay === i ? null : i)} style={{ padding: '6px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.78em', transition: 'all 0.15s', background: filterDay === i ? 'var(--accent)' : 'rgba(255,255,255,0.05)', color: filterDay === i ? '#fff' : 'var(--text-muted)' }}>{d}</button>
                    ))}
                </div>
            )}

            {/* ── Loading ── */}
            {loading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 18 }}>
                    {[1, 2, 3].map(k => (
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

            {/* ── Empty ── */}
            {!loading && classrooms.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border)' }}>
                    <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}><FiBookOpen size={30} color="var(--accent)" /></div>
                    <div style={{ fontWeight: 800, fontSize: '1.05em', marginBottom: 8 }}>Chưa có lớp học nào</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875em' }}>Admin chưa phân công lớp học cho bạn</div>
                </div>
            )}

            {/* ── Schedule View ── */}
            {!loading && classrooms.length > 0 && view === 'schedule' && (
                <WeekSchedule classrooms={classrooms} role="teacher" classIndexMap={classIndexMap} />
            )}

            {/* ── Cards View ── */}
            {!loading && classrooms.length > 0 && view === 'cards' && (
                <>
                    {filteredClassrooms.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.875em' }}>
                            Không có lớp học nào vào {DAYS_LABEL[filterDay]}
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 18 }}>
                        {filteredClassrooms.map((c, i) => (
                            <ClassCard key={c._id} c={c} idx={classIndexMap[c._id] ?? i} role="teacher"
                                onStart={startMeeting} startError={startErrors[c._id]} />
                        ))}
                    </div>
                </>
            )}
        </>
    );
}
