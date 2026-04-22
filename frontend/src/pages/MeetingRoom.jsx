import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { classroomsAPI, aiAPI } from '../api/api';
import { io } from 'socket.io-client';
import FaceVerifyModal from '../components/FaceVerifyModal';
import AttendancePanel from '../components/AttendancePanel';
// [B1] Extracted sub-components
import FaceGate from '../components/meeting/FaceGate';
import { AttendanceBanner, AttendanceSuccessBanner } from '../components/meeting/AttendanceBanner';
import MeetingControlBar from '../components/meeting/MeetingControlBar';
import MeetingSidebar from '../components/meeting/MeetingSidebar';
import MeetingLeaveModal from '../components/meeting/MeetingLeaveModal';
import {
    FiAlertTriangle, FiMaximize2, FiMinimize2,
    FiDownload, FiChevronLeft, FiChevronRight,
    FiVideo, FiVideoOff, FiUsers,
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
    const [recording, setRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [uploadingRec, setUploadingRec] = useState(false);
    const [expandCams, setExpandCams] = useState(false);
    const [stripOpen, setStripOpen] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [streamVersion, setStreamVersion] = useState(0); // Force re-render when remote streams change
    // ── Attendance ──
    const [attendanceSession, setAttendanceSession] = useState(null);
    const [showFaceVerify, setShowFaceVerify] = useState(false);     // Show face verify modal (chỉ khi điểm danh)
    const [attendanceCheckedIn, setAttendanceCheckedIn] = useState(false); // SV đã điểm danh rồi chưa

    const socketRef = useRef(null);
    const peersRef = useRef({});
    const remoteStreamsRef = useRef({});
    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null); // Keep ref in sync for callbacks
    const screenStreamRef = useRef(null); // Keep screen stream ref in sync
    const aiIntervalRef = useRef(null);
    const canvasRef = useRef(null);
    const localVideoRef2 = useRef(null); // Second ref for camera strip
    const mainVideoRef = useRef(null); // For fullscreen
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const recordingStartRef = useRef(null);
    const chatScrollRef = useRef(null); // [BUG FIX #19] Chat auto-scroll

    // Keep localStreamRef in sync
    useEffect(() => {
        localStreamRef.current = localStream;
        // Also sync camera strip video
        if (localVideoRef2.current && localStream) {
            localVideoRef2.current.srcObject = localStream;
        }
    }, [localStream]);

    // Keep screenStreamRef in sync
    useEffect(() => {
        screenStreamRef.current = screenStream;
    }, [screenStream]);

    // [BUG FIX #10] Auto-hide attendance success banner after 6s
    useEffect(() => {
        if (!attendanceCheckedIn) return;
        const timer = setTimeout(() => setAttendanceCheckedIn(false), 6000);
        return () => clearTimeout(timer);
    }, [attendanceCheckedIn]);

    // [BUG FIX #19] Auto-scroll chat khi có tin nhắn mới
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Re-sync camera strip video when strip toggles open
    useEffect(() => {
        if (stripOpen && localVideoRef2.current && localStream) {
            // Small delay to ensure DOM element is mounted
            setTimeout(() => {
                if (localVideoRef2.current && localStream) {
                    localVideoRef2.current.srcObject = localStream;
                }
            }, 50);
        }
    }, [stripOpen, localStream]);

    // Warn before reload if recording or sharing
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (recording || sharing) {
                e.preventDefault();
                e.returnValue = 'Bạn đang ghi hình/chia sẻ màn hình. Reload sẽ dừng tất cả.';
                return e.returnValue;
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [recording, sharing]);

    // Sync fullscreen state when Esc exits fullscreen
    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

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

    // ── Face Gate: Chỉ check faceRegistered (không cần bật camera) ──
    // Nếu SV chưa đăng ký khuôn mặt → chặn không cho vào
    const faceGatePass = user?.role !== 'student' || user?.faceRegistered;

    // ── Step 2: Acquire media (camera + mic) — chờ face gate pass ──
    useEffect(() => {
        if (!faceGatePass) return;

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
    }, [classroomId, faceGatePass]);

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
            setStreamVersion(v => v + 1);
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

        // Attendance started — TỰ ĐỘNG mở FaceVerify cho student
        socket.on('attendanceStarted', (sessionInfo) => {
            setAttendanceSession(sessionInfo);
            setAttendanceCheckedIn(false);
            // Student: tự động mở camera face verify ngay lập tức
            setShowFaceVerify(true);
        });

        socket.on('attendanceEnded', () => {
            setAttendanceSession(null);
            setShowFaceVerify(false);
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

        // If currently screen sharing, replace video track with screen track
        const currentScreenStream = screenStreamRef.current;
        if (currentScreenStream) {
            const screenTrack = currentScreenStream.getVideoTracks()[0];
            if (screenTrack) {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    sender.replaceTrack(screenTrack);
                }
            }
        }

        // Handle remote tracks
        pc.ontrack = (event) => {
            const remoteStream = event.streams[0];
            remoteStreamsRef.current[socketId] = remoteStream;
            // Force re-render: update participants AND stream version
            setParticipants(prev => [...prev]);
            setStreamVersion(v => v + 1);
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

    // ── AI monitoring (students only) ── [BUG FIX #2: re-run khi camOn thay đổi]
    useEffect(() => {
        if (!localStream || user?.role !== 'student' || !camOn) return;
        // Only run AI if we have active video tracks
        if (localStream.getVideoTracks().length === 0) return;

        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 240;
        const ctx = canvas.getContext('2d');
        canvasRef.current = canvas;

        aiIntervalRef.current = setInterval(async () => {
            // [BUG FIX #2: double-check camera vẫn on]
            if (!localVideoRef.current || !socketRef.current) return;
            const stream = localStreamRef.current;
            if (!stream || stream.getVideoTracks().length === 0) return;
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
    }, [localStream, user, classroomId, camOn]);

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

    // ── Toggle camera ── [BUG FIX #1: dùng replaceTrack thay vì addTrack]
    const toggleCam = async () => {
        if (camOn && localStream && localStream.getVideoTracks().length > 0) {
            // TẮT camera: stop track thực sự để tắt đèn LED
            localStream.getVideoTracks().forEach(t => {
                // Replace track trên peers bằng null trước khi stop
                Object.values(peersRef.current).forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track === t);
                    if (sender) sender.replaceTrack(null);
                });
                t.stop();
                localStream.removeTrack(t);
            });
            setCamOn(false);
            if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
            socketRef.current?.emit('mediaToggle', { classroomId, type: 'camera', enabled: false });
        } else {
            // BẬT camera: acquire mới + replaceTrack trên sender cũ (hoặc addTrack nếu chưa có)
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: 'user' }
                });
                const videoTrack = videoStream.getVideoTracks()[0];
                if (localStream) {
                    localStream.addTrack(videoTrack);
                    // [BUG FIX #1] replaceTrack trên sender cũ thay vì addTrack mới
                    Object.values(peersRef.current).forEach(pc => {
                        const sender = pc.getSenders().find(s => s.track === null && s.track !== undefined || s.track?.kind === 'video');
                        if (sender) {
                            sender.replaceTrack(videoTrack);
                        } else {
                            pc.addTrack(videoTrack, localStream);
                        }
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
        // [BUG FIX #4] Stop screen share — dùng ref thay vì state stale closure
        const currentScreen = screenStreamRef.current;
        if (currentScreen) {
            currentScreen.getTracks().forEach(t => t.stop());
        }
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

    // ── Recording (teacher only) ──
    const formatRecordTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return h > 0
            ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
            : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };

    const startRecording = async () => {
        try {
            // Ghi MÀN HÌNH (không phải camera)
            const screenCaptureStream = await navigator.mediaDevices.getDisplayMedia({
                video: { width: 1920, height: 1080 },
                audio: true, // System audio nếu có
            });

            // Kết hợp audio từ mic (nếu đang bật)
            const combinedTracks = [...screenCaptureStream.getTracks()];
            if (localStream) {
                const audioTrack = localStream.getAudioTracks()[0];
                if (audioTrack && audioTrack.enabled) {
                    combinedTracks.push(audioTrack.clone());
                }
            }
            const combinedStream = new MediaStream(combinedTracks);

            recordedChunksRef.current = [];
            let mimeType = 'video/webm;codecs=vp9,opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

            const mr = new MediaRecorder(combinedStream, { mimeType });
            mr.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
            };
            mr.onstop = async () => {
                clearInterval(recordingTimerRef.current);
                // Dừng screen capture stream riêng
                screenCaptureStream.getTracks().forEach(t => t.stop());
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const duration = Math.floor((Date.now() - recordingStartRef.current) / 1000);
                setUploadingRec(true);
                try {
                    const formData = new FormData();
                    formData.append('recording', blob, `recording_${Date.now()}.webm`);
                    formData.append('duration', duration);
                    formData.append('title', `Bản ghi ${classroom?.name || ''} - ${new Date().toLocaleString('vi-VN')}`);
                    const res = await classroomsAPI.uploadRecording(classroomId, formData);
                    socketRef.current?.emit('meetingChat', {
                        classroomId,
                        message: `🎬 Đã lưu bản ghi buổi học (${formatRecordTime(duration)}) — ${res.data.recording.originalName}`,
                    });
                } catch (err) {
                    console.error('Upload recording error:', err);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `recording_${Date.now()}.webm`;
                    a.click();
                    URL.revokeObjectURL(url);
                    socketRef.current?.emit('meetingChat', {
                        classroomId,
                        message: `🎬 Bản ghi đã tải về máy (upload thất bại)`,
                    });
                } finally {
                    setUploadingRec(false);
                }
                setRecording(false);
                setRecordingTime(0);
            };

            // Nếu user stop share từ browser → tự dừng recording
            screenCaptureStream.getVideoTracks()[0].onended = () => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                }
            };

            mr.start(1000);
            mediaRecorderRef.current = mr;
            recordingStartRef.current = Date.now();
            setRecording(true);
            setRecordingTime(0);
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(t => t + 1);
            }, 1000);
            socketRef.current?.emit('meetingChat', {
                classroomId,
                message: '🔴 Giáo viên đã bắt đầu ghi màn hình buổi học',
            });
        } catch (err) {
            if (err.name !== 'NotAllowedError') {
                console.error('Start recording error:', err);
                alert('Không thể bắt đầu ghi màn hình: ' + err.message);
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
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

                {/* Recording banner */}
                {recording && (
                    <div style={{
                        background: 'linear-gradient(90deg, #dc262622, #ef444422)', padding: '6px 20px',
                        display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85em',
                        borderBottom: '1px solid #ef444466', color: '#fca5a5',
                    }}>
                        <span style={{
                            width: 10, height: 10, borderRadius: '50%', background: '#ef4444',
                            animation: 'pulseGlow 1s infinite', flexShrink: 0,
                        }} />
                        <span style={{ fontWeight: 600 }}>Đang ghi hình</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#fff' }}>
                            {formatRecordTime(recordingTime)}
                        </span>
                        {uploadingRec && <span style={{ marginLeft: 'auto', color: '#fbbf24' }}>⏫ Đang lưu...</span>}
                    </div>
                )}

                {/* Main area — Teams layout: Main video + Camera strip bên phải */}
                <div style={styles.mainArea}>
                    {/* ── Main video area (pinned / screen share) ── */}
                    <div ref={mainVideoRef} style={{
                        ...styles.mainVideo,
                        ...(isFullscreen ? { width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}),
                    }}>
                        {/* Fullscreen button - ẩn khi chính mình đang share (tránh gương vô hạn) */}
                        {!sharing && (
                        <button
                            onClick={() => {
                                if (!document.fullscreenElement) {
                                    mainVideoRef.current?.requestFullscreen?.();
                                    setIsFullscreen(true);
                                } else {
                                    document.exitFullscreen?.();
                                    setIsFullscreen(false);
                                }
                            }}
                            style={styles.fullscreenBtn}
                            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
                        >
                            {isFullscreen ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
                        </button>
                        )}
                        {sharing && screenStream ? (
                            <div style={styles.screenShareMain}>
                                <ScreenShareVideo stream={screenStream} />
                                <div style={styles.videoLabel}>
                                    <span>🖥️ Màn hình chia sẻ</span>
                                    <span style={{ ...styles.roleTag, background: '#3b82f633', color: '#60a5fa' }}>Đang chia sẻ</span>
                                </div>
                            </div>
                        ) : pinned && pinned !== 'local' ? (
                            /* Pinned remote video */
                            <div style={styles.screenShareMain}>
                                <RemoteVideo socketId={pinned} stream={remoteStreamsRef.current[pinned]} />
                                <div style={styles.videoLabel}>
                                    <span>{participants.find(p => p.socketId === pinned)?.userName || 'Người tham gia'}</span>
                                </div>
                            </div>
                        ) : (
                            /* Default: local video lớn */
                            <div style={styles.screenShareMain}>
                                <video ref={localVideoRef}
                                    autoPlay muted playsInline style={{ ...styles.video, objectFit: 'contain' }} />
                                {!camOn && <div style={styles.videoOff}><FiVideoOff size={48} /></div>}
                                <div style={styles.videoLabel}>
                                    <span>🙋 {user?.name} (Bạn)</span>
                                    <span style={styles.roleTag}>
                                        {user?.role === 'teacher' ? '👨‍🏫 GV' : '🎓 SV'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Camera strip bên phải ── */}
                    {(() => {
                        // Sắp xếp participants: GV → User hiện tại (SV) → SV khác theo tên
                        const sortName = (a, b) => {
                            const na = (a.userName || '').toLowerCase();
                            const nb = (b.userName || '').toLowerCase();
                            const isLetterA = /^[a-zà-ỹ]/i.test(na);
                            const isLetterB = /^[a-zà-ỹ]/i.test(nb);
                            if (isLetterA && !isLetterB) return -1;
                            if (!isLetterA && isLetterB) return 1;
                            return na.localeCompare(nb, 'vi');
                        };

                        const teachers = participants.filter(p => p.role === 'teacher').sort(sortName);
                        const students = participants.filter(p => p.role !== 'teacher').sort(sortName);
                        const sorted = [...teachers, ...students];

                        // Local user card
                        const localCard = {
                            socketId: 'local',
                            userName: user?.name,
                            role: user?.role,
                            isLocal: true,
                        };

                        // Build ordered list: GV đầu tiên, rồi local (nếu SV), rồi SV khác
                        let cameraList = [];
                        // 1) Remote teachers
                        cameraList.push(...teachers);
                        // 2) Local user nếu là teacher → đầu tiên; nếu là SV → sau GV
                        if (user?.role === 'teacher') {
                            cameraList.unshift(localCard);
                        } else {
                            cameraList.push(localCard);
                        }
                        // 3) Remote students
                        cameraList.push(...students);

                        const MAX_VISIBLE = expandCams ? cameraList.length : 5;
                        const visibleCams = cameraList.slice(0, MAX_VISIBLE);
                        const hiddenCount = cameraList.length - MAX_VISIBLE;

                        return (
                            <>
                            {/* Nút toggle strip */}
                            <button
                                onClick={() => setStripOpen(!stripOpen)}
                                style={styles.stripToggle}
                                title={stripOpen ? 'Thu gọn camera' : 'Mở camera'}
                            >
                                {stripOpen ? <FiChevronRight size={14} /> : <FiChevronLeft size={14} />}
                            </button>
                            {stripOpen ? (
                            <div style={styles.cameraStrip}>
                                <div style={styles.cameraStripHeader}>
                                    <FiUsers size={12} /> <span>{cameraList.length} camera</span>
                                    {cameraList.length > 5 && (
                                        <button onClick={() => setExpandCams(!expandCams)} style={styles.expandBtn}>
                                            {expandCams ? <><FiMinimize2 size={11} /> Thu gọn</> : <><FiMaximize2 size={11} /> Tất cả</>}
                                        </button>
                                    )}
                                </div>
                                <div style={styles.cameraStripScroll}>
                                    {visibleCams.map((cam) => (
                                        <div
                                            key={cam.socketId}
                                            style={{
                                                ...styles.camCard,
                                                border: pinned === cam.socketId ? '2px solid var(--accent)' : '1px solid #ffffff15',
                                            }}
                                            onClick={() => setPinned(pinned === cam.socketId ? null : cam.socketId)}
                                        >
                                            {cam.isLocal ? (
                                                <>
                                                    <video ref={localVideoRef2}
                                                        autoPlay muted playsInline style={styles.camVideo} />
                                                    {!camOn && <div style={styles.camOff}><FiVideoOff size={14} /></div>}
                                                </>
                                            ) : (
                                                <RemoteVideo socketId={cam.socketId} stream={remoteStreamsRef.current[cam.socketId]} />
                                            )}
                                            <div style={styles.camLabel}>
                                                <span style={{ fontSize: '0.65em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {cam.role === 'teacher' ? '👨‍🏫' : '🎓'} {cam.userName}{cam.isLocal ? ' (Bạn)' : ''}
                                                </span>
                                            </div>
                                            {/* AI badge */}
                                            {!cam.isLocal && aiStates[cam.socketId] && user?.role === 'teacher' && (
                                                <div style={{
                                                    position: 'absolute', top: 3, left: 3, fontSize: '0.55em', fontWeight: 600,
                                                    padding: '1px 5px', borderRadius: 4,
                                                    background: stateColors[aiStates[cam.socketId].state] + '55',
                                                    color: stateColors[aiStates[cam.socketId].state],
                                                }}>
                                                    {stateLabels[aiStates[cam.socketId].state]}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {hiddenCount > 0 && !expandCams && (
                                        <button onClick={() => setExpandCams(true)} style={styles.moreBtn}>
                                            +{hiddenCount} người khác
                                        </button>
                                    )}
                                </div>
                            </div>
                            ) : null}
                            </>
                        );
                    })()}

                    {/* [B1] Sidebar: Chat / Participants — extracted */}
                    {(chatOpen || participantList) && (
                        <MeetingSidebar
                            mode={participantList ? 'participants' : 'chat'}
                            messages={messages}
                            chatInput={chatInput}
                            onChatChange={setChatInput}
                            onSendChat={sendChat}
                            currentUser={user}
                            participants={participants}
                            aiStates={aiStates}
                            stateColors={stateColors}
                        />
                    )}

                    {/* ── Attendance Panel (teacher) / Info (student) ── */}
                    <AttendancePanel
                        classroomId={classroomId}
                        socket={socketRef.current}
                        role={user?.role}
                    />
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

                {/* [B1] Bottom controls — extracted */}
                <MeetingControlBar
                    userRole={user?.role}
                    micOn={micOn} camOn={camOn} sharing={sharing}
                    recording={recording} uploadingRec={uploadingRec}
                    recordingTime={recordingTime}
                    chatOpen={chatOpen} participantList={participantList}
                    messageCount={messages.length}
                    onToggleMic={toggleMic} onToggleCam={toggleCam}
                    onToggleScreen={toggleScreenShare}
                    onStartRecording={startRecording} onStopRecording={stopRecording}
                    onToggleChat={() => { setChatOpen(!chatOpen); setParticipantList(false); }}
                    onToggleParticipants={() => { setParticipantList(!participantList); setChatOpen(false); }}
                    onLeave={leaveMeeting}
                />
            </div>

            {/* [B1] Face Gate — extracted */}
            {user?.role === 'student' && !user?.faceRegistered && <FaceGate />}

            {/* [B1] Attendance — Không cần banner trung gian, FaceVerify đã tự động mở */}
            <AttendanceSuccessBanner show={attendanceCheckedIn && !!attendanceSession} />

            {/* ── Face Verify Modal (chỉ khi điểm danh, không phải gate vào lớp) ── */}
            {showFaceVerify && user?.role === 'student' && (
                <FaceVerifyModal
                    user={user}
                    attendanceSessionId={attendanceSession?.sessionId}
                    requireFaceVerify={true}
                    onSuccess={(faceVerified, distance) => {
                        setShowFaceVerify(false);
                        setAttendanceCheckedIn(true);
                    }}
                    onSkip={() => setShowFaceVerify(false)}
                />
            )}

            {/* [B1] Leave modal — extracted */}
            {leaveModal && (
                <MeetingLeaveModal
                    userRole={user?.role}
                    onLeave={() => confirmLeave(false)}
                    onEndForAll={() => confirmLeave(true)}
                    onClose={() => setLeaveModal(false)}
                />
            )}
        </>);
}

// [BUG FIX #16] React.memo: tránh re-render khi parent state thay đổi
const RemoteVideo = React.memo(function RemoteVideo({ socketId, stream }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {
                // [BUG FIX #13] Autoplay blocked → chờ user click
                const handleClick = () => {
                    videoRef.current?.play().catch(() => {});
                    document.removeEventListener('click', handleClick);
                };
                document.addEventListener('click', handleClick, { once: true });
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
});

// [BUG FIX #16] React.memo
const ScreenShareVideo = React.memo(function ScreenShareVideo({ stream }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
                width: '100%', height: '100%', objectFit: 'contain',
                background: '#000', borderRadius: 8,
            }}
        />
    );
});

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
    mainVideo: {
        flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 12,
        background: '#0f0f1a',
    },
    fullscreenBtn: {
        position: 'absolute', top: 10, right: 10, zIndex: 20,
        width: 36, height: 36, borderRadius: 8,
        background: 'rgba(0,0,0,0.5)', border: '1px solid #ffffff30',
        color: '#fff', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s', backdropFilter: 'blur(4px)',
    },
    screenShareMain: {
        position: 'relative', width: '100%', height: '100%',
        background: '#000', borderRadius: 12, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    stripToggle: {
        width: 24, height: 40, background: '#1a1a2e', border: '1px solid #ffffff15',
        borderRadius: '8px 0 0 8px', cursor: 'pointer', color: '#999',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all 0.2s',
    },
    cameraStrip: {
        width: 200, display: 'flex', flexDirection: 'column',
        background: '#1a1a2e', borderRadius: 12, overflow: 'hidden',
        flexShrink: 0,
    },
    cameraStripHeader: {
        padding: '8px 10px', fontSize: '0.72em', color: '#999',
        display: 'flex', alignItems: 'center', gap: 6,
        borderBottom: '1px solid #ffffff10', fontWeight: 600,
    },
    expandBtn: {
        marginLeft: 'auto', background: 'none', border: '1px solid #ffffff20',
        color: '#999', borderRadius: 6, padding: '2px 8px', cursor: 'pointer',
        fontSize: '0.9em', display: 'flex', alignItems: 'center', gap: 3,
    },
    cameraStripScroll: {
        flex: 1, overflow: 'auto', padding: 4, display: 'flex',
        flexDirection: 'column', gap: 4,
    },
    camCard: {
        position: 'relative', width: '100%', aspectRatio: '16/10',
        background: '#0f0f1a', borderRadius: 8, overflow: 'hidden',
        cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
    },
    camVideo: {
        width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8,
    },
    camLabel: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
        padding: '10px 6px 4px', display: 'flex', alignItems: 'center',
    },
    camOff: {
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#1a1a2e', color: '#555',
    },
    moreBtn: {
        background: '#ffffff08', border: '1px dashed #ffffff20', borderRadius: 8,
        color: '#999', padding: '10px 0', cursor: 'pointer', fontSize: '0.75em',
        fontWeight: 600, textAlign: 'center', flexShrink: 0,
    },
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
