// Teacher routes: /teacher, /teacher/classrooms, /teacher/classroom/:id, /teacher/assignments, /teacher/profile
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TeacherClassrooms from './teacher/TeacherClassrooms';
import TeacherOverview from './teacher/TeacherOverview';
import TeacherAssignment from './teacher/TeacherAssignment';
import ClassroomDetail from './teacher/ClassroomDetail';
import UserProfile from './UserProfile';
import ChangePassword from './ChangePassword';

export default function TeacherDashboard() {
    return (
        <div className="fade-in">
            <Routes>
                <Route index element={<TeacherOverview />} />
                <Route path="classrooms" element={<TeacherClassrooms />} />
                <Route path="classroom/:id" element={<ClassroomDetail />} />
                <Route path="assignments/:classroomId?" element={<TeacherAssignment />} />
                <Route path="profile" element={<UserProfile />} />
                <Route path="change-password" element={<ChangePassword />} />
                <Route path="*" element={<Navigate to="/teacher" replace />} />
            </Routes>
        </div>
    );
}
