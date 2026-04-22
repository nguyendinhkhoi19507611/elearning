import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { toggleSidebar } from './store/uiSlice';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import MobileBottomNav from './components/MobileBottomNav';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import MeetingRoom from './pages/MeetingRoom';
import { FiMenu, FiX, FiSun, FiMoon } from 'react-icons/fi';
import NotificationBell from './components/NotificationBell';
import ThemeToggle from './components/ThemeToggle';

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
    // [BUG FIX #14] Role mismatch → redirect về dashboard của role, không phải /login
    if (roles && !roles.includes(user.role)) {
        const roleDashboard = { admin: '/admin', teacher: '/teacher', student: '/student' };
        return <Navigate to={roleDashboard[user.role] || '/login'} />;
    }
    return children;
}

/* ── Public Auth guard (prevents logged-in users from seeing login/register) ── */
function PublicRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return null; // or spinner
    if (user) {
        const roleDashboard = { admin: '/admin', teacher: '/teacher', student: '/student' };
        return <Navigate to={roleDashboard[user.role] || '/'} />;
    }
    return children;
}

/* ── Mobile top header ── */
function MobileHeader() {
    const { user } = useAuth();
    const dispatch = useDispatch();
    const sidebarOpen = useSelector((s) => s.ui.sidebarOpen);
    const location = useLocation();
    // [BUG-16 FIX] Thêm check auth pages để tránh flash MobileHeader khi PublicRoute chưa redirect kịp
    const isAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);
    if (!user || location.pathname.startsWith('/meeting') || isAuthPage) return null;
    return (
        <div className="mobile-header">
            <button className="hamburger" onClick={() => dispatch(toggleSidebar())} aria-label="Menu">
                {sidebarOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </button>
            <div className="mobile-header-logo">EduAI Platform</div>
            {/* [C2] Notification Bell */}
            <NotificationBell />
            {/* [C5] Theme toggle */}
            <ThemeToggle />
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
    const isAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);
    const showChrome = !!user && !isMeeting && !isAuthPage;

    return (
        <>
            {showChrome && <Sidebar />}
            {showChrome && <MobileHeader />}

            <div className={showChrome ? 'main-content' : ''} style={!showChrome ? { flex: 1, width: '100%', display:'flex', flexDirection:'column' } : undefined}>
                <Routes>
                    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                    <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                    <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

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
