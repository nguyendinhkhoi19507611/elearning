import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { classroomsAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import {
    FiMessageSquare, FiVideo, FiUsers, FiPlay, FiClock, FiCalendar,
    FiDownload, FiArrowLeft, FiSend, FiFilm, FiSquare, FiCheck, FiX,
    FiAlertCircle, FiChevronRight, FiCheckCircle, FiXCircle
} from 'react-icons/fi';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const TABS = { POSTS: 'posts', RECORDINGS: 'recordings', MEMBERS: 'members', ATTENDANCE: 'attendance' };

export default function ClassroomDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [classroom, setClassroom] = useState(null);
    const [activeTab, setActiveTab] = useState(TABS.POSTS);
    const [recordings, setRecordings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');

    // End meeting state
    const [endConfirm, setEndConfirm] = useState(false);
    const [endLoading, setEndLoading] = useState(false);
    const [startError, setStartError] = useState('');
    const [attendanceSessions, setAttendanceSessions] = useState([]);
    const [loadingAtt, setLoadingAtt] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        loadClassroom();
    }, [id]);

    useEffect(() => {
        if (activeTab === TABS.RECORDINGS) loadRecordings();
        if (activeTab === TABS.ATTENDANCE) loadAttendance();
    }, [activeTab, id]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const loadClassroom = async () => {
        try {
            const res = await classroomsAPI.getById(id);
            setClassroom(res.data);

            // Tạo chat placeholder từ recordings
            const recRes = await classroomsAPI.getRecordings(id);
            setRecordings(recRes.data || []);

            // Tạo "bài đăng" từ recordings đã lưu
            const posts = (recRes.data || []).map(r => ({
                id: r._id,
                type: 'recording',
                userName: r.uploadedByName || 'Giáo viên',
                message: `🎬 Bản ghi buổi học — ${r.originalName}`,
                duration: r.duration,
                size: r.size,
                url: r.url,
                timestamp: r.createdAt,
            }));
            setChatMessages(posts);
        } catch (err) {
            console.error(err);
            navigate(-1);
        } finally {
            setLoading(false);
        }
    };

    const loadRecordings = async () => {
        try {
            const res = await classroomsAPI.getRecordings(id);
            setRecordings(res.data || []);
        } catch (err) { console.error(err); }
    };

    const loadAttendance = async () => {
        setLoadingAtt(true);
        try {
            const res = await classroomsAPI.getAttendance(id);
            setAttendanceSessions(res.data || []);
        } catch (err) { console.error(err); }
        setLoadingAtt(false);
    };

    const startMeeting = async () => {
        setStartError('');
        try {
            await classroomsAPI.startMeeting(id);
            navigate(`/meeting/${id}`);
        } catch (e) {
            setStartError(e.response?.data?.error || 'Không thể bắt đầu');
        }
    };

    const endMeeting = async () => {
        setEndLoading(true);
        try {
            await classroomsAPI.endMeeting(id);
            setClassroom(prev => ({ ...prev, meeting: { ...prev.meeting, isLive: false } }));
            setEndConfirm(false);
        } catch (e) {
            setStartError(e.response?.data?.error || 'Lỗi khi kết thúc');
        }
        setEndLoading(false);
    };

    const formatDuration = (secs) => {
        if (!secs) return '00:00';
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const formatSize = (bytes) => {
        if (!bytes) return '';
        if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        return `${(bytes / 1024).toFixed(0)} KB`;
    };

    const formatDate = (d) => {
        if (!d) return '';
        return new Date(d).toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };



    if (loading) {
        return (
            <div className="card">
                <div className="empty-state">
                    <div className="spinner" />
                    <div className="empty-state-title">Đang tải...</div>
                </div>
            </div>
        );
    }

    if (!classroom) return null;

    const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
    const isLive = classroom.meeting?.isLive;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
            {/* ── Header giống Teams ── */}
            <div style={styles.header}>
                <button onClick={() => navigate(-1)} style={styles.backBtn}>
                    <FiArrowLeft size={16} />
                </button>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h2 style={{ margin: 0, fontSize: '1.1em', fontWeight: 700 }}>{classroom.name}</h2>
                        {isLive && <span className="live-dot">LIVE</span>}
                    </div>
                    <div style={{ fontSize: '0.78em', color: 'var(--text-muted)', marginTop: 2 }}>
                        {classroom.subject}
                        {classroom.schedule?.startTime && (
                            <> • {classroom.schedule.dayOfWeek?.map(d => DAYS[d]).join(', ')} • {classroom.schedule.startTime} - {classroom.schedule.endTime}</>
                        )}
                        {' '} • {classroom.students?.length || 0} thành viên
                    </div>
                </div>

                {/* Meeting actions */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {isLive ? (
                        <>
                            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/meeting/${id}`)}>
                                <FiVideo size={13} /> Vào lớp
                            </button>
                            {isTeacher && !endConfirm && (
                                <button className="btn btn-danger btn-sm" onClick={() => setEndConfirm(true)}>
                                    <FiSquare size={13} /> Kết thúc
                                </button>
                            )}
                        </>
                    ) : isTeacher ? (
                        <button className="btn btn-primary btn-sm" onClick={startMeeting}>
                            <FiPlay size={13} /> Bắt đầu lớp học
                        </button>
                    ) : null}
                </div>
            </div>

            {/* End confirmation */}
            {endConfirm && (
                <div style={styles.endBar}>
                    <span style={{ fontSize: '0.85em' }}>⚠️ Kết thúc buổi học? Sinh viên sẽ bị ngắt.</span>
                    <button className="btn btn-danger btn-sm" onClick={endMeeting} disabled={endLoading}>
                        {endLoading ? 'Đang...' : <><FiCheck size={12} /> Xác nhận</>}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => setEndConfirm(false)}>
                        <FiX size={12} /> Hủy
                    </button>
                </div>
            )}

            {/* Error */}
            {startError && (
                <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '8px 20px', fontSize: '0.83em', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <FiAlertCircle size={13} /> {startError}
                </div>
            )}

            {/* ── Tab bar giống Teams ── */}
            <div style={styles.tabBar}>
                {[
                    { key: TABS.POSTS, label: 'Bài đăng', icon: <FiMessageSquare size={14} /> },
                    { key: TABS.RECORDINGS, label: 'Bản ghi', icon: <FiFilm size={14} /> },
                    { key: TABS.MEMBERS, label: 'Thành viên', icon: <FiUsers size={14} /> },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            ...styles.tab,
                            ...(activeTab === tab.key ? styles.tabActive : {}),
                        }}
                    >
                        {tab.icon} {tab.label}
                        {tab.key === TABS.RECORDINGS && recordings.length > 0 && (
                            <span style={styles.tabCount}>{recordings.length}</span>
                        )}
                    </button>
                ))}
                {/* [N3] Tab Điểm danh chỉ hiển thị cho teacher/admin */}
                {isTeacher && (
                    <button
                        onClick={() => setActiveTab(TABS.ATTENDANCE)}
                        style={{
                            ...styles.tab,
                            ...(activeTab === TABS.ATTENDANCE ? styles.tabActive : {}),
                        }}
                    >
                        <FiCalendar size={14} /> Điểm danh
                        {attendanceSessions.length > 0 && (
                            <span style={styles.tabCount}>{attendanceSessions.length}</span>
                        )}
                    </button>
                )}
            </div>

            {/* ── Tab content ── */}
            <div style={styles.tabContent}>
                {/* [N3] Tab: Điểm danh */}
                {activeTab === TABS.ATTENDANCE && (
                    <div style={{ padding: '16px 0', overflowY: 'auto' }}>
                        {loadingAtt ? (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                <span className="spinner" />
                            </div>
                        ) : attendanceSessions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                <FiCalendar size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                                <div style={{ fontWeight: 600 }}>Chưa có buổi điểm danh</div>
                                <div style={{ fontSize: '0.85em', marginTop: 4 }}>Bắt đầu buổi học để tạo buổi điểm danh</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {attendanceSessions.map((sess, si) => {
                                    const presentCount = (sess.records || []).filter(r => r.status === 'present').length;
                                    const total = sess.records?.length || 0;
                                    const rate = total > 0 ? Math.round(presentCount / total * 100) : 0;
                                    const sessDate = new Date(sess.date || sess.createdAt).toLocaleDateString('vi-VN', {
                                        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
                                    });
                                    return (
                                        <div key={sess._id || si} style={{
                                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                                            borderRadius: 10, padding: '12px 16px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9em' }}>
                                                        <FiCalendar size={13} style={{ marginRight: 4 }} />
                                                        {sessDate}
                                                    </div>
                                                    <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', marginTop: 2 }}>
                                                        {sess.startTime} — {sess.endTime}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '1.1em', color: rate >= 80 ? 'var(--success)' : 'var(--warning)' }}>
                                                        {presentCount}/{total}
                                                    </div>
                                                    <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>{rate}% có mặt</div>
                                                </div>
                                            </div>
                                            {/* Progress bar */}
                                            <div style={{ height: 4, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginBottom: 10 }}>
                                                <div style={{
                                                    height: '100%', borderRadius: 4,
                                                    background: rate >= 80 ? 'var(--success)' : 'var(--warning)',
                                                    width: `${rate}%`, transition: 'width 0.4s'
                                                }} />
                                            </div>
                                            {/* Student records */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                {(sess.records || []).map((rec, ri) => (
                                                    <span key={ri} style={{
                                                        display: 'flex', alignItems: 'center', gap: 4,
                                                        padding: '3px 8px', borderRadius: 6, fontSize: '0.72em', fontWeight: 500,
                                                        background: rec.status === 'present' ? 'var(--success-light)' : 'var(--danger-light)',
                                                        color: rec.status === 'present' ? 'var(--success)' : 'var(--danger)',
                                                    }}>
                                                        {rec.status === 'present' ? <FiCheckCircle size={10} /> : <FiXCircle size={10} />}
                                                        {rec.studentName || 'SV'}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ Tab: Bài đăng (Posts/Chat) ═══ */}
                {activeTab === TABS.POSTS && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={styles.postsArea}>
                            {chatMessages.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                    <FiMessageSquare size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                                    <div style={{ fontWeight: 600 }}>Chưa có bài đăng nào</div>
                                    <div style={{ fontSize: '0.85em', marginTop: 4 }}>Các bản ghi buổi học sẽ hiện ở đây</div>
                                </div>
                            ) : (
                                chatMessages.map((msg, i) => (
                                    <div key={msg.id || i} style={styles.postCard}>
                                        <div style={styles.postHeader}>
                                            <div style={styles.postAvatar}>{msg.userName?.[0]?.toUpperCase()}</div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.88em' }}>{msg.userName}</div>
                                                <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>
                                                    {formatDate(msg.timestamp)}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.88em', marginTop: 8 }}>{msg.message}</div>

                                        {/* Nếu là recording → hiện player + download */}
                                        {msg.type === 'recording' && msg.url && (
                                            <div style={styles.recordingCard}>
                                                <video
                                                    controls
                                                    preload="metadata"
                                                    style={styles.videoPlayer}
                                                    src={msg.url}
                                                />
                                                <div style={styles.recordingMeta}>
                                                    <span><FiClock size={12} /> {formatDuration(msg.duration)}</span>
                                                    <span>{formatSize(msg.size)}</span>
                                                    <a
                                                        href={msg.url}
                                                        download
                                                        style={styles.downloadBtn}
                                                    >
                                                        <FiDownload size={13} /> Tải xuống
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                            <div ref={chatEndRef} />
                        </div>
                    </div>
                )}

                {/* ═══ Tab: Bản ghi (Recordings) ═══ */}
                {activeTab === TABS.RECORDINGS && (
                    <div style={{ padding: 16 }}>
                        {recordings.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                <FiFilm size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                                <div style={{ fontWeight: 600 }}>Chưa có bản ghi nào</div>
                                <div style={{ fontSize: '0.85em', marginTop: 4 }}>Bản ghi sẽ tự động lưu khi giáo viên ghi hình buổi học</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {recordings.map((rec, i) => (
                                    <div key={rec._id || i} style={styles.recListItem}>
                                        <div style={styles.recThumb}>
                                            <FiFilm size={22} style={{ color: 'var(--accent)' }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {rec.originalName}
                                            </div>
                                            <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 12 }}>
                                                <span><FiClock size={10} /> {formatDuration(rec.duration)}</span>
                                                <span>{formatSize(rec.size)}</span>
                                                <span>{formatDate(rec.createdAt)}</span>
                                                <span>bởi {rec.uploadedByName}</span>
                                            </div>
                                        </div>
                                        <a href={rec.url} download style={styles.dlIconBtn} title="Tải xuống">
                                            <FiDownload size={16} />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ Tab: Thành viên ═══ */}
                {activeTab === TABS.MEMBERS && (
                    <div style={{ padding: 16 }}>
                        {/* Giáo viên */}
                        <div style={styles.memberSection}>Giáo viên</div>
                        <div style={styles.memberItem}>
                            <div style={{ ...styles.memberAvatar, background: 'var(--success)' }}>
                                {classroom.teacher?.name?.[0]?.toUpperCase() || 'T'}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9em' }}>{classroom.teacher?.name}</div>
                                {/* [B2] Chỉ teacher/admin mới thấy email */}
                                {isTeacher && <div style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>{classroom.teacher?.email}</div>}
                            </div>
                            <span className="badge badge-success" style={{ marginLeft: 'auto', fontSize: '0.65em' }}>Giáo viên</span>
                        </div>

                        {/* Sinh viên */}
                        <div style={styles.memberSection}>Sinh viên ({classroom.students?.length || 0})</div>
                        {(classroom.students || []).map(s => (
                            <div key={s._id} style={{
                                ...styles.memberItem,
                                // [B2] Highlight bản thân
                                background: s._id === user?._id ? 'rgba(99,102,241,0.07)' : 'transparent',
                                borderRadius: 8,
                            }}>
                                <div style={{
                                    ...styles.memberAvatar,
                                    // [B2] Avatar khác màu cho bản thân
                                    background: s._id === user?._id ? 'var(--accent)' : 'var(--bg-primary)',
                                }}>
                                    {s.name?.[0]?.toUpperCase() || 'S'}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9em' }}>
                                        {s.name}
                                        {s._id === user?._id && (
                                            <span style={{ fontSize: '0.75em', color: 'var(--accent)', marginLeft: 6 }}>(Bạn)</span>
                                        )}
                                    </div>
                                    {/* [B2] Student chỉ thấy email của bản thân */}
                                    {(isTeacher || s._id === user?._id) && (
                                        <div style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>{s.email}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {(!classroom.students || classroom.students.length === 0) && (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85em' }}>
                                Chưa có sinh viên nào
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    header: {
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
    },
    backBtn: {
        background: 'none', border: '1px solid var(--border)', borderRadius: 8,
        padding: '6px 8px', cursor: 'pointer', color: 'var(--text-primary)',
        display: 'flex', alignItems: 'center',
    },
    endBar: {
        background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.3)',
        padding: '8px 20px', display: 'flex', gap: 10, alignItems: 'center',
    },
    tabBar: {
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)', padding: '0 16px',
    },
    tab: {
        border: 'none', background: 'none', padding: '10px 16px', cursor: 'pointer',
        fontSize: '0.85em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
        gap: 6, borderBottom: '2px solid transparent', transition: 'all 0.2s',
        fontWeight: 500,
    },
    tabActive: {
        color: 'var(--accent)', borderBottomColor: 'var(--accent)', fontWeight: 600,
    },
    tabCount: {
        background: 'var(--accent)', color: '#fff', borderRadius: 10,
        padding: '1px 7px', fontSize: '0.75em', fontWeight: 700,
    },
    tabContent: {
        flex: 1, overflow: 'auto', background: 'var(--bg-primary)',
    },
    postsArea: {
        flex: 1, overflow: 'auto', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
    },
    postCard: {
        background: 'var(--bg-card)', borderRadius: 12, padding: 16,
        border: '1px solid var(--border)',
    },
    postHeader: {
        display: 'flex', alignItems: 'center', gap: 10,
    },
    postAvatar: {
        width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: '0.85em', flexShrink: 0,
    },
    recordingCard: {
        marginTop: 12, background: 'var(--bg-primary)', borderRadius: 10,
        overflow: 'hidden', border: '1px solid var(--border)',
    },
    videoPlayer: {
        width: '100%', maxHeight: 360, background: '#000', display: 'block',
    },
    recordingMeta: {
        padding: '8px 12px', display: 'flex', gap: 14, fontSize: '0.78em',
        color: 'var(--text-muted)', alignItems: 'center',
    },
    downloadBtn: {
        marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
        color: 'var(--accent)', textDecoration: 'none', fontWeight: 600,
        fontSize: '0.85em',
    },
    recListItem: {
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)',
    },
    recThumb: {
        width: 48, height: 48, borderRadius: 10, background: 'var(--accent-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    dlIconBtn: {
        width: 36, height: 36, borderRadius: 8, background: 'var(--accent-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent)', textDecoration: 'none', flexShrink: 0,
    },
    memberSection: {
        fontSize: '0.75em', fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: 1, padding: '12px 0 6px',
        borderBottom: '1px solid var(--border)', marginBottom: 4,
    },
    memberItem: {
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px',
        borderRadius: 8,
    },
    memberAvatar: {
        width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: '0.8em', flexShrink: 0,
    },
};
