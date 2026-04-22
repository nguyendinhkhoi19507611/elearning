import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiBell, FiX, FiVideo, FiCalendar, FiCheck, FiCheckCircle, FiBook, FiStar } from 'react-icons/fi';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { classroomsAPI } from '../api/api';

/**
 * [C2] Global Notification System
 * - Nghe socket event 'classStarted' → hiện toast + badge
 * - Nghe socket event 'attendanceStarted' → hiện toast khẩn
 * - Lưu thông báo trong memory, hiện dropdown
 */

const MAX_NOTIFS = 20;

export default function NotificationBell() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [open, setOpen] = useState(false);
    const [toasts, setToasts] = useState([]);
    const socketRef = useRef(null);
    const bellRef = useRef(null);

    const unread = notifications.filter(n => !n.read).length;

    const addNotif = useCallback((notif) => {
        const n = { ...notif, id: Date.now() + Math.random(), read: false, time: new Date() };
        setNotifications(prev => [n, ...prev].slice(0, MAX_NOTIFS));
        // Show toast
        setToasts(prev => [...prev, n]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== n.id)), 5000);
    }, []);

    useEffect(() => {
        if (!user) return;
        const token = localStorage.getItem('token');
        const socket = io(window.location.origin, {
            path: '/socket.io', withCredentials: true, auth: { token },
            reconnectionAttempts: 3, reconnectionDelay: 2000,
        });
        socketRef.current = socket;

        socket.on('connect_error', (err) => {
            console.warn('[NotificationBell] Socket connection error:', err.message);
        });

        // [N6] Join personal room ngay khi kết nối
        socket.on('connect', () => {
            socket.emit('subscribeUser', { userId: user._id });

            // Subscribe tất cả classroom rooms để nhận newAssignment
            classroomsAPI.getAll()
                .then(r => {
                    const ids = (r.data || []).map(c => c._id);
                    if (ids.length > 0) socket.emit('subscribeClassrooms', { classroomIds: ids });
                })
                .catch(() => { });
        });

        // [C2] Lớp học bắt đầu
        socket.on('classStarted', ({ classroomId, classroomName, teacherName }) => {
            addNotif({
                type: 'class',
                title: '🔴 Lớp học bắt đầu',
                body: `${classroomName} — ${teacherName} đã bắt đầu buổi học`,
                link: `/meeting/${classroomId}`,
                classroomId,
            });
        });

        // [C2] Điểm danh bắt đầu — link đến trang điểm danh (không phải meeting)
        socket.on('attendanceStarted', ({ classroomId, classroomName, sessionId, endTime }) => {
            addNotif({
                type: 'attendance',
                title: '📋 Điểm danh bắt đầu!',
                body: `${classroomName || 'Lớp học'} — Vào điểm danh ngay (đến ${endTime})`,
                link: '/student/attendance',
                classroomId,
                urgent: true,
            });
        });

        // [C2] Lớp kết thúc
        socket.on('classEnded', ({ classroomName }) => {
            addNotif({
                type: 'end',
                title: '🏁 Lớp học kết thúc',
                body: `${classroomName} đã kết thúc`,
            });
        });

        // [N6] Bài tập mới (student nhận)
        socket.on('newAssignment', ({ classroomName, title, dueDate }) => {
            if (user.role === 'student') {
                addNotif({
                    type: 'assignment',
                    title: '📝 Bài tập mới',
                    body: `${classroomName}: "${title}" — Hạn nộp ${new Date(dueDate).toLocaleDateString('vi-VN')}`,
                    link: '/student/assignments',
                });
            }
        });

        // [N6] Sinh viên nộp bài (teacher nhận)
        socket.on('assignmentSubmitted', ({ title, studentName }) => {
            if (user.role === 'teacher') {
                addNotif({
                    type: 'submission',
                    title: '📬 Bài nộp mới',
                    body: `${studentName} đã nộp bài "${title}"`,
                    link: '/teacher/assignments',
                });
            }
        });

        // [N6] Giáo viên chấm điểm (student nhận)
        socket.on('assignmentGraded', ({ title, score, maxScore }) => {
            if (user.role === 'student') {
                addNotif({
                    type: 'grade',
                    title: '⭐ Bài tập được chấm điểm',
                    body: `"${title}" — Điểm của bạn: ${score}/${maxScore}`,
                    link: '/student/assignments',
                    urgent: false,
                });
            }
        });

        return () => socket.disconnect();
    }, [user, addNotif]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (bellRef.current && !bellRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const handleClick = (n) => {
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
        if (n.link) { navigate(n.link); setOpen(false); }
    };

    const formatTime = (d) => {
        const diff = (Date.now() - new Date(d)) / 1000;
        if (diff < 60) return 'Vừa xong';
        if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
        return new Date(d).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' });
    };

    if (!user) return null;

    return (
        <>
            {/* Bell button */}
            <div ref={bellRef} style={{ position: 'relative', display: 'inline-block' }}>
                <button
                    onClick={() => setOpen(!open)}
                    style={{
                        background: 'none', border: '1px solid var(--border)',
                        borderRadius: 10, padding: '7px 10px', cursor: 'pointer',
                        color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                        position: 'relative', transition: 'all 0.2s',
                    }}
                    aria-label="Thông báo"
                >
                    <FiBell size={17} />
                    {unread > 0 && (
                        <span style={{
                            position: 'absolute', top: -5, right: -5,
                            background: '#ef4444', color: '#fff',
                            fontSize: '0.65em', fontWeight: 700,
                            width: 18, height: 18, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '2px solid var(--bg-primary)',
                        }}>{unread > 9 ? '9+' : unread}</span>
                    )}
                </button>

                {/* Dropdown */}
                {open && (
                    <div style={{
                        position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                        width: 340, background: 'var(--bg-card)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 14, boxShadow: 'var(--shadow-lg)',
                        zIndex: 9000, overflow: 'hidden',
                    }}>
                        <div style={{
                            padding: '14px 16px', borderBottom: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95em' }}>
                                Thông báo {unread > 0 && <span className="badge badge-accent" style={{ fontSize: '0.7em' }}>{unread}</span>}
                            </span>
                            {unread > 0 && (
                                <button onClick={markAllRead} style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--accent)', fontSize: '0.78em', fontWeight: 600,
                                    display: 'flex', alignItems: 'center', gap: 4
                                }}>
                                    <FiCheckCircle size={12} /> Đánh dấu đã đọc
                                </button>
                            )}
                        </div>

                        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                            {notifications.length === 0 ? (
                                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85em' }}>
                                    <FiBell size={22} style={{ marginBottom: 8, opacity: 0.4 }} /><br />
                                    Chưa có thông báo nào
                                </div>
                            ) : notifications.map(n => (
                                <div
                                    key={n.id}
                                    onClick={() => handleClick(n)}
                                    style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid var(--border)',
                                        cursor: n.link ? 'pointer' : 'default',
                                        background: n.read ? 'transparent' : 'rgba(91,127,255,0.05)',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(91,127,255,0.05)'}
                                >
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <div style={{
                                            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                                            background: n.type === 'grade' ? 'var(--success-light)'
                                                : n.type === 'assignment' ? 'var(--info-light)'
                                                    : n.type === 'submission' ? 'var(--accent-light)'
                                                        : n.urgent ? 'var(--warning-light)'
                                                            : n.type === 'class' ? 'var(--accent-light)' : 'var(--success-light)',
                                            color: n.type === 'grade' ? 'var(--success)'
                                                : n.type === 'assignment' ? 'var(--info)'
                                                    : n.type === 'submission' ? 'var(--accent)'
                                                        : n.urgent ? 'var(--warning)'
                                                            : n.type === 'class' ? 'var(--accent)' : 'var(--success)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {n.type === 'class' && <FiVideo size={15} />}
                                            {n.type === 'attendance' && <FiCalendar size={15} />}
                                            {n.type === 'end' && <FiCheck size={15} />}
                                            {n.type === 'assignment' && <FiBook size={15} />}
                                            {n.type === 'submission' && <FiBook size={15} />}
                                            {n.type === 'grade' && <FiStar size={15} />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.83em' }}>{n.title}</div>
                                            <div style={{ fontSize: '0.77em', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>
                                            <div style={{ fontSize: '0.7em', color: 'var(--text-muted)', marginTop: 4 }}>{formatTime(n.time)}</div>
                                        </div>
                                        {!n.read && (
                                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Toast notifications */}
            <div style={{ position: 'fixed', top: 70, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
                {toasts.map(t => (
                    <div key={t.id} style={{
                        background: t.urgent ? 'linear-gradient(135deg,#f59e0b,#f97316)' : 'var(--bg-card)',
                        border: `1px solid ${t.urgent ? 'rgba(245,158,11,0.4)' : 'var(--border-strong)'}`,
                        borderRadius: 12, padding: '12px 16px',
                        boxShadow: 'var(--shadow-lg)', maxWidth: 320,
                        animation: 'fadeIn 0.3s ease', pointerEvents: 'all',
                        cursor: t.link ? 'pointer' : 'default',
                    }} onClick={() => { if (t.link) navigate(t.link); }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85em', marginBottom: 4 }}>{t.title}</div>
                        <div style={{ fontSize: '0.78em', color: t.urgent ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)' }}>{t.body}</div>
                    </div>
                ))}
            </div>
        </>
    );
}
