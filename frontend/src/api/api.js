import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_URL });

// Auto-attach token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (!window.location.pathname.includes('/login')) window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

// ── Auth ──
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    voiceLogin: (formData) => api.post('/auth/voice-login', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    voiceRegister: (formData) => api.post('/auth/voice-register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    me: () => api.get('/auth/me'),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    resetPassword: (data) => api.post('/auth/reset-password', data),
    changePassword: (data) => api.post('/auth/change-password', data),
};

// ── Users ──
export const usersAPI = {
    getAll: (params) => api.get('/users', { params }),
    getById: (id) => api.get(`/users/${id}`),
    update: (id, data) => api.put(`/users/${id}`, data),
    toggleLock: (id) => api.patch(`/users/${id}/toggle-lock`),
    deleteUser: (id) => api.delete(`/users/${id}`),
    getStats: () => api.get('/users/admin/stats'),
};

// ── Courses ──
export const coursesAPI = {
    create: (data) => api.post('/courses', data),
    getAll: (params) => api.get('/courses', { params }),
    getById: (id) => api.get(`/courses/${id}`),
    enroll: (id) => api.post(`/courses/${id}/enroll`),
    startSession: (id, data) => api.post(`/courses/${id}/session/start`, data),
    endSession: (id) => api.post(`/courses/session/${id}/end`),
    getSession: (id) => api.get(`/courses/session/${id}`),
    getSessions: (courseId) => api.get(`/courses/${courseId}/sessions`),
};

// ── AI ──
export const aiAPI = {
    detectImage: (formData) => api.post('/ai/vision/detect', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    detectBase64: (data) => api.post('/ai/vision/detect-base64', data),
    recommend: (data) => api.post('/ai/recommend', data),
    engagement: (data) => api.post('/ai/engagement', data),
    health: () => api.get('/ai/health'),
    // [D6] Real data endpoint
    getMyData: () => api.get('/ai/my-data'),
};

// ── Classrooms ──
export const classroomsAPI = {
    getAll: () => api.get('/classrooms'),
    getById: (id) => api.get(`/classrooms/${id}`),
    create: (data) => api.post('/classrooms', data),
    update: (id, data) => api.put(`/classrooms/${id}`, data),
    remove: (id) => api.delete(`/classrooms/${id}`),
    addStudents: (id, studentIds) => api.post(`/classrooms/${id}/students`, { studentIds }),
    removeStudent: (id, studentId) => api.delete(`/classrooms/${id}/students/${studentId}`),
    startMeeting: (id) => api.post(`/classrooms/${id}/meeting/start`),
    endMeeting: (id) => api.post(`/classrooms/${id}/meeting/end`),
    getLive: () => api.get('/classrooms/live/now'),
    uploadRecording: (id, formData) => api.post(`/classrooms/${id}/recording`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000, // 5 min timeout for large uploads
    }),
    getRecordings: (id) => api.get(`/classrooms/${id}/recordings`),
    // [E2] Attendance history
    getAttendance: (id) => api.get(`/attendance/classroom/${id}`),         // teacher: all sessions
    getMyAttendance: (id) => api.get(`/attendance/classroom/${id}/me`),    // student: my records
};

// ── Attendance ──
export const attendanceAPI = {
    getActiveSessions: (classroomId) => api.get('/attendance/sessions', { params: { classroomId, status: 'active' } }),
    checkin: (sessionId, data) => api.post(`/attendance/sessions/${sessionId}/checkin`, data),
    faceVerifyBase64: (data) => api.post('/attendance/face/verify-base64', data),
};

// ── Assignments ── [D3]
export const assignmentsAPI = {
    getByClassroom: (classroomId) => api.get(`/assignments/classroom/${classroomId}`),
    create: (formData) => api.post('/assignments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    update: (id, data) => api.put(`/assignments/${id}`, data),
    delete: (id) => api.delete(`/assignments/${id}`),
    submit: (id, formData) => api.post(`/assignments/${id}/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    grade: (id, studentId, data) => api.post(`/assignments/${id}/grade/${studentId}`, data),
    getSubmissions: (id) => api.get(`/assignments/${id}/submissions`),
};

// ── Profile ── [C1]
export const profileAPI = {
    get: () => api.get('/users/profile/me'),
    update: (data) => api.put('/users/profile/me', data),
};

export default api;
