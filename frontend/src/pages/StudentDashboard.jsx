// Student routes: /student, /student/classrooms, /student/learning, /student/camera, /student/voice, /student/face
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import StudentOverview from './student/StudentOverview';
import StudentClassrooms from './student/StudentClassrooms';
import StudentLearning from './student/StudentLearning';
import StudentVoice from './student/StudentVoice';
import StudentFace from './student/StudentFace';
import StudentProfile from './student/StudentProfile';
import StudentAttendance from './student/StudentAttendance';
import StudentAssignment from './student/StudentAssignment';
import ClassroomDetail from './teacher/ClassroomDetail';
import ChangePassword from './ChangePassword';

export default function StudentDashboard() {
    return (
        <div className="fade-in">
            <Routes>
                <Route index element={<StudentOverview />} />
                <Route path="classrooms" element={<StudentClassrooms />} />
                <Route path="learning" element={<StudentLearning />} />
                <Route path="voice" element={<StudentVoice />} />
                <Route path="face" element={<StudentFace />} />
                <Route path="profile" element={<StudentProfile />} />
                <Route path="attendance" element={<StudentAttendance />} />
                <Route path="assignments" element={<StudentAssignment />} />
                <Route path="classroom/:id" element={<ClassroomDetail />} />
                <Route path="change-password" element={<ChangePassword />} />
                <Route path="*" element={<Navigate to="/student" replace />} />
            </Routes>
        </div>
    );
}

