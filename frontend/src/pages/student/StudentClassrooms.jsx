import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { classroomsAPI } from '../../api/api';
import { FiVideo, FiClock, FiPlay } from 'react-icons/fi';

export default function StudentClassrooms() {
    const navigate = useNavigate();
    const [classrooms, setClassrooms] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        classroomsAPI.getAll()
            .then(res => setClassrooms(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Lớp học của bạn</h1>
                <p className="page-subtitle">Các lớp học đang tham gia</p>
            </div>

            {loading && <div className="card"><div className="empty-state"><div className="spinner" /><div className="empty-state-title">Đang tải...</div></div></div>}

            {!loading && classrooms.length === 0 && (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"><FiVideo size={24} /></div>
                        <div className="empty-state-title">Chưa có lớp học</div>
                        <div className="empty-state-sub">Bạn chưa được thêm vào lớp học nào</div>
                    </div>
                </div>
            )}

            {!loading && classrooms.length > 0 && (
                <div className="grid grid-2">
                    {classrooms.map(c => (
                        <div className="card" key={c._id} style={{
                            borderLeft: `4px solid ${c.meeting?.isLive ? 'var(--success)' : 'var(--accent)'}`,
                            position: 'relative'
                        }}>
                            {c.meeting?.isLive && (
                                <div style={{ position: 'absolute', top: 14, right: 14 }}>
                                    <span className="live-dot">LIVE</span>
                                </div>
                            )}
                            <div style={{ fontWeight: 700, fontSize: '1.05em', marginBottom: 6, paddingRight: c.meeting?.isLive ? 60 : 0 }}>
                                {c.name}
                            </div>
                            <div style={{ fontSize: '0.82em', color: 'var(--text-muted)', marginBottom: 10 }}>
                                Môn: <strong>{c.subject}</strong> &bull; GV: {c.teacher?.name}
                            </div>
                            {c.schedule?.startTime && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: '0.8em', color: 'var(--text-secondary)' }}>
                                    <FiClock size={13} />
                                    {c.schedule?.dayOfWeek?.map(d => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d]).join(', ')}
                                    {' '}&bull;{' '}{c.schedule?.startTime} - {c.schedule?.endTime}
                                </div>
                            )}
                            {c.meeting?.isLive ? (
                                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/meeting/${c._id}`)}>
                                    <FiPlay size={13} /> Tham gia lớp học
                                </button>
                            ) : (
                                <span style={{ fontSize: '0.8em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <FiClock size={13} /> Chưa bắt đầu
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
