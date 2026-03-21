import React, { useState, useEffect } from 'react';
import { aiAPI, coursesAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import {
    FiBarChart2, FiZap, FiCheckCircle, FiBook,
    FiAlertTriangle, FiTrendingUp, FiUser
} from 'react-icons/fi';

export default function StudentOverview() {
    const { user } = useAuth();
    const [recommendations, setRecommendations] = useState(null);
    const [engagement, setEngagement] = useState(null);
    const [courses, setCourses] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [recRes, coursesRes] = await Promise.all([
                aiAPI.recommend({ scores: [75, 65, 80, 55, 70], time_spent: [30, 25, 40, 20, 35] }).catch(() => null),
                coursesAPI.getAll().catch(() => ({ data: { courses: [] } }))
            ]);
            if (recRes) setRecommendations(recRes.data);
            setCourses(coursesRes.data.courses || []);
            const engRes = await aiAPI.engagement({
                scores: [75, 65, 80, 55, 70], studyMin: 60, loginFreq: 4, timeSpent: [30, 25, 40, 20, 35]
            }).catch(() => null);
            if (engRes) setEngagement(engRes.data);
        } catch (e) { console.error(e); }
    };

    const statCards = [
        {
            label: 'Điểm TB', value: recommendations?.stats?.avg_score || '—',
            icon: <FiBarChart2 size={18} />, color: 'var(--info)', bg: 'var(--info-light)'
        },
        {
            label: 'Engagement', value: engagement?.engagement?.toUpperCase() || '—',
            icon: <FiZap size={18} />, color: 'var(--success)', bg: 'var(--success-light)'
        },
        {
            label: 'Hoàn thành',
            value: recommendations?.stats?.completion_rate
                ? `${(recommendations.stats.completion_rate * 100).toFixed(0)}%` : '—',
            icon: <FiCheckCircle size={18} />, color: 'var(--accent)', bg: 'var(--accent-light)'
        },
        {
            label: 'Khóa học', value: courses.length,
            icon: <FiBook size={18} />, color: 'var(--warning)', bg: 'var(--warning-light)'
        },
    ];

    return (
        <>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">Xin chào, {user?.name?.split(' ').pop()}!</h1>
                        <p className="page-subtitle">Hôm nay bạn đã học được gì?</p>
                    </div>
                    <span className="badge badge-info"><FiUser size={10} /> Sinh viên</span>
                </div>
            </div>

            {/* Stat cards */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                {statCards.map((s, i) => (
                    <div className="stat-card" key={i}>
                        <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                        <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Warnings */}
            {recommendations?.warnings?.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-header">
                        <div className="card-title"><FiAlertTriangle size={15} color="var(--warning)" /> Cảnh báo học tập</div>
                    </div>
                    {recommendations.warnings.map((w, i) => (
                        <div key={i} style={{
                            padding: '10px 12px', marginBottom: 6, borderRadius: 8,
                            background: w.type === 'critical' ? 'var(--danger-light)' : 'var(--warning-light)',
                            borderLeft: `3px solid ${w.type === 'critical' ? 'var(--danger)' : 'var(--warning)'}`,
                            fontSize: '0.84em'
                        }}>{w.message}</div>
                    ))}
                </div>
            )}

            {/* Weak subjects */}
            {recommendations?.weak_subjects?.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title"><FiTrendingUp size={15} color="var(--warning)" /> Môn cần cải thiện</div>
                    </div>
                    <div className="grid grid-3">
                        {recommendations.weak_subjects.map((w, i) => (
                            <div key={i} style={{
                                padding: '12px', background: 'var(--bg-primary)',
                                borderRadius: 8, borderLeft: '3px solid var(--warning)'
                            }}>
                                <div style={{ fontWeight: 700, textTransform: 'capitalize', marginBottom: 4 }}>{w.subject}</div>
                                <div style={{ color: 'var(--warning)', fontSize: '0.83em' }}>
                                    Điểm TB: {w.avg_score} — {w.suggestion}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!recommendations && !engagement && (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"><FiBarChart2 size={24} /></div>
                        <div className="empty-state-title">Đang tải dữ liệu...</div>
                        <div className="empty-state-sub">AI đang phân tích hồ sơ học tập của bạn</div>
                    </div>
                </div>
            )}
        </>
    );
}
