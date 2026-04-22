import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { classroomsAPI } from '../../api/api';
import {
    FiVideo, FiClock, FiPlay, FiUsers, FiCalendar,
    FiChevronRight, FiBookOpen, FiGrid, FiChevronLeft,
} from 'react-icons/fi';

const DAYS_LABEL = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEK_ORDER  = [1, 2, 3, 4, 5, 6, 0];
const DAY_FULL    = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const CARD_GRADIENTS = [
    'linear-gradient(135deg,#7c3aed,#a78bfa)',
    'linear-gradient(135deg,#0891b2,#22d3ee)',
    'linear-gradient(135deg,#7e22ce,#c084fc)',
    'linear-gradient(135deg,#059669,#34d399)',
    'linear-gradient(135deg,#d97706,#fbbf24)',
    'linear-gradient(135deg,#0284c7,#38bdf8)',
];
const ACCENT_COLORS = ['#7c3aed', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#0ea5e9'];

function getSession(t) {
    if (!t) return 'other';
    const h = parseInt(t.split(':')[0], 10);
    if (h < 12) return 'morning';
    if (h < 18) return 'afternoon';
    return 'evening';
}

function getMondayOf(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
}

function fmt(date) {
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

/* ─────────────────────────────────
   Weekly Timetable
───────────────────────────────────*/
function WeekSchedule({ classrooms, classIndexMap }) {
    const navigate = useNavigate();
    const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()));

    const weekDates = WEEK_ORDER.map(dow => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + (dow === 0 ? 6 : dow - 1));
        return { dow, date: d };
    });

    const todayStr = new Date().toDateString();

    const sessions = [
        { key: 'morning',   label: 'Sáng',   time: '06:00 – 11:59' },
        { key: 'afternoon', label: 'Chiều',   time: '12:00 – 17:59' },
        { key: 'evening',   label: 'Tối',     time: '18:00 – 21:59' },
    ];

    // Build lookup: dayOfWeek → session → classes[]
    const lookup = {};
    classrooms.forEach(c => {
        (c.schedule?.dayOfWeek || []).forEach(dow => {
            const sess = getSession(c.schedule?.startTime);
            if (!lookup[dow]) lookup[dow] = {};
            if (!lookup[dow][sess]) lookup[dow][sess] = [];
            lookup[dow][sess].push(c);
        });
    });

    const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); };
    const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); };
    const goToday  = () => setWeekStart(getMondayOf(new Date()));

    return (
        <div>
            {/* Toolbar */}
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:18,flexWrap:'wrap' }}>
                <button onClick={goToday} className="btn btn-sm btn-outline" style={{ fontWeight:700 }}>
                    <FiCalendar size={13} /> Hôm nay
                </button>
                <div style={{ display:'flex',gap:4 }}>
                    <button onClick={prevWeek} className="btn btn-sm btn-outline" style={{ padding:'7px 12px' }}>
                        <FiChevronLeft size={14} />
                    </button>
                    <button onClick={nextWeek} className="btn btn-sm btn-outline" style={{ padding:'7px 12px' }}>
                        <FiChevronRight size={14} />
                    </button>
                </div>
                <span style={{ fontSize:'0.85em',fontWeight:700,color:'var(--text-secondary)' }}>
                    Tuần: {fmt(weekStart)} – {fmt(weekDates[6].date)} / {weekStart.getFullYear()}
                </span>
                <span style={{ marginLeft:'auto',fontSize:'0.8em',color:'var(--text-muted)' }}>
                    {classrooms.filter(c => c.schedule?.startTime).length} lớp có lịch
                </span>
            </div>

            {/* Grid */}
            <div style={{ background:'var(--bg-card)',borderRadius:18,border:'1px solid var(--border)',overflow:'auto' }}>
                <div style={{ minWidth:700 }}>
                    {/* Header row */}
                    <div style={{ display:'grid',gridTemplateColumns:'80px repeat(7,1fr)',borderBottom:'1px solid var(--border)' }}>
                        <div style={{ padding:'12px 8px',fontSize:'0.7em',fontWeight:800,textTransform:'uppercase',letterSpacing:0.8,color:'var(--text-muted)',textAlign:'center',borderRight:'1px solid var(--border)' }}>
                            Ca học
                        </div>
                        {weekDates.map(({ dow, date }, i) => {
                            const isToday = date.toDateString() === todayStr;
                            return (
                                <div key={i} style={{ padding:'12px 8px',textAlign:'center',borderRight:i<6?'1px solid var(--border)':'none',background:isToday?'var(--accent-light)':'transparent' }}>
                                    <div style={{ fontSize:'0.73em',fontWeight:800,letterSpacing:0.4,color:isToday?'var(--accent)':'var(--text-secondary)' }}>
                                        {DAY_FULL[dow]}
                                    </div>
                                    <div style={{ fontSize:'0.7em',marginTop:2,color:isToday?'var(--accent)':'var(--text-muted)',fontWeight:isToday?700:400 }}>
                                        {fmt(date)}
                                        {isToday && <span style={{ marginLeft:4,display:'inline-block',width:5,height:5,borderRadius:'50%',background:'var(--accent)',verticalAlign:'middle' }} />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Session rows */}
                    {sessions.map((sess, si) => (
                        <div key={sess.key} style={{ display:'grid',gridTemplateColumns:'80px repeat(7,1fr)',borderBottom:si<2?'1px solid var(--border)':'none',minHeight:120 }}>
                            {/* Session label */}
                            <div style={{ padding:'14px 6px',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'var(--bg-purple-soft)' }}>
                                <div style={{ fontSize:'0.78em',fontWeight:800,color:'var(--text-secondary)',marginBottom:3 }}>{sess.label}</div>
                                <div style={{ fontSize:'0.6em',color:'var(--text-muted)',textAlign:'center',lineHeight:1.4 }}>{sess.time}</div>
                            </div>

                            {/* Day cells */}
                            {weekDates.map(({ dow, date }, ci) => {
                                const isToday = date.toDateString() === todayStr;
                                const cellClasses = lookup[dow]?.[sess.key] || [];
                                return (
                                    <div key={ci} style={{ borderRight:ci<6?'1px solid var(--border)':'none',padding:6,background:isToday?'rgba(124,58,237,0.03)':'transparent',display:'flex',flexDirection:'column',gap:4,minHeight:120 }}>
                                        {cellClasses.map(c => {
                                            const live = c.meeting?.isLive;
                                            const gi   = classIndexMap[c._id] ?? 0;
                                            const accent = ACCENT_COLORS[gi % ACCENT_COLORS.length];
                                            return (
                                                <div key={c._id}
                                                    onClick={() => navigate(live ? `/meeting/${c._id}` : `/student/classroom/${c._id}`)}
                                                    style={{ borderRadius:8,padding:'7px 9px',background:live?'rgba(16,185,129,0.15)':`${accent}18`,border:`1px solid ${live?'rgba(16,185,129,0.35)':`${accent}33`}`,cursor:'pointer',transition:'all 0.15s ease',position:'relative',overflow:'hidden' }}
                                                    onMouseEnter={e=>{e.currentTarget.style.background=live?'rgba(16,185,129,0.25)':`${accent}2e`;e.currentTarget.style.transform='scale(1.02)';}}
                                                    onMouseLeave={e=>{e.currentTarget.style.background=live?'rgba(16,185,129,0.15)':`${accent}18`;e.currentTarget.style.transform='';}}
                                                >
                                                    <div style={{ position:'absolute',left:0,top:0,bottom:0,width:3,background:live?'var(--success)':accent,borderRadius:'0 2px 2px 0' }} />
                                                    <div style={{ paddingLeft:6 }}>
                                                        {live && <div style={{ marginBottom:2 }}><span className="live-dot" style={{ fontSize:'0.55em' }}>LIVE</span></div>}
                                                        <div style={{ fontSize:'0.75em',fontWeight:700,lineHeight:1.2,marginBottom:2 }}>{c.name}</div>
                                                        <div style={{ fontSize:'0.65em',color:live?'var(--success)':accent,fontWeight:600 }}>{c.subject}</div>
                                                        {c.teacher?.name && <div style={{ fontSize:'0.62em',color:'var(--text-muted)',marginTop:1 }}>GV: {c.teacher.name}</div>}
                                                        {c.schedule?.startTime && <div style={{ fontSize:'0.62em',color:'var(--text-muted)',marginTop:1 }}>{c.schedule.startTime} – {c.schedule.endTime}</div>}
                                                        {live && (
                                                            <button className="btn btn-sm" style={{ marginTop:6,padding:'3px 10px',fontSize:'0.65em',background:'linear-gradient(135deg,#10b981,#059669)',color:'#fff',border:'none',borderRadius:6,fontWeight:700,cursor:'pointer' }}
                                                                onClick={e=>{e.stopPropagation();navigate(`/meeting/${c._id}`);}}>
                                                                <FiPlay size={9} /> Tham gia
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div style={{ display:'flex',gap:14,marginTop:12,flexWrap:'wrap' }}>
                {classrooms.filter(c=>c.schedule?.startTime).map(c=>{
                    const gi = classIndexMap[c._id]??0;
                    const accent = ACCENT_COLORS[gi % ACCENT_COLORS.length];
                    return (
                        <div key={c._id} style={{ display:'flex',alignItems:'center',gap:6,fontSize:'0.75em' }}>
                            <div style={{ width:10,height:10,borderRadius:3,background:accent,flexShrink:0 }} />
                            <span style={{ color:'var(--text-secondary)',fontWeight:600 }}>{c.name}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ─────────────────────────────────
   Class Card
───────────────────────────────────*/
function ClassCard({ c, idx }) {
    const navigate = useNavigate();
    const [hovered, setHovered] = useState(false);
    const live    = c.meeting?.isLive;
    const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
    const accent   = ACCENT_COLORS[idx % ACCENT_COLORS.length];
    const initials = c.name?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'LH';
    const days     = c.schedule?.dayOfWeek?.map(d=>DAYS_LABEL[d]).join(', ')||'';

    return (
        <div
            onMouseEnter={()=>setHovered(true)}
            onMouseLeave={()=>setHovered(false)}
            style={{ borderRadius:20,overflow:'hidden',border:`1px solid ${live?'rgba(16,185,129,0.3)':'rgba(255,255,255,0.07)'}`,background:'var(--bg-card)',boxShadow:hovered?`0 16px 40px rgba(0,0,0,0.35),0 0 0 1px ${accent}22`:live?'0 0 0 1px rgba(16,185,129,0.2)':'none',transform:hovered?'translateY(-4px)':'none',transition:'all 0.25s cubic-bezier(0.4,0,0.2,1)',position:'relative',cursor:'pointer' }}
            onClick={()=>navigate(`/student/classroom/${c._id}`)}
        >
            {/* Banner */}
            <div style={{ height:110,background:gradient,padding:'18px 20px',position:'relative',overflow:'hidden' }}>
                <div style={{ position:'absolute',inset:0,backgroundImage:`radial-gradient(circle at 80% 20%,${accent}33 0%,transparent 60%)` }} />
                <div style={{ position:'absolute',bottom:-20,right:-10,width:100,height:100,borderRadius:'50%',background:`${accent}18` }} />
                <div style={{ position:'absolute',top:14,right:14 }}>
                    {live
                        ? <span className="live-dot">LIVE</span>
                        : <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:99,fontSize:'0.65em',fontWeight:700,background:'rgba(100,116,139,0.25)',color:'rgba(255,255,255,0.6)',border:'1px solid rgba(255,255,255,0.12)' }}><FiClock size={9} />Chưa bắt đầu</span>
                    }
                </div>
                <div style={{ width:48,height:48,borderRadius:14,background:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.18)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:'1em',color:'#fff' }}>{initials}</div>
            </div>

            {/* Body */}
            <div style={{ padding:'16px 20px 18px' }}>
                <div style={{ fontWeight:800,fontSize:'0.97em',marginBottom:4,lineHeight:1.3 }}>{c.name}</div>
                <div style={{ fontSize:'0.78em',color:accent,fontWeight:600,marginBottom:12 }}>{c.subject}</div>
                <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:14 }}>
                    {days && <div style={{ display:'flex',alignItems:'center',gap:8,fontSize:'0.77em',color:'var(--text-muted)' }}><FiCalendar size={12} style={{color:accent,flexShrink:0}} />{days}{c.schedule?.startTime?` • ${c.schedule.startTime}–${c.schedule.endTime}`:''}</div>}
                    {c.teacher?.name && <div style={{ display:'flex',alignItems:'center',gap:8,fontSize:'0.77em',color:'var(--text-muted)' }}><div style={{ width:16,height:16,borderRadius:'50%',background:'linear-gradient(135deg,#10b981,#059669)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.6em',fontWeight:700,color:'#fff',flexShrink:0 }}>{c.teacher.name[0]}</div>{c.teacher.name}</div>}
                    <div style={{ display:'flex',alignItems:'center',gap:8,fontSize:'0.77em',color:'var(--text-muted)' }}><FiUsers size={12} style={{color:accent,flexShrink:0}} />{c.students?.length||0} sinh viên</div>
                </div>
                <div style={{ height:1,background:'var(--border)',marginBottom:14 }} />
                <div style={{ display:'flex',gap:8 }} onClick={e=>e.stopPropagation()}>
                    {live ? (
                        <button className="btn btn-sm" style={{ flex:1,background:'linear-gradient(135deg,#10b981,#059669)',color:'#fff',border:'none',fontWeight:700 }} onClick={()=>navigate(`/meeting/${c._id}`)}>
                            <FiPlay size={13} /> Tham gia lớp học
                        </button>
                    ) : (
                        <div style={{ flex:1,display:'flex',alignItems:'center',gap:7,fontSize:'0.79em',color:'var(--text-muted)' }}>
                            <FiClock size={12} /><span>Chờ giáo viên bắt đầu</span>
                        </div>
                    )}
                    <button className="btn btn-outline btn-sm btn-icon" style={{ padding:'0 12px' }} onClick={()=>navigate(`/student/classroom/${c._id}`)}>
                        <FiChevronRight size={14} />
                    </button>
                </div>
            </div>

            {live && <div style={{ position:'absolute',bottom:0,left:0,right:0,height:3,background:'linear-gradient(90deg,transparent,#10b981,transparent)',filter:'blur(1px)' }} />}
        </div>
    );
}

/* ─────────────────────────────────
   Main Page
───────────────────────────────────*/
export default function StudentClassrooms() {
    const [classrooms, setClassrooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('schedule'); // 'schedule' | 'cards'
    const [filterDay, setFilterDay] = useState(null);

    useEffect(() => {
        classroomsAPI.getAll().then(r=>setClassrooms(r.data)).catch(console.error).finally(()=>setLoading(false));
    }, []);

    const liveCount = classrooms.filter(c=>c.meeting?.isLive).length;
    const classIndexMap = Object.fromEntries(classrooms.map((c,i)=>[c._id,i]));
    const displayed = filterDay===null ? classrooms : classrooms.filter(c=>c.schedule?.dayOfWeek?.includes(filterDay));

    return (
        <>
            {/* Header */}
            <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:14 }}>
                <div>
                    <h1 style={{ fontSize:'1.6em',fontWeight:900,letterSpacing:'-0.5px',margin:0 }}>Lớp học của bạn</h1>
                    <p style={{ color:'var(--text-muted)',fontSize:'0.875em',marginTop:5 }}>
                        {classrooms.length} lớp đang tham gia
                        {liveCount>0&&<span style={{ marginLeft:10,color:'var(--success)',fontWeight:700 }}>• {liveCount} đang diễn ra</span>}
                    </p>
                </div>

                {/* View toggle */}
                <div style={{ display:'flex',gap:6,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:12,padding:4 }}>
                    {[
                        { k:'schedule', icon:<FiCalendar size={13}/>, label:'Thời khóa biểu' },
                        { k:'cards',    icon:<FiGrid size={13}/>,     label:'Thẻ lớp học' },
                    ].map(({ k,icon,label })=>(
                        <button key={k} onClick={()=>setView(k)} style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:600,fontSize:'0.8em',transition:'all 0.18s',background:view===k?'var(--accent)':'transparent',color:view===k?'#fff':'var(--text-muted)' }}>
                            {icon}{label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Day filter (cards view) */}
            {view==='cards' && (
                <div style={{ display:'flex',gap:6,marginBottom:18,flexWrap:'wrap' }}>
                    <button onClick={()=>setFilterDay(null)} style={{ padding:'6px 14px',borderRadius:99,border:'none',cursor:'pointer',fontWeight:600,fontSize:'0.78em',background:filterDay===null?'var(--accent)':'rgba(255,255,255,0.05)',color:filterDay===null?'#fff':'var(--text-muted)',transition:'all 0.15s' }}>Tất cả</button>
                    {DAYS_LABEL.map((d,i)=>(
                        <button key={i} onClick={()=>setFilterDay(filterDay===i?null:i)} style={{ padding:'6px 12px',borderRadius:99,border:'none',cursor:'pointer',fontWeight:600,fontSize:'0.78em',background:filterDay===i?'var(--accent)':'rgba(255,255,255,0.05)',color:filterDay===i?'#fff':'var(--text-muted)',transition:'all 0.15s' }}>{d}</button>
                    ))}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))',gap:18 }}>
                    {[1,2,3].map(k=>(
                        <div key={k} style={{ borderRadius:20,overflow:'hidden',border:'1px solid var(--border)' }}>
                            <div className="skeleton" style={{height:110}} />
                            <div style={{ padding:'16px 20px' }}>
                                <div className="skeleton skeleton-text w-3/4" /><div className="skeleton skeleton-text w-1/2 sm" />
                                <div className="skeleton" style={{height:36,borderRadius:10,marginTop:16}} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty */}
            {!loading && classrooms.length===0 && (
                <div style={{ textAlign:'center',padding:'60px 20px',background:'var(--bg-card)',borderRadius:20,border:'1px solid var(--border)' }}>
                    <div style={{ width:72,height:72,borderRadius:20,background:'var(--accent-light)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px' }}><FiVideo size={30} color="var(--accent)" /></div>
                    <div style={{ fontWeight:800,fontSize:'1.05em',marginBottom:8 }}>Chưa có lớp học</div>
                    <div style={{ color:'var(--text-muted)',fontSize:'0.875em' }}>Bạn chưa được thêm vào lớp học nào</div>
                </div>
            )}

            {/* Schedule View */}
            {!loading && classrooms.length>0 && view==='schedule' && (
                <WeekSchedule classrooms={classrooms} classIndexMap={classIndexMap} />
            )}

            {/* Cards View */}
            {!loading && classrooms.length>0 && view==='cards' && (
                <>
                    {displayed.length===0 && <div style={{ textAlign:'center',padding:'40px',color:'var(--text-muted)',fontSize:'0.875em' }}>Không có lớp học nào vào {DAYS_LABEL[filterDay]}</div>}
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))',gap:18 }}>
                        {displayed.map(c=>(
                            <ClassCard key={c._id} c={c} idx={classIndexMap[c._id]??0} />
                        ))}
                    </div>
                </>
            )}
        </>
    );
}
