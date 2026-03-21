// Teacher routes: /teacher, /teacher/monitoring, /teacher/courses, /teacher/create
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TeacherClassrooms from './teacher/TeacherClassrooms';
import TeacherMonitoring from './teacher/TeacherMonitoring';
import TeacherCourses from './teacher/TeacherCourses';
import TeacherCreateCourse from './teacher/TeacherCreateCourse';

export default function TeacherDashboard() {
    return (
        <div className="fade-in">
            <Routes>
                <Route index element={<TeacherClassrooms />} />
                <Route path="monitoring" element={<TeacherMonitoring />} />
                <Route path="courses" element={<TeacherCourses />} />
                <Route path="create" element={<TeacherCreateCourse />} />
                <Route path="*" element={<Navigate to="/teacher" replace />} />
            </Routes>
        </div>
    );
}
