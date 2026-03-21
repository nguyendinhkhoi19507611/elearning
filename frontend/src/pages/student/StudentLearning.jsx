import React, { useState, useEffect } from 'react';
import { aiAPI, coursesAPI } from '../../api/api';
import { FiList, FiActivity, FiBookOpen } from 'react-icons/fi';

export default function StudentLearning() {
    const [recommendations, setRecommendations] = useState(null);
    const [engagement, setEngagement] = useState(null);

    useEffect(() => {
        aiAPI.recommend({ scores: [75, 65, 80, 55, 70], time_spent: [30, 25, 40, 20, 35] })
            .then(r => setRecommendations(r.data)).catch(() => { });
        aiAPI.engagement({ scores: [75, 65, 80, 55, 70], studyMin: 60, loginFreq: 4, timeSpent: [30, 25, 40, 20, 35] })
            .then(r => setEngagement(r.data)).catch(() => { });
    }, []);

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Lộ trình học</h1>
                <p className="page-subtitle">Bài học gợi ý và phân tích mức độ học tập</p>
            </div>

            <div className="grid grid-2">
                {/* Next lessons */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title"><FiList size={15} color="var(--accent)" /> Bài học tiếp theo</div>
                    </div>
                    {recommendations?.next_lessons?.map((l, i) => (
                        <div key={i} style={{
                            padding: '12px', background: 'var(--bg-primary)', borderRadius: 8, marginBottom: 8,
                            borderLeft: `3px solid ${l.difficulty === 'easy' ? 'var(--success)' : l.difficulty === 'medium' ? 'var(--info)' : 'var(--warning)'}`
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <div>
                                    <span style={{ fontWeight: 600, fontSize: '0.88em' }}>{l.lesson_id}</span>
                                    <span style={{ marginLeft: 8, textTransform: 'capitalize', color: 'var(--text-secondary)', fontSize: '0.8em' }}>{l.subject}</span>
                                </div>
                                <span className={`badge badge-${l.difficulty === 'easy' ? 'success' : l.difficulty === 'medium' ? 'info' : 'warning'}`}>{l.difficulty}</span>
                            </div>
                            <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${l.predicted_score}%` }} />
                            </div>
                            <span style={{ fontSize: '0.75em', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                                Dự đoán đạt: {l.predicted_score}%
                            </span>
                        </div>
                    )) || (
                            <div className="empty-state" style={{ padding: '30px 0' }}>
                                <div className="empty-state-icon"><FiBookOpen size={22} /></div>
                                <div className="empty-state-title">Đang tải lộ trình...</div>
                            </div>
                        )}
                </div>

                {/* Engagement */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title"><FiActivity size={15} color="var(--accent)" /> Mức độ Engagement</div>
                    </div>
                    {engagement ? (
                        <>
                            <div style={{ textAlign: 'center', margin: '20px 0' }}>
                                <div style={{
                                    fontSize: '2.4em', fontWeight: 900, letterSpacing: -2,
                                    color: engagement.engagement === 'high' ? 'var(--success)' : engagement.engagement === 'medium' ? 'var(--info)' : 'var(--danger)'
                                }}>{engagement.engagement?.toUpperCase()}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.83em', marginTop: 4 }}>
                                    Confidence: {(engagement.confidence * 100).toFixed(0)}%
                                </div>
                            </div>
                            {Object.entries(engagement.probabilities || {}).map(([k, v]) => (
                                <div key={k} style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83em', marginBottom: 4 }}>
                                        <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{k}</span>
                                        <span style={{ fontWeight: 600 }}>{(v * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="progress-track">
                                        <div className="progress-fill" style={{ width: `${v * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : (
                        <div className="empty-state" style={{ padding: '30px 0' }}>
                            <div className="empty-state-icon"><FiActivity size={22} /></div>
                            <div className="empty-state-title">Đang phân tích...</div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
