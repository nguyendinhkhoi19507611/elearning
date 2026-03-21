import React, { useState, useRef, useCallback } from 'react';
import { aiAPI } from '../../api/api';
import {
    FiCamera, FiList, FiTarget, FiAlertCircle, FiEyeOff,
    FiUser, FiAlertTriangle, FiStopCircle, FiPlay, FiEye
} from 'react-icons/fi';

const stateColor = {
    focused: 'var(--success)', distracted: 'var(--warning)',
    drowsy: 'var(--danger)', absent: 'var(--text-muted)', phone_usage: 'var(--purple)'
};
const stateLabel = {
    focused: 'Tập trung', distracted: 'Mất tập trung',
    drowsy: 'Buồn ngủ', absent: 'Vắng mặt', phone_usage: 'Dùng điện thoại'
};

export default function StudentCamera() {
    const [cameraOn, setCameraOn] = useState(false);
    const [currentState, setCurrentState] = useState(null);
    const [stateHistory, setStateHistory] = useState([]);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const intervalRef = useRef(null);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            setCameraOn(true);
            intervalRef.current = setInterval(detectState, 5000);
        } catch (err) { alert('Không thể truy cập camera: ' + err.message); }
    };

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        if (intervalRef.current) clearInterval(intervalRef.current);
        setCameraOn(false);
    };

    const detectState = useCallback(async () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        try {
            const res = await aiAPI.detectBase64({ image: base64, confidence: 0.3 });
            const state = res.data.primary_state;
            if (state) {
                setCurrentState({ ...state, noPersonDetected: res.data.no_person_detected, consecutiveAbsent: res.data.consecutive_absent || 0, detectionMethod: res.data.detection_method || state.detection_method, cvSummary: res.data.cv_analysis_summary });
                setStateHistory(prev => [...prev.slice(-50), { ...state, time: new Date().toLocaleTimeString('vi'), noPersonDetected: res.data.no_person_detected, detectionMethod: res.data.detection_method || state.detection_method }]);
            }
        } catch (e) { console.error('Detection error:', e); }
    }, []);

    // Stats computation
    const stats = (() => {
        if (stateHistory.length === 0) return null;
        const total = stateHistory.length;
        const counts = { focused: 0, distracted: 0, drowsy: 0, absent: 0, phone_usage: 0 };
        stateHistory.forEach(s => { if (counts[s.class_name] !== undefined) counts[s.class_name]++; });
        const focusPct = Math.round((counts.focused / total) * 100);
        return { counts, focusPct };
    })();

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Camera AI</h1>
                <p className="page-subtitle">Theo dõi trạng thái học tập qua camera</p>
            </div>

            {/* Stats */}
            {stats && (
                <div className="stats-grid" style={{ marginBottom: 20 }}>
                    {[
                        { label: 'Tập trung', value: `${stats.focusPct}%`, icon: <FiTarget size={18} />, color: stats.focusPct > 70 ? 'var(--success)' : stats.focusPct > 40 ? 'var(--warning)' : 'var(--danger)', bg: stats.focusPct > 70 ? 'var(--success-light)' : 'var(--warning-light)' },
                        { label: 'Mất tập trung', value: stats.counts.distracted + stats.counts.phone_usage, icon: <FiAlertCircle size={18} />, color: 'var(--warning)', bg: 'var(--warning-light)' },
                        { label: 'Buồn ngủ', value: stats.counts.drowsy, icon: <FiEyeOff size={18} />, color: 'var(--danger)', bg: 'var(--danger-light)' },
                        { label: 'Vắng mặt', value: stats.counts.absent, icon: <FiUser size={18} />, color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' },
                    ].map((s, i) => (
                        <div className="stat-card" key={i}>
                            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                            <div className="stat-label">{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Absent warning */}
            {currentState?.class_name === 'absent' && currentState?.consecutiveAbsent > 2 && (
                <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <FiAlertTriangle size={20} color="var(--danger)" />
                    <div>
                        <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.9em' }}>Bạn đã rời khỏi màn hình</div>
                        <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginTop: 2 }}>Đã vắng mặt {currentState.consecutiveAbsent * 5} giây</div>
                    </div>
                </div>
            )}

            <div className="grid grid-2">
                {/* Camera */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title"><FiCamera size={15} color="var(--accent)" /> Camera AI</div>
                        <button className={`btn btn-sm ${cameraOn ? 'btn-danger' : 'btn-success'}`} onClick={cameraOn ? stopCamera : startCamera}>
                            {cameraOn ? <><FiStopCircle size={13} /> Tắt</> : <><FiPlay size={13} /> Bật</>}
                        </button>
                    </div>
                    <div className="webcam-container" style={{ minHeight: 260 }}>
                        <video ref={videoRef} autoPlay muted playsInline
                            style={{ width: '100%', height: '100%', display: cameraOn ? 'block' : 'none', transform: 'scaleX(-1)' }} />
                        {!cameraOn && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: 'var(--text-muted)' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <FiCamera size={40} style={{ marginBottom: 12 }} />
                                    <div style={{ fontSize: '0.85em' }}>Nhấn Bật để bắt đầu theo dõi</div>
                                </div>
                            </div>
                        )}
                        {cameraOn && currentState && (
                            <div className={`webcam-overlay ${currentState.class_name}`} style={{
                                background: currentState.class_name === 'absent' ? 'rgba(239,68,68,0.85)' : 'rgba(0,0,0,0.75)'
                            }}>
                                <span className={`status-dot ${currentState.class_name}`} style={{ marginRight: 6 }} />
                                {stateLabel[currentState.class_name] || currentState.class_name}
                                {' '}({(currentState.confidence * 100).toFixed(0)}%)
                                {currentState.cvSummary && (
                                    <span style={{ display: 'block', fontSize: '0.65em', marginTop: 3, opacity: 0.7 }}>
                                        {currentState.cvSummary.face_detected ? 'Face' : 'No face'}
                                        {currentState.cvSummary.eyes_detected ? ` | Eyes(${currentState.cvSummary.eye_count})` : ' | No eyes'}
                                        {` | ${currentState.detectionMethod || 'hybrid'}`}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* History */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title"><FiList size={15} color="var(--accent)" /> Lịch sử ({stateHistory.length})</div>
                    </div>
                    <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                        {stateHistory.length === 0 && (
                            <div className="empty-state" style={{ padding: '30px 0' }}>
                                <div className="empty-state-icon"><FiEye size={20} /></div>
                                <div className="empty-state-title">Bật camera để theo dõi</div>
                            </div>
                        )}
                        {stateHistory.slice().reverse().map((s, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: '0.83em' }}>
                                <span className={`status-dot ${s.class_name}`} style={{ flexShrink: 0 }} />
                                <span style={{ flex: 1, color: stateColor[s.class_name] || 'var(--text-secondary)' }}>
                                    {stateLabel[s.class_name]}
                                    {s.noPersonDetected && <span style={{ color: 'var(--danger)', fontSize: '0.8em', marginLeft: 4 }}>(rời camera)</span>}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.78em', flexShrink: 0 }}>{s.time}</span>
                                <span style={{ fontWeight: 700, color: stateColor[s.class_name], fontSize: '0.8em', flexShrink: 0 }}>
                                    {(s.confidence * 100).toFixed(0)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
