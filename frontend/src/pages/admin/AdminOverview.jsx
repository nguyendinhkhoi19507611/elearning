import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI, classroomsAPI, aiAPI } from '../../api/api';
import { FiUsers, FiVideo, FiBook, FiZap, FiShield, FiMic, FiActivity, FiChevronRight } from 'react-icons/fi';

export default function AdminOverview() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [classrooms, setClassrooms] = useState([]);
    const [aiHealth, setAiHealth] = useState(null);

    useEffect(() => {
        Promise.all([
            usersAPI.getStats().then(r => setStats(r.data)).catch(() => { }),
            classroomsAPI.getAll().then(r => setClassrooms(r.data)).catch(() => { }),
            aiAPI.health().then(r => setAiHealth(r.data)).catch(() => { }),
        ]);
    }, []);

    const liveRooms = classrooms.filter(c => c.meeting?.isLive);
    const aiOnline = aiHealth ? Object.values(aiHealth).filter(s => s?.status === 'ok').length : 0;
    const aiTotal = 3;

    const cards = [
        { label: 'Tổng users', value: stats?.totalUsers || 0, icon: <FiUsers size={18} />, color: 'var(--accent)', bg: 'var(--accent-light)', link: '/admin/users' },
        { label: 'Lớp học', value: classrooms.length, icon: <FiVideo size={18} />, color: 'var(--info)', bg: 'var(--info-light)', link: '/admin/classrooms' },
        { label: 'Đang LIVE', value: liveRooms.length, icon: <FiZap size={18} />, color: 'var(--success)', bg: 'var(--success-light)', link: '/admin/classrooms' },
        { label: 'AI Services', value: `${aiOnline}/${aiTotal}`, icon: <FiActivity size={18} />, color: aiOnline === aiTotal ? 'var(--success)' : 'var(--warning)', bg: aiOnline === aiTotal ? 'var(--success-light)' : 'var(--warning-light)', link: '/admin/ai' },
    ];

    return (
        <>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">Admin Dashboard</h1>
                        <p className="page-subtitle">Quản lý hệ thống E-Learning AI</p>
                    </div>
                    <span className="badge badge-purple"><FiShield size={10} /> Quản trị viên</span>
                </div>
            </div>

            <div className="stats-grid" style={{ marginBottom: 24 }}>
                {cards.map((c, i) => (
                    <div className="stat-card" key={i} style={{ cursor: c.link ? 'pointer' : 'default' }} onClick={() => c.link && navigate(c.link)}>
                        <div className="stat-icon" style={{ background: c.bg, color: c.color }}>{c.icon}</div>
                        <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
                        <div className="stat-label">{c.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-2">
                {/* Live classrooms */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">{liveRooms.length > 0 && <span className="live-dot" style={{ marginRight: 6 }} />}Lớp đang học</div>
                        <button className="card-action" onClick={() => navigate('/admin/classrooms')}>Xem tất cả <FiChevronRight size={13} /></button>
                    </div>
                    {liveRooms.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875em', padding: '12px 0', textAlign: 'center' }}>Không có lớp đang diễn ra</div>
                    ) : liveRooms.map(c => (
                        <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                            <span className="live-dot" style={{ flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.875em' }}>{c.name}</div>
                                <div style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>{c.teacher?.name}</div>
                            </div>
                            <span className="badge badge-success">{c.students?.length || 0} SV</span>
                        </div>
                    ))}
                </div>

                {/* Voice stats */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title"><FiMic size={15} color="var(--accent)" /> Voice Authentication</div>
                        <button className="card-action" onClick={() => navigate('/admin/users')}>Chi tiết <FiChevronRight size={13} /></button>
                    </div>
                    {stats && (
                        <>
                            <div style={{ fontSize: '2.4em', fontWeight: 800, letterSpacing: -2, color: 'var(--accent)', marginBottom: 4 }}>
                                {stats.voiceRegistered || 0}
                                <span style={{ fontSize: '0.4em', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>/ {stats.totalUsers || 0}</span>
                            </div>
                            <div className="stat-label" style={{ marginBottom: 12 }}>Users đã đăng ký giọng nói</div>
                            <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${stats.totalUsers ? (stats.voiceRegistered / stats.totalUsers * 100) : 0}%` }} />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
