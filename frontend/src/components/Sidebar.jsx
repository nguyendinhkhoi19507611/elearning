import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { closeSidebar } from '../store/uiSlice';
import { useAuth } from '../context/AuthContext';
import {
    FiHome, FiBook, FiMic, FiUsers, FiLogOut,
    FiCpu, FiVideo, FiX, FiBookOpen, FiShield,
    FiGrid, FiLock, FiUser, FiCalendar, FiAward,
} from 'react-icons/fi';

const navConfig = {
    student: [
        { section: 'Học tập', items: [
            { icon: <FiHome size={16} />, label: 'Tổng quan', to: '/student' },
            { icon: <FiVideo size={16} />, label: 'Lớp học', to: '/student/classrooms' },
            { icon: <FiBookOpen size={16} />, label: 'Lộ trình AI', to: '/student/learning' },
            { icon: <FiCalendar size={16} />, label: 'Điểm danh', to: '/student/attendance' },
            { icon: <FiBook size={16} />, label: 'Bài tập', to: '/student/assignments' },
        ]},
        { section: 'Sinh trắc học', items: [
            { icon: <FiMic size={16} />, label: 'Giọng nói', to: '/student/voice' },
            { icon: <FiUser size={16} />, label: 'Khuôn mặt', to: '/student/face' },
        ]},
    ],
    teacher: [
        { section: 'Giảng dạy', items: [
            { icon: <FiHome size={16} />, label: 'Tổng quan', to: '/teacher' },
            { icon: <FiVideo size={16} />, label: 'Lớp học', to: '/teacher/classrooms' },
            { icon: <FiBook size={16} />, label: 'Bài tập', to: '/teacher/assignments' },
        ]},
    ],
    admin: [
        { section: 'Quản trị', items: [
            { icon: <FiHome size={16} />, label: 'Dashboard', to: '/admin' },
            { icon: <FiVideo size={16} />, label: 'Lớp học', to: '/admin/classrooms' },
            { icon: <FiUsers size={16} />, label: 'Người dùng', to: '/admin/users' },
            { icon: <FiCpu size={16} />, label: 'AI Services', to: '/admin/ai' },
        ]},
    ],
};

const roleConfig = {
    student: { label: 'Sinh viên',    color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   icon: <FiGrid size={11} /> },
    teacher: { label: 'Giáo viên',    color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: <FiBook size={11} /> },
    admin:   { label: 'Quản trị viên',color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: <FiShield size={11} /> },
};

const accountItems = [
    { icon: <FiUser size={16} />, label: 'Hồ sơ cá nhân', toSuffix: '/profile' },
    { icon: <FiLock size={16} />, label: 'Đổi mật khẩu',  toSuffix: '/change-password' },
];

export default function Sidebar() {
    const dispatch = useDispatch();
    const sidebarOpen = useSelector(s => s.ui.sidebarOpen);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    if (!user) return null;
    if (location.pathname.startsWith('/meeting')) return null;

    const sections = navConfig[user.role] || navConfig.student;
    const rc = roleConfig[user.role] || roleConfig.student;
    const initials = user.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <>
            <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => dispatch(closeSidebar())} />

            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>

                {/* ── Logo ── */}
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">
                        <FiBookOpen size={17} color="white" />
                    </div>
                    <div style={{ flex:1 }}>
                        <div className="sidebar-logo-text">EduAI</div>
                        <div className="sidebar-logo-sub">Learning Platform</div>
                    </div>
                    <button className="hamburger sidebar-close-btn" onClick={() => dispatch(closeSidebar())} aria-label="Đóng">
                        <FiX size={17} />
                    </button>
                </div>

                {/* ── User mini card ── */}
                <div style={{ padding:'14px 16px 10px' }}>
                    <div style={{
                        display:'flex', alignItems:'center', gap:10,
                        padding:'12px 14px', borderRadius:14,
                        background:'var(--bg-purple-soft)',
                        border:'1px solid var(--border)',
                    }}>
                        <div style={{
                            width:36, height:36, borderRadius:'50%', flexShrink:0,
                            background:'linear-gradient(135deg,var(--accent),var(--purple))',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontWeight:800, fontSize:'0.8em', color:'white',
                            boxShadow:'0 2px 8px rgba(124,58,237,0.35)',
                        }}>
                            {initials}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:'0.82em', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:'var(--text-primary)' }}>
                                {user.name}
                            </div>
                            <div style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:3, padding:'2px 8px', borderRadius:99, background:rc.bg, color:rc.color, fontSize:'0.62em', fontWeight:700 }}>
                                {rc.icon} {rc.label}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Nav ── */}
                <nav className="sidebar-nav" style={{ flex:1, padding:'4px 0' }}>
                    {sections.map(sec => (
                        <div key={sec.section}>
                            <div className="nav-section">{sec.section}</div>
                            {sec.items.map(item => {
                                const isIndex = item.to === `/${user.role}`;
                                return (
                                    <NavLink
                                        key={item.to} to={item.to} end={isIndex}
                                        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                                        onClick={() => dispatch(closeSidebar())}
                                    >
                                        <span className="nav-icon">{item.icon}</span>
                                        <span>{item.label}</span>
                                    </NavLink>
                                );
                            })}
                        </div>
                    ))}

                    {/* Account section */}
                    <div>
                        <div className="nav-section" style={{ marginTop:8 }}>Tài khoản</div>
                        {accountItems.map(item => (
                            <NavLink
                                key={item.toSuffix}
                                to={`/${user.role}${item.toSuffix}`}
                                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                                onClick={() => dispatch(closeSidebar())}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                </nav>

                {/* ── Footer logout ── */}
                <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
                    <button onClick={handleLogout} style={{
                        width:'100%', display:'flex', alignItems:'center', gap:10,
                        padding:'10px 14px', borderRadius:10, border:'none', cursor:'pointer',
                        background:'var(--danger-light)',
                        color:'var(--text-muted)',
                        fontSize:'0.855em', fontWeight:600,
                        transition:'all 0.18s ease',
                    }}
                        onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.1)'; e.currentTarget.style.color='var(--danger)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='var(--danger-light)'; e.currentTarget.style.color='var(--text-muted)'; }}
                    >
                        <FiLogOut size={15} />
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
