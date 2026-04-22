import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toggleSidebar } from '../store/uiSlice';
import { useAuth } from '../context/AuthContext';
import {
    FiHome, FiVideo, FiMic,
    FiUsers, FiCpu, FiCalendar,
    FiMenu, FiLogOut, FiUser, FiBookOpen, FiBook
} from 'react-icons/fi';

// [U4] Đồng bộ với Sidebar — 5 items cho student, thêm Điểm danh
const mobileNavConfig = {
    student: [
        { icon: <FiHome size={20} />, label: 'Tổng quan', to: '/student' },
        { icon: <FiVideo size={20} />, label: 'Lớp học', to: '/student/classrooms' },
        { icon: <FiCalendar size={20} />, label: 'Điểm danh', to: '/student/attendance' },
        { icon: <FiBook size={20} />, label: 'Bài tập', to: '/student/assignments' },
        { icon: <FiBookOpen size={20} />, label: 'Lộ trình', to: '/student/learning' },
    ],
    teacher: [
        { icon: <FiHome size={20} />, label: 'Tổng quan', to: '/teacher' },
        { icon: <FiVideo size={20} />, label: 'Lớp học', to: '/teacher/classrooms' },
        { icon: <FiBook size={20} />, label: 'Bài tập', to: '/teacher/assignments' },
        { icon: <FiUser size={20} />, label: 'Hồ sơ', to: '/teacher/profile' },
    ],
    admin: [
        { icon: <FiHome size={20} />, label: 'Tổng quan', to: '/admin' },
        { icon: <FiVideo size={20} />, label: 'Lớp học', to: '/admin/classrooms' },
        { icon: <FiUsers size={20} />, label: 'Users', to: '/admin/users' },
        { icon: <FiCpu size={20} />, label: 'AI', to: '/admin/ai' },
    ],
};

export default function MobileBottomNav() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();

    if (!user) return null;
    if (location.pathname.startsWith('/meeting')) return null;

    const items = mobileNavConfig[user.role] || mobileNavConfig.student;

    const isActive = (to) => {
        // Index route: exact match only
        if (to === `/${user.role}`) return location.pathname === to;
        return location.pathname.startsWith(to);
    };

    return (
        <div className="mobile-bottomnav">
            <div className="mobile-bottomnav-inner">
                {/* Menu button để mở sidebar (cho các mục không trong bottom nav) */}
                <button
                    className="mobile-nav-btn"
                    onClick={() => dispatch(toggleSidebar())}
                    aria-label="Menu"
                >
                    <FiMenu size={20} />
                    <span>Menu</span>
                </button>

                {items.map((item) => (
                    <button
                        key={item.to}
                        className={`mobile-nav-btn${isActive(item.to) ? ' active' : ''}`}
                        onClick={() => navigate(item.to)}
                        aria-label={item.label}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </button>
                ))}

                <button
                    className="mobile-nav-btn"
                    onClick={() => { logout(); navigate('/login'); }}
                    aria-label="Đăng xuất"
                >
                    <FiLogOut size={20} />
                    <span>Thoát</span>
                </button>
            </div>
        </div>
    );
}
