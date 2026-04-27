import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiAPI, classroomsAPI } from '../../api/api';
import { SkeletonStats, SkeletonList } from '../../components/Skeleton';
import {
    FiActivity, FiBookOpen, FiVideo, FiAlertCircle,
    FiClock, FiChevronRight, FiRefreshCw, FiBarChart2,
    FiTrendingDown, FiCheckCircle, FiTarget, FiAward,
    FiTrendingUp, FiBook, FiAlertTriangle, FiLayers,
} from 'react-icons/fi';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/* ── Bản dịch tiếng Việt ── */
const SUBJECT_VI = {
    informatics: 'Tin học', physics: 'Vật lý', chemistry: 'Hóa học',
    biology: 'Sinh học', literature: 'Ngữ văn', mathematics: 'Toán học',
    english: 'Tiếng Anh', history: 'Lịch sử', geography: 'Địa lý',
    art: 'Mỹ thuật', music: 'Âm nhạc', pe: 'Thể dục',
    economics: 'Kinh tế', philosophy: 'Triết học', sociology: 'Xã hội học',
};
const subjectVi = (s) => SUBJECT_VI[s?.toLowerCase()] || s || '—';

const DIFFICULTY_VI = { easy: 'Cơ bản', medium: 'Trung bình', hard: 'Nâng cao' };
const diffVi = (d) => DIFFICULTY_VI[d] || d || '—';

const ENGAGEMENT_MAP = {
    high: { label: 'Tốt', color: 'var(--success)', emoji: '🟢', desc: 'Bạn đang học rất tích cực!' },
    medium: { label: 'Trung bình', color: 'var(--info)', emoji: '🟡', desc: 'Cần tăng cường thêm hoạt động học tập.' },
    low: { label: 'Thấp', color: 'var(--warning)', emoji: '🟠', desc: 'Mức độ tương tác thấp, cần cải thiện.' },
    at_risk: { label: 'Có nguy cơ', color: 'var(--danger)', emoji: '🔴', desc: 'Cảnh báo! Cần hỗ trợ và tăng cường học tập ngay.' },
};

const ENGAGEMENT_KEY_VI = {
    at_risk: 'Có nguy cơ', high: 'Tốt', low: 'Thấp', medium: 'Trung bình',
};

/* ── Thanh tiến trình tròn nhỏ ── */
function MiniRing({ value, size = 44, stroke = 4, color = 'var(--accent)' }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, value));
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
            <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fontSize="0.7em"
                fontWeight="800" fill={color} style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
                {Math.round(pct)}
            </text>
        </svg>
    );
}

/* ── Đánh giá trình độ dựa trên điểm ── */
function getScoreLevel(score) {
    if (score >= 90) return { label: 'Xuất sắc', color: 'var(--success)', icon: '🏆' };
    if (score >= 80) return { label: 'Giỏi', color: 'var(--success)', icon: '⭐' };
    if (score >= 65) return { label: 'Khá', color: 'var(--info)', icon: '👍' };
    if (score >= 50) return { label: 'Trung bình', color: 'var(--warning)', icon: '📝' };
    return { label: 'Cần cải thiện', color: 'var(--danger)', icon: '⚠️' };
}

function getDiffColor(d) {
    if (d === 'easy') return 'var(--success)';
    if (d === 'medium') return 'var(--info)';
    return 'var(--warning)';
}

export default function StudentLearning() {
    const navigate = useNavigate();
    const [classrooms, setClassrooms] = useState([]);
    const [aiData, setAiData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [aiLoading, setAiLoading] = useState(true);
    const [aiError, setAiError] = useState('');

    const loadData = async () => {
        setLoading(true); setAiLoading(true); setAiError('');
        try {
            const r = await classroomsAPI.getAll();
            setClassrooms(r.data);
            setLoading(false);

            try {
                const aiRes = await aiAPI.getMyData();
                setAiData(aiRes.data);
            } catch (err) {
                setAiError(err.response?.data?.error || 'Không kết nối được AI Service');
            } finally {
                setAiLoading(false);
            }
        } catch (err) {
            setLoading(false); setAiLoading(false);
            console.error(err);
        }
    };

    useEffect(() => { loadData(); }, []);

    const eng = aiData?.engagement;
    const engInfo = ENGAGEMENT_MAP[eng?.engagement] || ENGAGEMENT_MAP.medium;
    const avgScore = aiData?.stats?.avg_score ?? 0;
    const scoreLevel = getScoreLevel(avgScore);
    const attendanceRate = aiData?.meta?.attendanceRate ?? 0;
    const subjectScores = aiData?.meta?.subjectScores || {};
    const completionRate = Math.round((aiData?.stats?.completion_rate ?? 0) * 100);
    const totalCompleted = aiData?.stats?.total_completed ?? 0;
    const totalLessons = aiData?.stats?.total_lessons ?? 0;
    const totalNotSubmitted = aiData?.meta?.totalNotSubmitted ?? 0;
    const recDifficulty = avgScore >= 80 ? 'hard' : avgScore >= 60 ? 'medium' : 'easy';

    return (
        <>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">Lộ trình học tập</h1>
                        <p className="page-subtitle">Phân tích AI cá nhân hóa dựa trên dữ liệu điểm danh & bài tập thực tế</p>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={loadData} disabled={loading || aiLoading}>
                        <FiRefreshCw size={14} className={aiLoading ? 'spinning' : ''} /> Làm mới
                    </button>
                </div>
            </div>

            {/* ── Lớp học đang tham gia ── */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                    <div className="card-title"><FiVideo size={15} color="var(--accent)" /> Lớp học đang tham gia</div>
                    <button className="card-action" onClick={() => navigate('/student/classrooms')}>
                        Xem tất cả <FiChevronRight size={13} />
                    </button>
                </div>
                {loading && <SkeletonList rows={3} />}
                {!loading && classrooms.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875em', padding: '16px 0', textAlign: 'center' }}>
                        Bạn chưa được thêm vào lớp học nào
                    </div>
                )}
                {!loading && classrooms.map(c => (
                    <div key={c._id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 0', borderBottom: '1px solid var(--border)',
                        cursor: 'pointer'
                    }} onClick={() => navigate(`/student/classroom/${c._id}`)}>
                        <div style={{
                            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                            background: c.meeting?.isLive ? 'var(--success-light)' : 'var(--accent-light)',
                            color: c.meeting?.isLive ? 'var(--success)' : 'var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '1em'
                        }}>
                            {c.name?.[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.875em' }}>{c.name}</div>
                            <div style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>
                                {c.subject}
                                {c.schedule?.dayOfWeek && ` • ${c.schedule.dayOfWeek.map(d => DAYS[d]).join(', ')} ${c.schedule.startTime}–${c.schedule.endTime}`}
                            </div>
                        </div>
                        {c.meeting?.isLive
                            ? <span className="live-dot" style={{ flexShrink: 0 }}>LIVE</span>
                            : <span style={{ fontSize: '0.75em', color: 'var(--text-muted)', flexShrink: 0 }}>
                                <FiClock size={11} style={{ marginRight: 4 }} />{c.schedule?.startTime || 'Chờ'}
                            </span>
                        }
                    </div>
                ))}
            </div>

            {/* ── AI Error ── */}
            {aiError && (
                <div className="notice notice-warning" style={{ marginBottom: 16 }}>
                    <FiAlertCircle size={14} />
                    <span><strong>AI Service tạm thời không khả dụng:</strong> {aiError}</span>
                </div>
            )}

            {aiLoading ? (
                <SkeletonStats count={4} />
            ) : aiData && (
                <>
                    {/* ── Tổng quan học tập ── */}
                    <div className="stats-grid" style={{ marginBottom: 20 }}>
                        <div className="stat-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <MiniRing value={avgScore} color={scoreLevel.color} />
                                <div>
                                    <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', marginBottom: 2 }}>Điểm trung bình</div>
                                    <div style={{ fontSize: '1.4em', fontWeight: 900, color: scoreLevel.color }}>{avgScore}<span style={{ fontSize: '0.5em', fontWeight: 400 }}>/100</span></div>
                                    <div style={{ fontSize: '0.72em', fontWeight: 600, color: scoreLevel.color }}>{scoreLevel.icon} {scoreLevel.label}</div>
                                </div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <MiniRing value={attendanceRate} color={attendanceRate >= 80 ? 'var(--success)' : 'var(--danger)'} />
                                <div>
                                    <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', marginBottom: 2 }}>Tỉ lệ điểm danh</div>
                                    <div style={{ fontSize: '1.4em', fontWeight: 900, color: attendanceRate >= 80 ? 'var(--success)' : 'var(--danger)' }}>{attendanceRate}%</div>
                                    <div style={{ fontSize: '0.72em', fontWeight: 600, color: attendanceRate >= 80 ? 'var(--success)' : 'var(--danger)' }}>
                                        {attendanceRate >= 80 ? '✅ Đạt yêu cầu' : '⚠️ Dưới mức yêu cầu'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}><FiBook size={18} /></div>
                            <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', marginBottom: 2, marginTop: 10 }}>Bài tập đã chấm</div>
                            <div style={{ fontSize: '1.4em', fontWeight: 900, color: 'var(--accent)' }}>
                                {aiData.meta?.gradedAssignments || 0}<span style={{ fontSize: '0.5em', fontWeight: 400, color: 'var(--text-muted)' }}>/{aiData.meta?.totalAssignments || 0}</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: engInfo.color === 'var(--success)' ? 'var(--success-light)' : engInfo.color === 'var(--danger)' ? 'var(--danger-light)' : 'var(--accent-light)', color: engInfo.color }}><FiActivity size={18} /></div>
                            <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', marginBottom: 2, marginTop: 10 }}>Mức độ tương tác</div>
                            <div style={{ fontSize: '1.2em', fontWeight: 900, color: engInfo.color }}>{engInfo.emoji} {engInfo.label}</div>
                            <div style={{ fontSize: '0.68em', color: 'var(--text-muted)', marginTop: 2 }}>{engInfo.desc}</div>
                        </div>

                        <div className="stat-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <MiniRing value={completionRate} color={completionRate >= 70 ? 'var(--success)' : completionRate >= 40 ? 'var(--warning)' : 'var(--danger)'} />
                                <div>
                                    <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', marginBottom: 2 }}>Tiến độ hoàn thành</div>
                                    <div style={{ fontSize: '1.4em', fontWeight: 900, color: completionRate >= 70 ? 'var(--success)' : completionRate >= 40 ? 'var(--warning)' : 'var(--danger)' }}>{completionRate}%</div>
                                    <div style={{ fontSize: '0.68em', color: 'var(--text-muted)' }}>{totalCompleted}/{totalLessons} bài tập</div>
                                </div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: totalNotSubmitted > 0 ? 'rgba(239,68,68,0.1)' : 'var(--success-light)', color: totalNotSubmitted > 0 ? 'var(--danger)' : 'var(--success)' }}><FiAlertTriangle size={18} /></div>
                            <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', marginBottom: 2, marginTop: 10 }}>Bài chưa nộp</div>
                            <div style={{ fontSize: '1.4em', fontWeight: 900, color: totalNotSubmitted > 0 ? 'var(--danger)' : 'var(--success)' }}>{totalNotSubmitted}</div>
                            <div style={{ fontSize: '0.68em', color: 'var(--text-muted)', marginTop: 2 }}>{totalNotSubmitted > 0 ? '⚠️ Cần nộp sớm' : '✅ Đã nộp hết'}</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: recDifficulty === 'hard' ? 'rgba(124,58,237,0.1)' : recDifficulty === 'medium' ? 'var(--accent-light)' : 'var(--success-light)', color: recDifficulty === 'hard' ? '#7c3aed' : recDifficulty === 'medium' ? 'var(--info)' : 'var(--success)' }}><FiLayers size={18} /></div>
                            <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', marginBottom: 2, marginTop: 10 }}>Độ khó đề xuất</div>
                            <div style={{ fontSize: '1.2em', fontWeight: 900, color: recDifficulty === 'hard' ? '#7c3aed' : recDifficulty === 'medium' ? 'var(--info)' : 'var(--success)' }}>
                                {recDifficulty === 'hard' ? '🔥 Nâng cao' : recDifficulty === 'medium' ? '📘 Trung bình' : '📗 Cơ bản'}
                            </div>
                            <div style={{ fontSize: '0.68em', color: 'var(--text-muted)', marginTop: 2 }}>Dựa trên điểm TB: {avgScore}/100</div>
                        </div>
                    </div>

                    {/* ── Cảnh báo AI ── */}
                    {aiData.warnings?.map((w, i) => (
                        <div key={i} className={`notice ${w.type === 'critical' ? 'notice-danger' : 'notice-warning'}`} style={{ marginBottom: 8 }}>
                            <span>{w.icon}</span>
                            <span>{w.message}</span>
                        </div>
                    ))}

                    {/* ── 🤖 AI Predictions (ML-powered) ── */}
                    {(() => {
                        const aiPred = aiData.ai_predictions;
                        const predScores = aiPred?.predicted_scores || [];
                        const studyOrder = aiPred?.study_order || [];
                        const simStudents = aiPred?.similar_students;
                        const isML = aiPred?.data_source === 'ml_model';

                        if (!isML && !predScores.length) return (
                            <div className="notice notice-warning" style={{ marginBottom: 16 }}>
                                <FiAlertCircle size={14} />
                                <span>AI model chưa được train. Gợi ý đang dùng chế độ heuristic (cơ bản).</span>
                            </div>
                        );

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                                {/* ── 🎯 Dự đoán điểm AI (CF Model) ── */}
                                {predScores.length > 0 && (
                                    <div className="card" style={{ border: '1px solid var(--accent)' }}>
                                        <div className="card-header">
                                            <div className="card-title"><FiTarget size={15} color="var(--accent)" /> Dự đoán điểm AI</div>
                                            <span style={{ fontSize: '0.68em', color: 'var(--accent)', fontWeight: 600 }}>Collaborative Filtering Model</span>
                                        </div>
                                        <div style={{ fontSize: '0.73em', color: 'var(--text-muted)', marginBottom: 12 }}>
                                            AI dự đoán điểm của bạn ở từng lớp học — dựa trên patterns của tất cả sinh viên
                                        </div>
                                        {predScores.slice(0, 8).map((p, i) => {
                                            const barColor = p.predicted_score >= 70 ? 'var(--success)' : p.predicted_score >= 50 ? 'var(--warning)' : 'var(--danger)';
                                            return (
                                                <div key={i} style={{ marginBottom: 10 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82em', marginBottom: 4 }}>
                                                        <span style={{ fontWeight: 600 }}>{p.subject || p.name}</span>
                                                        <span style={{ fontWeight: 700, color: barColor }}>
                                                            {p.has_actual_score ? '✓ ' : '🤖 '}{p.predicted_score}/100
                                                        </span>
                                                    </div>
                                                    <div className="progress-track" style={{ height: 7 }}>
                                                        <div className="progress-fill" style={{ width: `${p.predicted_score}%`, background: barColor }} />
                                                    </div>
                                                    <div style={{ fontSize: '0.68em', color: 'var(--text-muted)', marginTop: 2 }}>
                                                        {p.has_actual_score ? 'Đã có điểm thực tế' : `Dự đoán • ${p.difficulty}`}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="grid grid-2">
                                    {/* ── 📊 Thứ tự học tối ưu (Embedding Similarity) ── */}
                                    {studyOrder.length > 0 && (
                                        <div className="card" style={{ border: '1px solid #7c3aed' }}>
                                            <div className="card-header">
                                                <div className="card-title"><FiLayers size={15} color="#7c3aed" /> Thứ tự học tối ưu</div>
                                                <span style={{ fontSize: '0.68em', color: '#7c3aed', fontWeight: 600 }}>Embedding Analysis</span>
                                            </div>
                                            <div style={{ fontSize: '0.73em', color: 'var(--text-muted)', marginBottom: 12 }}>
                                                Thứ tự được tính riêng cho BẠN — dựa trên cosine similarity giữa student & lesson embeddings
                                            </div>
                                            {studyOrder.slice(0, 6).map((item, i) => (
                                                <div key={i} style={{
                                                    display: 'flex', alignItems: 'center', gap: 10,
                                                    padding: '8px 10px', marginBottom: 6,
                                                    background: i === 0 ? 'rgba(124,58,237,0.08)' : 'transparent',
                                                    borderRadius: 8, border: i === 0 ? '1px solid rgba(124,58,237,0.2)' : '1px solid var(--border)',
                                                }}>
                                                    <span style={{
                                                        width: 26, height: 26, borderRadius: 8,
                                                        background: i === 0 ? '#7c3aed' : 'var(--bg-secondary)',
                                                        color: i === 0 ? '#fff' : 'var(--text-muted)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontWeight: 800, fontSize: '0.78em', flexShrink: 0,
                                                    }}>{item.rank}</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.82em' }}>{item.subject || item.name}</div>
                                                        <div style={{ fontSize: '0.7em', color: 'var(--text-muted)' }}>
                                                            Affinity: {(item.affinity * 100).toFixed(0)}% • Dự đoán: {item.predicted_score}/100
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: '0.68em', color: '#7c3aed', fontWeight: 600, textAlign: 'right', maxWidth: 120 }}>
                                                        {item.reason}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* ── 👥 So sánh nhóm tương tự (Student Embedding) ── */}
                                    {simStudents && simStudents.peer_count > 0 && (
                                        <div className="card" style={{ border: '1px solid var(--info)' }}>
                                            <div className="card-header">
                                                <div className="card-title"><FiAward size={15} color="var(--info)" /> So sánh với nhóm tương tự</div>
                                                <span style={{ fontSize: '0.68em', color: 'var(--info)', fontWeight: 600 }}>Student Embeddings</span>
                                            </div>
                                            <div style={{ fontSize: '0.73em', color: 'var(--text-muted)', marginBottom: 16 }}>
                                                AI tìm {simStudents.peer_count} sinh viên có profile giống bạn nhất (similarity: {(simStudents.avg_similarity * 100).toFixed(0)}%)
                                            </div>

                                            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                                                <div style={{ flex: 1, textAlign: 'center', padding: '12px 8px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                                                    <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', marginBottom: 4 }}>Điểm TB của bạn</div>
                                                    <div style={{ fontSize: '1.6em', fontWeight: 900, color: 'var(--accent)' }}>{simStudents.your_avg_score}</div>
                                                </div>
                                                <div style={{ flex: 1, textAlign: 'center', padding: '12px 8px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                                                    <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', marginBottom: 4 }}>TB nhóm tương tự</div>
                                                    <div style={{ fontSize: '1.6em', fontWeight: 900, color: 'var(--info)' }}>{simStudents.peer_avg_score}</div>
                                                </div>
                                                <div style={{ flex: 1, textAlign: 'center', padding: '12px 8px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                                                    <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', marginBottom: 4 }}>Chênh lệch</div>
                                                    <div style={{
                                                        fontSize: '1.6em', fontWeight: 900,
                                                        color: simStudents.score_diff > 0 ? 'var(--success)' : simStudents.score_diff < 0 ? 'var(--danger)' : 'var(--text-muted)'
                                                    }}>
                                                        {simStudents.score_diff > 0 ? '+' : ''}{simStudents.score_diff}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{
                                                padding: '10px 14px', borderRadius: 8,
                                                background: simStudents.comparison === 'above' ? 'rgba(34,197,94,0.08)' : simStudents.comparison === 'below' ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)',
                                                border: `1px solid ${simStudents.comparison === 'above' ? 'var(--success)' : simStudents.comparison === 'below' ? 'var(--danger)' : 'var(--border)'}`,
                                                fontSize: '0.82em', fontWeight: 600,
                                                color: simStudents.comparison === 'above' ? 'var(--success)' : simStudents.comparison === 'below' ? 'var(--danger)' : 'var(--text-secondary)',
                                            }}>
                                                {simStudents.comparison === 'above' ? '🏆' : simStudents.comparison === 'below' ? '📈' : '🤝'} {simStudents.insight}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── ADVANCED ML ANALYTICS ── */}
                    {(() => {
                        const aiPred = aiData.ai_predictions;
                        if (!aiPred || aiPred.data_source !== 'ml_model') return null;

                        const trajectory = aiPred.score_trajectory;
                        const riskMap = aiPred.risk_map || [];
                        const studyTime = aiPred.study_time_estimates || [];
                        const clusters = aiPred.subject_clusters || [];
                        const insights = aiPred.smart_insights || [];

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                                {/* ── 💡 Smart Insights ── */}
                                {insights.length > 0 && (
                                    <div className="card" style={{ border: '1px solid #f59e0b', background: 'linear-gradient(135deg, rgba(245,158,11,0.03), transparent)' }}>
                                        <div className="card-header">
                                            <div className="card-title"><span style={{ fontSize: '1.1em' }}>💡</span> AI Insights</div>
                                            <span style={{ fontSize: '0.68em', color: '#f59e0b', fontWeight: 600 }}>Tổng hợp từ tất cả models</span>
                                        </div>
                                        {insights.map((ins, i) => (
                                            <div key={i} style={{
                                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                                padding: '10px 12px', marginBottom: 6, borderRadius: 8,
                                                background: ins.type === 'positive' ? 'rgba(34,197,94,0.06)' :
                                                    ins.type === 'warning' || ins.type === 'negative' ? 'rgba(239,68,68,0.06)' : 'var(--bg-secondary)',
                                                border: `1px solid ${ins.type === 'positive' ? 'rgba(34,197,94,0.15)' :
                                                    ins.type === 'warning' || ins.type === 'negative' ? 'rgba(239,68,68,0.15)' : 'var(--border)'}`,
                                            }}>
                                                <span style={{ fontSize: '1.1em', flexShrink: 0 }}>{ins.icon}</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.82em', fontWeight: 600, color: 'var(--text-primary)' }}>{ins.text}</div>
                                                    <div style={{ fontSize: '0.65em', color: 'var(--text-muted)', marginTop: 3 }}>📐 {ins.source}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="grid grid-2">
                                    {/* ── 📈 Score Trajectory ── */}
                                    {trajectory && trajectory.trend !== 'insufficient_data' && trajectory.trend !== 'error' && (
                                        <div className="card" style={{ border: `1px solid ${trajectory.trend === 'improving' ? 'var(--success)' : trajectory.trend === 'declining' ? 'var(--danger)' : 'var(--border)'}` }}>
                                            <div className="card-header">
                                                <div className="card-title"><FiTrendingUp size={15} color={trajectory.trend === 'improving' ? 'var(--success)' : trajectory.trend === 'declining' ? 'var(--danger)' : 'var(--info)'} /> Xu hướng điểm</div>
                                                <span style={{ fontSize: '0.68em', color: 'var(--text-muted)', fontWeight: 600 }}>Linear Regression (R²={trajectory.confidence})</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                                                <div style={{ flex: 1, textAlign: 'center', padding: '10px 6px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                                                    <div style={{ fontSize: '0.68em', color: 'var(--text-muted)' }}>Xu hướng</div>
                                                    <div style={{ fontSize: '1.3em', fontWeight: 900, color: trajectory.trend === 'improving' ? 'var(--success)' : trajectory.trend === 'declining' ? 'var(--danger)' : 'var(--info)' }}>
                                                        {trajectory.trend === 'improving' ? '📈 Tăng' : trajectory.trend === 'declining' ? '📉 Giảm' : '➡️ Ổn định'}
                                                    </div>
                                                </div>
                                                <div style={{ flex: 1, textAlign: 'center', padding: '10px 6px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                                                    <div style={{ fontSize: '0.68em', color: 'var(--text-muted)' }}>Tốc độ</div>
                                                    <div style={{ fontSize: '1.3em', fontWeight: 900 }}>{trajectory.slope > 0 ? '+' : ''}{trajectory.slope}/bài</div>
                                                </div>
                                                <div style={{ flex: 1, textAlign: 'center', padding: '10px 6px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                                                    <div style={{ fontSize: '0.68em', color: 'var(--text-muted)' }}>Dự đoán tiếp</div>
                                                    <div style={{ fontSize: '1.3em', fontWeight: 900, color: 'var(--accent)' }}>{trajectory.predicted_next}/100</div>
                                                </div>
                                            </div>
                                            {Object.entries(trajectory.subjects || {}).map(([subj, t]) => (
                                                <div key={subj} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '0.78em' }}>
                                                    <span>{subj}</span>
                                                    <span style={{ fontWeight: 700, color: t.trend === 'improving' ? 'var(--success)' : t.trend === 'declining' ? 'var(--danger)' : 'var(--text-muted)' }}>
                                                        {t.trend === 'improving' ? '↑' : t.trend === 'declining' ? '↓' : '→'} {t.slope > 0 ? '+' : ''}{t.slope}/bài → {t.predicted_next}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* ── 🔥 Risk Heatmap ── */}
                                    {riskMap.length > 0 && (
                                        <div className="card" style={{ border: '1px solid var(--danger)' }}>
                                            <div className="card-header">
                                                <div className="card-title"><FiAlertTriangle size={15} color="var(--danger)" /> Bản đồ rủi ro</div>
                                                <span style={{ fontSize: '0.68em', color: 'var(--danger)', fontWeight: 600 }}>4-Factor Analysis</span>
                                            </div>
                                            <div style={{ fontSize: '0.73em', color: 'var(--text-muted)', marginBottom: 10 }}>
                                                Kết hợp: Dự đoán điểm × Xu hướng × Điểm thực × Độ ổn định
                                            </div>
                                            {riskMap.slice(0, 6).map((r, i) => {
                                                const rColor = r.risk_level === 'high' ? 'var(--danger)' : r.risk_level === 'medium' ? 'var(--warning)' : 'var(--success)';
                                                return (
                                                    <div key={i} style={{ marginBottom: 8 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', marginBottom: 3 }}>
                                                            <span style={{ fontWeight: 600 }}>
                                                                {r.risk_level === 'high' ? '🔴' : r.risk_level === 'medium' ? '🟡' : '🟢'} {r.subject}
                                                            </span>
                                                            <span style={{ fontWeight: 800, color: rColor }}>{r.risk_pct}%</span>
                                                        </div>
                                                        <div className="progress-track" style={{ height: 6 }}>
                                                            <div className="progress-fill" style={{ width: `${r.risk_pct}%`, background: rColor }} />
                                                        </div>
                                                        <div style={{ fontSize: '0.65em', color: 'var(--text-muted)', marginTop: 2 }}>
                                                            Dự đoán: {r.predicted_score} • {r.trend === 'declining' ? '↓ Giảm' : r.trend === 'improving' ? '↑ Tăng' : '→ Ổn định'}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-2">
                                    {/* ── ⏱️ Study Time Estimates ── */}
                                    {studyTime.length > 0 && (
                                        <div className="card" style={{ border: '1px solid var(--info)' }}>
                                            <div className="card-header">
                                                <div className="card-title"><FiClock size={15} color="var(--info)" /> Thời gian cần học</div>
                                                <span style={{ fontSize: '0.68em', color: 'var(--info)', fontWeight: 600 }}>Peer-based Estimation</span>
                                            </div>
                                            <div style={{ fontSize: '0.73em', color: 'var(--text-muted)', marginBottom: 10 }}>
                                                Ước tính giờ học cần thiết — dựa trên data của sinh viên tương tự
                                            </div>
                                            {studyTime.slice(0, 6).map((st, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.82em' }}>{st.subject}</div>
                                                        <div style={{ fontSize: '0.7em', color: 'var(--text-muted)' }}>
                                                            {st.current_score} → {st.target_score} ({st.peer_based ? 'peer data' : 'ước tính'})
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 800, fontSize: '1em', color: 'var(--info)' }}>~{st.estimated_hours}h</div>
                                                        <div style={{ fontSize: '0.65em', color: 'var(--text-muted)' }}>+{st.gap} điểm</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* ── 🔗 Subject Clusters ── */}
                                    {clusters.length > 0 && (
                                        <div className="card" style={{ border: '1px solid #7c3aed' }}>
                                            <div className="card-header">
                                                <div className="card-title"><FiLayers size={15} color="#7c3aed" /> Nhóm môn học</div>
                                                <span style={{ fontSize: '0.68em', color: '#7c3aed', fontWeight: 600 }}>Embedding Clustering</span>
                                            </div>
                                            <div style={{ fontSize: '0.73em', color: 'var(--text-muted)', marginBottom: 10 }}>
                                                Các môn được nhóm theo embedding similarity — mạnh/yếu từng nhóm
                                            </div>
                                            {clusters.map((cl, i) => (
                                                <div key={i} style={{
                                                    padding: '10px 12px', marginBottom: 8, borderRadius: 10,
                                                    background: cl.strength === 'strong' ? 'rgba(34,197,94,0.06)' : cl.strength === 'weak' ? 'rgba(239,68,68,0.06)' : 'var(--bg-secondary)',
                                                    border: `1px solid ${cl.strength === 'strong' ? 'rgba(34,197,94,0.2)' : cl.strength === 'weak' ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                        <span style={{
                                                            fontSize: '0.72em', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                                                            background: cl.strength === 'strong' ? 'var(--success)' : cl.strength === 'weak' ? 'var(--danger)' : 'var(--info)',
                                                            color: '#fff',
                                                        }}>
                                                            {cl.strength === 'strong' ? '💪 Mạnh' : cl.strength === 'weak' ? '📚 Yếu' : '📘 TB'}
                                                        </span>
                                                        <span style={{ fontSize: '0.75em', fontWeight: 700 }}>TB: {cl.avg_score}/100</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>
                                                        {cl.subjects.join(' • ')}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    <div className="grid grid-2">
                        {/* ── Điểm theo lớp học thực tế ── */}
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title"><FiBarChart2 size={15} color="var(--accent)" /> Điểm theo môn học</div>
                                <span style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>Từ bài tập thực tế</span>
                            </div>
                            {Object.keys(subjectScores).length > 0 ? (
                                Object.entries(subjectScores).map(([subject, scores], i) => {
                                    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                                    const level = getScoreLevel(avg);
                                    return (
                                        <div key={i} style={{
                                            padding: '14px 16px', background: 'var(--bg-primary)', borderRadius: 12,
                                            marginBottom: 8, border: '1px solid var(--border)',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: level.color + '18', color: level.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75em' }}>
                                                        {subject[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.88em' }}>{subject}</div>
                                                        <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>{scores.length} bài đã chấm</div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '1.1em', fontWeight: 800, color: level.color }}>{avg}<span style={{ fontSize: '0.6em', fontWeight: 400 }}>/100</span></div>
                                                    <div style={{ fontSize: '0.68em', fontWeight: 600, color: level.color }}>{level.label}</div>
                                                </div>
                                            </div>
                                            <div className="progress-track">
                                                <div className="progress-fill" style={{ width: `${avg}%`, background: level.color }} />
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="empty-state" style={{ padding: '24px 0' }}>
                                    <div className="empty-state-icon"><FiBookOpen size={20} /></div>
                                    <div className="empty-state-title">Chưa có dữ liệu điểm</div>
                                    <div className="empty-state-sub">Hoàn thành bài tập để xem điểm theo môn</div>
                                </div>
                            )}
                        </div>

                        {/* ── Gợi ý AI + Mức độ tương tác ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Tình hình các lớp học */}
                            <div className="card">
                                <div className="card-header">
                                    <div className="card-title"><FiTarget size={15} color="var(--accent)" /> Tình hình các lớp</div>
                                    <span style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>Dữ liệu thực tế</span>
                                </div>
                                {aiData.next_lessons?.length > 0 ? aiData.next_lessons.map((l, i) => {
                                    const hasScore = l.avg_score !== null && l.avg_score !== undefined;
                                    const level = hasScore ? getScoreLevel(l.avg_score) : null;
                                    return (
                                        <div key={i} onClick={() => l.classroom_id && navigate(`/student/classroom/${l.classroom_id}`)} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '12px 14px', background: 'var(--bg-primary)', borderRadius: 12,
                                            marginBottom: 8, border: '1px solid var(--border)', cursor: 'pointer',
                                            borderLeft: l.not_submitted > 0 ? '3px solid var(--warning)' : hasScore ? `3px solid ${level.color}` : '3px solid var(--border)',
                                            transition: 'all 0.15s ease',
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                                        >
                                            <div style={{
                                                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                                                background: hasScore ? level.color + '15' : 'var(--accent-light)',
                                                color: hasScore ? level.color : 'var(--accent)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 800, fontSize: '0.85em',
                                            }}>
                                                {l.classroom_name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.84em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {l.classroom_name || l.subject}
                                                </div>
                                                <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span>{l.subject}</span>
                                                    {l.total_assignments > 0 && <span>• {l.total_assignments} bài tập</span>}
                                                    {l.not_submitted > 0 && (
                                                        <span style={{ color: 'var(--warning)', fontWeight: 700 }}>• {l.not_submitted} chưa nộp</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                {hasScore ? (
                                                    <>
                                                        <div style={{ fontSize: '1.05em', fontWeight: 800, color: level.color }}>{l.avg_score}<span style={{ fontSize: '0.6em', fontWeight: 400 }}>/100</span></div>
                                                        <div style={{ fontSize: '0.62em', fontWeight: 600, color: level.color }}>{level.label}</div>
                                                    </>
                                                ) : (
                                                    <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có điểm</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="empty-state" style={{ padding: '20px 0' }}>
                                        <div className="empty-state-icon"><FiBookOpen size={18} /></div>
                                        <div className="empty-state-title">Chưa có lớp học</div>
                                        <div className="empty-state-sub">Tham gia lớp học để xem tình hình</div>
                                    </div>
                                )}
                            </div>

                            {/* Mức độ tương tác chi tiết */}
                            {eng && (
                                <div className="card">
                                    <div className="card-header">
                                        <div className="card-title"><FiActivity size={15} color={engInfo.color} /> Phân tích mức độ tương tác</div>
                                    </div>
                                    <div style={{ padding: '2px 0' }}>
                                        {Object.entries(eng.probabilities || {})
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([k, v]) => {
                                                const label = ENGAGEMENT_KEY_VI[k] || k;
                                                const pct = (v * 100).toFixed(1);
                                                const isActive = k === eng.engagement;
                                                const barColor = k === 'high' ? 'var(--success)' : k === 'low' ? 'var(--warning)' : k === 'at_risk' ? 'var(--danger)' : 'var(--info)';
                                                return (
                                                    <div key={k} style={{
                                                        marginBottom: 10, padding: '8px 12px', borderRadius: 8,
                                                        background: isActive ? barColor + '0a' : 'transparent',
                                                        border: isActive ? `1px solid ${barColor}33` : '1px solid transparent',
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', marginBottom: 4 }}>
                                                            <span style={{ fontWeight: isActive ? 700 : 500, color: isActive ? barColor : 'var(--text-secondary)' }}>
                                                                {isActive && '● '}{label}
                                                            </span>
                                                            <span style={{ fontWeight: 700, color: isActive ? barColor : 'var(--text-primary)' }}>{pct}%</span>
                                                        </div>
                                                        <div className="progress-track" style={{ height: 6 }}>
                                                            <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            {/* Môn yếu */}
                            {aiData.weak_subjects?.length > 0 && (
                                <div className="card">
                                    <div className="card-header">
                                        <div className="card-title"><FiTrendingDown size={15} color="var(--danger)" /> Cần cải thiện</div>
                                    </div>
                                    {aiData.weak_subjects.map((s, i) => (
                                        <div key={i} style={{ marginBottom: 12 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', marginBottom: 6 }}>
                                                <span style={{ fontWeight: 600 }}>{subjectVi(s.subject)}</span>
                                                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{s.avg_score}/100</span>
                                            </div>
                                            <div className="progress-track">
                                                <div className="progress-fill" style={{ width: `${s.avg_score}%`, background: 'var(--danger)' }} />
                                            </div>
                                            <div style={{ fontSize: '0.73em', color: 'var(--text-muted)', marginTop: 4 }}>{s.suggestion}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
