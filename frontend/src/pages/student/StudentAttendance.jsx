import React, { useState, useEffect, useRef, useCallback } from 'react';
import { classroomsAPI, attendanceAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { SkeletonStats, SkeletonList } from '../../components/Skeleton';
import { io } from 'socket.io-client';
import {
    FiCheckCircle, FiXCircle, FiCalendar, FiClock, FiBook,
    FiCamera, FiAlertCircle, FiRefreshCw, FiShield, FiFilter,
} from 'react-icons/fi';

const STATUS_MAP = {
    present: { label: 'Có mặt', icon: <FiCheckCircle size={14} />, badge: 'badge-success' },
    absent: { label: 'Vắng mặt', icon: <FiXCircle size={14} />, badge: 'badge-danger' },
    late: { label: 'Muộn', icon: <FiClock size={14} />, badge: 'badge-warning' },
};

/* ── Face Verify Inline ── */
function FaceCheckin({ sessionId, user, onDone }) {
    const [phase, setPhase] = useState('ready'); // ready | scanning | verifying | success | failed
    const [error, setError] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [stream, setStream] = useState(null);
    const [faceResult, setFaceResult] = useState(null);
    const MAX_ATTEMPTS = 3;
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    useEffect(() => { streamRef.current = stream; }, [stream]);

    const stopCamera = useCallback(() => {
        const s = streamRef.current;
        if (s) s.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setStream(null);
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    useEffect(() => () => stopCamera(), [stopCamera]);
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => { });
        }
    }, [stream, phase]);

    const startCamera = async () => {
        setError(''); setPhase('scanning');
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            });
            setStream(s);
        } catch (err) {
            setError('Không thể bật camera: ' + err.message);
            setPhase('ready');
        }
    };

    const captureAndVerify = async () => {
        if (!canvasRef.current || !videoRef.current) return;
        setPhase('verifying');

        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');

        // Chụp 3 frame liên tiếp, mỗi frame cách nhau 500ms
        const TOTAL_FRAMES = 3;
        const REQUIRED_PASS = 2; // Cần ≥2/3 khớp mới tính điểm danh thành công
        let passCount = 0;
        let failCount = 0;
        let bestResult = null;

        for (let i = 0; i < TOTAL_FRAMES; i++) {
            try {
                // Chụp frame
                ctx.save();
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(video, 0, 0);
                ctx.restore();
                const imageData = canvas.toDataURL('image/jpeg', 0.9);

                const res = await attendanceAPI.faceVerifyBase64({ image: imageData });
                const data = res.data;

                if (data.verified) {
                    passCount++;
                    if (!bestResult || data.distance < bestResult.distance) bestResult = data;
                } else {
                    failCount++;
                    if (!bestResult) bestResult = data;
                }

                // Đợi 500ms trước frame tiếp (trừ frame cuối)
                if (i < TOTAL_FRAMES - 1) {
                    await new Promise(r => setTimeout(r, 500));
                }
            } catch (err) {
                failCount++;
            }
        }

        stopCamera();
        setFaceResult(bestResult);

        // Majority vote: cần >= 2/3 pass
        if (passCount >= REQUIRED_PASS) {
            try {
                await attendanceAPI.checkin(sessionId, {
                    faceVerified: true,
                    faceDistance: bestResult?.distance || 0,
                });
                setPhase('success');
                setTimeout(() => onDone('success'), 2000);
            } catch (err) {
                setError(err.response?.data?.error || 'Lỗi ghi nhận điểm danh');
                setPhase('ready');
            }
        } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            const msg = bestResult?.message || 'Không nhận diện được khuôn mặt';
            if (newAttempts >= MAX_ATTEMPTS) {
                setPhase('failed');
            } else {
                setError(`${msg}. Còn ${MAX_ATTEMPTS - newAttempts} lần thử.`);
                setPhase('ready');
            }
        }
    };

    // Điểm danh không cần face
    const checkinWithoutFace = async () => {
        setPhase('verifying');
        try {
            await attendanceAPI.checkin(sessionId, { faceVerified: false });
            setPhase('success');
            setTimeout(() => onDone('success'), 1500);
        } catch (err) {
            setError(err.response?.data?.error || 'Lỗi điểm danh');
            setPhase('ready');
        }
    };

    if (!user?.faceRegistered) {
        return (
            <div style={{ padding: '16px 20px', background: 'rgba(249,115,22,0.1)', borderRadius: 14, border: '1px solid rgba(249,115,22,0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <FiAlertCircle size={18} color="#f97316" />
                    <span style={{ fontWeight: 700, fontSize: '0.9em', color: '#f97316' }}>Chưa đăng ký khuôn mặt</span>
                </div>
                <p style={{ fontSize: '0.82em', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                    Vào <strong>Menu → Khuôn mặt</strong> để đăng ký trước khi điểm danh bằng khuôn mặt.
                </p>
                <button className="btn btn-primary" onClick={checkinWithoutFace} style={{ fontSize: '0.85em' }}>
                    <FiCheckCircle size={14} /> Điểm danh thường (không face)
                </button>
            </div>
        );
    }

    return (
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-strong)', overflow: 'hidden' }}>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {phase === 'success' && (
                <div style={{ padding: 32, textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <FiCheckCircle size={32} color="var(--success)" />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.1em', color: 'var(--success)' }}>Điểm danh thành công! 🎉</div>
                    {faceResult && <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', marginTop: 6 }}>Độ khớp: {faceResult.match_percent || Math.round((1 - faceResult.distance) * 100)}%</div>}
                </div>
            )}

            {phase === 'failed' && (
                <div style={{ padding: 32, textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <FiXCircle size={32} color="var(--danger)" />
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--danger)' }}>Xác thực thất bại</div>
                    <div style={{ fontSize: '0.82em', color: 'var(--text-muted)', margin: '8px 0 16px' }}>Đã hết lượt thử. Liên hệ giáo viên.</div>
                    <button className="btn btn-outline" onClick={() => { setAttempts(0); setError(''); setPhase('ready'); }} style={{ fontSize: '0.85em' }}>
                        <FiRefreshCw size={14} /> Thử lại
                    </button>
                </div>
            )}

            {phase === 'verifying' && (
                <div style={{ padding: 32, textAlign: 'center' }}>
                    <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto 12px' }} />
                    <div style={{ fontWeight: 700, fontSize: '0.95em', marginBottom: 6 }}>Đang quét khuôn mặt...</div>
                    <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>Chụp 3 frame &amp; xác thực AI (giữ yên mặt)</div>
                </div>
            )}

            {phase === 'scanning' && (
                <div>
                    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '16px 16px 0 0' }}>
                        <video ref={videoRef} autoPlay playsInline muted style={{
                            width: '100%', maxHeight: 280, objectFit: 'cover',
                            transform: 'scaleX(-1)'
                        }} />
                        <div style={{
                            position: 'absolute', top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)', width: 200, height: 280,
                            border: '4px dashed rgba(124,58,237,0.8)', borderRadius: '50%',
                            boxShadow: '0 0 0 4000px rgba(0,0,0,0.4)', pointerEvents: 'none',
                        }} />
                        <div style={{
                            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 14px',
                            borderRadius: 8, fontSize: '0.75em', fontWeight: 600, whiteSpace: 'nowrap',
                            backdropFilter: 'blur(4px)',
                        }}>
                            Hướng mặt vào vòng tròn
                        </div>
                    </div>
                    <div style={{ padding: '12px 16px' }}>
                        <button className="btn btn-primary btn-block" onClick={captureAndVerify} style={{ fontSize: '0.9em' }}>
                            <FiCamera size={15} /> Quét &amp; Xác thực (3 lần)
                        </button>
                    </div>
                </div>
            )}

            {phase === 'ready' && (
                <div style={{ padding: '20px' }}>
                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: 10, marginBottom: 12, color: '#ef4444', fontSize: '0.82em' }}>
                            <FiAlertCircle size={13} /> {error}
                        </div>
                    )}
                    {attempts > 0 && (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
                            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < attempts ? 'var(--danger)' : 'var(--border)' }} />
                            ))}
                        </div>
                    )}
                    <button className="btn btn-primary btn-block" onClick={startCamera} style={{ fontSize: '0.9em', padding: '10px' }}>
                        <FiCamera size={15} /> Điểm danh bằng khuôn mặt
                    </button>
                    <button className="btn btn-outline btn-block" onClick={checkinWithoutFace} style={{ fontSize: '0.82em', marginTop: 8, color: 'var(--text-muted)' }}>
                        Điểm danh thường (không face)
                    </button>
                </div>
            )}
        </div>
    );
}

/* ── Main Component ── */
export default function StudentAttendance() {
    const { user } = useAuth();
    const [classrooms, setClassrooms] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingRecs, setLoadingRecs] = useState(false);

    // Active attendance session
    const [activeSession, setActiveSession] = useState(null);
    const [checkedIn, setCheckedIn] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        classroomsAPI.getAll()
            .then(r => {
                setClassrooms(r.data);
                if (r.data.length > 0) setSelectedId(r.data[0]._id);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    // Load history + check active session
    useEffect(() => {
        if (!selectedId) return;
        setLoadingRecs(true);
        setActiveSession(null);
        setCheckedIn(false);

        Promise.all([
            classroomsAPI.getMyAttendance(selectedId).then(r => setRecords(r.data || [])).catch(() => setRecords([])),
            attendanceAPI.getActiveSessions(selectedId).then(r => {
                const sessions = r.data || [];
                if (sessions.length > 0) {
                    const session = sessions[0];
                    setActiveSession(session);
                    // Check if student already checked in
                    const myRecord = session.records?.find(rec => rec.student?.toString() === user._id || rec.student === user._id);
                    if (myRecord && (myRecord.status === 'present' || myRecord.status === 'late')) {
                        setCheckedIn(true);
                    }
                }
            }).catch(() => { }),
        ]).finally(() => setLoadingRecs(false));
    }, [selectedId, user._id]);

    // Socket: listen for attendanceStarted in real-time
    useEffect(() => {
        if (!user) return;
        const token = localStorage.getItem('token');
        const socket = io(window.location.origin, { path: '/socket.io', auth: { token }, reconnectionAttempts: 3, reconnectionDelay: 2000 });

        socket.on('connect', () => {
            socket.emit('subscribeUser', { userId: user._id });
            classroomsAPI.getAll().then(r => {
                const ids = (r.data || []).map(c => c._id);
                if (ids.length > 0) socket.emit('subscribeClassrooms', { classroomIds: ids });
            }).catch(() => { });
        });

        socket.on('attendanceStarted', (data) => {
            if (data.classroomId === selectedId) {
                setActiveSession({
                    _id: data.sessionId,
                    startTime: data.startTime,
                    endTime: data.endTime,
                    requireFaceVerify: data.requireFaceVerify,
                    status: 'active',
                });
                setCheckedIn(false);
            }
        });

        socket.on('attendanceEnded', () => {
            setActiveSession(prev => prev ? { ...prev, status: 'ended' } : null);
        });

        return () => socket.disconnect();
    }, [user, selectedId]);

    // Countdown timer
    useEffect(() => {
        if (!activeSession || activeSession.status !== 'active') return;
        const endStr = activeSession.endTime || '';
        let eh = 0, em = 0;
        if (endStr.includes('T')) {
            const d = new Date(endStr);
            eh = d.getHours(); em = d.getMinutes();
        } else {
            const parts = endStr.split(':').map(Number);
            eh = parts[0] || 0; em = parts[1] || 0;
        }
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

    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const selected = classrooms.find(c => c._id === selectedId);

    // Filter records by date range
    const filteredRecords = records.filter(r => {
        const d = new Date(r.sessionDate || r.createdAt);
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
        return true;
    });

    const presentCount = filteredRecords.filter(r => r.status === 'present' || r.status === 'late').length;
    const totalCount = filteredRecords.length;
    const rate = totalCount > 0 ? Math.round(presentCount / totalCount * 100) : 0;

    const formatDate = (d) => new Date(d).toLocaleDateString('vi-VN', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const formatTime = (d) => new Date(d).toLocaleTimeString('vi-VN', {
        hour: '2-digit', minute: '2-digit'
    });
    const formatCountdown = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Điểm danh</h1>
                <p className="page-subtitle">Điểm danh trực tiếp & xem lịch sử tham gia lớp học</p>
            </div>

            {loading ? (
                <div className="card"><div className="empty-state"><SkeletonStats count={4} /></div></div>
            ) : classrooms.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"><FiBook size={24} /></div>
                        <div className="empty-state-title">Chưa tham gia lớp học nào</div>
                        <div className="empty-state-sub">Bạn cần được thêm vào lớp học để điểm danh</div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Class selector */}
                    {classrooms.length > 1 && (
                        <div className="tabs" style={{ marginBottom: 20 }}>
                            {classrooms.map(c => (
                                <button
                                    key={c._id}
                                    className={`tab ${selectedId === c._id ? 'active' : ''}`}
                                    onClick={() => setSelectedId(c._id)}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ══ ACTIVE ATTENDANCE BANNER ══ */}
                    {activeSession && activeSession.status === 'active' && !checkedIn && (
                        <div style={{
                            marginBottom: 20,
                            background: 'var(--gradient-purple-soft)',
                            border: '2px solid var(--border-accent)',
                            borderRadius: 18, overflow: 'hidden',
                            animation: 'fadeIn 0.3s ease',
                        }}>
                            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{
                                        width: 10, height: 10, borderRadius: '50%', background: '#ef4444',
                                        animation: 'pulse 1.5s infinite', flexShrink: 0,
                                    }} />
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '0.95em', color: 'var(--accent)' }}>
                                            📋 ĐANG ĐIỂM DANH — {selected?.name}
                                        </div>
                                        <div style={{ fontSize: '0.78em', color: 'var(--text-muted)', marginTop: 2 }}>
                                            {activeSession.startTime} → {activeSession.endTime}
                                            {activeSession.requireFaceVerify && <span style={{ marginLeft: 8, color: '#f59e0b' }}>🔒 Yêu cầu xác thực khuôn mặt</span>}
                                        </div>
                                    </div>
                                </div>
                                {timeLeft > 0 && (
                                    <div style={{
                                        background: 'var(--accent-light)', borderRadius: 10,
                                        padding: '6px 14px', fontWeight: 800, fontSize: '1.1em',
                                        color: timeLeft < 60 ? '#ef4444' : 'var(--accent)',
                                        fontFamily: 'monospace',
                                    }}>
                                        ⏱ {formatCountdown(timeLeft)}
                                    </div>
                                )}
                            </div>

                            {/* Face verify / checkin UI */}
                            <div style={{ padding: 16 }}>
                                <FaceCheckin
                                    sessionId={activeSession._id}
                                    user={user}
                                    onDone={(status) => {
                                        setCheckedIn(true);
                                        // Refresh history
                                        classroomsAPI.getMyAttendance(selectedId).then(r => setRecords(r.data || [])).catch(() => { });
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Already checked in banner */}
                    {activeSession && activeSession.status === 'active' && checkedIn && (
                        <div style={{
                            marginBottom: 20, padding: '16px 20px',
                            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                            <FiCheckCircle size={22} color="var(--success)" />
                            <div>
                                <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.95em' }}>✅ Đã điểm danh thành công</div>
                                <div style={{ fontSize: '0.78em', color: 'var(--text-muted)' }}>{selected?.name} — {activeSession.startTime} → {activeSession.endTime}</div>
                            </div>
                        </div>
                    )}

                    {/* No active session info */}
                    {!activeSession && !loadingRecs && (
                        <div style={{
                            marginBottom: 20, padding: '14px 18px',
                            background: 'var(--bg-purple-soft)', border: '1px solid var(--border)',
                            borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
                            fontSize: '0.85em', color: 'var(--text-muted)',
                        }}>
                            <FiShield size={16} />
                            Hiện chưa có phiên điểm danh nào đang diễn ra cho lớp <strong style={{ color: 'var(--text-primary)', margin: '0 4px' }}>{selected?.name}</strong>
                        </div>
                    )}

                    {/* Summary stats */}
                    {!loadingRecs && totalCount > 0 && (
                        <div className="stats-grid" style={{ marginBottom: 20 }}>
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}><FiBook size={18} /></div>
                                <div className="stat-value" style={{ color: 'var(--accent)' }}>{totalCount}</div>
                                <div className="stat-label">Tổng buổi</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}><FiCheckCircle size={18} /></div>
                                <div className="stat-value" style={{ color: 'var(--success)' }}>{presentCount}</div>
                                <div className="stat-label">Có mặt</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}><FiXCircle size={18} /></div>
                                <div className="stat-value" style={{ color: 'var(--danger)' }}>{totalCount - presentCount}</div>
                                <div className="stat-label">Vắng</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon" style={{
                                    background: rate >= 80 ? 'var(--success-light)' : rate >= 60 ? 'var(--warning-light)' : 'var(--danger-light)',
                                    color: rate >= 80 ? 'var(--success)' : rate >= 60 ? 'var(--warning)' : 'var(--danger)'
                                }}><FiCalendar size={18} /></div>
                                <div className="stat-value" style={{
                                    color: rate >= 80 ? 'var(--success)' : rate >= 60 ? 'var(--warning)' : 'var(--danger)'
                                }}>{rate}%</div>
                                <div className="stat-label">Tỉ lệ</div>
                            </div>
                        </div>
                    )}

                    {/* Date filter */}
                    {!loadingRecs && records.length > 0 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                            flexWrap: 'wrap',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82em', color: 'var(--text-muted)', fontWeight: 600 }}>
                                <FiFilter size={13} /> Lọc theo ngày:
                            </div>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                className="form-input" style={{ padding: '5px 10px', fontSize: '0.82em', width: 'auto' }} />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8em' }}>→</span>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                className="form-input" style={{ padding: '5px 10px', fontSize: '0.82em', width: 'auto' }} />
                            {(dateFrom || dateTo) && (
                                <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                                    className="btn btn-sm btn-outline" style={{ fontSize: '0.75em', padding: '4px 10px' }}>
                                    Xóa lọc
                                </button>
                            )}
                        </div>
                    )}

                    {/* Records list */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">
                                <FiCalendar size={15} color="var(--accent)" />
                                {selected?.name} — Lịch sử điểm danh
                            </div>
                            {records.length > 0 && rate < 80 && (
                                <span className="badge badge-warning" style={{ fontSize: '0.7em' }}>⚠️ Dưới 80%</span>
                            )}
                        </div>

                        {totalCount > 0 && (
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', marginBottom: 6, color: 'var(--text-muted)' }}>
                                    <span>Tỉ lệ tham dự</span>
                                    <span style={{ fontWeight: 700, color: rate >= 80 ? 'var(--success)' : 'var(--danger)' }}>{rate}%</span>
                                </div>
                                <div className="progress-track">
                                    <div className="progress-fill" style={{
                                        width: `${rate}%`,
                                        background: rate >= 80 ? 'var(--success)' : rate >= 60 ? 'var(--warning)' : 'var(--danger)'
                                    }} />
                                </div>
                            </div>
                        )}

                        {loadingRecs ? (
                            <SkeletonList rows={5} />
                        ) : filteredRecords.length === 0 ? (
                            <div className="empty-state" style={{ padding: '30px 0' }}>
                                <div className="empty-state-icon"><FiCalendar size={22} /></div>
                                <div className="empty-state-title">{records.length === 0 ? 'Chưa có buổi điểm danh nào' : 'Không có buổi nào trong khoảng ngày đã chọn'}</div>
                                <div className="empty-state-sub">{records.length === 0 ? 'Dữ liệu sẽ hiện khi giáo viên tổ chức điểm danh' : 'Thử chọn khoảng ngày khác'}</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {filteredRecords.map((rec, i) => {
                                    const s = STATUS_MAP[rec.status] || STATUS_MAP.absent;
                                    return (
                                        <div key={rec._id || i} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '12px 0',
                                            borderBottom: i < records.length - 1 ? '1px solid var(--border)' : 'none'
                                        }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                                                background: rec.status === 'present' || rec.status === 'late' ? 'var(--success-light)' : 'var(--danger-light)',
                                                color: rec.status === 'present' || rec.status === 'late' ? 'var(--success)' : 'var(--danger)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                {s.icon}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.875em' }}>
                                                    Buổi ngày {formatDate(rec.sessionDate || rec.createdAt)}
                                                </div>
                                                {rec.checkedInAt && (
                                                    <div style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>
                                                        Điểm danh lúc: {formatTime(rec.checkedInAt)}
                                                        {rec.faceVerified && <span style={{ marginLeft: 8, color: 'var(--success)' }}>✅ Xác thực khuôn mặt</span>}
                                                    </div>
                                                )}
                                            </div>
                                            <span className={`badge ${s.badge}`}>{s.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </>
    );
}
