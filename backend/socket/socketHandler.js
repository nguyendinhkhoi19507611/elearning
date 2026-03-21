// WebSocket handler for real-time communication + WebRTC signaling
module.exports = (io) => {
    // Track rooms: { classroomId: { socketId: { userId, name, role } } }
    const rooms = {};

    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.id}`);

        // ── Legacy session support ──
        socket.on('joinSession', ({ sessionId, userId, role }) => {
            socket.join(`session_${sessionId}`);
            io.to(`session_${sessionId}`).emit('userJoined', { userId, role });
        });
        socket.on('leaveSession', ({ sessionId, userId }) => {
            socket.leave(`session_${sessionId}`);
            io.to(`session_${sessionId}`).emit('userLeft', { userId });
        });
        socket.on('stateUpdate', (data) => {
            io.to(`session_${data.sessionId}`).emit('studentState', {
                studentId: data.studentId, studentName: data.studentName,
                state: data.state, confidence: data.confidence,
                avgAttention: data.avgAttention, timestamp: new Date().toISOString()
            });
        });
        socket.on('alert', (data) => {
            io.to(`session_${data.sessionId}`).emit('alert', {
                ...data, timestamp: new Date().toISOString()
            });
        });

        // ═══════════════════════════════════════════════
        //  CLASSROOM MEETING — WebRTC Signaling
        // ═══════════════════════════════════════════════

        // Join classroom meeting room
        socket.on('joinMeeting', ({ classroomId, userId, userName, role }) => {
            const roomKey = `classroom_${classroomId}`;
            socket.join(roomKey);
            socket.classroomId = classroomId;
            socket.meetingUser = { userId, userName, role };

            if (!rooms[classroomId]) rooms[classroomId] = {};
            rooms[classroomId][socket.id] = { userId, userName, role, socketId: socket.id };

            // Send existing participants to the new user
            const participants = Object.values(rooms[classroomId])
                .filter(p => p.socketId !== socket.id);
            socket.emit('existingParticipants', participants);

            // Notify others about new participant
            socket.to(roomKey).emit('participantJoined', {
                userId, userName, role, socketId: socket.id
            });

            console.log(`📹 ${userName} (${role}) joined meeting ${classroomId} [${Object.keys(rooms[classroomId]).length} total]`);
        });

        // Leave meeting
        socket.on('leaveMeeting', ({ classroomId }) => {
            handleLeaveMeeting(socket, classroomId);
        });

        // ── WebRTC Signaling ──

        // Send offer to specific peer
        socket.on('offer', ({ to, offer }) => {
            io.to(to).emit('offer', {
                from: socket.id,
                offer,
                user: socket.meetingUser
            });
        });

        // Send answer to specific peer
        socket.on('answer', ({ to, answer }) => {
            io.to(to).emit('answer', {
                from: socket.id,
                answer
            });
        });

        // ICE candidate exchange
        socket.on('iceCandidate', ({ to, candidate }) => {
            io.to(to).emit('iceCandidate', {
                from: socket.id,
                candidate
            });
        });

        // ── Meeting actions ──

        // Toggle camera/mic status
        socket.on('mediaToggle', ({ classroomId, type, enabled }) => {
            const roomKey = `classroom_${classroomId}`;
            socket.to(roomKey).emit('participantMediaToggle', {
                socketId: socket.id,
                userId: socket.meetingUser?.userId,
                type, // 'camera' | 'mic' | 'screen'
                enabled
            });
        });

        // Screen share started/stopped
        socket.on('screenShare', ({ classroomId, active }) => {
            const roomKey = `classroom_${classroomId}`;
            socket.to(roomKey).emit('screenShareUpdate', {
                socketId: socket.id,
                userId: socket.meetingUser?.userId,
                userName: socket.meetingUser?.userName,
                active
            });
        });

        // Chat message in meeting
        socket.on('meetingChat', ({ classroomId, message }) => {
            const roomKey = `classroom_${classroomId}`;
            io.to(roomKey).emit('meetingChat', {
                socketId: socket.id,
                userId: socket.meetingUser?.userId,
                userName: socket.meetingUser?.userName,
                role: socket.meetingUser?.role,
                message,
                timestamp: new Date().toISOString()
            });
        });

        // AI State update during meeting
        socket.on('meetingAIState', ({ classroomId, state, confidence }) => {
            const roomKey = `classroom_${classroomId}`;
            socket.to(roomKey).emit('studentAIState', {
                socketId: socket.id,
                userId: socket.meetingUser?.userId,
                userName: socket.meetingUser?.userName,
                state, confidence,
                timestamp: new Date().toISOString()
            });
        });

        // ── Disconnect ──
        socket.on('disconnect', () => {
            if (socket.classroomId) {
                handleLeaveMeeting(socket, socket.classroomId);
            }
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        });
    });

    function handleLeaveMeeting(socket, classroomId) {
        const roomKey = `classroom_${classroomId}`;
        socket.leave(roomKey);

        if (rooms[classroomId]) {
            const user = rooms[classroomId][socket.id];
            delete rooms[classroomId][socket.id];

            if (Object.keys(rooms[classroomId]).length === 0) {
                delete rooms[classroomId];
            }

            socket.to(roomKey).emit('participantLeft', {
                socketId: socket.id,
                userId: user?.userId,
                userName: user?.userName
            });

            if (user) {
                console.log(`📹 ${user.userName} left meeting ${classroomId}`);
            }
        }
    }
};
