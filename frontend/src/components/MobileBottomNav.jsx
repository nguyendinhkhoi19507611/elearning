import React from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toggleSidebar } from '../store/uiSlice';
import { useAuth } from '../context/AuthContext';
import {
    FiHome, FiVideo, FiBookOpen, FiCamera, FiMic,
    FiActivity, FiBook, FiPlusCircle, FiUsers, FiCpu,
    FiMenu, FiLogOut
} from 'react-icons/fi';

const mobileNavConfig = {
    student: [
        { icon: <FiHome size={20} />, label: 'Tổng quan', to: '/student' },
        { icon: <FiVideo size={20} />, label: 'Lớp học', to: '/student/classrooms' },
        { icon: <FiCamera size={20} />, label: 'Camera', to: '/student/camera' },
        { icon: <FiMic size={20} />, label: 'Giọng', to: '/student/voice' },
    ],
    teacher: [
        { icon: <FiVideo size={20} />, label: 'Lớp học', to: '/teacher' },
        { icon: <FiActivity size={20} />, label: 'Giám sát', to: '/teacher/monitoring' },
        { icon: <FiBook size={20} />, label: 'Khóa học', to: '/teacher/courses' },
        { icon: <FiPlusCircle size={20} />, label: 'Tạo mới', to: '/teacher/create' },
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

    return (
        <div className="mobile-bottomnav">
            <div className="mobile-bottomnav-inner">
                <button
                    className="mobile-nav-btn"
                    onClick={() => dispatch(toggleSidebar())}
                    aria-label="Menu"
                >
                    <FiMenu size={20} />
                    <span>Menu</span>
                </button>
                {items.map((item) => {
                    const isActive = location.pathname === item.to ||
                        (item.to.split('/').length > 2 && location.pathname.startsWith(item.to));
                    return (
                        <button
                            key={item.to}
                            className={`mobile-nav-btn${isActive ? ' active' : ''}`}
                            onClick={() => navigate(item.to)}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </button>
                    );
                })}
                <button
                    className="mobile-nav-btn"
                    onClick={() => { logout(); navigate('/login'); }}
                >
                    <FiLogOut size={20} />
                    <span>Thoát</span>
                </button>
            </div>
        </div>
    );
}
