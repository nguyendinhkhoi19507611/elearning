// Student routes: /student, /student/classrooms, /student/learning, /student/camera, /student/voice
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import StudentOverview from './student/StudentOverview';
import StudentClassrooms from './student/StudentClassrooms';
import StudentLearning from './student/StudentLearning';
import StudentCamera from './student/StudentCamera';
import StudentVoice from './student/StudentVoice';

export default function StudentDashboard() {
    return (
        <div className="fade-in">
            <Routes>
                <Route index element={<StudentOverview />} />
                <Route path="classrooms" element={<StudentClassrooms />} />
                <Route path="learning" element={<StudentLearning />} />
                <Route path="camera" element={<StudentCamera />} />
                <Route path="voice" element={<StudentVoice />} />
                <Route path="*" element={<Navigate to="/student" replace />} />
            </Routes>
        </div>
    );
}
