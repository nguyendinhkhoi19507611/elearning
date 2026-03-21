import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { closeSidebar, toggleSidebar } from '../store/uiSlice';
import { useAuth } from '../context/AuthContext';
import {
    FiHome, FiBook, FiCamera, FiMic, FiUsers, FiLogOut,
    FiActivity, FiServer, FiPlusCircle, FiBarChart2, FiVideo,
    FiX, FiBookOpen, FiShield, FiCpu, FiGrid
} from 'react-icons/fi';

const navConfig = {
    student: [
        { icon: <FiHome size={17} />, label: 'Tổng quan', to: '/student' },
        { icon: <FiVideo size={17} />, label: 'Lớp học', to: '/student/classrooms' },
        { icon: <FiBookOpen size={17} />, label: 'Lộ trình học', to: '/student/learning' },
        { icon: <FiCamera size={17} />, label: 'Camera AI', to: '/student/camera' },
        { icon: <FiMic size={17} />, label: 'Giọng nói', to: '/student/voice' },
    ],
    teacher: [
        { icon: <FiVideo size={17} />, label: 'Lớp học', to: '/teacher' },
        { icon: <FiActivity size={17} />, label: 'Giám sát', to: '/teacher/monitoring' },
        { icon: <FiBook size={17} />, label: 'Khóa học', to: '/teacher/courses' },
        { icon: <FiPlusCircle size={17} />, label: 'Tạo khóa học', to: '/teacher/create' },
    ],
    admin: [
        { icon: <FiHome size={17} />, label: 'Tổng quan', to: '/admin' },
        { icon: <FiVideo size={17} />, label: 'Lớp học', to: '/admin/classrooms' },
        { icon: <FiUsers size={17} />, label: 'Người dùng', to: '/admin/users' },
        { icon: <FiCpu size={17} />, label: 'AI Services', to: '/admin/ai' },
    ],
};

const roleLabels = { student: 'Sinh viên', teacher: 'Giáo viên', admin: 'Quản trị viên' };
const roleColors = { student: 'var(--info)', teacher: 'var(--success)', admin: 'var(--purple)' };
const roleBadgeClass = { student: 'badge-info', teacher: 'badge-success', admin: 'badge-purple' };

export default function Sidebar() {
    const dispatch = useDispatch();
    const sidebarOpen = useSelector((s) => s.ui.sidebarOpen);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    if (!user) return null;
    if (location.pathname.startsWith('/meeting')) return null;

    const items = navConfig[user.role] || navConfig.student;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
                onClick={() => dispatch(closeSidebar())}
            />

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                {/* Logo + close btn (mobile) */}
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">
                        <FiBookOpen size={18} color="white" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div className="sidebar-logo-text">EduAI</div>
                        <div className="sidebar-logo-sub">Learning Platform</div>
                    </div>
                    <button
                        className="hamburger sidebar-close-btn"
                        onClick={() => dispatch(closeSidebar())}
                        aria-label="Đóng menu"
                    >
                        <FiX size={18} />
                    </button>
                </div>

                {/* Role badge */}
                <div style={{ padding: '10px 16px 4px' }}>
                    <span className={`badge ${roleBadgeClass[user.role]}`} style={{ width: '100%', justifyContent: 'center', padding: '6px 0', borderRadius: 8 }}>
                        {user.role === 'admin' && <FiShield size={11} />}
                        {user.role === 'teacher' && <FiBook size={11} />}
                        {user.role === 'student' && <FiGrid size={11} />}
                        {roleLabels[user.role]}
                    </span>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    <div className="nav-section">Menu chính</div>
                    {items.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to.split('/').length <= 2}
                            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                            onClick={() => dispatch(closeSidebar())}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* User footer */}
                <div className="sidebar-user">
                    <div className="user-avatar">
                        {user.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="user-info">
                        <div className="user-name">{user.name}</div>
                        <div className="user-role" style={{ color: roleColors[user.role] }}>
                            {roleLabels[user.role]}
                        </div>
                    </div>
                    <button className="logout-btn" onClick={handleLogout} title="Đăng xuất">
                        <FiLogOut size={16} />
                    </button>
                </div>
            </aside>
        </>
    );
}
