import React, { useState, useEffect } from 'react';
import { classroomsAPI, assignmentsAPI } from '../../api/api';
import {
    FiBook, FiClock, FiCheckCircle, FiAlertCircle, FiUpload,
    FiSend, FiStar, FiMessageSquare, FiDownload, FiX,
    FiChevronRight, FiAward, FiAlertTriangle, FiFile,
} from 'react-icons/fi';

const TYPE_META = {
    homework: { label:'Bài tập',  color:'#7c3aed', bg:'rgba(124,58,237,0.08)'  },
    quiz:     { label:'Kiểm tra', color:'#06b6d4', bg:'rgba(6,182,212,0.08)'   },
    project:  { label:'Đồ án',   color:'#8b5cf6', bg:'rgba(139,92,246,0.08)'  },
    exam:     { label:'Thi',     color:'#ef4444', bg:'rgba(239,68,68,0.08)'    },
};
const ACCENT_COLORS = ['#7c3aed','#06b6d4','#8b5cf6','#10b981','#f59e0b','#0ea5e9'];

function timeLeft(dueDate) {
    const diff = new Date(dueDate) - Date.now();
    if (diff < 0) return { label:'Đã hết hạn', past:true, urgent:true };
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(h / 24);
    if (d > 1)  return { label:`Còn ${d} ngày`, urgent: d <= 2 };
    if (h > 0)  return { label:`Còn ${h} giờ`,  urgent: true };
    return { label:'Sắp hết hạn!', urgent:true };
}

/* Score ring */
function ScoreRing({ score, max, size=60 }) {
    const pct = max > 0 ? Math.min(score/max, 1) : 0;
    const r=(size-8)/2, c=size/2, circ=2*Math.PI*r;
    const color = pct>=0.8?'#10b981':pct>=0.5?'#f59e0b':'#ef4444';
    return (
        <svg width={size} height={size}>
            <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border)" strokeWidth={6}/>
            <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={6}
                strokeDasharray={circ} strokeDashoffset={circ*(1-pct)}
                strokeLinecap="round" transform={`rotate(-90,${c},${c})`}
                style={{ transition:'stroke-dashoffset 0.55s ease' }}/>
            <text x={c} y={c+1} textAnchor="middle" dominantBaseline="middle"
                fill={color} fontSize={size*0.2} fontWeight="900">{score}</text>
            <text x={c} y={c+size*0.18} textAnchor="middle" dominantBaseline="middle"
                fill="var(--text-muted)" fontSize={size*0.12}>/{max}</text>
        </svg>
    );
}

export default function StudentAssignment() {
    const [classrooms,  setClassrooms]  = useState([]);
    const [selectedId,  setSelectedId]  = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [loadingA,    setLoadingA]    = useState(false);
    const [activeA,     setActiveA]     = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');

    const [submitText, setSubmitText]   = useState('');
    const [submitFile, setSubmitFile]   = useState(null);
    const [submitting, setSubmitting]   = useState(false);
    const [msg,        setMsg]          = useState({ text:'', type:'' });

    useEffect(() => {
        classroomsAPI.getAll()
            .then(r => { setClassrooms(r.data); if (r.data.length>0) setSelectedId(r.data[0]._id); })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedId) return;
        setLoadingA(true); setActiveA(null); setMsg({ text:'', type:'' });
        assignmentsAPI.getByClassroom(selectedId)
            .then(r => setAssignments(r.data))
            .catch(() => setAssignments([]))
            .finally(() => setLoadingA(false));
    }, [selectedId]);

    const handleSubmit = async () => {
        if (!activeA) return;
        if (!submitText.trim() && !submitFile) return setMsg({ text:'Vui lòng nhập nội dung hoặc chọn file', type:'error' });
        setSubmitting(true); setMsg({ text:'', type:'' });
        try {
            const fd = new FormData();
            if (submitText.trim()) fd.append('content', submitText);
            if (submitFile) fd.append('file', submitFile);
            const res = await assignmentsAPI.submit(activeA._id, fd);
            setAssignments(prev => prev.map(a => a._id===activeA._id ? { ...a, mySubmission: res.data.submission } : a));
            setActiveA(prev => ({ ...prev, mySubmission: res.data.submission }));
            setSubmitText(''); setSubmitFile(null);
            setMsg({ text:'Nộp bài thành công!', type:'success' });
        } catch(err) {
            setMsg({ text: err.response?.data?.error||err.message, type:'error' });
        } finally { setSubmitting(false); }
    };

    const classIdx = classrooms.findIndex(c => c._id === selectedId);
    const accent   = ACCENT_COLORS[classIdx % ACCENT_COLORS.length] || '#7c3aed';

    const pending   = assignments.filter(a => !a.mySubmission);
    const submitted = assignments.filter(a =>  a.mySubmission);
    const graded    = submitted.filter(a => a.mySubmission?.score !== null && a.mySubmission?.score !== undefined);

    const filtered  = assignments.filter(a => {
        if (filterStatus === 'all')       return true;
        if (filterStatus === 'pending')   return !a.mySubmission;
        if (filterStatus === 'submitted') return !!a.mySubmission && (a.mySubmission.score === null || a.mySubmission.score === undefined);
        if (filterStatus === 'graded')    return a.mySubmission?.score !== null && a.mySubmission?.score !== undefined;
        return true;
    });

    return (
        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {/* ── Header ── */}
            <div style={{ marginBottom:22 }}>
                <h1 style={{ fontSize:'1.6em',fontWeight:900,letterSpacing:'-0.5px',margin:0 }}>Bài tập của tôi</h1>
                <p style={{ color:'var(--text-muted)',fontSize:'0.875em',marginTop:5 }}>
                    Xem đề bài, nộp bài và theo dõi điểm số từ giáo viên
                </p>
            </div>

            {/* ── Loading ── */}
            {loading && (
                <div style={{ display:'flex',gap:18 }}>
                    <div style={{ width:300 }}>{[1,2,3].map(k=><div key={k} className="skeleton" style={{height:72,borderRadius:14,marginBottom:10}}/>)}</div>
                    <div style={{ flex:1,borderRadius:20 }} className="skeleton" />
                </div>
            )}

            {/* ── No classrooms ── */}
            {!loading && classrooms.length === 0 && (
                <div style={{ textAlign:'center',padding:'60px 20px',background:'var(--bg-card)',borderRadius:20,border:'1px solid var(--border)' }}>
                    <div style={{ width:72,height:72,borderRadius:20,background:'var(--accent-light)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px' }}>
                        <FiBook size={30} color="var(--accent)"/>
                    </div>
                    <div style={{ fontWeight:800,fontSize:'1.05em',marginBottom:8 }}>Chưa tham gia lớp học nào</div>
                    <div style={{ color:'var(--text-muted)',fontSize:'0.875em' }}>Liên hệ giáo viên hoặc admin để được thêm vào lớp</div>
                </div>
            )}

            {/* ── Main layout ── */}
            {!loading && classrooms.length > 0 && (
                <div className="split-layout">

                    {/* ══ LEFT PANEL ══ */}
                    <div className="split-panel">
                        {/* Class tabs */}
                        {classrooms.length > 1 && (
                            <div style={{ marginBottom:14 }}>
                                <div style={{ fontSize:'0.7em',fontWeight:700,textTransform:'uppercase',letterSpacing:0.8,color:'var(--text-muted)',marginBottom:8 }}>Lớp học</div>
                                <div style={{ display:'flex',flexDirection:'column',gap:4 }}>
                                    {classrooms.map((c,i)=>(
                                        <button key={c._id} onClick={()=>{ setSelectedId(c._id); setActiveA(null); }} style={{
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

                        {/* Stats mini */}
                        {!loadingA && assignments.length > 0 && (
                            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:14 }}>
                                {[
                                    { label:'Chưa nộp', val:pending.length,   color:'#f59e0b' },
                                    { label:'Đã nộp',   val:submitted.length,  color:accent    },
                                    { label:'Đã chấm',  val:graded.length,     color:'#10b981' },
                                ].map((s,i)=>(
                                    <div key={i} style={{ textAlign:'center',padding:'10px 6px',background:'var(--bg-card)',borderRadius:12,border:'1px solid var(--border)' }}>
                                        <div style={{ fontSize:'1.35em',fontWeight:900,color:s.color,letterSpacing:'-1px' }}>{s.val}</div>
                                        <div style={{ fontSize:'0.6em',color:'var(--text-muted)',fontWeight:600,marginTop:2 }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Filter chips */}
                        {!loadingA && assignments.length > 0 && (
                            <div style={{ display:'flex',gap:5,marginBottom:12 }}>
                                {[
                                    {k:'all',       label:'Tất cả'},
                                    {k:'pending',   label:'Chưa nộp'},
                                    {k:'submitted', label:'Đã nộp'},
                                    {k:'graded',    label:'Đã chấm'},
                                ].map(f=>(
                                    <button key={f.k} onClick={()=>setFilterStatus(f.k)} style={{ flex:1,padding:'5px 0',borderRadius:99,border:'none',cursor:'pointer',fontSize:'0.68em',fontWeight:700,background:filterStatus===f.k?accent:'rgba(255,255,255,0.05)',color:filterStatus===f.k?'#fff':'var(--text-muted)',transition:'all 0.15s' }}>
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Assignment list */}
                        {loadingA ? (
                            [1,2,3,4].map(k=><div key={k} className="skeleton" style={{height:68,borderRadius:14,marginBottom:8}}/>)
                        ) : filtered.length === 0 ? (
                            <div style={{ textAlign:'center',padding:'28px 16px',background:'var(--bg-card)',borderRadius:16,border:'1px solid var(--border)' }}>
                                <FiBook size={22} style={{ color:'var(--text-muted)',marginBottom:8 }}/>
                                <div style={{ fontWeight:700,fontSize:'0.875em',marginBottom:4 }}>Không có bài tập</div>
                                <div style={{ fontSize:'0.76em',color:'var(--text-muted)' }}>{filterStatus==='all'?'Giáo viên chưa giao bài':'Thay đổi bộ lọc để xem thêm'}</div>
                            </div>
                        ) : (
                            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                                {filtered.map(a => {
                                    const tl  = timeLeft(a.dueDate);
                                    const sub = a.mySubmission;
                                    const isGraded    = sub && sub.score !== null && sub.score !== undefined;
                                    const isSubmitted = !!sub;
                                    const tm  = TYPE_META[a.type] || TYPE_META.homework;
                                    const isActive = activeA?._id === a._id;

                                    let statusColor = tl.past ? 'var(--danger)' : tl.urgent ? 'var(--warning)' : accent;
                                    if (isGraded)    statusColor = 'var(--success)';
                                    if (isSubmitted && !isGraded) statusColor = accent;

                                    return (
                                        <div key={a._id} onClick={()=>{ setActiveA({...a}); setSubmitText(''); setSubmitFile(null); setMsg({text:'',type:''}); }}
                                            style={{ padding:'12px 14px',borderRadius:14,border:`1px solid ${isActive?accent+'44':'var(--border)'}`,background:isActive?`${accent}10`:'var(--bg-card)',cursor:'pointer',transition:'all 0.18s',position:'relative',overflow:'hidden' }}
                                            onMouseEnter={e=>{if(!isActive){e.currentTarget.style.borderColor=accent+'33';e.currentTarget.style.background=accent+'08';}}}
                                            onMouseLeave={e=>{if(!isActive){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg-card)';}}}
                                        >
                                            {isActive&&<div style={{ position:'absolute',left:0,top:0,bottom:0,width:3,background:accent,borderRadius:'3px 0 0 3px' }}/>}
                                            <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8 }}>
                                                <div style={{ minWidth:0,flex:1 }}>
                                                    <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:4,flexWrap:'wrap' }}>
                                                        <span style={{ padding:'2px 8px',borderRadius:99,fontSize:'0.61em',fontWeight:700,background:tm.bg,color:tm.color,border:`1px solid ${tm.color}33` }}>{tm.label}</span>
                                                        {isGraded && <span style={{ padding:'2px 8px',borderRadius:99,fontSize:'0.61em',fontWeight:700,background:'rgba(16,185,129,0.12)',color:'var(--success)',border:'1px solid rgba(16,185,129,0.25)' }}>✓ Đã chấm</span>}
                                                        {isSubmitted&&!isGraded && <span style={{ padding:'2px 8px',borderRadius:99,fontSize:'0.61em',fontWeight:600,background:`${accent}15`,color:accent,border:`1px solid ${accent}33` }}>Đã nộp</span>}
                                                        {!isSubmitted && <span style={{ padding:'2px 8px',borderRadius:99,fontSize:'0.61em',fontWeight:600,background:tl.past?'rgba(239,68,68,0.1)':'rgba(100,116,139,0.1)',color:tl.past?'var(--danger)':'var(--text-muted)',border:`1px solid ${tl.past?'rgba(239,68,68,0.2)':'rgba(100,116,139,0.15)'}` }}>Chưa nộp</span>}
                                                    </div>
                                                    <div style={{ fontWeight:700,fontSize:'0.875em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:3 }}>{a.title}</div>
                                                    <div style={{ fontSize:'0.7em',color:tl.past?'var(--danger)':tl.urgent?'var(--warning)':'var(--text-muted)',display:'flex',alignItems:'center',gap:4 }}>
                                                        <FiClock size={9}/> {tl.label} · {new Date(a.dueDate).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                                                    </div>
                                                </div>
                                                {isGraded
                                                    ? <div style={{ fontSize:'0.8em',fontWeight:800,color:'var(--success)',flexShrink:0 }}>{sub.score}<span style={{ fontSize:'0.7em',fontWeight:400,color:'var(--text-muted)' }}>/{a.maxScore}</span></div>
                                                    : <FiChevronRight size={14} style={{ color:'var(--text-muted)',flexShrink:0,marginTop:3 }}/>
                                                }
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ══ RIGHT PANEL: Assignment detail ══ */}
                    <div className="split-panel">
                        {!activeA ? (
                            <div style={{ textAlign:'center',padding:'64px 24px',background:'var(--bg-card)',borderRadius:20,border:'1px solid var(--border)' }}>
                                <div style={{ width:72,height:72,borderRadius:20,background:'var(--accent-light)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px' }}>
                                    <FiBook size={30} color="var(--accent)"/>
                                </div>
                                <div style={{ fontWeight:800,fontSize:'1.05em',marginBottom:8 }}>Chọn một bài tập</div>
                                <div style={{ color:'var(--text-muted)',fontSize:'0.875em' }}>Chọn bài tập bên trái để xem đề bài và nộp bài</div>
                            </div>
                        ) : (() => {
                            const sub = activeA.mySubmission;
                            const isGraded    = sub && sub.score !== null && sub.score !== undefined;
                            const isSubmitted = !!sub;
                            const tl = timeLeft(activeA.dueDate);
                            const tm = TYPE_META[activeA.type] || TYPE_META.homework;
                            const canSubmit = !isSubmitted || (!tl.past && activeA.allowLate);

                            return (
                                <div style={{ background:'var(--bg-card)',borderRadius:20,border:'1px solid var(--border)',overflow:'hidden' }}>
                                    {/* Top bar */}
                                    <div style={{ height:3,background:`linear-gradient(90deg,${tm.color},${tm.color}88,transparent)` }}/>

                                    {/* Assignment header */}
                                    <div style={{ padding:'22px 26px',borderBottom:'1px solid var(--border)' }}>
                                        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12 }}>
                                            <div style={{ flex:1,minWidth:0 }}>
                                                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10,flexWrap:'wrap' }}>
                                                    <span style={{ padding:'3px 12px',borderRadius:99,fontSize:'0.7em',fontWeight:700,background:tm.bg,color:tm.color,border:`1px solid ${tm.color}33` }}>{tm.label}</span>
                                                    {tl.past
                                                        ? <span style={{ padding:'3px 12px',borderRadius:99,fontSize:'0.7em',fontWeight:700,background:'rgba(239,68,68,0.1)',color:'var(--danger)',border:'1px solid rgba(239,68,68,0.2)' }}>Đã hết hạn</span>
                                                        : tl.urgent
                                                            ? <span style={{ padding:'3px 12px',borderRadius:99,fontSize:'0.7em',fontWeight:700,background:'rgba(245,158,11,0.12)',color:'var(--warning)',border:'1px solid rgba(245,158,11,0.25)' }}>⚠️ {tl.label}</span>
                                                            : <span style={{ padding:'3px 12px',borderRadius:99,fontSize:'0.7em',fontWeight:700,background:'rgba(16,185,129,0.1)',color:'var(--success)',border:'1px solid rgba(16,185,129,0.2)' }}>{tl.label}</span>
                                                    }
                                                </div>
                                                <h2 style={{ fontWeight:900,fontSize:'1.2em',margin:'0 0 10px',letterSpacing:'-0.3px' }}>{activeA.title}</h2>
                                                {activeA.description && (
                                                    <div style={{ fontSize:'0.875em',color:'var(--text-secondary)',lineHeight:1.7,padding:'12px 16px',background:'var(--bg-purple-soft)',borderRadius:12,border:'1px solid var(--border)',marginBottom:14 }}>
                                                        {activeA.description}
                                                    </div>
                                                )}
                                                <div style={{ display:'flex',gap:18,flexWrap:'wrap' }}>
                                                    <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:'0.8em',color:'var(--text-muted)' }}>
                                                        <FiClock size={13} style={{ color:tm.color }}/>
                                                        Hạn nộp: <strong style={{ color:'var(--text-primary)' }}>{new Date(activeA.dueDate).toLocaleString('vi-VN')}</strong>
                                                    </div>
                                                    <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:'0.8em',color:'var(--text-muted)' }}>
                                                        <FiStar size={13} style={{ color:'#f59e0b' }}/>
                                                        Điểm tối đa: <strong style={{ color:'var(--text-primary)' }}>{activeA.maxScore}</strong>
                                                    </div>
                                                    {activeA.allowLate && <div style={{ fontSize:'0.78em',color:'var(--text-muted)',display:'flex',alignItems:'center',gap:4 }}>✓ Cho phép nộp trễ</div>}
                                                </div>
                                            </div>
                                            <button onClick={()=>setActiveA(null)} style={{ background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer',color:'var(--text-muted)',padding:'6px 8px',display:'flex',flexShrink:0,transition:'all 0.15s' }}
                                                onMouseEnter={e=>{e.currentTarget.style.color='var(--danger)';e.currentTarget.style.background='var(--danger-light)';}}
                                                onMouseLeave={e=>{e.currentTarget.style.color='var(--text-muted)';e.currentTarget.style.background='var(--bg-secondary)';}}>
                                                <FiX size={15}/>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Attachments */}
                                    {activeA.attachments?.length > 0 && (
                                        <div style={{ padding:'14px 26px',borderBottom:'1px solid var(--border)' }}>
                                            <div style={{ fontSize:'0.74em',fontWeight:800,textTransform:'uppercase',letterSpacing:0.8,color:'var(--text-muted)',marginBottom:8 }}>📎 File đính kèm từ giáo viên</div>
                                            <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                                                {activeA.attachments.map((att,i)=>(
                                                    <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',background:`${tm.color}15`,borderRadius:99,border:`1px solid ${tm.color}33`,fontSize:'0.76em',color:tm.color,textDecoration:'none',transition:'all 0.15s' }}>
                                                        <FiDownload size={11}/> {att.name}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Submission status or form */}
                                    <div style={{ padding:'20px 26px' }}>
                                        {isSubmitted ? (
                                            /* ── Already submitted ── */
                                            <div>
                                                <div style={{ fontSize:'0.74em',fontWeight:800,textTransform:'uppercase',letterSpacing:0.8,color:'var(--text-muted)',marginBottom:14 }}>Bài đã nộp của bạn</div>

                                                <div style={{ padding:'16px 18px',borderRadius:14,background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.2)',marginBottom:isGraded?16:0 }}>
                                                    <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
                                                        <FiCheckCircle size={15} color="var(--success)"/>
                                                        <span style={{ fontWeight:700,fontSize:'0.875em',color:'var(--success)' }}>Đã nộp bài</span>
                                                        <span style={{ fontSize:'0.72em',color:'var(--text-muted)',marginLeft:'auto' }}>
                                                            {sub.status==='late'&&<span style={{ color:'var(--warning)',marginRight:6 }}>⚠️ Nộp trễ ·</span>}
                                                            {new Date(sub.submittedAt).toLocaleString('vi-VN')}
                                                        </span>
                                                    </div>
                                                    {sub.content && <div style={{ fontSize:'0.84em',color:'var(--text-secondary)',lineHeight:1.6,padding:'8px 12px',background:'rgba(255,255,255,0.03)',borderRadius:8 }}>{sub.content}</div>}
                                                    {sub.fileName && (
                                                        <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex',alignItems:'center',gap:6,marginTop:8,padding:'5px 12px',background:'rgba(16,185,129,0.12)',borderRadius:99,border:'1px solid rgba(16,185,129,0.25)',fontSize:'0.74em',color:'var(--success)',textDecoration:'none' }}>
                                                            <FiFile size={11}/> {sub.fileName}
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Grade result */}
                                                {isGraded ? (
                                                    <div style={{ marginTop:16,padding:'20px 20px',borderRadius:16,background:'linear-gradient(135deg,rgba(245,158,11,0.06),rgba(16,185,129,0.06))',border:'1px solid rgba(16,185,129,0.2)' }}>
                                                        <div style={{ fontSize:'0.74em',fontWeight:800,textTransform:'uppercase',letterSpacing:0.8,color:'var(--text-muted)',marginBottom:14 }}>Kết quả chấm điểm</div>
                                                        <div style={{ display:'flex',alignItems:'center',gap:20 }}>
                                                            <ScoreRing score={sub.score} max={activeA.maxScore} size={72}/>
                                                            <div>
                                                                <div style={{ fontSize:'1.8em',fontWeight:900,letterSpacing:'-1px',color: sub.score/activeA.maxScore>=0.8?'var(--success)':sub.score/activeA.maxScore>=0.5?'var(--warning)':'var(--danger)' }}>
                                                                    {sub.score}<span style={{ fontSize:'0.45em',fontWeight:400,color:'var(--text-muted)' }}>/{activeA.maxScore} điểm</span>
                                                                </div>
                                                                <div style={{ fontSize:'0.78em',color:'var(--text-muted)',marginTop:2 }}>
                                                                    {Math.round(sub.score/activeA.maxScore*100)}% · {sub.score/activeA.maxScore>=0.8?'Xuất sắc 🎉':sub.score/activeA.maxScore>=0.6?'Đạt yêu cầu ✓':'Cần cải thiện'}
                                                                </div>
                                                                {sub.feedback && (
                                                                    <div style={{ marginTop:10,padding:'8px 12px',borderRadius:8,background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',fontSize:'0.82em',color:'var(--text-secondary)',lineHeight:1.5 }}>
                                                                        <FiMessageSquare size={11} style={{ marginRight:5,color:'var(--success)' }}/>
                                                                        {sub.feedback}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ marginTop:14,padding:'12px 16px',borderRadius:12,background:'var(--accent-light)',border:'1px solid var(--border-accent)',fontSize:'0.82em',color:'var(--text-secondary)',display:'flex',alignItems:'center',gap:8 }}>
                                                        <FiClock size={14} style={{ color:'var(--accent)',flexShrink:0 }}/> Bài đã nộp, đang chờ giáo viên chấm điểm...
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            /* ── Submit form ── */
                                            <div>
                                                <div style={{ fontSize:'0.74em',fontWeight:800,textTransform:'uppercase',letterSpacing:0.8,color:'var(--text-muted)',marginBottom:14 }}>
                                                    ✍️ Nộp bài của bạn
                                                </div>

                                                {tl.past && !activeA.allowLate && (
                                                    <div style={{ display:'flex',gap:10,padding:'12px 16px',borderRadius:12,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'var(--danger)',fontSize:'0.84em',marginBottom:16 }}>
                                                        <FiAlertCircle size={15} style={{ flexShrink:0,marginTop:1 }}/>
                                                        <div><strong>Đã hết hạn nộp bài.</strong> Giáo viên không cho phép nộp trễ.</div>
                                                    </div>
                                                )}

                                                <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                                                    <div>
                                                        <label style={{ fontSize:'0.78em',fontWeight:700,color:'var(--text-muted)',display:'block',marginBottom:6 }}>Nội dung bài làm</label>
                                                        <textarea
                                                            value={submitText} onChange={e=>setSubmitText(e.target.value)}
                                                            placeholder="Nhập nội dung bài làm, đáp án hoặc link nộp bài..."
                                                            className="form-input"
                                                            style={{ minHeight:120,resize:'vertical',fontSize:'0.875em',lineHeight:1.6 }}
                                                            disabled={tl.past && !activeA.allowLate}
                                                        />
                                                    </div>

                                                    <div>
                                                        <label style={{ fontSize:'0.78em',fontWeight:700,color:'var(--text-muted)',display:'block',marginBottom:6 }}>File đính kèm</label>
                                                        <label style={{
                                                            display:'flex',alignItems:'center',gap:12,cursor: tl.past&&!activeA.allowLate?'not-allowed':'pointer',
                                                            border:`2px dashed ${submitFile?tm.color+'55':'var(--border-strong)'}`,
                                                            borderRadius:12,padding:'14px 18px',
                                                            background:submitFile?`${tm.color}08`:'transparent',
                                                            transition:'all 0.2s',
                                                        }}>
                                                            <div style={{ width:36,height:36,borderRadius:10,background:submitFile?tm.bg:`rgba(255,255,255,0.04)`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                                                                {submitFile ? <FiFile size={16} style={{ color:tm.color }}/> : <FiUpload size={16} style={{ color:'var(--text-muted)' }}/>}
                                                            </div>
                                                            <div style={{ flex:1,minWidth:0 }}>
                                                                {submitFile
                                                                    ? <><div style={{ fontWeight:700,fontSize:'0.84em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:tm.color }}>{submitFile.name}</div><div style={{ fontSize:'0.7em',color:'var(--text-muted)',marginTop:2 }}>{(submitFile.size/1024).toFixed(1)} KB</div></>
                                                                    : <><div style={{ fontWeight:600,fontSize:'0.84em' }}>Chọn file hoặc kéo thả</div><div style={{ fontSize:'0.7em',color:'var(--text-muted)',marginTop:2 }}>PDF, Word, ZIP, hình ảnh... tối đa 50MB</div></>
                                                                }
                                                            </div>
                                                            {submitFile && (
                                                                <button onClick={e=>{e.preventDefault();setSubmitFile(null);}} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:4 }}>
                                                                    <FiX size={15}/>
                                                                </button>
                                                            )}
                                                            <input type="file" style={{ display:'none' }} onChange={e=>setSubmitFile(e.target.files[0])}
                                                                disabled={tl.past && !activeA.allowLate}/>
                                                        </label>
                                                    </div>
                                                </div>

                                                {/* Feedback message */}
                                                {msg.text && (
                                                    <div style={{ display:'flex',gap:9,padding:'11px 16px',borderRadius:12,marginTop:12,fontSize:'0.84em',background:msg.type==='success'?'rgba(16,185,129,0.08)':'rgba(239,68,68,0.08)',border:`1px solid ${msg.type==='success'?'rgba(16,185,129,0.25)':'rgba(239,68,68,0.2)'}`,color:msg.type==='success'?'var(--success)':'var(--danger)' }}>
                                                        {msg.type==='success'?<FiCheckCircle size={14} style={{flexShrink:0,marginTop:1}}/>:<FiAlertCircle size={14} style={{flexShrink:0,marginTop:1}}/>}
                                                        {msg.text}
                                                    </div>
                                                )}

                                                <button className="btn btn-primary" onClick={handleSubmit}
                                                    disabled={submitting || (tl.past && !activeA.allowLate) || (!submitText.trim() && !submitFile)}
                                                    style={{ width:'100%',marginTop:14,padding:'12px',fontSize:'0.9em',fontWeight:700 }}>
                                                    {submitting
                                                        ? <><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Đang nộp bài...</>
                                                        : <><FiSend size={14}/> Nộp bài</>
                                                    }
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
