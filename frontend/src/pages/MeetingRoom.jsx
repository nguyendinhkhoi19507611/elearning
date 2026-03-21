import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { classroomsAPI, aiAPI } from '../api/api';
import { io } from 'socket.io-client';
import {
    FiMic, FiMicOff, FiVideo, FiVideoOff, FiMonitor,
    FiMessageSquare, FiUsers, FiPhoneOff, FiSend,
    FiAlertTriangle, FiMaximize2, FiMinimize2
} from 'react-icons/fi';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

// Socket connects via same-origin (Vite proxy forwards /socket.io → backend)

export default function MeetingRoom() {
    const { classroomId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [classroom, setClassroom] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [localStream, setLocalStream] = useState(null);
    const [screenStream, setScreenStream] = useState(null);
    const [micOn, setMicOn] = useState(false);
    const [camOn, setCamOn] = useState(false);
    const [sharing, setSharing] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [participantList, setParticipantList] = useState(false);
    const [aiStates, setAiStates] = useState({});
    const [pinned, setPinned] = useState(null);
    const [mediaError, setMediaError] = useState('');
    const [socketReady, setSocketReady] = useState(false);
    const [leaveModal, setLeaveModal] = useState(false);
    const [audioUnlocked, setAudioUnlocked] = useState(false);

    const socketRef = useRef(null);
    const peersRef = useRef({});
    const remoteStreamsRef = useRef({});
    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null); // Keep ref in sync for callbacks
    const aiIntervalRef = useRef(null);
    const canvasRef = useRef(null);

    // Keep localStreamRef in sync
    useEffect(() => {
        localStreamRef.current = localStream;
    }, [localStream]);

    // ── Step 1: Load classroom info ──
    useEffect(() => {
        let mounted = true;
        const loadClassroom = async () => {
            try {
                const res = await classroomsAPI.getById(classroomId);
                if (mounted) setClassroom(res.data);
            } catch {
                navigate('/');
            }
        };
        loadClassroom();
        return () => { mounted = false; };
    }, [classroomId]);

    // ── Step 2: Acquire media (camera + mic) ──
    useEffect(() => {
        let mounted = true;
        let acquiredStreams = []; // track all streams acquired

        const acquireMedia = async () => {
            // Check if mediaDevices API is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setMediaError('Trình duyệt không hỗ trợ camera/mic trên kết nối HTTP. Hãy dùng HTTPS hoặc localhost.');
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: 'user' },
                    audio: true
                });
                acquiredStreams.push(stream);
                if (mounted) {
                    setLocalStream(stream);
                    setCamOn(true);
                    setMicOn(true);
                    setMediaError('');
                    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                } else {
                    // Component unmounted before stream was ready - stop immediately
                    stream.getTracks().forEach(t => t.stop());
                }
            } catch (err) {
                console.warn('Camera+Audio không khả dụng:', err);
                // Try audio only
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    acquiredStreams.push(audioStream);
                    if (mounted) {
                        setLocalStream(audioStream);
                        setCamOn(false);
                        setMicOn(true);
                        setMediaError('Camera không khả dụng, chỉ có mic.');
                    } else {
                        audioStream.getTracks().forEach(t => t.stop());
                    }
                } catch (err2) {
                    console.warn('Audio cũng không khả dụng:', err2);
                    if (mounted) {
                        setCamOn(false);
                        setMicOn(false);
                        setMediaError('Không thể truy cập camera/mic. Kiểm tra quyền truy cập trình duyệt.');
                    }
                }
            }
        };
        acquireMedia();

        return () => {
            mounted = false;
            // ❌ Stop ALL acquired tracks so camera/mic light turns off immediately
            acquiredStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
            // Also clear the video element srcObject
            if (localVideoRef.current) localVideoRef.current.srcObject = null;
            localStreamRef.current = null;
        };
    }, [classroomId]);

    // ── Step 3: Socket connection (NOT dependent on localStream) ──
    useEffect(() => {
        if (!user || !classroom) return;

        // Connect via same origin — Vite proxy forwards /socket.io to backend
        const socket = io({
            transports: ['websocket', 'polling'],
            forceNew: true,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('✅ Socket connected:', socket.id);
            setSocketReady(true);

            socket.emit('joinMeeting', {
                classroomId, userId: user._id, userName: user.name, role: user.role
            });
        });

        socket.on('connect_error', (err) => {
            console.error('❌ Socket connection error:', err.message);
        });

        // Receive existing participants → create offers
        socket.on('existingParticipants', (existing) => {
            existing.forEach(p => createPeerConnection(p.socketId, p, true));
            setParticipants(existing);
        });

        // New participant joined
        socket.on('participantJoined', (p) => {
            setParticipants(prev => [...prev.filter(x => x.socketId !== p.socketId), p]);
            createPeerConnection(p.socketId, p, false);
        });

        // Participant left
        socket.on('participantLeft', ({ socketId }) => {
            setParticipants(prev => prev.filter(p => p.socketId !== socketId));
            if (peersRef.current[socketId]) {
                peersRef.current[socketId].close();
                delete peersRef.current[socketId];
            }
            delete remoteStreamsRef.current[socketId];
            setAiStates(prev => { const n = { ...prev }; delete n[socketId]; return n; });
        });

        // WebRTC offer
        socket.on('offer', async ({ from, offer, user: u }) => {
            const pc = peersRef.current[from] || createPeerConnection(from, u, false);
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('answer', { to: from, answer });
            } catch (err) {
                console.error('Error handling offer:', err);
            }
        });

        // WebRTC answer
        socket.on('answer', async ({ from, answer }) => {
            const pc = peersRef.current[from];
            if (pc) {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (err) {
                    console.error('Error handling answer:', err);
                }
            }
        });

        // ICE candidate
        socket.on('iceCandidate', ({ from, candidate }) => {
            const pc = peersRef.current[from];
            if (pc && candidate) {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
            }
        });

        // Media toggle from remote
        socket.on('participantMediaToggle', ({ socketId, type, enabled }) => {
            setParticipants(prev => prev.map(p =>
                p.socketId === socketId ? { ...p, [type + 'On']: enabled } : p
            ));
        });

        // Screen share update
        socket.on('screenShareUpdate', ({ socketId, userName, active }) => {
            if (active) setPinned(socketId);
            else setPinned(prev => prev === socketId ? null : prev);
        });

        // Chat
        socket.on('meetingChat', (msg) => {
            setMessages(prev => [...prev, msg]);
        });

        // AI state from other students (teacher sees)
        socket.on('studentAIState', ({ socketId, userId, userName, state, confidence }) => {
            setAiStates(prev => ({
                ...prev,
                [socketId]: { userId, userName, state, confidence, timestamp: Date.now() }
            }));
        });

        // Meeting ended by teacher
        socket.on('meetingEnded', () => {
            alert('Buổi học đã kết thúc.');
            navigate('/');
        });

        return () => {
            socket.emit('leaveMeeting', { classroomId });
            socket.disconnect();
            Object.values(peersRef.current).forEach(pc => pc.close());
            peersRef.current = {};
            remoteStreamsRef.current = {};
            setSocketReady(false);
        };
    }, [user, classroom, classroomId]);

    // ── Step 4: When localStream becomes available, add tracks to existing peers ──
    useEffect(() => {
        if (!localStream) return;
        // Add tracks to any existing peer connections
        Object.entries(peersRef.current).forEach(([socketId, pc]) => {
            const senders = pc.getSenders();
            if (senders.length === 0) {
                localStream.getTracks().forEach(track => {
                    pc.addTrack(track, localStream);
                });
                // Re-negotiate
                pc.createOffer().then(offer => {
                    pc.setLocalDescription(offer);
                    socketRef.current?.emit('offer', { to: socketId, offer });
                }).catch(console.error);
            }
        });

        // ❌ Cleanup: stop tracks if useEffect re-runs (e.g. stream replaced)
        return () => {
            // We do NOT stop here because the stream might still be active.
            // Tracks are stopped in the acquireMedia cleanup or confirmLeave.
        };
    }, [localStream]);

    // ── Create peer connection ──
    const createPeerConnection = useCallback((socketId, participantInfo, createOffer) => {
        if (peersRef.current[socketId]) return peersRef.current[socketId];

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peersRef.current[socketId] = pc;

        // Add local tracks if available
        const stream = localStreamRef.current;
        if (stream) {
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
        }

        // Handle remote tracks
        pc.ontrack = (event) => {
            const remoteStream = event.streams[0];
            remoteStreamsRef.current[socketId] = remoteStream;
            // Force re-render
            setParticipants(prev => [...prev]);
        };

        // ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && socketRef.current) {
                socketRef.current.emit('iceCandidate', {
                    to: socketId, candidate: event.candidate
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`ICE state [${socketId}]:`, pc.iceConnectionState);
        };

        // Create offer if we're the initiator
        if (createOffer) {
            pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
                .then(offer => {
                    pc.setLocalDescription(offer);
                    socketRef.current?.emit('offer', { to: socketId, offer });
                })
                .catch(console.error);
        }

        return pc;
    }, []);

    // ── AI monitoring (students only) ──
    useEffect(() => {
        if (!localStream || user?.role !== 'student') return;
        // Only run AI if we have video tracks
        if (localStream.getVideoTracks().length === 0) return;

        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 240;
        const ctx = canvas.getContext('2d');
        canvasRef.current = canvas;

        aiIntervalRef.current = setInterval(async () => {
            if (!localVideoRef.current || !socketRef.current) return;
            try {
                ctx.drawImage(localVideoRef.current, 0, 0, 320, 240);
                const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                const res = await aiAPI.detectBase64({ image: base64 });
                const state = res.data?.primary_state?.class_name || 'unknown';
                const conf = res.data?.primary_state?.confidence || 0;
                socketRef.current.emit('meetingAIState', {
                    classroomId, state, confidence: conf
                });
            } catch { }
        }, 5000);

        return () => clearInterval(aiIntervalRef.current);
    }, [localStream, user, classroomId]);

    // ── Toggle mic ──
    const toggleMic = async () => {
        if (localStream && localStream.getAudioTracks().length > 0) {
            // Toggle existing audio tracks
            const newState = !micOn;
            localStream.getAudioTracks().forEach(t => t.enabled = newState);
            setMicOn(newState);
            socketRef.current?.emit('mediaToggle', { classroomId, type: 'mic', enabled: newState });
        } else {
            // Try to acquire mic
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (localStream) {
                    // Add audio track to existing stream
                    audioStream.getAudioTracks().forEach(track => {
                        localStream.addTrack(track);
                        // Add to all peer connections
                        Object.values(peersRef.current).forEach(pc => {
                            pc.addTrack(track, localStream);
                        });
                    });
                } else {
                    setLocalStream(audioStream);
                }
                setMicOn(true);
                setMediaError('');
                socketRef.current?.emit('mediaToggle', { classroomId, type: 'mic', enabled: true });
            } catch (err) {
                alert('Không thể bật mic: ' + err.message);
            }
        }
    };

    // ── Toggle camera ──
    const toggleCam = async () => {
        if (localStream && localStream.getVideoTracks().length > 0) {
            // Toggle existing video tracks
            const newState = !camOn;
            localStream.getVideoTracks().forEach(t => t.enabled = newState);
            setCamOn(newState);
            socketRef.current?.emit('mediaToggle', { classroomId, type: 'camera', enabled: newState });
        } else {
            // Try to acquire camera
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: 'user' }
                });
                const videoTrack = videoStream.getVideoTracks()[0];
                if (localStream) {
                    localStream.addTrack(videoTrack);
                    // Add to all peer connections
                    Object.values(peersRef.current).forEach(pc => {
                        pc.addTrack(videoTrack, localStream);
                    });
                } else {
                    setLocalStream(videoStream);
                }
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = localStream || videoStream;
                }
                setCamOn(true);
                setMediaError('');
                socketRef.current?.emit('mediaToggle', { classroomId, type: 'camera', enabled: true });
            } catch (err) {
                alert('Không thể bật camera: ' + err.message);
            }
        }
    };

    // ── Screen share ──
    const toggleScreenShare = async () => {
        if (sharing) {
            screenStream?.getTracks().forEach(t => t.stop());
            setScreenStream(null);
            setSharing(false);
            const videoTrack = localStream?.getVideoTracks()[0];
            if (videoTrack) {
                Object.values(peersRef.current).forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(videoTrack);
                });
            }
            socketRef.current?.emit('screenShare', { classroomId, active: false });
        } else {
            try {
                const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
                setScreenStream(screen);
                setSharing(true);

                const screenTrack = screen.getVideoTracks()[0];
                Object.values(peersRef.current).forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(screenTrack);
                });

                screenTrack.onended = () => toggleScreenShare();
                socketRef.current?.emit('screenShare', { classroomId, active: true });
            } catch { }
        }
    };

    // ── Leave / End meeting ──
    const leaveMeeting = () => setLeaveModal(true);

    const confirmLeave = async (endForAll) => {
        // Use REF (not state) to avoid stale closure - always gets current stream
        const stream = localStreamRef.current;
        if (stream) {
            stream.getTracks().forEach(t => {
                t.stop();
                console.log('[MeetingRoom] Stopped track:', t.kind, t.label);
            });
        }
        // Stop screen share too
        screenStream?.getTracks().forEach(t => t.stop());
        setScreenStream(null);

        // Clear video element so browser releases camera
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }

        if (endForAll && (user?.role === 'teacher' || user?.role === 'admin')) {
            try { await classroomsAPI.endMeeting(classroomId); } catch (e) { console.error(e); }
        }
        navigate(user?.role === 'admin' ? '/admin/classrooms'
            : user?.role === 'teacher' ? '/teacher/classrooms'
                : '/student/classrooms');
    };

    // Unlock audio on desktop (autoplay policy)
    const unlockAudio = () => {
        document.querySelectorAll('video').forEach(v => {
            v.muted = false;
            v.play().catch(() => { });
        });
        setAudioUnlocked(true);
    };

    // ── Send chat ──
    const sendChat = () => {
        if (!chatInput.trim()) return;
        socketRef.current?.emit('meetingChat', { classroomId, message: chatInput.trim() });
        setChatInput('');
    };

    const stateColors = {
        focused: '#22c55e', distracted: '#f97316', drowsy: '#ef4444',
        absent: '#6b7280', phone_usage: '#a855f7'
    };
    const stateLabels = {
        focused: 'Tập trung', distracted: 'Mất tập trung', drowsy: 'Buồn ngủ',
        absent: 'Vắng mặt', phone_usage: 'Dùng ĐT'
    };

    return (
        <>
            <div style={styles.container}>
                {/* Top bar */}
                <div style={styles.topBar}>
                    <div style={styles.topLeft}>
                        <span style={{ fontSize: '1.2em', fontWeight: 700 }}>
                            📹 {classroom?.name || 'Phòng học'}
                        </span>
                        <span style={styles.badge}>{classroom?.subject}</span>
                        <span style={{ ...styles.badge, background: '#22c55e33', color: '#22c55e' }}>
                            🟢 LIVE
                        </span>
                        {!socketReady && (
                            <span style={{ ...styles.badge, background: '#f9731633', color: '#f97316' }}>
                                ⏳ Đang kết nối...
                            </span>
                        )}
                    </div>
                    <div style={styles.topRight}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>
                            {participants.length + 1} người tham gia
                        </span>
                    </div>
                </div>

                {/* Audio unlock button - desktop autoplay policy */}
                {!audioUnlocked && participants.length > 0 && (
                    <div style={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                        <button onClick={unlockAudio} style={{
                            background: 'rgba(59,130,246,0.9)', color: '#fff', border: 'none', borderRadius: 10,
                            padding: '8px 18px', cursor: 'pointer', fontSize: '0.85em', fontWeight: 600,
                            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 6
                        }}>
                            🔊 Bấm để nghe âm thanh
                        </button>
                    </div>
                )}

                {mediaError && (
                    <div style={styles.mediaErrorBar}>
                        ⚠️ {mediaError}
                    </div>
                )}

                {/* Main area */}
                <div style={styles.mainArea}>
                    {/* Video grid */}
                    <div style={styles.videoGrid}>
                        {/* Local video */}
                        <div style={{
                            ...styles.videoCard,
                            ...(pinned === 'local' ? styles.pinnedVideo : {}),
                            border: '2px solid var(--accent)',
                        }} onClick={() => setPinned(pinned === 'local' ? null : 'local')}>
                            <video ref={localVideoRef} autoPlay muted playsInline
                                style={styles.video} />
                            <div style={styles.videoLabel}>
                                <span>🙋 {user?.name} (Bạn)</span>
                                <span style={styles.roleTag}>
                                    {user?.role === 'teacher' ? '👨‍🏫 GV' : '🎓 SV'}
                                </span>
                            </div>
                            {!camOn && <div style={styles.videoOff}><FiVideoOff size={40} /></div>}
                            {!micOn && <div style={styles.micOffBadge}><FiMicOff size={12} /></div>}
                        </div>

                        {/* Remote videos */}
                        {participants.map(p => (
                            <div key={p.socketId} style={{
                                ...styles.videoCard,
                                ...(pinned === p.socketId ? styles.pinnedVideo : {}),
                            }} onClick={() => setPinned(pinned === p.socketId ? null : p.socketId)}>
                                <RemoteVideo socketId={p.socketId}
                                    stream={remoteStreamsRef.current[p.socketId]} />
                                <div style={styles.videoLabel}>
                                    <span>{p.userName}</span>
                                    <span style={styles.roleTag}>
                                        {p.role === 'teacher' ? '👨‍🏫 GV' : '🎓 SV'}
                                    </span>
                                </div>
                                {/* AI state badge for students (visible to teacher) */}
                                {aiStates[p.socketId] && user?.role === 'teacher' && (
                                    <div style={{
                                        ...styles.aiBadge,
                                        background: stateColors[aiStates[p.socketId].state] + '33',
                                        color: stateColors[aiStates[p.socketId].state],
                                        border: `1px solid ${stateColors[aiStates[p.socketId].state]}55`
                                    }}>
                                        {stateLabels[aiStates[p.socketId].state] || aiStates[p.socketId].state}
                                        {' '}({Math.round(aiStates[p.socketId].confidence * 100)}%)
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Sidebar: Chat / Participants */}
                    {(chatOpen || participantList) && (
                        <div style={styles.sidebar}>
                            {participantList ? (
                                <>
                                    <div style={styles.sidebarHeader}>
                                        <FiUsers /> Người tham gia ({participants.length + 1})
                                    </div>
                                    <div style={styles.sidebarBody}>
                                        <div style={styles.participantItem}>
                                            <div style={styles.pAvatar}>{user?.name?.[0]}</div>
                                            <span>{user?.name} (Bạn)</span>
                                            <span style={styles.roleTag}>{user?.role === 'teacher' ? 'GV' : 'SV'}</span>
                                        </div>
                                        {participants.map(p => (
                                            <div key={p.socketId} style={styles.participantItem}>
                                                <div style={styles.pAvatar}>{p.userName?.[0]}</div>
                                                <span>{p.userName}</span>
                                                <span style={styles.roleTag}>{p.role === 'teacher' ? 'GV' : 'SV'}</span>
                                                {aiStates[p.socketId] && user?.role === 'teacher' && (
                                                    <span style={{
                                                        marginLeft: 'auto', fontSize: '0.75em', padding: '2px 6px',
                                                        borderRadius: 4,
                                                        background: stateColors[aiStates[p.socketId].state] + '33',
                                                        color: stateColors[aiStates[p.socketId].state]
                                                    }}>
                                                        {stateLabels[aiStates[p.socketId].state]}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={styles.sidebarHeader}><FiMessageSquare /> Chat</div>
                                    <div style={styles.chatMessages}>
                                        {messages.map((m, i) => (
                                            <div key={i} style={{
                                                ...styles.chatMsg,
                                                alignSelf: m.userId === user?._id ? 'flex-end' : 'flex-start',
                                                background: m.userId === user?._id ? 'var(--accent)' : 'var(--bg-card)',
                                            }}>
                                                <div style={{ fontSize: '0.7em', color: 'var(--text-muted)', marginBottom: 2 }}>
                                                    {m.userName} • {new Date(m.timestamp).toLocaleTimeString('vi')}
                                                </div>
                                                {m.message}
                                            </div>
                                        ))}
                                    </div>
                                    <div style={styles.chatInputArea}>
                                        <input style={styles.chatTextInput} value={chatInput}
                                            onChange={e => setChatInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && sendChat()}
                                            placeholder="Nhập tin nhắn..." />
                                        <button style={styles.chatSendBtn} onClick={sendChat}>
                                            <FiSend />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* AI monitoring warning (for teacher) */}
                {user?.role === 'teacher' && Object.values(aiStates).some(s =>
                    s.state !== 'focused' && Date.now() - s.timestamp < 10000
                ) && (
                        <div style={styles.warningBar}>
                            <FiAlertTriangle /> Cảnh báo: Có sinh viên không tập trung!
                            {Object.values(aiStates).filter(s => s.state !== 'focused').map((s, i) => (
                                <span key={i} style={{ marginLeft: 12, fontWeight: 600 }}>
                                    {s.userName}: {stateLabels[s.state]}
                                </span>
                            ))}
                        </div>
                    )}

                {/* Bottom controls */}
                <div style={styles.controls}>
                    <button style={{ ...styles.ctrlBtn, background: micOn ? 'var(--bg-card)' : '#ef4444' }}
                        onClick={toggleMic} title={micOn ? 'Tắt mic' : 'Bật mic'}>
                        {micOn ? <FiMic size={20} /> : <FiMicOff size={20} />}
                    </button>
                    <button style={{ ...styles.ctrlBtn, background: camOn ? 'var(--bg-card)' : '#ef4444' }}
                        onClick={toggleCam} title={camOn ? 'Tắt camera' : 'Bật camera'}>
                        {camOn ? <FiVideo size={20} /> : <FiVideoOff size={20} />}
                    </button>
                    {(user?.role === 'teacher' || user?.role === 'admin') && (
                        <button style={{ ...styles.ctrlBtn, background: sharing ? '#3b82f6' : 'var(--bg-card)' }}
                            onClick={toggleScreenShare} title="Chia sẻ màn hình">
                            <FiMonitor size={20} />
                        </button>
                    )}
                    <button style={{ ...styles.ctrlBtn, background: chatOpen ? 'var(--accent)' : 'var(--bg-card)' }}
                        onClick={() => { setChatOpen(!chatOpen); setParticipantList(false); }}>
                        <FiMessageSquare size={20} />
                        {messages.length > 0 && <span style={styles.chatBadge}>{messages.length}</span>}
                    </button>
                    <button style={{ ...styles.ctrlBtn, background: participantList ? 'var(--accent)' : 'var(--bg-card)' }}
                        onClick={() => { setParticipantList(!participantList); setChatOpen(false); }}>
                        <FiUsers size={20} />
                    </button>
                    <button style={{ ...styles.ctrlBtn, background: '#ef4444', color: '#fff' }}
                        onClick={leaveMeeting}>
                        <FiPhoneOff size={20} />
                    </button>
                </div>
            </div>

            {/* ── Leave / End Meeting Modal ── */}
            {leaveModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(8px)' }}>
                    <div style={{ background: '#1a1a2e', border: '1px solid #ffffff20', borderRadius: 16, padding: 32, width: 360, maxWidth: 'calc(100vw - 32px)', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5em', marginBottom: 12 }}>📴</div>
                        <div style={{ fontWeight: 700, fontSize: '1.1em', marginBottom: 8 }}>Rời phòng học?</div>
                        {(user?.role === 'teacher' || user?.role === 'admin') ? (
                            <>
                                <p style={{ color: '#999', fontSize: '0.85em', marginBottom: 20, lineHeight: 1.6 }}>
                                    Bạn có thể rời phòng hoặc kết thúc buổi học cho tất cả sinh viên.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <button onClick={() => confirmLeave(true)} style={{
                                        background: '#ef4444', border: 'none', borderRadius: 10, padding: '12px 20px',
                                        color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.95em'
                                    }}>🏁 Kết thúc buổi học (tất cả)</button>
                                    <button onClick={() => confirmLeave(false)} style={{
                                        background: '#374151', border: 'none', borderRadius: 10, padding: '12px 20px',
                                        color: '#fff', cursor: 'pointer', fontSize: '0.9em'
                                    }}>🚪 Chỉ rời phòng</button>
                                    <button onClick={() => setLeaveModal(false)} style={{
                                        background: 'transparent', border: '1px solid #ffffff30', borderRadius: 10,
                                        padding: '10px 20px', color: '#999', cursor: 'pointer', fontSize: '0.85em'
                                    }}>Hủy</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p style={{ color: '#999', fontSize: '0.85em', marginBottom: 20 }}>Bạn có muốn rời khỏi lớp học không?</p>
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                    <button onClick={() => confirmLeave(false)} style={{
                                        background: '#ef4444', border: 'none', borderRadius: 10, padding: '12px 24px',
                                        color: '#fff', cursor: 'pointer', fontWeight: 700
                                    }}>Rời phòng</button>
                                    <button onClick={() => setLeaveModal(false)} style={{
                                        background: '#374151', border: 'none', borderRadius: 10, padding: '12px 24px',
                                        color: '#fff', cursor: 'pointer'
                                    }}>Ở lại</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>);
}

// RemoteVideo component - plays both video AND audio from remote stream
function RemoteVideo({ socketId, stream }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            // Ensure audio plays - handle autoplay policy
            videoRef.current.play().catch(err => {
                console.warn('Autoplay blocked, will play on interaction:', err);
            });
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
                width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8
            }}
        />
    );
}

// ── Styles ──
const styles = {
    container: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: '#0f0f1a', color: '#fff', display: 'flex', flexDirection: 'column',
        zIndex: 9999, fontFamily: "'Inter', sans-serif",
    },
    topBar: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 20px', background: '#1a1a2e', borderBottom: '1px solid #ffffff15',
    },
    topLeft: { display: 'flex', alignItems: 'center', gap: 10 },
    topRight: { display: 'flex', alignItems: 'center', gap: 10 },
    badge: {
        background: '#ffffff15', padding: '2px 10px', borderRadius: 20,
        fontSize: '0.75em', color: 'var(--text-muted, #999)',
    },
    mediaErrorBar: {
        background: '#f9731633', color: '#f97316', padding: '8px 20px',
        fontSize: '0.85em', fontWeight: 600, textAlign: 'center',
        borderBottom: '1px solid #f9731666',
    },
    mainArea: { flex: 1, display: 'flex', overflow: 'hidden', padding: 8, gap: 8 },
    videoGrid: {
        flex: 1, display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 8, alignContent: 'start', overflow: 'auto', padding: 4,
    },
    videoCard: {
        position: 'relative', background: '#1a1a2e', borderRadius: 12,
        overflow: 'hidden', aspectRatio: '16/10',
        border: '1px solid #ffffff10', cursor: 'pointer',
        transition: 'all 0.3s ease',
    },
    pinnedVideo: {
        gridColumn: '1 / -1', aspectRatio: '16/9', maxHeight: '70vh',
    },
    video: {
        width: '100%', height: '100%', objectFit: 'cover',
        transform: 'scaleX(-1)', borderRadius: 8,
    },
    videoLabel: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '6px 12px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', fontSize: '0.8em',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
    },
    roleTag: {
        background: '#ffffff20', padding: '1px 6px', borderRadius: 4,
        fontSize: '0.75em',
    },
    videoOff: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#1a1a2e', color: '#666',
    },
    micOffBadge: {
        position: 'absolute', top: 8, right: 8,
        background: '#ef4444', borderRadius: '50%', padding: 4,
        display: 'flex', alignItems: 'center',
    },
    aiBadge: {
        position: 'absolute', top: 8, left: 8,
        padding: '3px 10px', borderRadius: 6, fontSize: '0.72em',
        fontWeight: 600, backdropFilter: 'blur(8px)',
    },
    sidebar: {
        width: 300, background: '#1a1a2e', borderRadius: 12,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: '1px solid #ffffff10',
    },
    sidebarHeader: {
        padding: '12px 16px', fontWeight: 600, fontSize: '0.9em',
        borderBottom: '1px solid #ffffff10', display: 'flex', alignItems: 'center', gap: 8,
    },
    sidebarBody: { flex: 1, overflow: 'auto', padding: 8 },
    participantItem: {
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
        borderRadius: 8, fontSize: '0.85em',
    },
    pAvatar: {
        width: 28, height: 28, borderRadius: '50%', background: 'var(--accent, #3b82f6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '0.8em',
    },
    chatMessages: {
        flex: 1, overflow: 'auto', padding: 10,
        display: 'flex', flexDirection: 'column', gap: 6,
    },
    chatMsg: {
        padding: '6px 10px', borderRadius: 10, fontSize: '0.82em',
        maxWidth: '85%',
    },
    chatInputArea: {
        display: 'flex', padding: 8, gap: 6,
        borderTop: '1px solid #ffffff10',
    },
    chatTextInput: {
        flex: 1, background: '#0f0f1a', border: '1px solid #ffffff20',
        borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: '0.85em',
        outline: 'none',
    },
    chatSendBtn: {
        background: 'var(--accent, #3b82f6)', border: 'none', borderRadius: 8,
        padding: '8px 12px', color: '#fff', cursor: 'pointer',
        display: 'flex', alignItems: 'center',
    },
    warningBar: {
        background: '#f9731633', color: '#f97316', padding: '8px 20px',
        display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85em',
        fontWeight: 600, borderTop: '1px solid #f97316',
    },
    controls: {
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 12, padding: '12px 20px', background: '#1a1a2e',
        borderTop: '1px solid #ffffff15',
    },
    ctrlBtn: {
        position: 'relative', border: 'none', borderRadius: 12,
        padding: '12px 16px', cursor: 'pointer', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease',
    },
    chatBadge: {
        position: 'absolute', top: -4, right: -4,
        background: '#ef4444', borderRadius: '50%', width: 18, height: 18,
        fontSize: '0.65em', display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
};
