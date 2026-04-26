import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { classroomsAPI } from '../api/api';
import api from '../api/api';
import {
    FiCamera, FiCheckCircle, FiXCircle, FiAlertCircle,
    FiRefreshCw, FiClock,
} from 'react-icons/fi';

/**
 * AttendanceAlert — Component GLOBAL hiển thị ở MỌI trang cho sinh viên.
 * Khi giáo viên bắt đầu điểm danh:
 *   1. Popup khẩn cấp xuất hiện (bất kể đang ở trang nào)
 *   2. Sinh viên nhấn "Điểm danh ngay"
 *   3. Camera fullscreen bật lên quét mặt
 *   4. Tự động checkin sau xác thực thành công
 */

export default function AttendanceAlert() {
    const { user } = useAuth();
    const [alert, setAlert] = useState(null); // { sessionId, classroomId, classroomName, startTime, endTime, requireFaceVerify }
    const [phase, setPhase] = useState('alert'); // alert | camera | verifying | success | failed
    const [error, setError] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [faceResult, setFaceResult] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [stream, setStream] = useState(null);
    const MAX_ATTEMPTS = 3;

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    // Sync ref
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

    // ── Socket listener — mount ONCE, listen ALWAYS ──
    useEffect(() => {
        if (!user || user.role !== 'student') return;

        const token = localStorage.getItem('token');
        const socket = io(window.location.origin, {
            path: '/socket.io', auth: { token }, withCredentials: true,
            reconnectionAttempts: 3, reconnectionDelay: 2000,
        });

        socket.on('connect_error', (err) => {
            console.warn('[AttendanceAlert] Socket connection error:', err.message);
        });

        socket.on('connect', () => {
            socket.emit('subscribeUser', { userId: user._id });
            // Subscribe tất cả lớp
            classroomsAPI.getAll().then(r => {
                const ids = (r.data || []).map(c => c._id);
                if (ids.length > 0) socket.emit('subscribeClassrooms', { classroomIds: ids });
            }).catch(() => { });
        });

        socket.on('attendanceStarted', (data) => {
            console.log('📋 attendanceStarted received:', data);
            // Show fullscreen alert
            setAlert({
                sessionId: data.sessionId,
                classroomId: data.classroomId,
                classroomName: data.classroomName || 'Lớp học',
                startTime: data.startTime,
                endTime: data.endTime,
                requireFaceVerify: data.requireFaceVerify,
            });
            setPhase('alert');
            setError('');
            setAttempts(0);
            setFaceResult(null);

            // Play notification sound
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.frequency.value = 880; gain.gain.value = 0.3;
                osc.start(); osc.stop(audioCtx.currentTime + 0.3);
                setTimeout(() => {
                    const o2 = audioCtx.createOscillator();
                    o2.connect(gain); o2.frequency.value = 1100;
                    o2.start(); o2.stop(audioCtx.currentTime + 0.4);
                }, 350);
            } catch (e) { /* ignore audio errors */ }
        });

        socket.on('attendanceEnded', () => {
            // Nếu chưa điểm danh xong → đóng alert
            setAlert(prev => {
                if (prev) setPhase('alert');
                return null;
            });
            stopCamera();
        });

        return () => socket.disconnect();
    }, [user, stopCamera]);

    // Countdown timer
    useEffect(() => {
        if (!alert) return;
        const [eh, em] = alert.endTime.split(':').map(Number);
        const tick = () => {
            const now = new Date();
            const end = new Date(now);
            end.setHours(eh, em, 0, 0);
            const left = Math.max(0, Math.floor((end - now) / 1000));
            setTimeLeft(left);
            if (left === 0) { setAlert(null); stopCamera(); }
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [alert, stopCamera]);

    // ── Camera actions ──
    const openCamera = async () => {
        setError(''); setPhase('camera');
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            });
            setStream(s);
        } catch (err) {
            setError('Không thể bật camera: ' + err.message);
            setPhase('alert');
        }
    };

    const captureAndVerify = async () => {
        if (!canvasRef.current || !videoRef.current || !alert) return;
        setPhase('verifying');
        stopCamera();

        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);

        const imageData = canvas.toDataURL('image/jpeg', 0.9);

        try {
            const res = await api.post('/attendance/face/verify-base64', {
                image: imageData, threshold: 0.55,
            });
            setFaceResult(res.data);

            if (res.data.verified) {
                // Checkin
                await api.post(`/attendance/sessions/${alert.sessionId}/checkin`, {
                    faceVerified: true,
                    faceDistance: res.data.distance,
                });
                setPhase('success');
                // Auto close after 3s
                setTimeout(() => { setAlert(null); setPhase('alert'); }, 3000);
            } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);
                if (newAttempts >= MAX_ATTEMPTS) {
                    setPhase('failed');
                } else {
                    setError(`Không nhận diện được. Còn ${MAX_ATTEMPTS - newAttempts} lần thử.`);
                    setPhase('alert');
                }
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Lỗi xác thực. Thử lại.');
            setAttempts(a => a + 1);
            setPhase('alert');
        }
    };

    const checkinWithoutFace = async () => {
        if (!alert) return;
        setPhase('verifying');
        try {
            await api.post(`/attendance/sessions/${alert.sessionId}/checkin`, {
                faceVerified: false,
            });
            setPhase('success');
            setTimeout(() => { setAlert(null); setPhase('alert'); }, 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Lỗi điểm danh');
            setPhase('alert');
        }
    };

    const dismiss = () => {
        stopCamera();
        setAlert(null);
        setPhase('alert');
    };

    // ── Render ──
    if (!alert || !user || user.role !== 'student') return null;

    const formatCountdown = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

    // ═══ FULLSCREEN CAMERA VIEW ═══
    if (phase === 'camera') {
        return (
            <div style={styles.fullscreenOverlay}>
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Camera feed fullscreen */}
                <video
                    ref={videoRef}
                    autoPlay playsInline muted
                    style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover', transform: 'scaleX(-1)',
                    }}
                />

                {/* Face guide oval */}
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -55%)',
                    width: 220, height: 280, borderRadius: '50%',
                    border: '4px solid rgba(99,102,241,0.9)',
                    boxShadow: '0 0 40px rgba(99,102,241,0.4), inset 0 0 40px rgba(99,102,241,0.1)',
                    pointerEvents: 'none',
                }} />

                {/* Scanning animation ring */}
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -55%)',
                    width: 240, height: 300, borderRadius: '50%',
                    border: '2px solid rgba(99,102,241,0.3)',
                    animation: 'pulse 2s infinite',
                    pointerEvents: 'none',
                }} />

                {/* Top bar */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
                    padding: '20px 24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div>
                        <div style={{ fontSize: '1.1em', fontWeight: 800, color: '#fff' }}>
                            📋 {alert.classroomName}
                        </div>
                        <div style={{ fontSize: '0.8em', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                            Hướng mặt vào khung hình • Đủ ánh sáng
                        </div>
                    </div>
                    <div style={{
                        background: 'rgba(99,102,241,0.3)', borderRadius: 12,
                        padding: '8px 16px', fontWeight: 800, fontFamily: 'monospace',
                        fontSize: '1.2em', color: '#fff',
                    }}>
                        ⏱ {formatCountdown(timeLeft)}
                    </div>
                </div>

                {/* Bottom capture bar */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                    padding: '40px 24px 32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
                }}>
                    <button onClick={() => { stopCamera(); setPhase('alert'); }} style={{
                        width: 50, height: 50, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)',
                        color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <FiXCircle size={22} />
                    </button>

                    <button onClick={captureAndVerify} style={{
                        width: 76, height: 76, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        border: '4px solid rgba(255,255,255,0.8)',
                        boxShadow: '0 0 30px rgba(99,102,241,0.6)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'transform 0.2s',
                    }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <FiCamera size={28} color="#fff" />
                    </button>

                    <div style={{ width: 50 }} /> {/* spacer */}
                </div>
            </div>
        );
    }

    // ═══ VERIFYING SPINNER ═══
    if (phase === 'verifying') {
        return (
            <div style={styles.fullscreenOverlay}>
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ width: 56, height: 56, borderWidth: 4, margin: '0 auto 20px', borderColor: 'rgba(99,102,241,0.3)', borderTopColor: '#6366f1' }} />
                    <div style={{ fontSize: '1.2em', fontWeight: 700, color: '#fff' }}>Đang nhận diện khuôn mặt...</div>
                    <div style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>Vui lòng chờ trong giây lát</div>
                </div>
            </div>
        );
    }

    // ═══ SUCCESS ═══
    if (phase === 'success') {
        return (
            <div style={{ ...styles.fullscreenOverlay, background: 'rgba(16,185,129,0.95)' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: 100, height: 100, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 24px', animation: 'fadeIn 0.5s ease',
                    }}>
                        <FiCheckCircle size={56} color="#fff" />
                    </div>
                    <div style={{ fontSize: '1.6em', fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                        Điểm danh thành công! 🎉
                    </div>
                    <div style={{ fontSize: '1em', color: 'rgba(255,255,255,0.8)' }}>
                        {alert.classroomName}
                    </div>
                    {faceResult && (
                        <div style={{ fontSize: '0.9em', color: 'rgba(255,255,255,0.7)', marginTop: 12 }}>
                            Độ khớp khuôn mặt: {Math.round((1 - faceResult.distance) * 100)}%
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ═══ FAILED ═══
    if (phase === 'failed') {
        return (
            <div style={{ ...styles.fullscreenOverlay, background: 'rgba(239,68,68,0.95)' }}>
                <div style={{ textAlign: 'center', maxWidth: 400 }}>
                    <div style={{
                        width: 100, height: 100, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 24px',
                    }}>
                        <FiXCircle size={56} color="#fff" />
                    </div>
                    <div style={{ fontSize: '1.4em', fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                        Xác thực thất bại
                    </div>
                    <div style={{ fontSize: '0.9em', color: 'rgba(255,255,255,0.8)', marginBottom: 24 }}>
                        Đã hết {MAX_ATTEMPTS} lượt thử. Liên hệ giáo viên để điểm danh thủ công.
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button onClick={() => { setAttempts(0); setError(''); setPhase('alert'); }}
                            style={{ ...styles.btn, background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.4)' }}>
                            <FiRefreshCw size={16} /> Thử lại
                        </button>
                        <button onClick={dismiss}
                            style={{ ...styles.btn, background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)' }}>
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ═══ ALERT POPUP (phase === 'alert') ═══
    return (
        <div style={styles.alertOverlay}>
            <div style={styles.alertCard}>
                {/* Pulsing red dot */}
                <div style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#ef4444', animation: 'pulse 1s infinite',
                    boxShadow: '0 0 12px rgba(239,68,68,0.6)',
                }} />

                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    borderRadius: '20px 20px 0 0', padding: '24px 28px',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '2.5em', marginBottom: 8 }}>📋</div>
                    <div style={{ fontWeight: 800, fontSize: '1.2em', color: '#fff' }}>
                        ĐIỂM DANH BẮT ĐẦU!
                    </div>
                    <div style={{ fontSize: '0.88em', color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>
                        {alert.classroomName}
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 28px 28px' }}>
                    {/* Timer */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        background: 'rgba(99,102,241,0.1)', borderRadius: 14,
                        padding: '12px 18px', marginBottom: 16,
                    }}>
                        <FiClock size={18} color="var(--accent)" />
                        <span style={{ fontSize: '0.88em', color: 'var(--text-secondary)' }}>
                            {alert.startTime} → {alert.endTime}
                        </span>
                        <span style={{
                            fontWeight: 800, fontFamily: 'monospace', fontSize: '1.2em',
                            color: timeLeft < 60 ? '#ef4444' : 'var(--accent)',
                            marginLeft: 'auto',
                        }}>
                            {formatCountdown(timeLeft)}
                        </span>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: 'rgba(239,68,68,0.1)', padding: '10px 14px',
                            borderRadius: 10, marginBottom: 14, color: '#ef4444', fontSize: '0.85em',
                        }}>
                            <FiAlertCircle size={14} /> {error}
                        </div>
                    )}

                    {/* Attempt indicator */}
                    {attempts > 0 && (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
                            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                                <div key={i} style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: i < attempts ? '#ef4444' : 'var(--border)',
                                }} />
                            ))}
                        </div>
                    )}

                    {/* Main CTA */}
                    <button onClick={openCamera} style={{
                        width: '100%', padding: '14px 20px', borderRadius: 14,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        border: 'none', color: '#fff', fontWeight: 800, fontSize: '1em',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 10, transition: 'transform 0.15s, box-shadow 0.15s',
                        boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                    }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <FiCamera size={20} />
                        Điểm danh bằng khuôn mặt
                    </button>

                    {/* Secondary actions */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                        {!alert.requireFaceVerify && (
                            <button onClick={checkinWithoutFace} style={{
                                flex: 1, padding: '10px', borderRadius: 12,
                                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                                color: 'var(--accent)', fontWeight: 600, fontSize: '0.82em',
                                cursor: 'pointer',
                            }}>
                                <FiCheckCircle size={14} style={{ marginRight: 6 }} />
                                Điểm danh thường
                            </button>
                        )}
                        <button onClick={dismiss} style={{
                            flex: alert.requireFaceVerify ? 1 : 0,
                            padding: '10px', borderRadius: 12,
                            background: 'transparent', border: '1px solid var(--border)',
                            color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.82em',
                            cursor: 'pointer', whiteSpace: 'nowrap',
                        }}>
                            Để sau
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    fullscreenOverlay: {
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    alertOverlay: {
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'fadeIn 0.3s ease',
    },
    alertCard: {
        position: 'relative',
        background: 'var(--bg-card, #1a1a2e)',
        border: '2px solid rgba(99,102,241,0.4)',
        borderRadius: 22, width: '100%', maxWidth: 400,
        boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.15)',
        overflow: 'hidden', animation: 'fadeIn 0.4s ease',
    },
    btn: {
        padding: '10px 20px', borderRadius: 12, border: 'none',
        color: '#fff', fontWeight: 700, fontSize: '0.88em',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
    },
};
