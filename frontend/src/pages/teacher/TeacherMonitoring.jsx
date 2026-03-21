import React, { useState, useEffect } from 'react';
import { classroomsAPI } from '../../api/api';
import { FiActivity, FiUsers, FiCamera, FiEye, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import io from 'socket.io-client';

let socket = null;

const stateLabel = { focused: 'Tập trung', distracted: 'Mất TT', drowsy: 'Buồn ngủ', absent: 'Vắng mặt', phone_usage: 'Điện thoại' };
const stateColor = { focused: 'var(--success)', distracted: 'var(--warning)', drowsy: 'var(--danger)', absent: 'var(--text-muted)', phone_usage: 'var(--purple)' };

export default function TeacherMonitoring() {
    const [classrooms, setClassrooms] = useState([]);
    const [studentStatuses, setStudentStatuses] = useState({});
    const [selectedRoom, setSelectedRoom] = useState(null);

    useEffect(() => {
        classroomsAPI.getAll().then(r => {
            const live = r.data.filter(c => c.meeting?.isLive);
            setClassrooms(live);
            if (live.length > 0) setSelectedRoom(live[0]);
        }).catch(console.error);

        socket = io(window.location.origin, { path: '/socket.io', withCredentials: true });
        socket.on('student-status-update', (data) => {
            setStudentStatuses(prev => ({
                ...prev,
                [data.userId]: { state: data.state, confidence: data.confidence, name: data.userName, time: new Date().toLocaleTimeString('vi') }
            }));
        });
        return () => { socket?.disconnect(); };
    }, []);

    const room = selectedRoom;
    const statuses = room ? Object.values(studentStatuses) : [];
    const focusedCount = statuses.filter(s => s.state === 'focused').length;
    const problemCount = statuses.filter(s => ['distracted', 'drowsy', 'phone_usage'].includes(s.state)).length;
    const absentCount = statuses.filter(s => s.state === 'absent').length;

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Giám sát lớp học</h1>
                <p className="page-subtitle">Theo dõi trạng thái sinh viên theo thời gian thực</p>
            </div>

            {classrooms.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"><FiActivity size={24} /></div>
                        <div className="empty-state-title">Chưa có lớp học đang diễn ra</div>
                        <div className="empty-state-sub">Bắt đầu một lớp học để giám sát sinh viên</div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Room selector */}
                    {classrooms.length > 1 && (
                        <div className="tabs" style={{ marginBottom: 16 }}>
                            {classrooms.map(c => (
                                <button key={c._id} className={`tab ${selectedRoom?._id === c._id ? 'active' : ''}`} onClick={() => setSelectedRoom(c)}>
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Stats */}
                    <div className="stats-grid" style={{ marginBottom: 20 }}>
                        <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}><FiUsers size={18} /></div><div className="stat-value" style={{ color: 'var(--info)' }}>{room?.students?.length || 0}</div><div className="stat-label">Tổng sinh viên</div></div>
                        <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}><FiCheckCircle size={18} /></div><div className="stat-value" style={{ color: 'var(--success)' }}>{focusedCount}</div><div className="stat-label">Đang tập trung</div></div>
                        <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}><FiAlertTriangle size={18} /></div><div className="stat-value" style={{ color: 'var(--warning)' }}>{problemCount}</div><div className="stat-label">Cần chú ý</div></div>
                        <div className="stat-card"><div className="stat-icon" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}><FiEye size={18} /></div><div className="stat-value" style={{ color: 'var(--text-muted)' }}>{absentCount}</div><div className="stat-label">Vắng mặt</div></div>
                    </div>

                    {/* Student grid */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title"><FiCamera size={15} color="var(--accent)" /> Trạng thái sinh viên</div>
                        </div>
                        {room?.students?.length > 0 ? (
                            <div className="grid grid-3">
                                {room.students.map(s => {
                                    const status = studentStatuses[s._id];
                                    return (
                                        <div key={s._id} style={{
                                            padding: 14, background: 'var(--bg-primary)', borderRadius: 10,
                                            borderLeft: `3px solid ${status ? stateColor[status.state] : 'var(--border)'}`
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9em', flexShrink: 0 }}>
                                                    {s.name?.[0]}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85em' }}>{s.name}</div>
                                                    <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>{s.email}</div>
                                                </div>
                                            </div>
                                            {status ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span className={`status-dot ${status.state}`} />
                                                    <span style={{ fontSize: '0.8em', color: stateColor[status.state], fontWeight: 600 }}>
                                                        {stateLabel[status.state]}
                                                    </span>
                                                    <span style={{ fontSize: '0.72em', color: 'var(--text-muted)', marginLeft: 'auto' }}>{status.time}</span>
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '0.78em', color: 'var(--text-muted)' }}>Chờ dữ liệu...</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="empty-state" style={{ padding: '30px 0' }}>
                                <div className="empty-state-title">Chưa có sinh viên</div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </>
    );
}
