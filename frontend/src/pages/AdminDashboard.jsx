// Admin routes: /admin, /admin/classrooms, /admin/users, /admin/ai, /admin/profile
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminOverview from './admin/AdminOverview';
import AdminClassrooms from './admin/AdminClassrooms';
import AdminUsers from './admin/AdminUsers';
import AdminAI from './admin/AdminAI';
import UserProfile from './UserProfile';
import ChangePassword from './ChangePassword';

export default function AdminDashboard() {
    return (
        <div className="fade-in">
            <Routes>
                <Route index element={<AdminOverview />} />
                <Route path="classrooms" element={<AdminClassrooms />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="ai" element={<AdminAI />} />
                <Route path="profile" element={<UserProfile />} />
                <Route path="change-password" element={<ChangePassword />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
        </div>
    );
}
