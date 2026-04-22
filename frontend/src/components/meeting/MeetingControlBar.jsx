import React from 'react';
import {
    FiMic, FiMicOff, FiVideo, FiVideoOff, FiMonitor,
    FiMessageSquare, FiUsers, FiPhoneOff,
    FiCircle, FiStopCircle
} from 'react-icons/fi';

/**
 * [B1] MeetingControlBar — thanh điều khiển phía dưới MeetingRoom
 * Extracted from MeetingRoom.jsx
 */
export default function MeetingControlBar({
    userRole,
    micOn, camOn, sharing, recording, uploadingRec,
    chatOpen, participantList, messageCount,
    recordingTime,
    onToggleMic, onToggleCam, onToggleScreen,
    onStartRecording, onStopRecording,
    onToggleChat, onToggleParticipants,
    onLeave,
}) {
    const isTeacher = userRole === 'teacher' || userRole === 'admin';

    const ctrlStyle = (active, color) => ({
        width: 48, height: 48, borderRadius: 12,
        border: 'none', cursor: 'pointer',
        background: active ? (color || 'var(--accent)') : 'rgba(255, 255, 255, 0.15)',
        color: active ? '#fff' : 'rgba(255, 255, 255, 0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease',
        position: 'relative', flexShrink: 0,
    });

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    return (
        <div style={{
            height: 72, flexShrink: 0,
            background: '#0d1117',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 10, padding: '0 20px',
        }}>
            {/* Mic */}
            <button style={ctrlStyle(micOn, null)} className={micOn ? '' : 'ctrl-active-danger'}
                onClick={onToggleMic} title={micOn ? 'Tắt mic' : 'Bật mic'}
                aria-label={micOn ? 'Tắt mic' : 'Bật mic'}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
                {micOn ? <FiMic size={20} /> : <FiMicOff size={20} />}
            </button>

            {/* Camera */}
            <button style={ctrlStyle(camOn, null)}
                onClick={onToggleCam} title={camOn ? 'Tắt camera' : 'Bật camera'}
                aria-label={camOn ? 'Tắt camera' : 'Bật camera'}
            >
                {camOn ? <FiVideo size={20} /> : <FiVideoOff size={20} />}
            </button>

            {/* Screen share — teacher only */}
            {isTeacher && (
                <button style={ctrlStyle(sharing, '#3b82f6')}
                    onClick={onToggleScreen} title="Chia sẻ màn hình"
                    aria-label="Chia sẻ màn hình"
                >
                    <FiMonitor size={20} />
                </button>
            )}

            {/* Record — teacher only */}
            {isTeacher && (
                <button
                    style={{
                        ...ctrlStyle(recording, '#dc2626'),
                        animation: recording ? 'pulseGlow 1.5s infinite' : 'none',
                    }}
                    onClick={recording ? onStopRecording : onStartRecording}
                    disabled={uploadingRec}
                    title={recording ? 'Dừng ghi hình' : 'Ghi hình buổi học'}
                    aria-label={recording ? 'Dừng ghi hình' : 'Ghi hình'}
                >
                    {uploadingRec ? (
                        <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    ) : recording ? (
                        <FiStopCircle size={20} />
                    ) : (
                        <FiCircle size={20} style={{ fill: '#ef4444', color: '#ef4444' }} />
                    )}
                </button>
            )}

            {/* Recording timer */}
            {recording && (
                <span style={{
                    fontSize: '0.78em', fontWeight: 700, color: '#ef4444',
                    background: 'rgba(239,68,68,0.12)', padding: '4px 10px',
                    borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)',
                    fontVariantNumeric: 'tabular-nums',
                }}>
                    ● {formatTime(recordingTime)}
                </span>
            )}

            {/* Chat */}
            <button style={ctrlStyle(chatOpen, 'var(--accent)')}
                onClick={onToggleChat}
                aria-label="Chat"
            >
                <FiMessageSquare size={20} />
                {messageCount > 0 && (
                    <span style={{
                        position: 'absolute', top: -4, right: -4,
                        background: '#ef4444', color: '#fff',
                        fontSize: '0.6em', fontWeight: 700,
                        width: 16, height: 16, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{messageCount}</span>
                )}
            </button>

            {/* Participants */}
            <button style={ctrlStyle(participantList, 'var(--accent)')}
                onClick={onToggleParticipants}
                aria-label="Danh sách tham gia"
            >
                <FiUsers size={20} />
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.1)', margin: '0 6px' }} />

            {/* Leave */}
            <button style={{ ...ctrlStyle(true, '#ef4444'), border: 'none' }}
                onClick={onLeave}
                aria-label="Rời phòng"
            >
                <FiPhoneOff size={20} />
            </button>
        </div>
    );
}
