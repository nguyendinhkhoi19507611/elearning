import React, { useState, useEffect } from 'react';
import { FiClock, FiUsers, FiCheckCircle, FiXCircle, FiDownload, FiPlay, FiSquare, FiAlertCircle } from 'react-icons/fi';
import api from '../api/api';

/**
 * AttendancePanel - Panel điểm danh cho giáo viên trong MeetingRoom
 * Props:
 *   - classroomId: string
 *   - socket: socket instance (để nhận realtime checkin events)
 *   - role: 'teacher' | 'student'
 */
export default function AttendancePanel({ classroomId, socket, role }) {
    const [activeSession, setActiveSession] = useState(null);
    const [records, setRecords] = useState([]);
    const [showSetup, setShowSetup] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);

    // Setup form
    const now = new Date();
    const defaultStart = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const defaultEnd = new Date(now.getTime() + 5 * 60000);
    const defaultEndStr = `${String(defaultEnd.getHours()).padStart(2, '0')}:${String(defaultEnd.getMinutes()).padStart(2, '0')}`;

    const [startTime, setStartTime] = useState(defaultStart);
    const [endTime, setEndTime] = useState(defaultEndStr);
    const [lateAfter, setLateAfter] = useState(0);
    const [requireFace, setRequireFace] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Listen to socket events
    useEffect(() => {
        if (!socket) return;

        socket.on('studentCheckedIn', ({ studentId, studentName, status, faceVerified }) => {
            setRecords(prev => {
                const idx = prev.findIndex(r =>
                    r.student?.toString() === studentId?.toString() ||
                    r.student === studentId ||
                    r.studentName === studentName
                );
                if (idx === -1) return prev; // Not found
                const updated = [...prev];
                updated[idx] = { ...updated[idx], status, faceVerified, verifiedAt: new Date().toISOString() };
                return updated;
            });
        });

        socket.on('attendanceEnded', ({ records: endedRecords }) => {
            setActiveSession(prev => prev ? { ...prev, status: 'ended' } : null);
            if (endedRecords) {
                setRecords(prev => prev.map(r => {
                    const updated = endedRecords.find(e => e.studentId === r.student);
                    return updated ? { ...r, ...updated } : r;
                }));
            }
        });

        return () => {
            socket.off('studentCheckedIn');
            socket.off('attendanceEnded');
        };
    }, [socket]);

    // Countdown timer [BUG FIX #15: dùng local timezone thay vì hardcode UTC+7]
    useEffect(() => {
        if (!activeSession || activeSession.status !== 'active') return;
        const [eh, em] = activeSession.endTime.split(':').map(Number);
        const tick = () => {
            const now = new Date();
            const end = new Date(now);
            end.setHours(eh, em, 0, 0);
            const left = Math.max(0, Math.floor((end - now) / 1000));
            setTimeLeft(left);
            if (left === 0) setActiveSession(prev => prev ? { ...prev, status: 'ended' } : null);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [activeSession]);

    const startAttendance = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/attendance/sessions', {
                classroomId,
                startTime,
                endTime,
                lateAfterMinutes: parseInt(lateAfter),
                requireFaceVerify: requireFace
            });
            setActiveSession(res.data.session);
            setRecords(res.data.session.records || []);
            setShowSetup(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Không thể bắt đầu điểm danh');
        }
        setLoading(false);
    };

    const endAttendance = async () => {
        if (!activeSession) return;
        setLoading(true);
        try {
            await api.post(`/attendance/sessions/${activeSession._id}/end`);
            setActiveSession(prev => ({ ...prev, status: 'ended' }));
        } catch (err) {
            setError(err.response?.data?.error || 'Lỗi kết thúc điểm danh');
        }
        setLoading(false);
    };

    const exportCSV = async () => {
        if (!activeSession) return;
        try {
            const res = await api.get(`/attendance/sessions/${activeSession._id}/export`, {
                responseType: 'blob'
            });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `diemdanh_${activeSession._id}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            setError('Không thể tải file điểm danh');
        }
    };

    const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;

    const formatTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

    const statusColor = { present: 'var(--success)', late: '#f59e0b', absent: 'var(--danger)', excused: 'var(--info)' };
    const statusLabel = { present: 'Có mặt', late: 'Trễ', absent: 'Vắng', excused: 'Phép' };

    // Student view: chỉ hiện thông tin cơ bản
    if (role !== 'teacher') {
        if (!activeSession) return null;
        return (
            <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.1)', borderRadius: 10, margin: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <FiClock size={14} color="var(--accent)" />
                    <span style={{ fontSize: '0.85em', fontWeight: 600, color: 'var(--accent)' }}>
                        ĐANG ĐIỂM DANH {activeSession.startTime} - {activeSession.endTime}
                    </span>
                </div>
                {timeLeft > 0 && (
                    <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>
                        Còn lại: {formatTime(timeLeft)}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FiUsers size={14} />
                Điểm danh
            </div>

            {error && (
                <div style={{
                    display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10,
                    background: 'rgba(239,68,68,0.1)', padding: '8px 10px', borderRadius: 8,
                    color: '#ef4444', fontSize: '0.8em'
                }}>
                    <FiAlertCircle size={13} /> {error}
                </div>
            )}

            {/* No active session */}
            {!activeSession && !showSetup && (
                <button
                    onClick={() => setShowSetup(true)}
                    className="btn btn-primary btn-block"
                    style={{ fontSize: '0.85em', padding: '8px 12px' }}
                >
                    <FiPlay size={13} /> Bắt đầu điểm danh
                </button>
            )}

            {/* Setup form */}
            {showSetup && !activeSession && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                            <label style={{ fontSize: '0.75em', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                                Bắt đầu
                            </label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                className="form-input"
                                style={{ padding: '6px 8px', fontSize: '0.85em' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75em', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                                Kết thúc
                            </label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                                className="form-input"
                                style={{ padding: '6px 8px', fontSize: '0.85em' }}
                            />
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75em', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                            Trễ sau (phút)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="30"
                            value={lateAfter}
                            onChange={e => setLateAfter(e.target.value)}
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '0.85em' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85em' }}>
                        <input
                            type="checkbox"
                            id="requireFace"
                            checked={requireFace}
                            onChange={e => setRequireFace(e.target.checked)}
                            style={{ width: 14, height: 14 }}
                        />
                        <label htmlFor="requireFace" style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            Yêu cầu xác thực khuôn mặt
                        </label>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={startAttendance}
                            className="btn btn-primary btn-block"
                            disabled={loading}
                            style={{ fontSize: '0.85em', padding: '8px' }}
                        >
                            {loading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <FiPlay size={13} />}
                            Bắt đầu
                        </button>
                        <button
                            onClick={() => setShowSetup(false)}
                            className="btn btn-outline"
                            style={{ fontSize: '0.85em', padding: '8px 12px', whiteSpace: 'nowrap' }}
                        >
                            Hủy
                        </button>
                    </div>
                </div>
            )}

            {/* Active session */}
            {activeSession && (
                <div>
                    {/* Timer */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: activeSession.status === 'active'
                            ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                        borderRadius: 8, padding: '8px 12px', marginBottom: 10
                    }}>
                        <div>
                            <div style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>
                                {activeSession.startTime} → {activeSession.endTime}
                            </div>
                            {activeSession.status === 'active' && timeLeft > 0 ? (
                                <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1.1em' }}>
                                    ⏱ {formatTime(timeLeft)}
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>Đã kết thúc</div>
                            )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.8em', color: 'var(--success)', fontWeight: 600 }}>
                                ✓ {present} có mặt
                            </div>
                            <div style={{ fontSize: '0.75em', color: 'var(--danger)' }}>
                                ✗ {absent} vắng
                            </div>
                        </div>
                    </div>

                    {/* Records list */}
                    <div style={{
                        maxHeight: 200, overflowY: 'auto', marginBottom: 10,
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8
                    }}>
                        {records.map((r, i) => (
                            <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '6px 10px',
                                borderBottom: i < records.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        background: statusColor[r.status] + '22',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.75em', fontWeight: 700,
                                        color: statusColor[r.status]
                                    }}>
                                        {r.studentName?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.8em', fontWeight: 600 }}>{r.studentName}</div>
                                        {r.faceVerified && (
                                            <div style={{ fontSize: '0.7em', color: 'var(--success)' }}>✓ Khuôn mặt</div>
                                        )}
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: '0.72em', fontWeight: 700, padding: '2px 8px',
                                    borderRadius: 20, background: statusColor[r.status] + '22',
                                    color: statusColor[r.status]
                                }}>
                                    {statusLabel[r.status]}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        {activeSession.status === 'active' && (
                            <button
                                onClick={endAttendance}
                                className="btn btn-danger btn-block"
                                disabled={loading}
                                style={{ fontSize: '0.8em', padding: '7px' }}
                            >
                                <FiSquare size={12} /> Kết thúc
                            </button>
                        )}
                        <button
                            onClick={exportCSV}
                            className="btn btn-outline"
                            style={{ fontSize: '0.8em', padding: '7px 12px', whiteSpace: 'nowrap' }}
                            title="Tải file điểm danh"
                        >
                            <FiDownload size={13} /> CSV
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
