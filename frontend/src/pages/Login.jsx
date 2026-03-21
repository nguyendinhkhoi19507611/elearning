import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FiMail, FiLock, FiMic, FiBookOpen,
    FiAlertCircle, FiLoader, FiEye, FiEyeOff
} from 'react-icons/fi';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [voiceMode, setVoiceMode] = useState(false);
    const [recording, setRecording] = useState(false);
    const [recordProgress, setRecordProgress] = useState(0);
    const { login, voiceLogin } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const data = await login(email, password);
            navigate(data.user.role === 'teacher' ? '/teacher'
                : data.user.role === 'admin' ? '/admin' : '/student');
        } catch (err) {
            setError(err.response?.data?.error || 'Đăng nhập thất bại');
        } finally { setLoading(false); }
    };

    const encodeWAV = (samples, sampleRate = 16000) => {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);
        const ws = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
        ws(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true);
        ws(8, 'WAVE'); ws(12, 'fmt '); view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        ws(36, 'data'); view.setUint32(40, samples.length * 2, true);
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return new Blob([buffer], { type: 'audio/wav' });
    };

    const handleVoiceLogin = async () => {
        setRecording(true); setError(''); setRecordProgress(0);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
            });
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const actualSR = audioCtx.sampleRate;
            const source = audioCtx.createMediaStreamSource(stream);
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            const chunks = [];
            processor.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
            source.connect(processor); processor.connect(audioCtx.destination);

            const DURATION = 5000;
            const start = Date.now();
            const intervalId = setInterval(() => {
                setRecordProgress(Math.min(100, ((Date.now() - start) / DURATION) * 100));
            }, 100);

            await new Promise(r => setTimeout(r, DURATION));
            clearInterval(intervalId);
            setRecordProgress(100);

            processor.disconnect(); source.disconnect();
            await audioCtx.close();
            stream.getTracks().forEach(t => t.stop());

            const totalLen = chunks.reduce((a, c) => a + c.length, 0);
            const merged = new Float32Array(totalLen);
            let off = 0;
            for (const c of chunks) { merged.set(c, off); off += c.length; }

            const targetSR = 16000;
            let finalSamples = merged, finalSR = actualSR;
            if (actualSR !== targetSR) {
                const ratio = targetSR / actualSR;
                const newLen = Math.round(merged.length * ratio);
                finalSamples = new Float32Array(newLen);
                for (let i = 0; i < newLen; i++) {
                    const srcIdx = i / ratio, idx0 = Math.floor(srcIdx);
                    const idx1 = Math.min(idx0 + 1, merged.length - 1);
                    finalSamples[i] = merged[idx0] * (1 - srcIdx + idx0) + merged[idx1] * (srcIdx - idx0);
                }
                finalSR = targetSR;
            }

            const blob = encodeWAV(finalSamples, finalSR);
            const data = await voiceLogin(blob);
            navigate(data.user.role === 'teacher' ? '/teacher'
                : data.user.role === 'admin' ? '/admin' : '/student');
        } catch (err) {
            const hint = err.response?.data?.hint || '';
            setError((err.response?.data?.error || 'Không nhận diện được giọng nói') + (hint ? ` — ${hint}` : ''));
        } finally {
            setRecording(false);
            setRecordProgress(0);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card fade-slide-up">
                {/* Logo */}
                <div className="auth-logo">
                    <div className="auth-logo-icon">
                        <FiBookOpen size={22} color="white" />
                    </div>
                    <span className="auth-title">EduAI Platform</span>
                </div>

                <h2 className="auth-heading">Đăng nhập</h2>
                <p className="auth-subheading">Chào mừng trở lại!</p>

                {/* Error */}
                {error && (
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        background: 'var(--danger-light)', border: '1px solid rgba(255,77,106,0.3)',
                        padding: '12px 14px', borderRadius: '10px', marginBottom: '20px',
                        fontSize: '0.84em', color: 'var(--danger)'
                    }}>
                        <FiAlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>{error}</span>
                    </div>
                )}

                {!voiceMode ? (
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label"><FiMail size={13} /> Email</label>
                            <div className="form-input-icon">
                                <span className="icon"><FiMail size={15} /></span>
                                <input
                                    className="form-input"
                                    type="email" value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    required autoComplete="email"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label"><FiLock size={13} /> Mật khẩu</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="form-input"
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required autoComplete="current-password"
                                    style={{ paddingRight: 44 }}
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-muted)', display: 'flex', padding: 4
                                }}>
                                    {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                </button>
                            </div>
                        </div>
                        <button
                            className="btn btn-primary btn-lg btn-block"
                            style={{ marginTop: 8 }}
                            disabled={loading}
                        >
                            {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Đang đăng nhập...</> : 'Đăng nhập'}
                        </button>
                    </form>
                ) : (
                    <div style={{ textAlign: 'center', padding: '12px 0' }}>
                        {/* Mic icon animated */}
                        <div style={{
                            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
                            background: recording ? 'var(--danger-light)' : 'var(--accent-light)',
                            border: `2px solid ${recording ? 'var(--danger)' : 'var(--accent)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            animation: recording ? 'pulseGlow 1s infinite' : 'none',
                            transition: 'all 0.3s ease'
                        }}>
                            <FiMic size={28} color={recording ? 'var(--danger)' : 'var(--accent)'} />
                        </div>
                        {recording && (
                            <div style={{ marginBottom: 16 }}>
                                <div className="progress-track" style={{ marginBottom: 8 }}>
                                    <div className="progress-fill" style={{ width: `${recordProgress}%`, background: 'var(--danger)' }} />
                                </div>
                                <span style={{ fontSize: '0.8em', color: 'var(--danger)' }}>
                                    Đang ghi âm... {Math.ceil((100 - recordProgress) / 20)}s
                                </span>
                            </div>
                        )}
                        <p style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: '0.875em' }}>
                            {recording ? 'Hãy nói to và rõ ràng...' : 'Nhấn bên dưới để bắt đầu (5 giây)'}
                        </p>
                        <button
                            className={`btn btn-lg btn-block ${recording ? 'btn-danger' : 'btn-primary'}`}
                            onClick={handleVoiceLogin}
                            disabled={recording}
                        >
                            <FiMic size={16} />
                            {recording ? 'Đang nhận diện...' : 'Bắt đầu ghi âm'}
                        </button>
                    </div>
                )}

                <div className="auth-divider">hoặc</div>

                <button
                    className="btn btn-outline btn-block"
                    onClick={() => { setVoiceMode(!voiceMode); setError(''); }}
                >
                    <FiMic size={15} />
                    {voiceMode ? 'Đăng nhập bằng Email' : 'Đăng nhập bằng Giọng nói'}
                </button>

            </div>
        </div>
    );
}
