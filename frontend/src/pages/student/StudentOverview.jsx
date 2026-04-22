import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { classroomsAPI, assignmentsAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import {
    FiVideo, FiCalendar, FiBook, FiClock, FiCheckCircle,
    FiAlertTriangle, FiChevronRight, FiZap, FiTrendingUp,
    FiArrowUpRight, FiAward,
} from 'react-icons/fi';

/* ── Due date label ── */
function DueChip({ dueDate, now }) {
    const diff = Math.ceil((new Date(dueDate) - now) / 86400000);
    const label = diff === 0 ? 'Hôm nay' : diff === 1 ? 'Ngày mai' : `${diff} ngày`;
    const urgent = diff <= 1;
    return (
        <div style={{
            padding: '3px 10px', borderRadius: 99,
            background: urgent ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)',
            border: `1px solid ${urgent ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.25)'}`,
            color: urgent ? 'var(--danger)' : 'var(--warning)',
            fontSize: '0.68em', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
        }}>
            {label}
        </div>
    );
}

export default function StudentOverview() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [classrooms, setClassrooms] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const crRes = await classroomsAPI.getAll().catch(() => ({ data: [] }));
            setClassrooms(crRes.data || []);
            const allA = [];
            for (const cr of (crRes.data || []).slice(0, 5)) {
                try {
                    const r = await assignmentsAPI.getByClassroom(cr._id);
                    (r.data || []).forEach(a => allA.push({ ...a, classroomName: cr.name }));
                } catch (_) {}
            }
            setAssignments(allA);
        } finally { setLoading(false); }
    };

    const now = Date.now();
    const todayDow = new Date().getDay();
    const todayClasses = classrooms.filter(cr => cr.schedule?.dayOfWeek?.includes(todayDow));
    const upcoming = assignments
        .filter(a => { const d = new Date(a.dueDate).getTime(); return d > now && d - now < 7 * 86400000 && !a.mySubmission; })
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 4);
    const overdue = assignments.filter(a => new Date(a.dueDate) < now && !a.mySubmission).length;
    const submitted = assignments.filter(a => a.mySubmission).length;

    const firstName = user?.name?.split(' ').pop();
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
    const dateStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });

    const notSubmitted = assignments.filter(a => !a.mySubmission && new Date(a.dueDate) > now).length;

    const metrics = [
        { label: 'Lớp học', value: classrooms.length, icon: <FiVideo size={18} />, gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)', glow: 'rgba(124,58,237,0.3)', to: '/student/classrooms' },
        { label: 'Hôm nay', value: todayClasses.length, icon: <FiCalendar size={18} />, gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)', glow: 'rgba(6,182,212,0.3)', to: '/student/attendance' },
        { label: 'Đã nộp', value: submitted, icon: <FiCheckCircle size={18} />, gradient: 'linear-gradient(135deg,#10b981,#059669)', glow: 'rgba(16,185,129,0.3)', to: '/student/assignments' },
        { label: 'Chưa nộp', value: notSubmitted, icon: <FiClock size={18} />, gradient: notSubmitted > 0 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#374151,#4b5563)', glow: notSubmitted > 0 ? 'rgba(245,158,11,0.3)' : 'transparent', to: '/student/assignments' },
        { label: 'Quá hạn', value: overdue, icon: <FiAlertTriangle size={18} />, gradient: overdue > 0 ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#374151,#4b5563)', glow: overdue > 0 ? 'rgba(239,68,68,0.3)' : 'transparent', to: '/student/assignments' },
    ];

    return (
        <>
            {/* ── Hero Banner ── */}
            <div style={{
                borderRadius: 20, marginBottom: 28, padding: '26px 30px',
                background: 'var(--gradient-header)',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(124, 58, 237, 0.25)',
            }}>
                <div style={{ position:'absolute', top:-60, right:-40, width:220, height:220, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,255,255,0.15) 0%,transparent 70%)', pointerEvents:'none' }} />
                <div style={{ position:'absolute', bottom:-30, left:120, width:150, height:150, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,255,255,0.1) 0%,transparent 70%)', pointerEvents:'none' }} />

                <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
                    <div>
                        <p style={{ fontSize:'0.77em', fontWeight:600, color:'rgba(255,255,255,0.7)', marginBottom:5, letterSpacing:0.3 }}>
                            {greeting}, {dateStr}
                        </p>
                        <h1 style={{ fontSize:'1.95em', fontWeight:900, letterSpacing:'-0.6px', color:'#fff', margin:0, lineHeight:1.15 }}>
                            {firstName} <span style={{ fontSize:'0.7em', opacity:0.6 }}>👋</span>
                        </h1>
                        <p style={{ color:'rgba(255,255,255,0.75)', marginTop:7, fontSize:'0.875em' }}>
                            {overdue > 0
                                ? `⚠️ Bạn có ${overdue} bài tập quá hạn cần nộp gấp`
                                : upcoming.length > 0
                                    ? `📌 ${upcoming.length} bài tập sắp đến hạn trong 7 ngày tới`
                                    : '✅ Không có bài tập quá hạn — Tiếp tục phát huy!'}
                        </p>
                    </div>
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                        {todayClasses.find(c => c.meeting?.isLive) && (
                            <button className="btn" style={{ background:'rgba(255,255,255,0.2)', color:'#fff', border:'1px solid rgba(255,255,255,0.3)', fontWeight:700, backdropFilter:'blur(8px)' }}
                                onClick={() => navigate(`/student/classroom/${todayClasses.find(c => c.meeting?.isLive)._id}`)}>
                                <FiZap size={13} /> Vào lớp LIVE
                            </button>
                        )}
                        <button className="btn btn-sm" style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.25)', backdropFilter:'blur(8px)' }}
                            onClick={() => navigate('/student/assignments')}>
                            <FiBook size={13} /> Bài tập của tôi
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Metrics ── */}
            <div className="stats-grid" style={{ marginBottom:24 }}>
                {metrics.map((m, i) => (
                    <div key={i} onClick={() => navigate(m.to)} className="stat-card" style={{
                        borderRadius:18, padding:'20px 22px', cursor:'pointer',
                    }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                            <div style={{ width:44, height:44, borderRadius:13, background:m.gradient, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow:`0 4px 12px ${m.glow}` }}>
                                {m.icon}
                            </div>
                            <FiArrowUpRight size={14} style={{ color:'var(--text-muted)', marginTop:2 }} />
                        </div>
                        <div style={{ fontSize:'2.2em', fontWeight:900, letterSpacing:'-1.5px', lineHeight:1, color:'var(--text-primary)', marginBottom:4 }}>
                            {loading ? <span className="skeleton" style={{ display:'inline-block', width:32, height:26, borderRadius:5 }} /> : m.value}
                        </div>
                        <div style={{ fontSize:'0.82em', fontWeight:600, color:'var(--text-muted)' }}>{m.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Content Grid ── */}
            <div className="grid grid-2" style={{ gap:16, marginBottom:16, alignItems:'flex-start' }}>

                {/* Lớp học hôm nay */}
                <div className="card" style={{ borderRadius:18, display:'flex', flexDirection:'column', maxHeight:420 }}>
                    <div className="card-header">
                        <div className="card-title">
                            <FiCalendar size={14} color="var(--accent)" /> Lớp học hôm nay
                            {todayClasses.length > 0 && (
                                <span style={{ marginLeft:6, background:'var(--accent-light)', color:'var(--accent)', fontSize:'0.72em', padding:'2px 8px', borderRadius:99, fontWeight:700 }}>
                                    {todayClasses.length}
                                </span>
                            )}
                        </div>
                        <button className="card-action" onClick={() => navigate('/student/classrooms')}>Tất cả <FiChevronRight size={13} /></button>
                    </div>

                    {loading && [1,2].map(k => (
                        <div key={k} style={{ display:'flex', gap:10, padding:'8px 0' }}>
                            <div className="skeleton" style={{ width:40, height:40, borderRadius:11, flexShrink:0 }} />
                            <div style={{ flex:1 }}><div className="skeleton skeleton-text w-3/4" /><div className="skeleton skeleton-text w-1/2 sm" /></div>
                        </div>
                    ))}

                    {!loading && todayClasses.length === 0 && (
                        <div style={{ padding:'28px 0', textAlign:'center' }}>
                            <FiCheckCircle size={28} style={{ color:'var(--success)', opacity:0.4, marginBottom:10 }} />
                            <div style={{ color:'var(--text-muted)', fontSize:'0.84em' }}>Không có lớp học hôm nay 🎉</div>
                        </div>
                    )}

                    {!loading && todayClasses.map(cr => {
                        const live = cr.meeting?.isLive;
                        return (
                            <div key={cr._id} onClick={() => navigate(`/student/classroom/${cr._id}`)} style={{
                                display:'flex', alignItems:'center', gap:12,
                                padding:'11px 14px', borderRadius:12, marginBottom:8, cursor:'pointer',
                                background: live ? 'var(--success-light)' : 'var(--bg-purple-soft)',
                                border: `1px solid ${live ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
                                transition:'all 0.18s ease',
                            }}
                                onMouseEnter={e => e.currentTarget.style.background = live ? 'rgba(16,185,129,0.15)' : 'var(--bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = live ? 'var(--success-light)' : 'var(--bg-purple-soft)'}
                            >
                                <div style={{ width:40, height:40, borderRadius:11, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: live ? 'rgba(16,185,129,0.15)' : 'var(--accent-light)', color: live ? 'var(--success)' : 'var(--accent)', boxShadow: live ? '0 0 10px rgba(16,185,129,0.2)' : 'none' }}>
                                    <FiVideo size={15} />
                                </div>
                                <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontWeight:600, fontSize:'0.875em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{cr.name}</div>
                                    <div style={{ fontSize:'0.72em', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
                                        <FiClock size={9} /> {cr.schedule?.startTime}–{cr.schedule?.endTime}
                                    </div>
                                </div>
                                {live && <span className="live-dot" style={{ fontSize:'0.65em', flexShrink:0 }}>LIVE</span>}
                            </div>
                        );
                    })}
                </div>

                {/* Bài tập sắp hạn */}
                <div className="card" style={{ borderRadius:18, display:'flex', flexDirection:'column', maxHeight:420 }}>
                    <div className="card-header">
                        <div className="card-title">
                            <FiBook size={14} color="var(--warning)" /> Sắp đến hạn
                            {upcoming.length > 0 && (
                                <span style={{ marginLeft:6, background:'rgba(245,158,11,0.12)', color:'var(--warning)', fontSize:'0.72em', padding:'2px 8px', borderRadius:99, fontWeight:700 }}>
                                    {upcoming.length}
                                </span>
                            )}
                        </div>
                        <button className="card-action" onClick={() => navigate('/student/assignments')}>Xem tất cả <FiChevronRight size={13} /></button>
                    </div>

                    {loading && [1,2,3].map(k => (
                        <div key={k} style={{ display:'flex', gap:10, padding:'8px 0' }}>
                            <div style={{ flex:1 }}><div className="skeleton skeleton-text w-3/4" /><div className="skeleton skeleton-text w-1/2 sm" /></div>
                            <div className="skeleton" style={{ width:55, height:22, borderRadius:99, flexShrink:0 }} />
                        </div>
                    ))}

                    {!loading && upcoming.length === 0 && (
                        <div style={{ padding:'28px 0', textAlign:'center' }}>
                            <FiAward size={28} style={{ color:'var(--success)', opacity:0.4, marginBottom:10 }} />
                            <div style={{ color:'var(--text-muted)', fontSize:'0.84em' }}>Không có bài tập nào sắp hạn ✅</div>
                        </div>
                    )}

                    {!loading && upcoming.map(a => (
                        <div key={a._id} onClick={() => navigate('/student/assignments')} style={{
                            display:'flex', alignItems:'center', gap:12,
                            padding:'11px 14px', borderRadius:12, marginBottom:8, cursor:'pointer',
                            background:'var(--bg-card)',
                            border:'1px solid rgba(245,158,11,0.12)',
                            borderLeft:'3px solid var(--warning)',
                            transition:'all 0.18s ease',
                        }}
                            onMouseEnter={e => e.currentTarget.style.background='var(--warning-light)'}
                            onMouseLeave={e => e.currentTarget.style.background='var(--bg-card)'}
                        >
                            <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontWeight:600, fontSize:'0.875em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.title}</div>
                                <div style={{ fontSize:'0.72em', color:'var(--text-muted)', marginTop:2 }}>{a.classroomName}</div>
                            </div>
                            <DueChip dueDate={a.dueDate} now={now} />
                        </div>
                    ))}
                </div>
            </div>

            {/* ── AI Learning Banner ── */}
            <div onClick={() => navigate('/student/learning')} style={{
                cursor:'pointer', borderRadius:18, overflow:'hidden', position:'relative',
                background:'var(--gradient-purple-deep)',
                padding:'22px 28px',
                display:'flex', alignItems:'center', justifyContent:'space-between', gap:20,
                boxShadow:'0 4px 20px rgba(124,58,237,0.3)',
                transition:'all 0.22s ease',
            }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(124,58,237,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 4px 20px rgba(124,58,237,0.3)'; }}
            >
                <div style={{ position:'absolute', top:-30, right:80, width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,255,255,0.08) 0%,transparent 70%)', pointerEvents:'none' }} />
                <div style={{ position:'relative' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <div style={{ width:32, height:32, borderRadius:9, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <FiZap size={15} color="#fff" />
                        </div>
                        <span style={{ fontSize:'0.72em', fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'rgba(255,255,255,0.65)' }}>
                            Lộ trình học AI cá nhân hóa
                        </span>
                    </div>
                    <div style={{ fontWeight:800, color:'#fff', fontSize:'1.05em', marginBottom:4 }}>Xem lộ trình học cá nhân hóa</div>
                    <div style={{ fontSize:'0.8em', color:'rgba(255,255,255,0.65)' }}>
                        Phân tích điểm yếu · Đề xuất bài học phù hợp · Đánh giá mức độ tiến bộ
                    </div>
                </div>
                <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ display:'flex', gap:4 }}>
                        {[FiTrendingUp, FiBook, FiAward].map((Icon, i) => (
                            <div key={i} style={{ width:34, height:34, borderRadius:9, background:'rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <Icon size={14} color="rgba(255,255,255,0.8)" />
                            </div>
                        ))}
                    </div>
                    <FiChevronRight size={22} color="rgba(255,255,255,0.7)" />
                </div>
            </div>
        </>
    );
}
