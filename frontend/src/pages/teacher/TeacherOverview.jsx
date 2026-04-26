import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { classroomsAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import {
    FiVideo, FiUsers, FiClock, FiPlay, FiCalendar,
    FiZap, FiBook, FiChevronRight, FiArrowUpRight,
    FiStar,
} from 'react-icons/fi';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/* ── Class card dạng premium ── */
function ClassRow({ c, onNavigate, showEnter }) {
    const [hovered, setHovered] = useState(false);
    const live = c.meeting?.isLive;
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={onNavigate}
            style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 14px', borderRadius: 12, marginBottom: 8,
                background: hovered
                    ? (live ? 'rgba(16,185,129,0.08)' : 'var(--bg-hover)')
                    : 'var(--bg-card)',
                border: `1px solid ${live ? 'rgba(16,185,129,0.15)' : 'var(--border)'}`, cursor: 'pointer', transition: 'all 0.18s ease',
            }}
        >
            <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: live ? 'rgba(16,185,129,0.15)' : 'var(--accent-light)',
                color: live ? 'var(--success)' : 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '1em',
                boxShadow: live ? '0 0 12px rgba(16,185,129,0.2)' : 'none',
            }}>
                {live ? <FiZap size={17} /> : c.name?.[0]}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}
                </div>
                <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    {c.schedule?.startTime && <><FiClock size={9} /> {c.schedule.startTime}–{c.schedule.endTime}</>}
                    {c.subject && <span style={{ color: 'var(--text-muted)' }}>· {c.subject}</span>}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8em', fontWeight: 700, color: 'var(--accent)' }}>
                        {c.students?.length || 0}
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85em' }}> SV</span>
                    </div>
                    {live
                        ? <span className="live-dot" style={{ fontSize: '0.65em' }}>LIVE</span>
                        : c.isScheduledNow && <span className="badge badge-warning" style={{ fontSize: '0.62em' }}>Đến giờ</span>}
                </div>
                {showEnter && live && (
                    <button className="btn btn-sm" style={{ padding: '5px 10px', fontSize: '0.7em', background: 'rgba(16,185,129,0.2)', color: 'var(--success)', border: 'none' }}
                        onClick={e => { e.stopPropagation(); onNavigate?.(); }}>
                        <FiPlay size={10} />
                    </button>
                )}
            </div>
        </div>
    );
}

export default function TeacherOverview() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [classrooms, setClassrooms] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        classroomsAPI.getAll()
            .then(r => setClassrooms(r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const liveRooms = classrooms.filter(c => c.meeting?.isLive);
    const totalStudents = classrooms.reduce((sum, c) => sum + (c.students?.length || 0), 0);
    const todayDow = new Date().getDay();
    const todayClasses = classrooms.filter(c =>
        !c.isExpired && c.schedule?.dayOfWeek?.includes(todayDow) && c.schedule?.startTime
    ).sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime));

    const firstName = user?.name?.split(' ').pop();
    const greeting = new Date().getHours() < 12 ? 'Chào buổi sáng' : new Date().getHours() < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

    const metrics = [
        { label: 'Lớp phụ trách', value: classrooms.length, icon: <FiVideo size={19} />, gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)', glow: 'rgba(124,58,237,0.3)', link: '/teacher' },
        { label: 'Đang LIVE', value: liveRooms.length, icon: <FiZap size={19} />, gradient: 'linear-gradient(135deg,#10b981,#059669)', glow: 'rgba(16,185,129,0.3)', link: '/teacher' },
        { label: 'Tổng sinh viên', value: totalStudents, icon: <FiUsers size={19} />, gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)', glow: 'rgba(6,182,212,0.3)' },
        { label: 'Lớp hôm nay', value: todayClasses.length, icon: <FiCalendar size={19} />, gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', glow: 'rgba(245,158,11,0.3)' },
    ];

    return (
        <>
            {/* ── Hero ── */}
            <div style={{
                borderRadius: 20, marginBottom: 28, padding: '28px 32px',
                background: 'var(--gradient-header)',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(124, 58, 237, 0.25)',
            }}>
                <div style={{ position: 'absolute', top: -80, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -30, left: 40, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
                    <div>
                        <p style={{ fontSize: '0.78em', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, marginBottom: 6 }}>
                            {greeting}, 👋
                        </p>
                        <h1 style={{ fontSize: '2em', fontWeight: 900, letterSpacing: '-0.7px', color: '#fff', margin: 0, lineHeight: 1.15 }}>
                            {firstName}
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 7, fontSize: '0.875em' }}>
                            {liveRooms.length > 0
                                ? `🔴 ${liveRooms.length} lớp đang diễn ra — Vào ngay!`
                                : todayClasses.length > 0
                                    ? `📅 Hôm nay bạn có ${todayClasses.length} lớp cần dạy`
                                    : '✅ Hôm nay không có lớp — Tận hưởng ngày nghỉ!'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {liveRooms.length > 0 && (
                            <button className="btn" onClick={() => navigate(`/meeting/${liveRooms[0]._id}`)}
                                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700, backdropFilter: 'blur(8px)' }}>
                                <FiPlay size={14} /> Vào lớp LIVE
                            </button>
                        )}
                        <button className="btn btn-sm" onClick={() => navigate('/teacher/assignments')}
                            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}>
                            <FiBook size={13} /> Bài tập
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Metrics ── */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                {metrics.map((m, i) => (
                    <div key={i} onClick={() => m.link && navigate(m.link)} className="stat-card" style={{
                        borderRadius: 18, padding: '20px 22px',
                        cursor: m.link ? 'pointer' : 'default',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 13, background: m.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: `0 4px 14px ${m.glow}` }}>
                                {m.icon}
                            </div>
                            {m.link && <FiArrowUpRight size={15} style={{ color: 'var(--text-muted)' }} />}
                        </div>
                        <div style={{ fontSize: '2.2em', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: 'var(--text-primary)', marginBottom: 4 }}>
                            {loading ? <span className="skeleton" style={{ display: 'inline-block', width: 36, height: 28, borderRadius: 6 }} /> : m.value}
                        </div>
                        <div style={{ fontSize: '0.82em', fontWeight: 600, color: 'var(--text-muted)' }}>{m.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Body Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

                {/* Lịch hôm nay */}
                <div className="card" style={{ borderRadius: 18 }}>
                    <div className="card-header">
                        <div className="card-title">
                            <FiCalendar size={15} color="var(--accent)" /> Lịch dạy hôm nay
                            <span style={{ marginLeft: 6, fontSize: '0.75em', background: 'var(--accent-light)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 99 }}>
                                {todayClasses.length}
                            </span>
                        </div>
                        <button className="card-action" onClick={() => navigate('/teacher')}>Tất cả <FiChevronRight size={13} /></button>
                    </div>
                    {loading && [1, 2].map(k => (
                        <div key={k} style={{ display: 'flex', gap: 12, padding: '10px 0', marginBottom: 4 }}>
                            <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <div className="skeleton skeleton-text w-3/4" />
                                <div className="skeleton skeleton-text w-1/2 sm" />
                            </div>
                        </div>
                    ))}
                    {!loading && todayClasses.length === 0 && (
                        <div style={{ padding: '32px 0', textAlign: 'center' }}>
                            <FiStar size={28} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: 10 }} />
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.84em' }}>Không có lớp nào hôm nay</div>
                        </div>
                    )}
                    {!loading && todayClasses.map(c => (
                        <ClassRow key={c._id} c={c} onNavigate={() => navigate(`/teacher/classroom/${c._id}`)} />
                    ))}
                </div>

                {/* Lớp LIVE */}
                <div className="card" style={{ borderRadius: 18 }}>
                    <div className="card-header">
                        <div className="card-title">
                            {liveRooms.length > 0 && <span className="live-dot" style={{ marginRight: 4 }} />}
                            Lớp đang LIVE
                        </div>
                    </div>
                    {!loading && liveRooms.length === 0 && (
                        <div style={{ padding: '32px 0', textAlign: 'center' }}>
                            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--bg-purple-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                <FiZap size={22} style={{ color: 'var(--text-muted)' }} />
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.84em' }}>Chưa có buổi học nào đang diễn ra</div>
                        </div>
                    )}
                    {liveRooms.map(c => (
                        <ClassRow key={c._id} c={c} onNavigate={() => navigate(`/meeting/${c._id}`)} showEnter />
                    ))}
                </div>
            </div>

            {/* ── All classes ── */}
            <div className="card" style={{ borderRadius: 18 }}>
                <div className="card-header">
                    <div className="card-title"><FiBook size={15} color="var(--accent)" /> Tất cả lớp học</div>
                    <button className="card-action" onClick={() => navigate('/teacher')}>Quản lý <FiChevronRight size={13} /></button>
                </div>
                {loading && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[1, 2, 3, 4].map(k => <div key={k} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}
                    </div>
                )}
                {!loading && classrooms.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-state-icon"><FiVideo size={24} /></div>
                        <div className="empty-state-title">Chưa được phân công lớp nào</div>
                        <div className="empty-state-sub">Liên hệ quản trị viên để được phân công lớp học</div>
                    </div>
                )}
                {!loading && classrooms.filter(c => !c.isExpired).length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                        {classrooms.filter(c => !c.isExpired).map(c => (
                            <div key={c._id} onClick={() => navigate(`/teacher/classroom/${c._id}`)} style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                                borderRadius: 12, border: '1px solid var(--border)',
                                cursor: 'pointer', transition: 'all 0.18s ease', background: 'var(--bg-primary)',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-primary)'; }}
                            >
                                <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(167,139,250,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9em', color: 'var(--accent)', flexShrink: 0 }}>
                                    {c.name?.[0]}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.855em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                                    <div style={{ fontSize: '0.71em', color: 'var(--text-muted)', marginTop: 2 }}>
                                        {c.subject}
                                        {c.schedule?.dayOfWeek && ` · ${c.schedule.dayOfWeek.map(d => DAYS[d]).join(', ')}`}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: '0.78em', fontWeight: 700, color: 'var(--accent)' }}>{c.students?.length || 0} SV</div>
                                    {c.meeting?.isLive
                                        ? <span className="live-dot" style={{ fontSize: '0.62em' }}>LIVE</span>
                                        : <span style={{ fontSize: '0.68em', color: 'var(--text-muted)' }}>Chờ</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
