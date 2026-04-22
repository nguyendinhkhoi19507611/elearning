import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FiMail, FiLock, FiMic, FiBookOpen,
    FiAlertCircle, FiLoader, FiEye, FiEyeOff, FiSquare
} from 'react-icons/fi';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [voiceMode, setVoiceMode] = useState(false);
    const [recording, setRecording] = useState(false);
    const [processing, setProcessing] = useState(false);
    const { login, voiceLogin } = useAuth();
    const navigate = useNavigate();

    const streamRef = useRef(null);
    const audioCtxRef = useRef(null);
    const processorRef = useRef(null);
    const sourceRef = useRef(null);
    const chunksRef = useRef([]);

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

    const startVoiceRecording = async () => {
        setError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
            });
            streamRef.current = stream;
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            audioCtxRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            sourceRef.current = source;
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            chunksRef.current = [];
            processor.onaudioprocess = (e) => chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
            source.connect(processor);
            processor.connect(audioCtx.destination);
            setRecording(true);
        } catch (err) {
            setError('Không thể truy cập mic: ' + err.message);
        }
    };

    const stopVoiceRecording = async () => {
        setRecording(false);
        setProcessing(true);
        try {
            const audioCtx = audioCtxRef.current;
            const actualSR = audioCtx?.sampleRate || 48000;
            processorRef.current?.disconnect();
            sourceRef.current?.disconnect();
            if (audioCtx) await audioCtx.close();
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;

            const chunks = chunksRef.current;
            const totalLen = chunks.reduce((a, c) => a + c.length, 0);
            const merged = new Float32Array(totalLen);
            let off = 0;
            for (const c of chunks) { merged.set(c, off); off += c.length; }

            const targetSR = 16000;
            let finalSamples = merged;
            if (actualSR !== targetSR) {
                const ratio = targetSR / actualSR;
                const newLen = Math.round(merged.length * ratio);
                finalSamples = new Float32Array(newLen);
                for (let i = 0; i < newLen; i++) {
                    const srcIdx = i / ratio, idx0 = Math.floor(srcIdx);
                    const idx1 = Math.min(idx0 + 1, merged.length - 1);
                    finalSamples[i] = merged[idx0] * (1 - srcIdx + idx0) + merged[idx1] * (srcIdx - idx0);
                }
            }

            const blob = encodeWAV(finalSamples, targetSR);
            const data = await voiceLogin(blob);
            navigate(data.user.role === 'teacher' ? '/teacher'
                : data.user.role === 'admin' ? '/admin' : '/student');
        } catch (err) {
            const hint = err.response?.data?.hint || '';
            setError((err.response?.data?.error || 'Không nhận diện được giọng nói') + (hint ? ` — ${hint}` : ''));
        } finally {
            setProcessing(false);
        }
    };

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
                        <div style={{ textAlign: 'right', marginTop: 6, marginBottom: 4 }}>
                            <Link to="/forgot-password" style={{
                                color: 'var(--accent)', fontSize: '0.82em', textDecoration: 'none'
                            }}>
                                Quên mật khẩu?
                            </Link>
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
                            background: recording ? 'var(--danger-light)' : processing ? 'var(--accent-light)' : 'var(--accent-light)',
                            border: `2px solid ${recording ? 'var(--danger)' : 'var(--accent)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            animation: recording ? 'pulseGlow 1s infinite' : processing ? 'pulse 1.5s infinite' : 'none',
                            transition: 'all 0.3s ease'
                        }}>
                            <FiMic size={28} color={recording ? 'var(--danger)' : 'var(--accent)'} />
                        </div>
                        <p style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: '0.875em' }}>
                            {processing ? '⏳ Đang nhận diện giọng nói...' :
                                recording ? '🎙️ Hãy nói to và rõ ràng, nhấn kết thúc khi xong' :
                                    'Nhấn bắt đầu, nói rõ ràng, rồi nhấn kết thúc'}
                        </p>
                        {!recording && !processing && (
                            <button
                                className="btn btn-primary btn-lg btn-block"
                                onClick={startVoiceRecording}
                            >
                                <FiMic size={16} />
                                Bắt đầu ghi âm
                            </button>
                        )}
                        {recording && (
                            <button
                                className="btn btn-danger btn-lg btn-block"
                                onClick={stopVoiceRecording}
                            >
                                <FiSquare size={16} />
                                Kết thúc &amp; Nhận diện
                            </button>
                        )}
                        {processing && (
                            <button className="btn btn-lg btn-block" disabled style={{ opacity: 0.7 }}>
                                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                Đang xử lý...
                            </button>
                        )}
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

                <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.84em', color: 'var(--text-muted)' }}>
                    Chưa có tài khoản?{' '}
                    <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>Đăng ký sinh viên</Link>
                </p>

            </div>
        </div>
    );
}
