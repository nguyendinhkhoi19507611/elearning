import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { toggleSidebar } from './store/uiSlice';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import MobileBottomNav from './components/MobileBottomNav';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import MeetingRoom from './pages/MeetingRoom';
import { FiMenu, FiX } from 'react-icons/fi';

/* ── Auth guard ── */
function PrivateRoute({ children, roles }) {
    const { user, loading } = useAuth();
    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
            <span style={{ fontSize: '0.875em' }}>Đang tải...</span>
        </div>
    );
    if (!user) return <Navigate to="/login" />;
    if (roles && !roles.includes(user.role)) return <Navigate to="/login" />;
    return children;
}

/* ── Mobile top header ── */
function MobileHeader() {
    const { user } = useAuth();
    const dispatch = useDispatch();
    const sidebarOpen = useSelector((s) => s.ui.sidebarOpen);
    const location = useLocation();
    if (!user || location.pathname.startsWith('/meeting')) return null;
    return (
        <div className="mobile-header">
            <button className="hamburger" onClick={() => dispatch(toggleSidebar())} aria-label="Menu">
                {sidebarOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </button>
            <div className="mobile-header-logo">EduAI Platform</div>
            <div className="user-avatar" style={{ width: 30, height: 30, fontSize: '0.75em', flexShrink: 0 }}>
                {user.name?.charAt(0).toUpperCase()}
            </div>
        </div>
    );
}

/* ── Default redirect ── */
function DefaultRedirect() {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" />;
    if (user.role === 'admin') return <Navigate to="/admin" />;
    if (user.role === 'teacher') return <Navigate to="/teacher" />;
    return <Navigate to="/student" />;
}

/* ── AppContent ── */
function AppContent() {
    const { user } = useAuth();
    const location = useLocation();
    const isMeeting = location.pathname.startsWith('/meeting');
    const showChrome = !!user && !isMeeting;

    return (
        <>
            {showChrome && <Sidebar />}
            {showChrome && <MobileHeader />}

            <div className={showChrome ? 'main-content' : ''}>
                <Routes>
                    <Route path="/login" element={<Login />} />

                    {/* Student – nested */}
                    <Route path="/student/*" element={
                        <PrivateRoute roles={['student']}><StudentDashboard /></PrivateRoute>
                    } />

                    {/* Teacher – nested */}
                    <Route path="/teacher/*" element={
                        <PrivateRoute roles={['teacher']}><TeacherDashboard /></PrivateRoute>
                    } />

                    {/* Admin – nested */}
                    <Route path="/admin/*" element={
                        <PrivateRoute roles={['admin']}><AdminDashboard /></PrivateRoute>
                    } />

                    {/* Meeting room */}
                    <Route path="/meeting/:classroomId" element={
                        <PrivateRoute roles={['admin', 'teacher', 'student']}><MeetingRoom /></PrivateRoute>
                    } />

                    {/* Default */}
                    <Route path="*" element={<DefaultRedirect />} />
                </Routes>
            </div>

            {showChrome && <MobileBottomNav />}
        </>
    );
}

/* ── App root ── */
export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <div className="app-layout">
                    <AppContent />
                </div>
            </AuthProvider>
        </BrowserRouter>
    );
}
