import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { classroomsAPI, assignmentsAPI } from '../../api/api';
import {
    FiPlus, FiBook, FiClock, FiTrash2, FiEdit2, FiX,
    FiUsers, FiCheckCircle, FiStar, FiSend, FiDownload,
    FiAlertCircle, FiAlertTriangle, FiAward, FiFilter,
    FiChevronRight, FiMessageSquare, FiCalendar,
} from 'react-icons/fi';

const TYPE_META = {
    homework: { label: 'Bài tập', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
    quiz:     { label: 'Kiểm tra', color: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },
    project:  { label: 'Đồ án',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
    exam:     { label: 'Thi',     color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
};
const TYPE_OPTS = [
    { value: 'homework', label: 'Bài tập về nhà' },
    { value: 'quiz',     label: 'Kiểm tra nhanh' },
    { value: 'project',  label: 'Đồ án' },
    { value: 'exam',     label: 'Thi' },
];
const ACCENT_COLORS = ['#6366f1','#06b6d4','#8b5cf6','#10b981','#f59e0b','#0ea5e9'];

/* ── Glassmorphism Modal ── */
function Modal({ title, onClose, children, maxWidth = 500 }) {
    return (
        <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(30,27,75,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000,backdropFilter:'blur(8px)',padding:20 }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:'var(--bg-card)',borderRadius:20,width:'100%',maxWidth,maxHeight:'90vh',overflow:'auto',border:'1px solid var(--border-strong)',boxShadow:'var(--shadow-lg)',position:'relative',animation:'fadeSlideUp 0.25s ease' }}>
                <div style={{ position:'absolute',top:0,left:0,right:0,height:2,background:'var(--gradient-purple)' }} />
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 24px',borderBottom:'1px solid var(--border)',position:'sticky',top:0,background:'var(--bg-card)',zIndex:1 }}>
                    <h3 style={{ display:'flex',alignItems:'center',gap:9,fontSize:'0.95em',fontWeight:700,margin:0 }}>{title}</h3>
                    <button onClick={onClose} style={{ background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer',color:'var(--text-muted)',padding:'5px 7px',display:'flex',transition:'all 0.15s' }}
                        onMouseEnter={e=>{e.currentTarget.style.background='var(--danger-light)';e.currentTarget.style.color='var(--danger)';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='var(--bg-secondary)';e.currentTarget.style.color='var(--text-muted)';}}>                        <FiX size={15}/>
                    </button>
                </div>
                <div style={{ padding:'22px 24px' }}>{children}</div>
            </div>
        </div>
    );
}

/* ── Score ring ── */
function ScoreRing({ score, max, size = 52 }) {
    const pct = max > 0 ? Math.min(score / max, 1) : 0;
    const r = (size-6)/2, c = size/2;
    const circ = 2*Math.PI*r;
    const color = pct >= 0.8 ? '#10b981' : pct >= 0.5 ? '#f59e0b' : '#ef4444';
    return (
        <svg width={size} height={size} style={{ flexShrink:0 }}>
            <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border)" strokeWidth={5}/>
            <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={5}
                strokeDasharray={circ} strokeDashoffset={circ*(1-pct)}
                strokeLinecap="round" transform={`rotate(-90,${c},${c})`}
                style={{ transition:'stroke-dashoffset 0.4s ease' }}/>
            <text x={c} y={c+1} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={size*0.22} fontWeight="800">{score}</text>
        </svg>
    );
}

export default function TeacherAssignment() {
    const { classroomId: paramId } = useParams();
    const navigate = useNavigate();

    const [classrooms, setClassrooms] = useState([]);
    const [selectedId, setSelectedId] = useState(paramId || null);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingA, setLoadingA] = useState(false);

    // Selected assignment for detail panel
    const [activeA, setActiveA] = useState(null);
    const [subs, setSubs] = useState(null);
    const [loadingSubs, setLoadingSubs] = useState(false);

    // Grading
    const [gradingId, setGradingId] = useState(null);
    const [gradeForm, setGradeForm] = useState({ score:'', feedback:'' });
    const [grading, setGrading] = useState(false);

    // Create modal
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ title:'', description:'', type:'homework', dueDate:'', maxScore:100, allowLate:false });
    const [creating, setCreating] = useState(false);
    const [createMsg, setCreateMsg] = useState('');

    // Delete
    const [deleteTarget, setDeleteTarget] = useState(null);

    // Filter
    const [filterStatus, setFilterStatus] = useState('all'); // all | active | past

    useEffect(() => {
        classroomsAPI.getAll().then(r => {
            setClassrooms(r.data);
            if (!selectedId && r.data.length > 0) setSelectedId(r.data[0]._id);
        }).finally(() => setLoading(false));
    }, []);

    useEffect(() => { if (selectedId) loadAssignments(); }, [selectedId]);

    const loadAssignments = () => {
        setLoadingA(true); setActiveA(null); setSubs(null);
        assignmentsAPI.getByClassroom(selectedId)
            .then(r => setAssignments(r.data))
            .catch(()=>setAssignments([]))
            .finally(()=>setLoadingA(false));
    };

    const openDetail = async (a) => {
        setActiveA(a); setGradingId(null);
        setLoadingSubs(true); setSubs(null);
        const r = await assignmentsAPI.getSubmissions(a._id).catch(()=>null);
        setSubs(r?.data || null);
        setLoadingSubs(false);
    };

    const handleCreate = async () => {
        if (!form.title || !form.dueDate) return;
        setCreating(true); setCreateMsg('');
        try {
            const fd = new FormData();
            fd.append('classroomId', selectedId);
            Object.entries(form).forEach(([k,v])=>fd.append(k,v));
            await assignmentsAPI.create(fd);
            setShowCreate(false);
            setForm({ title:'', description:'', type:'homework', dueDate:'', maxScore:100, allowLate:false });
            loadAssignments();
        } catch(e) { setCreateMsg(e.response?.data?.error || e.message); }
        finally { setCreating(false); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await assignmentsAPI.delete(deleteTarget._id).catch(()=>{});
        setDeleteTarget(null);
        if (activeA?._id === deleteTarget._id) { setActiveA(null); setSubs(null); }
        loadAssignments();
    };

    const handleGrade = async (studentId) => {
        if (!activeA || !gradeForm.score) return;
        const scoreNum = Number(gradeForm.score);
        const maxScore = activeA.maxScore || 100;
        if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxScore) {
            alert(`❌ Điểm phải từ 0 đến ${maxScore}`);
            return;
        }
        // [BUG-09 FIX] Capture assignment ref trước async call để tránh race condition
        const currentAssignment = { ...activeA };
        setGrading(true);
        try {
            await assignmentsAPI.grade(currentAssignment._id, studentId, gradeForm);
            setGradingId(null); setGradeForm({ score:'', feedback:'' });
            // Re-fetch detail dùng captured ref, không phải state hiện tại
            openDetail(currentAssignment);
        } catch (e) {
            // [BUG-08 FIX] Hiển thị lỗi thay vì nuốt im lặng
            alert('❌ Chấm điểm thất bại: ' + (e.response?.data?.error || e.message));
        } finally {
            setGrading(false);
        }
    };

    const filteredAssignments = assignments.filter(a => {
        if (filterStatus === 'all') return true;
        const past = new Date(a.dueDate) < Date.now();
        return filterStatus === 'past' ? past : !past;
    });

    const selectedClassroom = classrooms.find(c => c._id === selectedId);
    const classIdx = classrooms.findIndex(c => c._id === selectedId);
    const accent = ACCENT_COLORS[classIdx % ACCENT_COLORS.length] || '#7c3aed';

    return (
        <div style={{ display:'flex', flexDirection:'column', height:'100%', gap:0 }}>
            {/* ── Header ── */}
            <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:14 }}>
                <div>
                    <h1 style={{ fontSize:'1.6em',fontWeight:900,letterSpacing:'-0.5px',margin:0 }}>Bài tập & Chấm điểm</h1>
                    <p style={{ color:'var(--text-muted)',fontSize:'0.875em',marginTop:5 }}>
                        Tạo bài tập, theo dõi nộp bài và chấm điểm sinh viên
                    </p>
                </div>
                <button className="btn btn-primary" onClick={()=>setShowCreate(true)} disabled={!selectedId}>
                    <FiPlus size={15}/> Tạo bài tập
                </button>
            </div>

            {loading ? (
                <div style={{ display:'flex',gap:18 }}>
                    <div style={{ width:320 }}>
                        {[1,2,3].map(k=><div key={k} className="skeleton" style={{ height:80,borderRadius:14,marginBottom:10 }} />)}
                    </div>
                    <div style={{ flex:1,background:'var(--bg-card)',borderRadius:18,height:300 }} className="skeleton" />
                </div>
            ) : (
                <div style={{ display:'flex', flexWrap:'wrap', gap:18, alignItems:'flex-start' }}>
                    {/* ══════ LEFT: Class selector + Assignment list ══════ */}
                    <div style={{ flex: '1 1 280px', maxWidth: '100%' }}>
                        {/* Class tabs */}
                        {classrooms.length > 1 && (
                            <div style={{ marginBottom:14 }}>
                                <div style={{ fontSize:'0.7em',fontWeight:700,textTransform:'uppercase',letterSpacing:0.8,color:'var(--text-muted)',marginBottom:8 }}>Lớp học</div>
                                <div style={{ display:'flex',flexDirection:'column',gap:4 }}>
                                    {classrooms.map((c,i)=>(
                                        <button key={c._id} onClick={()=>setSelectedId(c._id)} style={{
                                            display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:12,
                                            border:`1px solid ${selectedId===c._id?ACCENT_COLORS[i%6]+'44':'var(--border)'}`,
                                            background:selectedId===c._id?ACCENT_COLORS[i%6]+'15':'transparent',
                                            cursor:'pointer',transition:'all 0.18s',textAlign:'left',
                                        }}>
                                            <div style={{ width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${ACCENT_COLORS[i%6]}aa,${ACCENT_COLORS[i%6]}66)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65em',fontWeight:800,color:'#fff',flexShrink:0 }}>
                                                {c.name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase().slice(0,2)}
                                            </div>
                                            <div style={{ minWidth:0 }}>
                                                <div style={{ fontWeight:600,fontSize:'0.82em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:selectedId===c._id?ACCENT_COLORS[i%6]:'var(--text-primary)' }}>{c.name}</div>
                                                <div style={{ fontSize:'0.68em',color:'var(--text-muted)' }}>{c.subject}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Filter chips */}
                        <div style={{ display:'flex',gap:5,marginBottom:12 }}>
                            {[{k:'all',label:'Tất cả'},{k:'active',label:'Đang mở'},{k:'past',label:'Đã kết thúc'}].map(f=>(
                                <button key={f.k} onClick={()=>setFilterStatus(f.k)} style={{ flex:1,padding:'5px 0',borderRadius:99,border:'none',cursor:'pointer',fontSize:'0.72em',fontWeight:700,background:filterStatus===f.k?accent:'rgba(255,255,255,0.05)',color:filterStatus===f.k?'#fff':'var(--text-muted)',transition:'all 0.15s' }}>
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Assignment list */}
                        {loadingA ? (
                            [1,2,3].map(k=><div key={k} className="skeleton" style={{ height:74,borderRadius:14,marginBottom:8 }} />)
                        ) : filteredAssignments.length === 0 ? (
                            <div style={{ textAlign:'center',padding:'32px 16px',background:'var(--bg-card)',borderRadius:16,border:'1px solid var(--border)' }}>
                                <FiBook size={24} style={{ color:'var(--text-muted)',marginBottom:10 }} />
                                <div style={{ fontWeight:700,fontSize:'0.875em',marginBottom:6 }}>Chưa có bài tập</div>
                                <div style={{ fontSize:'0.78em',color:'var(--text-muted)',marginBottom:14 }}>Tạo bài tập đầu tiên cho lớp này</div>
                                <button className="btn btn-sm btn-primary" onClick={()=>setShowCreate(true)}><FiPlus size={13}/>Tạo bài tập</button>
                            </div>
                        ) : (
                            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                                {filteredAssignments.map(a=>{
                                    const tm = TYPE_META[a.type]||TYPE_META.homework;
                                    const past = new Date(a.dueDate) < Date.now();
                                    const subCount = a.submissions?.length||0;
                                    const gradedCount = a.submissions?.filter(s=>s.score!==null&&s.score!==undefined).length||0;
                                    const isActive = activeA?._id===a._id;
                                    return (
                                        <div key={a._id} onClick={()=>openDetail(a)} style={{
                                            padding:'12px 14px',borderRadius:14,border:`1px solid ${isActive?accent+'44':'var(--border)'}`,
                                            background:isActive?`${accent}10`:'var(--bg-card)',
                                            cursor:'pointer',transition:'all 0.18s',position:'relative',overflow:'hidden',
                                        }}
                                            onMouseEnter={e=>{if(!isActive){e.currentTarget.style.borderColor=accent+'33';e.currentTarget.style.background=accent+'08';}}}
                                            onMouseLeave={e=>{if(!isActive){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg-card)';}}}
                                        >
                                            {isActive&&<div style={{ position:'absolute',left:0,top:0,bottom:0,width:3,background:accent,borderRadius:'3px 0 0 3px' }}/>}
                                            <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8 }}>
                                                <div style={{ minWidth:0 }}>
                                                    <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:4,flexWrap:'wrap' }}>
                                                        <span style={{ padding:'2px 8px',borderRadius:99,fontSize:'0.62em',fontWeight:700,background:tm.bg,color:tm.color,border:`1px solid ${tm.color}33` }}>{tm.label}</span>
                                                        {past&&<span style={{ padding:'2px 8px',borderRadius:99,fontSize:'0.62em',fontWeight:600,background:'rgba(100,116,139,0.12)',color:'var(--text-muted)' }}>Đã kết thúc</span>}
                                                    </div>
                                                    <div style={{ fontWeight:700,fontSize:'0.875em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:4 }}>{a.title}</div>
                                                    <div style={{ fontSize:'0.68em',color:'var(--text-muted)',display:'flex',gap:8 }}>
                                                        <span style={{ display:'flex',alignItems:'center',gap:3 }}><FiUsers size={9}/>{subCount} nộp</span>
                                                        <span style={{ display:'flex',alignItems:'center',gap:3,color:gradedCount===subCount&&subCount>0?'var(--success)':'var(--text-muted)' }}><FiCheckCircle size={9}/>{gradedCount} chấm</span>
                                                    </div>
                                                </div>
                                                <FiChevronRight size={14} style={{ color:'var(--text-muted)',flexShrink:0,marginTop:2 }}/>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ══════ RIGHT: Detail panel ══════ */}
                    <div style={{ flex: '2 1 400px', minWidth: 0 }}>
                        {!activeA ? (
                            <div style={{ background:'var(--bg-card)',borderRadius:20,border:'1px solid var(--border)',padding:'60px 24px',textAlign:'center' }}>
                                <div style={{ width:72,height:72,borderRadius:20,background:'var(--accent-light)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px' }}>
                                    <FiBook size={30} color="var(--accent)"/>
                                </div>
                                <div style={{ fontWeight:800,fontSize:'1.05em',marginBottom:8 }}>Chọn một bài tập</div>
                                <div style={{ color:'var(--text-muted)',fontSize:'0.875em' }}>Chọn bài tập bên trái để xem chi tiết, danh sách nộp bài và chấm điểm</div>
                            </div>
                        ) : (
                            <div style={{ background:'var(--bg-card)',borderRadius:20,border:'1px solid var(--border)',overflow:'hidden' }}>
                                {/* Top accent bar */}
                                <div style={{ height:3,background:`linear-gradient(90deg,${accent},${accent}88,transparent)` }}/>

                                {/* Assignment header */}
                                <div style={{ padding:'20px 24px',borderBottom:'1px solid var(--border)' }}>
                                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap' }}>
                                        <div style={{ flex:1,minWidth:0 }}>
                                            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap' }}>
                                                {(() => { const tm=TYPE_META[activeA.type]||TYPE_META.homework; return (
                                                    <span style={{ padding:'3px 12px',borderRadius:99,fontSize:'0.7em',fontWeight:700,background:tm.bg,color:tm.color,border:`1px solid ${tm.color}33` }}>{tm.label}</span>
                                                ); })()}
                                                {new Date(activeA.dueDate)<Date.now()
                                                    ? <span style={{ padding:'3px 12px',borderRadius:99,fontSize:'0.7em',fontWeight:700,background:'rgba(239,68,68,0.1)',color:'var(--danger)',border:'1px solid rgba(239,68,68,0.2)' }}>Đã hết hạn</span>
                                                    : <span style={{ padding:'3px 12px',borderRadius:99,fontSize:'0.7em',fontWeight:700,background:'rgba(16,185,129,0.1)',color:'var(--success)',border:'1px solid rgba(16,185,129,0.2)' }}>Đang mở</span>
                                                }
                                                {activeA.allowLate&&<span style={{ fontSize:'0.66em',color:'var(--text-muted)' }}>• Cho nộp trễ</span>}
                                            </div>
                                            <h2 style={{ fontWeight:900,fontSize:'1.15em',margin:'0 0 8px',letterSpacing:'-0.3px' }}>{activeA.title}</h2>
                                            {activeA.description&&<p style={{ fontSize:'0.84em',color:'var(--text-secondary)',lineHeight:1.6,margin:'0 0 10px' }}>{activeA.description}</p>}
                                            <div style={{ display:'flex',gap:16,flexWrap:'wrap' }}>
                                                <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:'0.78em',color:'var(--text-muted)' }}>
                                                    <FiCalendar size={12} style={{ color:accent }}/>
                                                    Hạn: <strong style={{ color:'var(--text-primary)' }}>{new Date(activeA.dueDate).toLocaleString('vi-VN')}</strong>
                                                </div>
                                                <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:'0.78em',color:'var(--text-muted)' }}>
                                                    <FiStar size={12} style={{ color:'#f59e0b' }}/>
                                                    Điểm tối đa: <strong style={{ color:'var(--text-primary)' }}>{activeA.maxScore}</strong>
                                                </div>
                                            </div>
                                        </div>
                                        <button className="btn btn-sm btn-danger btn-icon" title="Xóa bài tập" onClick={()=>setDeleteTarget(activeA)} style={{ padding:'9px 12px' }}>
                                            <FiTrash2 size={14}/>
                                        </button>
                                    </div>
                                </div>

                                {/* Stats row */}
                                {subs && (
                                    <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:0,borderBottom:'1px solid var(--border)' }}>
                                        {[
                                            { label:'Tổng sinh viên',   val:subs.totalStudents||0,      icon:<FiUsers size={14}/>,    color:'var(--info)' },
                                            { label:'Đã nộp bài',       val:subs.submittedCount||0,     icon:<FiCheckCircle size={14}/>,color:'var(--accent)' },
                                            { label:'Đã chấm điểm',    val:subs.gradedCount||0,         icon:<FiAward size={14}/>,     color:'var(--success)' },
                                        ].map((s,i)=>(
                                            <div key={i} style={{ padding:'16px 20px',textAlign:'center',borderRight:i<2?'1px solid var(--border)':'none' }}>
                                                <div style={{ display:'flex',justifyContent:'center',marginBottom:4,color:s.color }}>{s.icon}</div>
                                                <div style={{ fontSize:'1.6em',fontWeight:900,color:s.color,letterSpacing:'-1px' }}>{s.val}</div>
                                                <div style={{ fontSize:'0.68em',color:'var(--text-muted)',fontWeight:600,marginTop:2 }}>{s.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Submissions list */}
                                <div style={{ padding:'16px 22px' }}>
                                    <div style={{ fontSize:'0.78em',fontWeight:800,textTransform:'uppercase',letterSpacing:0.8,color:'var(--text-muted)',marginBottom:14 }}>
                                        Danh sách sinh viên
                                    </div>

                                    {loadingSubs ? (
                                        [1,2,3,4].map(k=><div key={k} className="skeleton" style={{ height:60,borderRadius:12,marginBottom:8 }}/>)
                                    ) : !subs ? (
                                        <div style={{ textAlign:'center',padding:'24px',color:'var(--text-muted)',fontSize:'0.85em' }}>
                                            Không thể tải dữ liệu
                                        </div>
                                    ) : subs.students?.length === 0 ? (
                                        <div style={{ textAlign:'center',padding:'32px',color:'var(--text-muted)',fontSize:'0.85em' }}>
                                            Lớp chưa có sinh viên
                                        </div>
                                    ) : (
                                        <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                                            {subs.students?.map(item => {
                                                const sub = item.submission;
                                                const studentId = item.student?._id?.toString() || item.student?.toString();
                                                const notSubmitted = !sub;
                                                const graded = sub && sub.score !== null && sub.score !== undefined;
                                                const late = sub?.status === 'late';
                                                const isGrading = gradingId === studentId;

                                                const borderColor = notSubmitted ? 'rgba(100,116,139,0.3)' : graded ? 'rgba(16,185,129,0.3)' : late ? 'rgba(245,158,11,0.3)' : `${accent}44`;
                                                const bgColor    = notSubmitted ? 'transparent' : graded ? 'rgba(16,185,129,0.04)' : late ? 'rgba(245,158,11,0.04)' : `${accent}06`;

                                                return (
                                                    <div key={studentId} style={{ border:`1px solid ${borderColor}`,background:bgColor,borderRadius:14,overflow:'hidden',transition:'all 0.15s' }}>
                                                        <div style={{ padding:'13px 16px',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap' }}>
                                                            {/* Avatar */}
                                                            <div style={{ width:36,height:36,borderRadius:'50%',background:notSubmitted?'rgba(100,116,139,0.2)':`linear-gradient(135deg,${accent}cc,${accent}88)`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:'0.8em',color:'#fff',flexShrink:0 }}>
                                                                {item.student?.name?.[0]?.toUpperCase()||'?'}
                                                            </div>

                                                            {/* Info */}
                                                            <div style={{ flex:1,minWidth:0 }}>
                                                                <div style={{ fontWeight:700,fontSize:'0.875em',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
                                                                    {item.student?.name}
                                                                    {item.student?.studentId&&<span style={{ fontSize:'0.72em',color:'var(--text-muted)',fontFamily:'monospace' }}>{item.student.studentId}</span>}
                                                                    {notSubmitted&&<span style={{ padding:'1px 8px',borderRadius:99,fontSize:'0.65em',fontWeight:700,background:'rgba(100,116,139,0.12)',color:'var(--text-muted)',border:'1px solid rgba(100,116,139,0.2)' }}>Chưa nộp</span>}
                                                                    {late&&<span style={{ padding:'1px 8px',borderRadius:99,fontSize:'0.65em',fontWeight:700,background:'rgba(245,158,11,0.12)',color:'var(--warning)',border:'1px solid rgba(245,158,11,0.25)' }}>⚠️ Nộp trễ</span>}
                                                                </div>
                                                                {!notSubmitted&&(
                                                                    <div style={{ fontSize:'0.72em',color:'var(--text-muted)',marginTop:2 }}>
                                                                        Nộp: {new Date(sub.submittedAt).toLocaleString('vi-VN')}
                                                                    </div>
                                                                )}
                                                                {sub?.content&&<div style={{ fontSize:'0.78em',color:'var(--text-secondary)',marginTop:4,lineHeight:1.5 }}>{sub.content}</div>}
                                                                {sub?.fileName&&(
                                                                    <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex',alignItems:'center',gap:5,marginTop:5,fontSize:'0.72em',color:accent,textDecoration:'none',background:`${accent}12`,padding:'3px 10px',borderRadius:99,border:`1px solid ${accent}33` }}>
                                                                        <FiDownload size={10}/> {sub.fileName}
                                                                    </a>
                                                                )}
                                                                {graded&&sub.feedback&&(
                                                                    <div style={{ fontSize:'0.74em',color:'var(--success)',marginTop:5,display:'flex',alignItems:'flex-start',gap:5 }}>
                                                                        <FiMessageSquare size={11} style={{ flexShrink:0,marginTop:1 }}/> {sub.feedback}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Score / Grade area */}
                                                            <div style={{ flexShrink:0,textAlign:'right' }}>
                                                                {notSubmitted ? (
                                                                    <div style={{ fontSize:'0.72em',color:'var(--text-muted)' }}>—</div>
                                                                ) : graded ? (
                                                                    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
                                                                        <ScoreRing score={sub.score} max={subs.assignment?.maxScore||100} size={50}/>
                                                                        <button style={{ fontSize:'0.65em',background:'none',border:'1px solid var(--border)',borderRadius:99,padding:'2px 8px',cursor:'pointer',color:'var(--text-muted)',transition:'all 0.15s' }}
                                                                            onClick={()=>{setGradingId(studentId);setGradeForm({score:sub.score,feedback:sub.feedback||''});}}>
                                                                            <FiEdit2 size={9}/> Sửa
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    !isGrading&&(
                                                                        <button className="btn btn-sm btn-primary" onClick={()=>{setGradingId(studentId);setGradeForm({score:'',feedback:''});}}>
                                                                            <FiAward size={12}/> Chấm điểm
                                                                        </button>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Grading form */}
                                                        {isGrading&&(
                                                            <div style={{ padding:'12px 16px',background:'rgba(99,102,241,0.06)',borderTop:'1px solid var(--border)' }}>
                                                                <div style={{ fontSize:'0.78em',fontWeight:700,color:accent,marginBottom:10 }}>✏️ Nhập điểm và nhận xét</div>
                                                                <div style={{ display:'flex',alignItems:'flex-start',gap:10,flexWrap:'wrap' }}>
                                                                    <div style={{ display:'flex',flexDirection:'column',gap:8,flex:1,minWidth:200 }}>
                                                                        <input type="number" className="form-input" style={{ padding:'8px 12px',fontSize:'0.875em' }}
                                                                            placeholder={`Điểm / ${subs.assignment?.maxScore||100}`} min={0} max={subs.assignment?.maxScore||100}
                                                                            value={gradeForm.score} onChange={e=>setGradeForm({...gradeForm,score:e.target.value})} autoFocus/>
                                                                        <input className="form-input" style={{ padding:'8px 12px',fontSize:'0.875em' }}
                                                                            placeholder="Nhận xét cho sinh viên (tùy chọn)..."
                                                                            value={gradeForm.feedback} onChange={e=>setGradeForm({...gradeForm,feedback:e.target.value})}
                                                                            onKeyDown={e=>e.key==='Enter'&&handleGrade(studentId)}/>
                                                                    </div>
                                                                    <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                                                                        <button className="btn btn-primary btn-sm" onClick={()=>handleGrade(studentId)} disabled={grading||!gradeForm.score}>
                                                                            {grading?<><span className="spinner" style={{width:12,height:12}}/> Đang lưu...</>:<><FiSend size={12}/> Lưu điểm</>}
                                                                        </button>
                                                                        <button className="btn btn-outline btn-sm" onClick={()=>{setGradingId(null);setGradeForm({score:'',feedback:''});}}> <FiX size={12}/> Hủy</button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════ CREATE MODAL ══════ */}
            {showCreate&&(
                <Modal title={<><FiPlus size={15} color="var(--accent)"/> Tạo bài tập mới</>} onClose={()=>setShowCreate(false)}>
                    <div className="form-group">
                        <label className="form-label">Tiêu đề *</label>
                        <input className="form-input" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="VD: Bài tập chương 3" autoFocus/>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Mô tả / Đề bài</label>
                        <textarea className="form-input" rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Mô tả yêu cầu bài tập..."/>
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                        <div className="form-group" style={{ marginBottom:0 }}>
                            <label className="form-label">Loại bài tập</label>
                            <select className="form-input" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
                                {TYPE_OPTS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom:0 }}>
                            <label className="form-label">Điểm tối đa</label>
                            <input className="form-input" type="number" min={1} max={1000} value={form.maxScore} onChange={e=>setForm({...form,maxScore:e.target.value})}/>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label"><FiCalendar size={13}/> Hạn nộp *</label>
                        <input className="form-input" type="datetime-local" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/>
                    </div>
                    <label style={{ display:'flex',alignItems:'center',gap:10,fontSize:'0.84em',cursor:'pointer',padding:'10px 12px',borderRadius:10,background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',marginBottom:4 }}>
                        <input type="checkbox" checked={form.allowLate} onChange={e=>setForm({...form,allowLate:e.target.checked})} style={{ width:16,height:16 }}/>
                        <div>
                            <div style={{ fontWeight:600 }}>Cho phép nộp trễ</div>
                            <div style={{ fontSize:'0.82em',color:'var(--text-muted)',marginTop:2 }}>Sinh viên có thể nộp sau thời hạn</div>
                        </div>
                    </label>
                    {createMsg&&<div style={{ display:'flex',gap:8,padding:'10px 14px',borderRadius:10,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'var(--danger)',fontSize:'0.84em',marginTop:8 }}><FiAlertCircle size={14}style={{flexShrink:0}}/>{createMsg}</div>}
                    {selectedClassroom&&(
                        <div style={{ padding:'10px 14px',borderRadius:10,background:`${accent}10`,border:`1px solid ${accent}25`,fontSize:'0.8em',color:accent,marginTop:8,display:'flex',alignItems:'center',gap:8 }}>
                            <FiBook size={13}/> Lớp: <strong>{selectedClassroom.name}</strong> — {selectedClassroom.students?.length||0} sinh viên
                        </div>
                    )}
                    <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:18,paddingTop:16,borderTop:'1px solid var(--border)' }}>
                        <button className="btn btn-outline" onClick={()=>setShowCreate(false)}>Hủy</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={!form.title||!form.dueDate||creating}>
                            {creating?<><span className="spinner" style={{width:14,height:14}}/> Đang tạo...</>:<><FiPlus size={14}/> Tạo bài tập</>}
                        </button>
                    </div>
                </Modal>
            )}

            {/* ══════ DELETE CONFIRM ══════ */}
            {deleteTarget&&(
                <Modal title={<><FiTrash2 size={15} color="var(--danger)"/> Xóa bài tập</>} onClose={()=>setDeleteTarget(null)} maxWidth={420}>
                    <div style={{ textAlign:'center',padding:'8px 0 16px' }}>
                        <div style={{ width:64,height:64,borderRadius:'50%',background:'rgba(239,68,68,0.1)',border:'2px solid rgba(239,68,68,0.25)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px' }}>
                            <FiTrash2 size={26} color="var(--danger)"/>
                        </div>
                        <div style={{ fontWeight:700,fontSize:'1.05em',marginBottom:10 }}>Xóa bài tập này?</div>
                        <div style={{ display:'inline-block',background:'var(--bg-primary)',borderRadius:12,padding:'10px 20px',marginBottom:14,border:'1px solid var(--border)' }}>
                            <div style={{ fontWeight:700,fontSize:'0.9em' }}>{deleteTarget.title}</div>
                        </div>
                        <div style={{ fontSize:'0.84em',color:'var(--text-secondary)',lineHeight:1.6 }}>
                            Tất cả bài nộp của sinh viên cũng sẽ bị xóa vĩnh viễn.
                        </div>
                    </div>
                    <div style={{ display:'flex',gap:10,justifyContent:'flex-end',paddingTop:16,borderTop:'1px solid var(--border)' }}>
                        <button className="btn btn-outline" onClick={()=>setDeleteTarget(null)}>Hủy</button>
                        <button className="btn btn-danger" onClick={handleDelete}><FiTrash2 size={14}/> Xóa</button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
