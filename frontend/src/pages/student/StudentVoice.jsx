import React, { useState } from 'react';
import { authAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { FiMic, FiCheckCircle } from 'react-icons/fi';

export default function StudentVoice() {
    const { user } = useAuth();
    const [voiceRegistering, setVoiceRegistering] = useState(false);
    const [voiceStep, setVoiceStep] = useState(0);

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

    const handleVoiceRegister = async () => {
        setVoiceRegistering(true); setVoiceStep(0);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
            });
            const recordings = [];
            const targetSR = 16000;
            for (let i = 0; i < 5; i++) {
                setVoiceStep(i + 1);
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const actualSR = audioCtx.sampleRate;
                const source = audioCtx.createMediaStreamSource(stream);
                const processor = audioCtx.createScriptProcessor(4096, 1, 1);
                const chunks = [];
                processor.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
                source.connect(processor); processor.connect(audioCtx.destination);
                await new Promise(r => setTimeout(r, 5000));
                processor.disconnect(); source.disconnect(); await audioCtx.close();
                const totalLen = chunks.reduce((a, c) => a + c.length, 0);
                const merged = new Float32Array(totalLen);
                let off = 0;
                for (const c of chunks) { merged.set(c, off); off += c.length; }
                let finalSamples = merged, finalSR = actualSR;
                if (actualSR !== targetSR) {
                    const ratio = targetSR / actualSR;
                    const newLen = Math.round(merged.length * ratio);
                    finalSamples = new Float32Array(newLen);
                    for (let j = 0; j < newLen; j++) {
                        const srcIdx = j / ratio, idx0 = Math.floor(srcIdx);
                        const idx1 = Math.min(idx0 + 1, merged.length - 1);
                        finalSamples[j] = merged[idx0] * (1 - srcIdx + idx0) + merged[idx1] * (srcIdx - idx0);
                    }
                    finalSR = targetSR;
                }
                recordings.push(encodeWAV(finalSamples, finalSR));
            }
            stream.getTracks().forEach(t => t.stop());
            const formData = new FormData();
            recordings.forEach((r, i) => formData.append('audio', r, `sample_${i}.wav`));
            await authAPI.voiceRegister(formData);
            alert('Đăng ký giọng nói thành công!');
        } catch (e) { alert('Lỗi: ' + e.message); }
        setVoiceRegistering(false); setVoiceStep(0);
    };

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Giọng nói</h1>
                <p className="page-subtitle">Đăng ký voiceprint để đăng nhập bằng giọng nói</p>
            </div>

            <div className="card" style={{ maxWidth: 520 }}>
                <div className="card-header">
                    <div className="card-title"><FiMic size={15} color="var(--accent)" /> Đăng ký Giọng nói</div>
                </div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.875em', lineHeight: 1.6 }}>
                    Cần ghi <strong>5 mẫu x 5 giây</strong>. Hãy nói rõ ràng và liên tục khi ghi âm.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 16 }}>
                    <div style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: voiceRegistering ? 'var(--danger-light)' : user?.voiceRegistered ? 'var(--success-light)' : 'var(--accent-light)',
                        border: `2px solid ${voiceRegistering ? 'var(--danger)' : user?.voiceRegistered ? 'var(--success)' : 'var(--accent)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: voiceRegistering ? 'pulseGlow 1s infinite' : 'none',
                    }}>
                        <FiMic size={30} color={voiceRegistering ? 'var(--danger)' : user?.voiceRegistered ? 'var(--success)' : 'var(--accent)'} />
                    </div>

                    {voiceRegistering && (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>Đang ghi mẫu {voiceStep}/5</div>
                            <div className="progress-track" style={{ width: 200 }}>
                                <div className="progress-fill" style={{ width: `${(voiceStep / 5) * 100}%`, background: 'var(--danger)' }} />
                            </div>
                            <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', marginTop: 6 }}>Hãy nói to và rõ ràng...</div>
                        </div>
                    )}

                    <div style={{ fontWeight: 600, color: user?.voiceRegistered ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {user?.voiceRegistered
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FiCheckCircle size={15} /> Giọng nói đã đăng ký</span>
                            : 'Chưa đăng ký giọng nói'}
                    </div>
                </div>

                <button className="btn btn-primary btn-lg btn-block" onClick={handleVoiceRegister} disabled={voiceRegistering}>
                    <FiMic size={16} />
                    {voiceRegistering ? `Đang ghi mẫu ${voiceStep}/5...` : user?.voiceRegistered ? 'Đăng ký lại giọng nói' : 'Bắt đầu đăng ký'}
                </button>
            </div>
        </>
    );
}
