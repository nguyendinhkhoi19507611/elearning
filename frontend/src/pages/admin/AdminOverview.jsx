import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI, classroomsAPI, aiAPI } from '../../api/api';
import {
    FiUsers, FiVideo, FiZap, FiActivity, FiShield,
    FiMic, FiCamera, FiChevronRight, FiPlay,
    FiTrendingUp, FiServer, FiCheckCircle, FiAlertCircle, FiClock,
    FiArrowUpRight,
} from 'react-icons/fi';

/* ── Animated counter ── */
function Counter({ value }) {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        if (!value) return;
        const steps = 24;
        let step = 0;
        const interval = setInterval(() => {
            step++;
            setDisplay(Math.round((value / steps) * step));
            if (step >= steps) clearInterval(interval);
        }, 28);
        return () => clearInterval(interval);
    }, [value]);
    return <>{display}</>;
}

/* ── Biểu đồ thanh mini ── */
function MiniBar({ pct, color }) {
    const [w, setW] = useState(0);
    useEffect(() => { setTimeout(() => setW(pct), 120); }, [pct]);
    return (
        <div style={{ height: 6, borderRadius: 99, background: 'var(--border)', overflow: 'hidden', marginTop: 10 }}>
            <div style={{
                height: '100%', borderRadius: 99,
                width: `${w}%`,
                background: color,
                transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: `0 0 8px ${color}88`,
            }} />
        </div>
    );
}

/* ── AI Service badge ── */
function AIBadge({ label, ok }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 10,
            background: ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
            <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: ok ? 'var(--success)' : 'var(--danger)',
                boxShadow: `0 0 6px ${ok ? 'var(--success)' : 'var(--danger)'}`,
                animation: ok ? 'pulseDot 2s infinite' : 'none',
            }} />
            <span style={{ fontSize: '0.78em', fontWeight: 600, color: ok ? 'var(--success)' : 'var(--danger)' }}>
                {label}
            </span>
            <span style={{ fontSize: '0.7em', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {ok ? 'Hoạt động' : 'Ngưng'}
            </span>
        </div>
    );
}

export default function AdminOverview() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [classrooms, setClassrooms] = useState([]);
    const [aiHealth, setAiHealth] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            usersAPI.getStats().then(r => setStats(r.data)).catch(() => {}),
            classroomsAPI.getAll().then(r => setClassrooms(r.data)).catch(() => {}),
            aiAPI.health().then(r => setAiHealth(r.data)).catch(() => {}),
        ]).finally(() => setLoading(false));
    }, []);

    const liveRooms = classrooms.filter(c => c.meeting?.isLive);
    const aiServices = [
        { label: 'Voice API', ok: aiHealth?.voice?.status === 'ok' },
        { label: 'Vision API', ok: aiHealth?.vision?.status === 'ok' },
        { label: 'Recommend API', ok: aiHealth?.recommendation?.status === 'ok' },
    ];
    const aiOnline = aiServices.filter(s => s.ok).length;
    const voicePct = stats?.totalUsers ? Math.round(stats.voiceRegistered / stats.totalUsers * 100) : 0;
    const facePct  = stats?.totalUsers ? Math.round(stats.faceRegistered  / stats.totalUsers * 100) : 0;

    const metricCards = [
        {
            label: 'Tổng người dùng', value: stats?.totalUsers || 0,
            sub: `${stats?.students || 0} SV · ${stats?.teachers || 0} GV`,
            icon: <FiUsers size={20} />, gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
            glow: 'rgba(124,58,237,0.3)', link: '/admin/users',
        },
        {
            label: 'Lớp học', value: classrooms.length,
            sub: `${liveRooms.length} đang diễn ra`,
            icon: <FiVideo size={20} />, gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)',
            glow: 'rgba(6,182,212,0.35)', link: '/admin/classrooms',
        },
        {
            label: 'Buổi đang LIVE', value: liveRooms.length,
            sub: liveRooms.length > 0 ? 'Đang phát trực tiếp' : 'Không có buổi nào',
            icon: <FiZap size={20} />, gradient: 'linear-gradient(135deg,#10b981,#059669)',
            glow: 'rgba(16,185,129,0.35)', link: '/admin/classrooms',
        },
        {
            label: 'AI Services', value: `${aiOnline}/3`,
            sub: aiOnline === 3 ? 'Tất cả online' : `${3 - aiOnline} service offline`,
            icon: <FiServer size={20} />, gradient: aiOnline === 3 ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#f59e0b,#d97706)',
            glow: aiOnline === 3 ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)', link: '/admin/ai',
        },
    ];

    return (
        <>
            {/* ── Hero Banner ── */}
            <div style={{
                borderRadius: 20,
                padding: '28px 32px',
                marginBottom: 28,
                background: 'var(--gradient-header)',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(124, 58, 237, 0.25)',
            }}>
                {/* Decorative orbs */}
                <div style={{ position:'absolute', top:-60, right:-40, width:220, height:220, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,255,255,0.15) 0%,transparent 70%)', pointerEvents:'none' }} />
                <div style={{ position:'absolute', bottom:-40, right:180, width:140, height:140, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,255,255,0.1) 0%,transparent 70%)', pointerEvents:'none' }} />

                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:20, flexWrap:'wrap', position:'relative' }}>
                    <div>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                            <div style={{
                                width:40, height:40, borderRadius:12,
                                background:'rgba(255,255,255,0.2)', backdropFilter:'blur(8px)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                border:'1px solid rgba(255,255,255,0.25)',
                            }}>
                                <FiShield size={20} color="#fff" />
                            </div>
                            <span style={{ fontSize:'0.72em', fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(255,255,255,0.8)' }}>
                                Admin Dashboard
                            </span>
                        </div>
                        <h1 style={{ fontSize:'1.9em', fontWeight:900, letterSpacing:'-0.6px', color:'#fff', margin:0, lineHeight:1.15 }}>
                            Hệ thống EduAI Platform
                        </h1>
                        <p style={{ color:'rgba(255,255,255,0.7)', marginTop:6, fontSize:'0.9em' }}>
                            Quản lý toàn diện · AI-powered · Real-time monitoring
                        </p>
                    </div>
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                        <button className="btn btn-sm" onClick={() => navigate('/admin/users')}
                            style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.25)', backdropFilter:'blur(8px)' }}>
                            <FiUsers size={13} /> Quản lý Users
                        </button>
                        <button className="btn btn-sm" onClick={() => navigate('/admin/ai')}
                            style={{ background:'rgba(255,255,255,0.2)', color:'#fff', border:'1px solid rgba(255,255,255,0.3)' }}>
                            <FiActivity size={13} /> AI Services
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Metric Cards ── */}
            <div className="stats-grid" style={{ marginBottom:24 }}>
                {metricCards.map((c, i) => (
                    <div key={i} onClick={() => navigate(c.link)} className="stat-card" style={{
                        borderRadius:18, padding:'20px 22px',
                        cursor:'pointer',
                    }}>
                        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
                            <div style={{ width:46, height:46, borderRadius:13, background:c.gradient, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow:`0 4px 14px ${c.glow}` }}>
                                {c.icon}
                            </div>
                            <FiArrowUpRight size={16} style={{ color:'var(--text-muted)', marginTop:2 }} />
                        </div>

                        <div style={{ fontSize:'2.2em', fontWeight:900, letterSpacing:'-1.5px', lineHeight:1, color:'var(--text-primary)', marginBottom:4 }}>
                            {loading ? <span className="skeleton" style={{ display:'inline-block', width:40, height:32, borderRadius:6 }} /> : <Counter value={typeof c.value === 'string' ? parseFloat(c.value) : c.value} />}
                            {typeof c.value === 'string' && c.value.includes('/') && !loading &&
                                <span style={{ fontSize:'0.45em', color:'var(--text-muted)', fontWeight:500 }}>/{c.value.split('/')[1]}</span>}
                        </div>
                        <div style={{ fontWeight:700, fontSize:'0.88em', color:'var(--text-secondary)', marginBottom:3 }}>{c.label}</div>
                        <div style={{ fontSize:'0.72em', color:'var(--text-muted)' }}>{c.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Content Grid ── */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

                {/* Live Classrooms */}
                <div className="card" style={{ borderRadius:18 }}>
                    <div className="card-header">
                        <div className="card-title">
                            <span className="live-dot" />
                            Lớp đang diễn ra
                            {liveRooms.length > 0 && (
                                <span style={{ marginLeft:6, fontSize:'0.75em', background:'rgba(16,185,129,0.12)', color:'var(--success)', padding:'2px 8px', borderRadius:99, fontWeight:700 }}>
                                    {liveRooms.length}
                                </span>
                            )}
                        </div>
                        <button className="card-action" onClick={() => navigate('/admin/classrooms')}>
                            Tất cả <FiChevronRight size={13} />
                        </button>
                    </div>

                    {liveRooms.length === 0 ? (
                        <div style={{ padding:'28px 0', textAlign:'center' }}>
                            <div style={{ width:52, height:52, borderRadius:14, background:'var(--bg-purple-soft)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                                <FiVideo size={22} style={{ color:'var(--text-muted)' }} />
                            </div>
                            <div style={{ color:'var(--text-muted)', fontSize:'0.84em' }}>Không có buổi học nào đang diễn ra</div>
                        </div>
                    ) : liveRooms.map(c => (
                        <div key={c._id} style={{
                            display:'flex', alignItems:'center', gap:12,
                            padding:'12px 14px', borderRadius:12, marginBottom:8,
                            background:'rgba(16,185,129,0.06)',
                            border:'1px solid rgba(16,185,129,0.15)',
                            cursor:'pointer', transition:'all 0.18s ease',
                        }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(16,185,129,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background='rgba(16,185,129,0.06)'}
                        >
                            <div style={{ width:36, height:36, borderRadius:10, background:'rgba(16,185,129,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <FiZap size={15} color="var(--success)" />
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontWeight:600, fontSize:'0.875em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</div>
                                <div style={{ fontSize:'0.72em', color:'var(--text-muted)' }}>{c.teacher?.name || 'Giáo viên'}</div>
                            </div>
                            <div style={{ textAlign:'right', flexShrink:0 }}>
                                <div style={{ fontSize:'0.7em', fontWeight:700, color:'var(--success)' }}>{c.students?.length || 0} SV</div>
                                <button className="btn btn-sm" style={{ marginTop:4, padding:'3px 8px', fontSize:'0.65em', background:'rgba(16,185,129,0.2)', color:'var(--success)', border:'none' }}
                                    onClick={() => navigate(`/meeting/${c._id}`)}>
                                    <FiPlay size={9} /> Xem
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* AI Services */}
                <div className="card" style={{ borderRadius:18 }}>
                    <div className="card-header">
                        <div className="card-title"><FiServer size={15} color="var(--accent)" /> AI Infrastructure</div>
                        <button className="card-action" onClick={() => navigate('/admin/ai')}>
                            Quản lý <FiChevronRight size={13} />
                        </button>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {aiServices.map((s, i) => <AIBadge key={i} label={s.label} ok={s.ok} />)}
                    </div>
                    <div style={{ marginTop:16, padding:'12px 14px', borderRadius:12, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)' }}>
                        <div style={{ fontSize:'0.75em', color:'var(--text-muted)', marginBottom:4, fontWeight:600 }}>Tổng thể</div>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                            <span style={{ fontSize:'0.82em', color: aiOnline === 3 ? 'var(--success)' : 'var(--warning)', fontWeight:700 }}>
                                {aiOnline}/3 Services online
                            </span>
                            {aiOnline === 3
                                ? <FiCheckCircle size={16} color="var(--success)" />
                                : <FiAlertCircle size={16} color="var(--warning)" />}
                        </div>
                        <MiniBar pct={aiOnline / 3 * 100} color={aiOnline === 3 ? 'var(--success)' : 'var(--warning)'} />
                    </div>
                </div>
            </div>

            {/* ── Biometric Registration ── */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {/* Voice */}
                <div className="card" style={{ borderRadius:18 }}>
                    <div className="card-header">
                        <div className="card-title"><FiMic size={15} color="var(--accent)" /> Voice Authentication</div>
                        <button className="card-action" onClick={() => navigate('/admin/users')}>Chi tiết <FiChevronRight size={13} /></button>
                    </div>
                    {loading ? <div style={{ height:80 }} className="skeleton" /> : (
                        <>
                            <div style={{ display:'flex', alignItems:'flex-end', gap:6, marginBottom:6 }}>
                                <span style={{ fontSize:'3em', fontWeight:900, letterSpacing:'-2px', lineHeight:1, color:'var(--accent)' }}>{voicePct}</span>
                                <span style={{ fontSize:'1.2em', fontWeight:700, color:'var(--text-muted)', marginBottom:4 }}>%</span>
                            </div>
                            <div style={{ fontSize:'0.79em', color:'var(--text-muted)', marginBottom:2 }}>
                                <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>{stats?.voiceRegistered || 0}</span> / {stats?.totalUsers || 0} users đã đăng ký
                            </div>
                            <MiniBar pct={voicePct} color="var(--accent)" />
                        </>
                    )}
                </div>

                {/* Face */}
                <div className="card" style={{ borderRadius:18 }}>
                    <div className="card-header">
                        <div className="card-title"><FiCamera size={15} color="var(--success)" /> Face Recognition</div>
                        <button className="card-action" onClick={() => navigate('/admin/users')}>Chi tiết <FiChevronRight size={13} /></button>
                    </div>
                    {loading ? <div style={{ height:80 }} className="skeleton" /> : (
                        <>
                            <div style={{ display:'flex', alignItems:'flex-end', gap:6, marginBottom:6 }}>
                                <span style={{ fontSize:'3em', fontWeight:900, letterSpacing:'-2px', lineHeight:1, color:'var(--success)' }}>{facePct}</span>
                                <span style={{ fontSize:'1.2em', fontWeight:700, color:'var(--text-muted)', marginBottom:4 }}>%</span>
                            </div>
                            <div style={{ fontSize:'0.79em', color:'var(--text-muted)', marginBottom:2 }}>
                                <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>{stats?.faceRegistered || 0}</span> / {stats?.totalUsers || 0} users đã đăng ký
                            </div>
                            <MiniBar pct={facePct} color="var(--success)" />
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
