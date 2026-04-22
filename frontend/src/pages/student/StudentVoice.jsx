import React, { useState, useRef } from 'react';
import { authAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { FiMic, FiCheckCircle, FiSquare, FiPlay } from 'react-icons/fi';

export default function StudentVoice() {
    const { user } = useAuth();
    const [voiceRegistering, setVoiceRegistering] = useState(false);
    const [currentSample, setCurrentSample] = useState(0); // 0 = not started, 1-5 = sample number
    const [isRecording, setIsRecording] = useState(false);
    const [recordings, setRecordings] = useState([]);
    const [submitting, setSubmitting] = useState(false);

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

    const startRecording = async () => {
        try {
            if (!streamRef.current) {
                streamRef.current = await navigator.mediaDevices.getUserMedia({
                    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
                });
            }
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            audioCtxRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(streamRef.current);
            sourceRef.current = source;
            chunksRef.current = [];

            // [BUG FIX #12] AudioWorklet (modern) with ScriptProcessor fallback
            if (audioCtx.audioWorklet) {
                try {
                    const workletCode = `class Rec extends AudioWorkletProcessor{process(i){this.port.postMessage(new Float32Array(i[0][0]));return true}}registerProcessor('rec',Rec)`;
                    const blob = new Blob([workletCode], { type: 'application/javascript' });
                    await audioCtx.audioWorklet.addModule(URL.createObjectURL(blob));
                    const workletNode = new AudioWorkletNode(audioCtx, 'rec');
                    processorRef.current = workletNode;
                    workletNode.port.onmessage = (e) => chunksRef.current.push(e.data);
                    source.connect(workletNode);
                    workletNode.connect(audioCtx.destination);
                } catch {
                    // Fallback to ScriptProcessor
                    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
                    processorRef.current = processor;
                    processor.onaudioprocess = (e) => chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
                    source.connect(processor);
                    processor.connect(audioCtx.destination);
                }
            } else {
                const processor = audioCtx.createScriptProcessor(4096, 1, 1);
                processorRef.current = processor;
                processor.onaudioprocess = (e) => chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
                source.connect(processor);
                processor.connect(audioCtx.destination);
            }
            setIsRecording(true);
        } catch (err) {
            alert('Không thể truy cập mic: ' + err.message);
        }
    };

    const stopRecording = async () => {
        setIsRecording(false);
        const audioCtx = audioCtxRef.current;
        const actualSR = audioCtx?.sampleRate || 48000;
        processorRef.current?.disconnect();
        sourceRef.current?.disconnect();
        if (audioCtx) await audioCtx.close();

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
            for (let j = 0; j < newLen; j++) {
                const srcIdx = j / ratio, idx0 = Math.floor(srcIdx);
                const idx1 = Math.min(idx0 + 1, merged.length - 1);
                finalSamples[j] = merged[idx0] * (1 - srcIdx + idx0) + merged[idx1] * (srcIdx - idx0);
            }
        }

        const blob = encodeWAV(finalSamples, targetSR);
        const newRecordings = [...recordings, blob];
        setRecordings(newRecordings);

        if (currentSample < 5) {
            setCurrentSample(currentSample + 1);
        }

        // If all 5 done, submit
        if (newRecordings.length === 5) {
            setSubmitting(true);
            try {
                streamRef.current?.getTracks().forEach(t => t.stop());
                streamRef.current = null;
                const formData = new FormData();
                newRecordings.forEach((r, i) => formData.append('audio', r, `sample_${i}.wav`));
                await authAPI.voiceRegister(formData);
                alert('Đăng ký giọng nói thành công!');
            } catch (e) {
                alert('Lỗi: ' + e.message);
            }
            setSubmitting(false);
            setVoiceRegistering(false);
            setCurrentSample(0);
            setRecordings([]);
        }
    };

    const handleStart = () => {
        setVoiceRegistering(true);
        setCurrentSample(1);
        setRecordings([]);
    };

    const handleCancel = () => {
        if (isRecording) {
            processorRef.current?.disconnect();
            sourceRef.current?.disconnect();
            audioCtxRef.current?.close();
        }
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setVoiceRegistering(false);
        setIsRecording(false);
        setCurrentSample(0);
        setRecordings([]);
    };

    const sampleDone = recordings.length;
    const waitingToStart = voiceRegistering && !isRecording && sampleDone < 5;
    const allDone = sampleDone === 5;

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Đăng ký Giọng nói</h1>
                <p className="page-subtitle">Đăng ký voiceprint để đăng nhập bằng giọng nói</p>
            </div>

            {/* [B6] notice class thay inline styles */}
            <div className="notice notice-success">
                <span className="notice-icon">🎤</span>
                <div>
                    <strong>Dùng để làm gì?</strong> — Sau khi đăng ký, bạn có thể chọn{' '}
                    <strong>"Đăng nhập bằng Giọng nói"</strong> trên trang đăng nhập thay vì nhập mật khẩu.
                    Hệ thống sẽ nhận dạng giọng của bạn và tự động đăng nhập.
                </div>
            </div>

            <div className="card" style={{ maxWidth: 520 }}>
                <div className="card-header">
                    <div className="card-title"><FiMic size={15} color="var(--accent)" /> Đăng ký Giọng nói</div>
                </div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.875em', lineHeight: 1.6 }}>
                    Cần ghi <strong>5 mẫu giọng nói</strong>. Nhấn bắt đầu → nói rõ ràng → nhấn kết thúc cho mỗi lần.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 16 }}>
                    {/* Mic icon */}
                    <div style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: isRecording ? 'var(--danger-light)' : user?.voiceRegistered ? 'var(--success-light)' : 'var(--accent-light)',
                        border: `2px solid ${isRecording ? 'var(--danger)' : user?.voiceRegistered ? 'var(--success)' : 'var(--accent)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: isRecording ? 'pulseGlow 1s infinite' : 'none',
                    }}>
                        <FiMic size={30} color={isRecording ? 'var(--danger)' : user?.voiceRegistered ? 'var(--success)' : 'var(--accent)'} />
                    </div>

                    {/* Progress: sample indicators */}
                    {voiceRegistering && (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, marginBottom: 10 }}>
                                {isRecording ? `🔴 Đang ghi mẫu ${sampleDone + 1}/5...` :
                                    allDone ? '✅ Hoàn tất! Đang gửi...' :
                                        `Sẵn sàng ghi mẫu ${sampleDone + 1}/5`}
                            </div>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} style={{
                                        width: 32, height: 32, borderRadius: 8,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.8em', fontWeight: 700,
                                        background: i <= sampleDone ? 'var(--success)' :
                                            i === sampleDone + 1 && isRecording ? 'var(--danger)' :
                                                'var(--bg-card)',
                                        color: i <= sampleDone || (i === sampleDone + 1 && isRecording) ? '#fff' : 'var(--text-muted)',
                                        border: `1px solid ${i <= sampleDone ? 'var(--success)' :
                                            i === sampleDone + 1 ? 'var(--accent)' : 'var(--border)'}`,
                                        transition: 'all 0.3s',
                                    }}>
                                        {i <= sampleDone ? '✓' : i}
                                    </div>
                                ))}
                            </div>
                            {isRecording && (
                                <div style={{ fontSize: '0.8em', color: 'var(--danger)', fontWeight: 500 }}>
                                    🎙️ Hãy nói to và rõ ràng...
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status */}
                    <div style={{ fontWeight: 600, color: user?.voiceRegistered ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {user?.voiceRegistered
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FiCheckCircle size={15} /> Giọng nói đã đăng ký</span>
                            : !voiceRegistering ? 'Chưa đăng ký giọng nói' : null}
                    </div>
                </div>

                {/* Buttons */}
                {!voiceRegistering ? (
                    <button className="btn btn-primary btn-lg btn-block" onClick={handleStart}>
                        <FiMic size={16} />
                        {user?.voiceRegistered ? 'Đăng ký lại giọng nói' : 'Bắt đầu đăng ký'}
                    </button>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {!isRecording && sampleDone < 5 && (
                            <button className="btn btn-primary btn-lg btn-block" onClick={startRecording}>
                                <FiPlay size={16} />
                                Bắt đầu thu lần {sampleDone + 1}
                            </button>
                        )}
                        {isRecording && (
                            <button className="btn btn-danger btn-lg btn-block" onClick={stopRecording}>
                                <FiSquare size={16} />
                                Kết thúc thu lần {sampleDone + 1}
                            </button>
                        )}
                        {submitting && (
                            <div style={{ textAlign: 'center', color: 'var(--accent)', fontWeight: 600, padding: 10 }}>
                                ⏳ Đang xử lý và gửi mẫu giọng nói...
                            </div>
                        )}
                        {!isRecording && !submitting && (
                            <button className="btn btn-outline btn-block" onClick={handleCancel}
                                style={{ fontSize: '0.85em' }}>
                                Hủy đăng ký
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
