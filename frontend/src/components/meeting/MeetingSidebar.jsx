import React, { useRef, useEffect } from 'react';
import { FiMessageSquare, FiUsers, FiSend } from 'react-icons/fi';

/**
 * [B1] MeetingSidebar — Chat + Participants panel
 * Extracted from MeetingRoom.jsx
 */
export default function MeetingSidebar({
    mode, // 'chat' | 'participants'
    messages, chatInput, onChatChange, onSendChat,
    currentUser, participants, aiStates, stateColors,
}) {
    const chatScrollRef = useRef(null);

    useEffect(() => {
        if (chatScrollRef.current && mode === 'chat') {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [messages, mode]);

    const sidebarStyle = {
        width: 280, flexShrink: 0,
        background: '#0d1117',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
    };

    const headerStyle = {
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontWeight: 700, fontSize: '0.9em',
        display: 'flex', alignItems: 'center', gap: 8,
        flexShrink: 0,
    };

    if (mode === 'participants') {
        return (
            <div style={sidebarStyle}>
                <div style={headerStyle}>
                    <FiUsers size={15} /> Người tham gia ({participants.length + 1})
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                    {/* Current user */}
                    <div style={pItemStyle}>
                        <div style={pAvatarStyle}>{currentUser?.name?.[0]}</div>
                        <span style={{ flex: 1, fontSize: '0.85em' }}>{currentUser?.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>(Bạn)</span></span>
                        <span style={roleTagStyle}>{currentUser?.role === 'teacher' ? 'GV' : 'SV'}</span>
                    </div>
                    {/* Others */}
                    {participants.map(p => (
                        <div key={p.socketId} style={pItemStyle}>
                            <div style={pAvatarStyle}>{p.userName?.[0]}</div>
                            <span style={{ flex: 1, fontSize: '0.85em' }}>{p.userName}</span>
                            <span style={roleTagStyle}>{p.role === 'teacher' ? 'GV' : 'SV'}</span>
                            {aiStates[p.socketId] && currentUser?.role === 'teacher' && (
                                <span style={{
                                    fontSize: '0.72em', padding: '2px 6px', borderRadius: 4,
                                    background: stateColors[aiStates[p.socketId].state] + '33',
                                    color: stateColors[aiStates[p.socketId].state],
                                }}>
                                    {aiStates[p.socketId].state}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Chat mode
    return (
        <div style={sidebarStyle}>
            <div style={headerStyle}>
                <FiMessageSquare size={15} /> Chat
            </div>
            <div ref={chatScrollRef} style={{
                flex: 1, overflowY: 'auto', padding: 12,
                display: 'flex', flexDirection: 'column', gap: 8,
            }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8em', marginTop: 20 }}>
                        Chưa có tin nhắn nào
                    </div>
                )}
                {messages.map((m, i) => {
                    const isMe = m.userId === currentUser?._id;
                    return (
                        <div key={i} style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            background: isMe ? 'var(--accent)' : 'var(--bg-card)',
                            borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                            padding: '8px 12px',
                        }}>
                            <div style={{ fontSize: '0.68em', color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', marginBottom: 3 }}>
                                {m.userName} · {new Date(m.timestamp).toLocaleTimeString('vi')}
                            </div>
                            <div style={{ fontSize: '0.85em' }}>{m.message}</div>
                        </div>
                    );
                })}
            </div>
            <div style={{
                padding: '10px 12px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', gap: 8, flexShrink: 0,
            }}>
                <input
                    style={{
                        flex: 1, background: 'var(--bg-secondary)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                        padding: '8px 12px', color: '#fff', fontSize: '0.85em',
                        outline: 'none',
                    }}
                    placeholder="Nhập tin nhắn..."
                    value={chatInput}
                    onChange={e => onChatChange(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendChat(); } }}
                />
                <button
                    onClick={onSendChat}
                    disabled={!chatInput.trim()}
                    style={{
                        background: 'var(--accent)', border: 'none', borderRadius: 8,
                        padding: '8px 12px', cursor: 'pointer', color: '#fff',
                        display: 'flex', alignItems: 'center',
                        opacity: chatInput.trim() ? 1 : 0.5,
                    }}
                    aria-label="Gửi tin nhắn"
                >
                    <FiSend size={16} />
                </button>
            </div>
        </div>
    );
}

const pItemStyle = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 16px', fontSize: '0.875em',
};

const pAvatarStyle = {
    width: 28, height: 28, borderRadius: '50%',
    background: 'var(--accent-light)', color: 'var(--accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: '0.85em', flexShrink: 0,
};

const roleTagStyle = {
    fontSize: '0.68em', fontWeight: 700,
    padding: '2px 6px', borderRadius: 4,
    background: 'rgba(255,255,255,0.07)',
    color: 'var(--text-muted)',
};
