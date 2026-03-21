import React, { useState, useEffect } from 'react';
import { coursesAPI } from '../../api/api';
import { FiBook, FiClock, FiUsers, FiList } from 'react-icons/fi';

export default function TeacherCourses() {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        coursesAPI.getAll().then(r => setCourses(r.data.courses || r.data || [])).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="card"><div className="empty-state"><div className="spinner" /></div></div>;

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Khóa học</h1>
                <p className="page-subtitle">Danh sách khóa học bạn phụ trách</p>
            </div>

            {courses.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"><FiBook size={24} /></div>
                        <div className="empty-state-title">Chưa có khóa học nào</div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-2">
                    {courses.map((c) => (
                        <div className="card" key={c._id}>
                            <div style={{ fontWeight: 700, fontSize: '1.05em', marginBottom: 6 }}>{c.name}</div>
                            <div style={{ fontSize: '0.82em', color: 'var(--text-muted)', marginBottom: 12 }}>{c.description}</div>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                {c.duration && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8em', color: 'var(--text-secondary)' }}>
                                        <FiClock size={12} /> {c.duration}h
                                    </span>
                                )}
                                {c.level && <span className="badge badge-accent">{c.level}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
