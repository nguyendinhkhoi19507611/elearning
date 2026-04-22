import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FiCamera, FiCheckCircle, FiXCircle, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import api from '../api/api';

/**
 * FaceVerifyModal - Chụp tay 5 tấm → gửi verify → auto checkin
 * Flow: Bật camera → user nhấn nút chụp 5 lần → gửi verify → kết quả (<5s)
 */
const TOTAL_PHOTOS = 5;

export default function FaceVerifyModal({ onSuccess, onSkip, requireFaceVerify = true, attendanceSessionId, user }) {
    // Phases: camera | verifying | success | failed
    const [phase, setPhase] = useState('camera');
    const [error, setError] = useState('');
    const [stream, setStream] = useState(null);
    const [faceResult, setFaceResult] = useState(null);
    const [captures, setCaptures] = useState([]);
    const [flashKey, setFlashKey] = useState(0);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const mountedRef = useRef(true);

    useEffect(() => { streamRef.current = stream; }, [stream]);
    useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

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
    }, [stream]);

    // User chưa đăng ký khuôn mặt
    if (!user?.faceRegistered) {
        return (
            <div style={styles.overlay}>
                <div style={styles.fullscreenContainer}>
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <div style={styles.iconWrap('#f97316')}>
                            <FiAlertCircle size={40} color="#f97316" />
                        </div>
                        <h2 style={{ ...styles.title, color: '#fff' }}>Chưa đăng ký khuôn mặt</h2>
                        <p style={{ fontSize: '0.9em', color: 'rgba(255,255,255,0.7)', margin: '12px 0 24px' }}>
                            Vui lòng vào <strong>Menu → Khuôn mặt</strong> để đăng ký trước.
                        </p>
                        <button className="btn btn-primary btn-lg" onClick={onSkip} style={{ padding: '12px 32px' }}>
                            ← Quay lại
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Capture 1 frame ──
    const captureFrame = () => {
        if (!canvasRef.current || !videoRef.current) return null;
        const video = videoRef.current;
        if (video.readyState < 2) return null;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.8);
    };

    // ── Start camera ──
    const startCamera = async () => {
        setError('');
        setPhase('camera');
        setCaptures([]);
        setFaceResult(null);
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            });
            if (!mountedRef.current) { s.getTracks().forEach(t => t.stop()); return; }
            setStream(s);
        } catch (err) {
            setError('Không thể bật camera: ' + err.message);
            setPhase('failed');
        }
    };

    // ── Manual capture: user taps button ──
    const handleCapture = () => {
        const frame = captureFrame();
        if (!frame) return;
        setFlashKey(k => k + 1); // Flash effect

        const newCaptures = [...captures, frame];
        setCaptures(newCaptures);

        if (newCaptures.length >= TOTAL_PHOTOS) {
            // All 5 captured → verify
            stopCamera();
            verifyAll(newCaptures);
        }
    };

    // ── Send all photos to verify ──
    const verifyAll = async (photos) => {
        setPhase('verifying');
        try {
            const res = await api.post('/attendance/face/verify-multi-base64', {
                images: photos,
            });
            if (!mountedRef.current) return;
            setFaceResult(res.data);

            if (res.data.verified) {
                setPhase('success');
                if (attendanceSessionId) {
                    try {
                        await api.post(`/attendance/sessions/${attendanceSessionId}/checkin`, {
                            faceVerified: true,
                            faceDistance: res.data.distance,
                        });
                    } catch (e) { console.warn('Checkin error:', e.message); }
                }
                setTimeout(() => {
                    if (mountedRef.current) onSuccess(true, res.data.distance);
                }, 2500);
            } else {
                setPhase('failed');
            }
        } catch (err) {
            if (!mountedRef.current) return;
            setError(err.response?.data?.error || 'Lỗi kết nối AI service');
            setPhase('failed');
        }
    };

    // Auto-start camera
    useEffect(() => {
        if (user?.faceRegistered) startCamera();
        return () => stopCamera();
    }, []); // eslint-disable-line

    // ── Photo progress dots ──
    const renderDots = () => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {Array.from({ length: TOTAL_PHOTOS }).map((_, i) => (
                <div key={i} style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: i < captures.length ? '#10b981' : 'rgba(255,255,255,0.25)',
                    transition: 'all 0.3s',
                    transform: i < captures.length ? 'scale(1.15)' : 'scale(1)',
                }} />
            ))}
        </div>
    );

    // ── Capture hints ──
    const hints = [
        'Nhìn thẳng vào camera',
        'Xoay mặt sang trái nhẹ',
        'Xoay mặt sang phải nhẹ',
        'Ngẩng đầu lên nhẹ',
        'Mỉm cười tự nhiên',
    ];

    return (
        <div style={styles.overlay}>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* ═══ SUCCESS ═══ */}
            {phase === 'success' && (
                <div style={{ ...styles.fullscreenContainer, background: 'rgba(16,185,129,0.95)' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: 100, height: 100, borderRadius: '50%',
                            background: 'rgba(255,255,255,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px',
                        }}>
                            <FiCheckCircle size={56} color="#fff" />
                        </div>
                        <div style={{ fontSize: '1.5em', fontWeight: 800, color: '#fff' }}>
                            Điểm danh thành công!
                        </div>
                        <div style={{ fontSize: '1em', color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>
                            {user?.name}
                        </div>
                        {faceResult && (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: '0.95em', color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                                    Khớp {faceResult.match_percent}%
                                </div>
                                <div style={{ fontSize: '0.8em', color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                                    {faceResult.pass_count}/{faceResult.total} ảnh xác thực thành công
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ FAILED ═══ */}
            {phase === 'failed' && (
                <div style={{ ...styles.fullscreenContainer, background: 'rgba(239,68,68,0.95)' }}>
                    <div style={{ textAlign: 'center', maxWidth: 400 }}>
                        <div style={{
                            width: 100, height: 100, borderRadius: '50%',
                            background: 'rgba(255,255,255,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px',
                        }}>
                            <FiXCircle size={56} color="#fff" />
                        </div>
                        <div style={{ fontSize: '1.3em', fontWeight: 800, color: '#fff' }}>
                            Không nhận diện được
                        </div>
                        <div style={{ fontSize: '0.9em', color: 'rgba(255,255,255,0.7)', margin: '12px 0' }}>
                            {error || (faceResult
                                ? `${faceResult.pass_count || 0}/${faceResult.total || TOTAL_PHOTOS} ảnh khớp (cần ≥${faceResult.min_required || 3})`
                                : 'Không thể xác thực. Thử lại hoặc liên hệ giáo viên.'
                            )}
                        </div>
                        {faceResult?.match_percent > 0 && (
                            <div style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
                                Độ khớp cao nhất: {faceResult.match_percent}%
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button onClick={startCamera}
                                style={{ ...styles.actionBtn, background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.4)' }}>
                                <FiRefreshCw size={16} /> Thử lại
                            </button>
                            <button onClick={onSkip}
                                style={{ ...styles.actionBtn, background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)' }}>
                                ← Quay lại
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ VERIFYING ═══ */}
            {phase === 'verifying' && (
                <div style={styles.fullscreenContainer}>
                    <div style={{ textAlign: 'center' }}>
                        <div className="spinner" style={{
                            width: 56, height: 56, borderWidth: 4,
                            margin: '0 auto 20px',
                            borderColor: 'rgba(99,102,241,0.3)', borderTopColor: '#6366f1',
                        }} />
                        <div style={{ fontSize: '1.2em', fontWeight: 700, color: '#fff' }}>
                            Đang xác thực khuôn mặt...
                        </div>
                        <div style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
                            So sánh {TOTAL_PHOTOS} ảnh • Vui lòng chờ
                        </div>
                        {/* Mini thumbnails */}
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 20 }}>
                            {captures.map((img, i) => (
                                <div key={i} style={{
                                    width: 48, height: 48, borderRadius: 10, overflow: 'hidden',
                                    border: '2px solid rgba(99,102,241,0.4)',
                                }}>
                                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ CAMERA — Manual capture ═══ */}
            {phase === 'camera' && (
                <>
                    <video
                        ref={videoRef}
                        autoPlay playsInline muted
                        style={{
                            position: 'absolute', inset: 0,
                            width: '100%', height: '100%',
                            objectFit: 'cover', transform: 'scaleX(-1)',
                        }}
                    />

                    {/* Face oval guide */}
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -55%)',
                        width: 220, height: 280, borderRadius: '50%',
                        border: '4px solid rgba(99,102,241,0.9)',
                        boxShadow: '0 0 40px rgba(99,102,241,0.4), inset 0 0 40px rgba(99,102,241,0.1)',
                        pointerEvents: 'none',
                    }} />

                    {/* Flash effect */}
                    <div key={flashKey} style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(255,255,255,0.2)',
                        animation: flashKey > 0 ? 'flashFade 0.3s ease-out forwards' : 'none',
                        pointerEvents: 'none', opacity: flashKey > 0 ? 1 : 0,
                    }} />

                    {/* Top bar */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
                        padding: '20px 24px 50px',
                    }}>
                        <div style={{ fontSize: '1.1em', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FiCamera size={18} /> Điểm danh khuôn mặt
                        </div>
                        <div style={{ fontSize: '0.82em', color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                            {hints[captures.length] || hints[0]}
                        </div>
                    </div>

                    {/* Bottom bar */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
                        padding: '50px 24px 28px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                    }}>
                        {/* Progress dots */}
                        {renderDots()}

                        {/* Counter */}
                        <div style={{ fontSize: '0.9em', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                            {captures.length}/{TOTAL_PHOTOS} ảnh đã chụp
                        </div>

                        {/* Capture button — big round button */}
                        <button onClick={handleCapture} style={{
                            width: 76, height: 76, borderRadius: '50%',
                            background: 'transparent',
                            border: '4px solid #fff',
                            cursor: 'pointer', padding: 4,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'transform 0.15s',
                        }}
                            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
                            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <div style={{
                                width: '100%', height: '100%', borderRadius: '50%',
                                background: '#fff',
                            }} />
                        </button>

                        {/* Skip */}
                        <button onClick={() => { stopCamera(); onSkip(); }} style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 12, padding: '10px 24px',
                            color: 'rgba(255,255,255,0.7)', fontSize: '0.85em',
                            fontWeight: 600, cursor: 'pointer',
                        }}>
                            Bỏ qua
                        </button>
                    </div>

                    {/* Mini thumbnails of captured photos */}
                    {captures.length > 0 && (
                        <div style={{
                            position: 'absolute', left: 16, top: '50%',
                            transform: 'translateY(-50%)',
                            display: 'flex', flexDirection: 'column', gap: 6,
                        }}>
                            {captures.map((img, i) => (
                                <div key={i} style={{
                                    width: 48, height: 48, borderRadius: 10, overflow: 'hidden',
                                    border: '2px solid #10b981',
                                    boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                                }}>
                                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            <style>{`
                @keyframes flashFade {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `}</style>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed', inset: 0, zIndex: 99999,
        background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    fullscreenContainer: {
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    iconWrap: (color) => ({
        width: 80, height: 80, borderRadius: '50%',
        background: `${color}22`, border: `2px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
    }),
    title: {
        fontSize: '1.3em', fontWeight: 800, margin: '0 0 8px',
    },
    actionBtn: {
        padding: '10px 24px', borderRadius: 12, border: 'none',
        color: '#fff', fontWeight: 700, fontSize: '0.9em',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
    },
};
