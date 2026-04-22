import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiCamera, FiCheckCircle, FiRefreshCw, FiUpload, FiAlertCircle, FiX, FiArrowLeft } from 'react-icons/fi';
import api from '../../api/api';

const SAMPLES_REQUIRED = 5;

export default function StudentFace() {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const [phase, setPhase] = useState('idle'); // idle | capturing | done | submitting | success
    const [captures, setCaptures] = useState([]);
    const [error, setError] = useState('');
    const [stream, setStream] = useState(null);
    const [registeredFaces, setRegisteredFaces] = useState([]);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // Khi stream thay đổi → gán vào video element
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
        }
    }, [stream, phase]);

    // Load registered faces on mount
    useEffect(() => {
        if (user?.faceRegistered) {
            api.get('/attendance/face/my-faces').then(r => {
                setRegisteredFaces(r.data?.faces || []);
            }).catch(() => {});
        }
    }, [user?.faceRegistered]);

    const startCamera = async () => {
        setError('');
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
            });
            setStream(s);
            setPhase('capturing');
        } catch (err) {
            setError('Không thể bật camera: ' + err.message);
        }
    };

    const stopCamera = useCallback(() => {
        stream?.getTracks().forEach(t => t.stop());
        setStream(null);
        if (videoRef.current) videoRef.current.srcObject = null;
    }, [stream]);

    const capturePhoto = () => {
        if (!canvasRef.current || !videoRef.current) return;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        // Mirror flip
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const newCaptures = [...captures, dataUrl];
        setCaptures(newCaptures);

        if (newCaptures.length >= SAMPLES_REQUIRED) {
            stopCamera();
            setPhase('done');
        }
    };

    const removeCapture = async (idx) => {
        const updated = captures.filter((_, i) => i !== idx);
        setCaptures(updated);
        if (updated.length < SAMPLES_REQUIRED && phase === 'done') {
            setPhase('capturing');
            try {
                await startCamera();
            } catch {
                // Camera không bật được → quay về phase done
                setPhase('done');
            }
        }
    };

    const handleSubmit = async () => {
        if (captures.length < SAMPLES_REQUIRED) {
            setError(`Cần ít nhất ${SAMPLES_REQUIRED} ảnh`);
            return;
        }
        setPhase('submitting');
        setError('');
        try {
            const formData = new FormData();
            for (let i = 0; i < captures.length; i++) {
                const res = await fetch(captures[i]);
                const blob = await res.blob();
                formData.append('images', blob, `face_${i}.jpg`);
            }
            const response = await api.post('/attendance/face/enroll', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success || response.data.samples_saved) {
                setPhase('success');
                setUser(prev => ({ ...prev, faceRegistered: true }));
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Lỗi đăng ký. Thử lại.');
            setPhase('done');
        }
    };

    const reset = () => {
        stopCamera();
        setCaptures([]);
        setPhase('idle');
        setError('');
    };

    // Hướng dẫn chụp từng mẫu
    const captureHints = [
        '📸 Nhìn thẳng vào camera',
        '↩️ Xoay mặt sang trái một chút',
        '↪️ Xoay mặt sang phải một chút',
        '⬆️ Ngẩng mặt lên nhẹ',
        '🙂 Nhìn thẳng – mỉm cười tự nhiên',
    ];

    // ── IDLE ──
    if (phase === 'idle') {
        return (
            <div style={styles.fullPage}>
                {/* Back button */}
                <button onClick={() => navigate(-1)} style={styles.floatingBackBtn}>
                    <FiArrowLeft size={18} /> Quay lại
                </button>
                <div style={styles.centerCard}>
                    <div style={styles.iconCircle('var(--accent)')}>
                        <FiCamera size={48} />
                    </div>
                    <h1 style={styles.title}>Đăng ký Khuôn mặt</h1>
                    <p style={styles.subtitle}>
                        Hệ thống sẽ chụp <strong>{SAMPLES_REQUIRED} ảnh</strong> khuôn mặt của bạn từ các góc khác nhau
                        để sử dụng cho điểm danh tự động.
                    </p>

                    {/* Status */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                        borderRadius: 12, marginBottom: 24,
                        background: user?.faceRegistered ? 'var(--success-light)' : 'var(--bg-purple-soft)',
                        border: `1px solid ${user?.faceRegistered ? 'var(--success)' : 'var(--border)'}`,
                    }}>
                        <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: user?.faceRegistered ? 'var(--success)' : 'var(--text-muted)'
                        }} />
                        <span style={{ fontSize: '0.9em', color: user?.faceRegistered ? 'var(--success)' : 'var(--text-muted)' }}>
                            {user?.faceRegistered ? 'Khuôn mặt đã được đăng ký' : 'Chưa đăng ký khuôn mặt'}
                        </span>
                    </div>

                    <div style={styles.stepsList}>
                        <div style={styles.step}><span style={styles.stepNum}>1</span>Bật camera và nhìn thẳng</div>
                        <div style={styles.step}><span style={styles.stepNum}>2</span>Chụp 3 ảnh từ các góc</div>
                        <div style={styles.step}><span style={styles.stepNum}>3</span>Xác nhận và lưu</div>
                    </div>

                    <button onClick={startCamera} style={styles.primaryBtn}>
                        <FiCamera size={18} />
                        {user?.faceRegistered ? 'Đăng ký lại khuôn mặt' : 'Bắt đầu đăng ký'}
                    </button>

                    {/* Registered faces gallery */}
                    {user?.faceRegistered && registeredFaces.length > 0 && (
                        <div style={{ marginTop: 32, width: '100%', maxWidth: 420 }}>
                            <div style={{ fontSize: '0.85em', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                🖼️ Ảnh khuôn mặt đã đăng ký ({registeredFaces.length})
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                                {registeredFaces.map((face, i) => (
                                    <div key={i} style={{
                                        width: 90, height: 90, borderRadius: 14, overflow: 'hidden',
                                        border: '2px solid rgba(34,197,94,0.4)',
                                        boxShadow: '0 2px 12px rgba(34,197,94,0.15)',
                                    }}>
                                        <img src={face.data} alt={`Mẫu ${i + 1}`} style={{
                                            width: '100%', height: '100%', objectFit: 'cover',
                                        }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── SUCCESS ──
    if (phase === 'success') {
        return (
            <div style={styles.fullPage}>
                {/* Back button */}
                <button onClick={() => navigate(-1)} style={styles.floatingBackBtn}>
                    <FiArrowLeft size={18} /> Quay lại
                </button>
                <div style={styles.centerCard}>
                    <div style={styles.iconCircle('#22c55e')}>
                        <FiCheckCircle size={48} />
                    </div>
                    <h1 style={{ ...styles.title, color: '#22c55e' }}>Đăng ký thành công!</h1>
                    <p style={styles.subtitle}>
                        Khuôn mặt của bạn đã được lưu vào hệ thống.
                        Từ giờ bạn có thể điểm danh tự động khi vào lớp học.
                    </p>
                    <div style={{ fontSize: '4em', margin: '16px 0' }}>🎉</div>
                    <button onClick={reset} style={styles.outlineBtn}>
                        <FiRefreshCw size={16} /> Quay lại
                    </button>
                </div>
            </div>
        );
    }

    // ── CAPTURING / DONE / SUBMITTING ──
    return (
        <div style={styles.fullPage}>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Top bar */}
            <div style={styles.topBar}>
                <button onClick={reset} style={styles.backBtn}>
                    <FiX size={18} /> Hủy
                </button>
                <div style={styles.topTitle}>
                    Đăng ký Khuôn mặt
                </div>
                <div style={styles.progressPills}>
                    {Array.from({ length: SAMPLES_REQUIRED }).map((_, i) => (
                        <div key={i} style={{
                            width: 36, height: 6, borderRadius: 3,
                            background: i < captures.length ? '#22c55e' :
                                i === captures.length && phase === 'capturing' ? 'var(--accent)' : '#374151',
                            transition: 'all 0.3s',
                        }} />
                    ))}
                </div>
            </div>

            {/* Main content */}
            <div style={styles.mainContent}>
                {/* Camera area */}
                <div style={styles.cameraArea}>
                    {phase === 'capturing' && (
                        <>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                style={styles.videoFull}
                            />
                            {/* Oval guide */}
                            <div style={styles.ovalGuide} />
                            {/* Hint */}
                            <div style={styles.hintBadge}>
                                {captureHints[captures.length] || captureHints[0]}
                            </div>
                        </>
                    )}

                    {(phase === 'done' || phase === 'submitting') && (
                        <div style={styles.donePreview}>
                            <FiCheckCircle size={64} color="#22c55e" />
                            <div style={{ fontSize: '1.2em', fontWeight: 700, color: '#22c55e', marginTop: 16 }}>
                                {SAMPLES_REQUIRED} ảnh đã chụp xong!
                            </div>
                            <p style={{ color: '#9ca3af', fontSize: '0.9em', marginTop: 8 }}>
                                Kiểm tra ảnh bên dưới rồi nhấn "Lưu khuôn mặt"
                            </p>
                        </div>
                    )}
                </div>

                {/* Bottom panel */}
                <div style={styles.bottomPanel}>
                    {/* Error */}
                    {error && (
                        <div style={styles.errorBar}>
                            <FiAlertCircle size={15} /> {error}
                        </div>
                    )}

                    {/* Thumbnails */}
                    <div style={styles.thumbRow}>
                        {captures.map((img, i) => (
                            <div key={i} style={styles.thumbWrap}>
                                <img src={img} alt={`Mẫu ${i + 1}`} style={styles.thumbImg} />
                                <button onClick={() => removeCapture(i)} style={styles.thumbRemove}>×</button>
                                <div style={styles.thumbLabel}>Mẫu {i + 1}</div>
                            </div>
                        ))}
                        {Array.from({ length: Math.max(0, SAMPLES_REQUIRED - captures.length) }).map((_, i) => (
                            <div key={`ph-${i}`} style={styles.thumbPlaceholder}>
                                <FiCamera size={16} color="#4b5563" />
                                <span>{captures.length + i + 1}</span>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div style={styles.actionsRow}>
                        {phase === 'capturing' && (
                            <button onClick={capturePhoto} style={styles.captureBtn}>
                                <div style={styles.captureBtnInner} />
                            </button>
                        )}
                        {phase === 'done' && (
                            <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 400 }}>
                                <button onClick={() => { setPhase('capturing'); startCamera(); }}
                                    style={{ ...styles.outlineBtn, flex: 1 }}>
                                    <FiRefreshCw size={15} /> Chụp lại
                                </button>
                                <button onClick={handleSubmit}
                                    style={{ ...styles.primaryBtn, flex: 2 }}>
                                    <FiUpload size={15} /> Lưu khuôn mặt
                                </button>
                            </div>
                        )}
                        {phase === 'submitting' && (
                            <button style={{ ...styles.primaryBtn, opacity: 0.7, cursor: 'not-allowed' }} disabled>
                                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                                Đang xử lý...
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    fullPage: {
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0a0a1a',
        display: 'flex', flexDirection: 'column',
        color: '#fff',
    },
    floatingBackBtn: {
        position: 'absolute', top: 16, left: 16, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10, padding: '8px 16px',
        color: '#d1d5db', fontSize: '0.9em', fontWeight: 600,
        cursor: 'pointer', backdropFilter: 'blur(8px)',
        transition: 'background 0.2s',
    },
    centerCard: {
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px', textAlign: 'center', maxWidth: 500,
        margin: '0 auto',
    },
    iconCircle: (color) => ({
        width: 100, height: 100, borderRadius: '50%',
        background: `${color}18`, border: `3px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24, color,
    }),
    title: {
        fontSize: '1.6em', fontWeight: 800, margin: '0 0 12px',
        letterSpacing: '-0.02em',
    },
    subtitle: {
        fontSize: '0.95em', color: 'var(--text-muted)', lineHeight: 1.7,
        margin: '0 0 24px', maxWidth: 420,
    },
    stepsList: {
        display: 'flex', flexDirection: 'column', gap: 10,
        marginBottom: 32, width: '100%', maxWidth: 320,
    },
    step: {
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--bg-purple-soft)', borderRadius: 10,
        padding: '10px 16px', fontSize: '0.9em', color: 'var(--text-secondary)',
    },
    stepNum: {
        width: 28, height: 28, borderRadius: '50%',
        background: 'var(--accent)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.8em', fontWeight: 700, flexShrink: 0,
    },
    primaryBtn: {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        background: 'var(--gradient-purple)',
        border: 'none', borderRadius: 14, padding: '14px 32px',
        color: '#fff', fontSize: '1em', fontWeight: 700,
        cursor: 'pointer', width: '100%', maxWidth: 360,
        boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
        transition: 'transform 0.2s',
    },
    outlineBtn: {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: 'transparent', border: '1px solid #374151',
        borderRadius: 12, padding: '12px 24px',
        color: '#9ca3af', fontSize: '0.9em', fontWeight: 600,
        cursor: 'pointer',
    },
    // ── Camera phase ──
    topBar: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid #1f2937',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
    },
    backBtn: {
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', color: '#9ca3af',
        fontSize: '0.9em', cursor: 'pointer', padding: '6px 10px',
        borderRadius: 8,
    },
    topTitle: {
        fontWeight: 700, fontSize: '1em',
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
    },
    progressPills: {
        display: 'flex', gap: 6,
    },
    mainContent: {
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
    },
    cameraArea: {
        flex: 1, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#000', overflow: 'hidden',
        minHeight: 0,
    },
    videoFull: {
        width: '100%', height: '100%',
        objectFit: 'cover',
        transform: 'scaleX(-1)', // Mirror
    },
    ovalGuide: {
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 440, height: 560,
        border: '3px solid rgba(99,102,241,0.7)',
        borderRadius: '50%',
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.45), 0 0 30px rgba(99,102,241,0.3)',
        pointerEvents: 'none',
    },
    hintBadge: {
        position: 'absolute', top: 20, left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        padding: '8px 20px', borderRadius: 30,
        fontSize: '0.9em', fontWeight: 600, color: '#fff',
        whiteSpace: 'nowrap',
    },
    donePreview: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 40,
    },
    bottomPanel: {
        padding: '16px 20px 24px',
        background: 'rgba(15,15,30,0.95)',
        borderTop: '1px solid #1f2937',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    },
    errorBar: {
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 400,
        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
        padding: '8px 14px', borderRadius: 10, color: '#ef4444', fontSize: '0.85em',
    },
    thumbRow: {
        display: 'flex', gap: 12, justifyContent: 'center',
    },
    thumbWrap: {
        position: 'relative', width: 80, height: 80,
    },
    thumbImg: {
        width: 80, height: 80, borderRadius: 12, objectFit: 'cover',
        border: '2px solid #22c55e', transform: 'scaleX(-1)',
    },
    thumbRemove: {
        position: 'absolute', top: -6, right: -6, width: 22, height: 22,
        borderRadius: '50%', background: '#ef4444', border: '2px solid #0a0a1a',
        color: '#fff', fontSize: 13, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700,
    },
    thumbLabel: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        textAlign: 'center', fontSize: '0.65em', color: '#fff',
        background: 'rgba(0,0,0,0.6)', borderRadius: '0 0 10px 10px',
        padding: '2px 0',
    },
    thumbPlaceholder: {
        width: 80, height: 80, borderRadius: 12,
        border: '2px dashed #374151', background: 'rgba(255,255,255,0.03)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 4,
        color: '#4b5563', fontSize: '0.75em',
    },
    actionsRow: {
        display: 'flex', justifyContent: 'center', width: '100%',
    },
    captureBtn: {
        width: 72, height: 72, borderRadius: '50%',
        background: 'transparent', border: '4px solid #fff',
        cursor: 'pointer', padding: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.15s',
    },
    captureBtnInner: {
        width: '100%', height: '100%', borderRadius: '50%',
        background: '#fff',
        transition: 'transform 0.15s',
    },
};
