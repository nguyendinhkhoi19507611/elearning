import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { classroomsAPI } from '../../api/api';
import { FiVideo, FiClock, FiPlay, FiSquare, FiUsers, FiAlertCircle, FiCalendar, FiX, FiCheck } from 'react-icons/fi';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export default function TeacherClassrooms() {
    const navigate = useNavigate();
    const [classrooms, setClassrooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startError, setStartError] = useState({});
    // endConfirm: id of classroom pending end confirmation (inline)
    const [endConfirm, setEndConfirm] = useState(null);
    const [endLoading, setEndLoading] = useState(false);
    const [endError, setEndError] = useState('');

    useEffect(() => {
        classroomsAPI.getAll().then(r => setClassrooms(r.data)).catch(console.error).finally(() => setLoading(false));
    }, []);

    const startMeeting = async (id) => {
        setStartError(prev => ({ ...prev, [id]: '' }));
        try {
            await classroomsAPI.startMeeting(id);
            navigate(`/meeting/${id}`);
        } catch (e) {
            const msg = e.response?.data?.error || 'Không thể bắt đầu lớp học';
            setStartError(prev => ({ ...prev, [id]: msg }));
        }
    };

    const endMeeting = async (id) => {
        setEndLoading(true);
        setEndError('');
        try {
            await classroomsAPI.endMeeting(id);
            setClassrooms(c => c.map(room => room._id === id
                ? { ...room, meeting: { ...room.meeting, isLive: false } }
                : room
            ));
            setEndConfirm(null);
        } catch (e) {
            setEndError(e.response?.data?.error || 'Không thể kết thúc lớp học');
        }
        setEndLoading(false);
    };

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Lớp học của tôi</h1>
                <p className="page-subtitle">Quản lý và bắt đầu buổi dạy trực tuyến</p>
            </div>

            {loading && <div className="card"><div className="empty-state"><div className="spinner" /><div className="empty-state-title">Đang tải...</div></div></div>}

            {!loading && classrooms.length === 0 && (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"><FiVideo size={24} /></div>
                        <div className="empty-state-title">Chưa có lớp học nào</div>
                        <div className="empty-state-sub">Admin chưa phân công lớp học cho bạn</div>
                    </div>
                </div>
            )}

            {!loading && (
                <div className="grid grid-2">
                    {classrooms.map(c => (
                        <div className="card" key={c._id} style={{
                            borderLeft: `4px solid ${c.meeting?.isLive ? 'var(--success)' : c.isScheduledNow ? 'var(--warning)' : 'var(--accent)'}`,
                            position: 'relative'
                        }}>
                            {/* Status badge */}
                            <div style={{ position: 'absolute', top: 14, right: 14 }}>
                                {c.meeting?.isLive
                                    ? <span className="live-dot">LIVE</span>
                                    : c.isScheduledNow
                                        ? <span className="badge badge-warning" style={{ fontSize: '0.68em' }}><FiClock size={9} /> Đến giờ học</span>
                                        : <span className="badge badge-neutral" style={{ fontSize: '0.68em' }}><FiCalendar size={9} /> Chưa đến giờ</span>
                                }
                            </div>

                            <div style={{ fontWeight: 700, fontSize: '1.05em', marginBottom: 6, paddingRight: 90 }}>
                                {c.name}
                            </div>
                            <div style={{ fontSize: '0.83em', color: 'var(--text-muted)', marginBottom: 12 }}>
                                Môn: <strong>{c.subject}</strong>
                                {c.description && ` • ${c.description}`}
                            </div>

                            {c.schedule?.startTime && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: '0.8em', color: 'var(--text-secondary)' }}>
                                    <FiClock size={13} />
                                    {c.schedule?.dayOfWeek?.map(d => DAYS[d]).join(', ')} &bull; {c.schedule.startTime} - {c.schedule.endTime}
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: '0.82em', color: 'var(--text-secondary)' }}>
                                <FiUsers size={13} /> {c.students?.length || 0} sinh viên
                            </div>

                            {/* Error khi bắt đầu sai lịch */}
                            {startError[c._id] && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, background: 'var(--danger-light)', border: '1px solid rgba(255,77,106,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: '0.8em', color: 'var(--danger)' }}>
                                    <FiAlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                                    {startError[c._id]}
                                </div>
                            )}

                            {/* Inline End Confirmation */}
                            {endConfirm === c._id ? (
                                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginTop: 4 }}>
                                    <div style={{ fontSize: '0.82em', color: 'var(--danger)', fontWeight: 600, marginBottom: 8 }}>
                                        Kết thúc buổi học? Sinh viên sẽ bị ngắt kết nối.
                                    </div>
                                    {endError && (
                                        <div style={{ fontSize: '0.78em', color: 'var(--danger)', marginBottom: 8 }}>
                                            <FiAlertCircle size={11} /> {endError}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => endMeeting(c._id)}
                                            disabled={endLoading}
                                            style={{ flex: 1 }}
                                        >
                                            {endLoading
                                                ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Đang kết thúc...</>
                                                : <><FiCheck size={13} /> Xác nhận kết thúc</>
                                            }
                                        </button>
                                        <button
                                            className="btn btn-outline btn-sm"
                                            onClick={() => { setEndConfirm(null); setEndError(''); }}
                                            disabled={endLoading}
                                        >
                                            <FiX size={13} /> Hủy
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {c.meeting?.isLive ? (
                                        <>
                                            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/meeting/${c._id}`)}>
                                                <FiPlay size={13} /> Vào lớp
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={() => { setEndConfirm(c._id); setEndError(''); }}>
                                                <FiSquare size={13} /> Kết thúc
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className={`btn btn-sm ${c.isScheduledNow ? 'btn-primary' : 'btn-outline'}`}
                                            onClick={() => startMeeting(c._id)}
                                        >
                                            <FiPlay size={13} /> {c.isScheduledNow ? 'Bắt đầu lớp học' : 'Bắt đầu (ngoài giờ?)'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
