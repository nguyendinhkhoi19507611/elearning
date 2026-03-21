import React, { useState } from 'react';
import { coursesAPI } from '../../api/api';
import { useNavigate } from 'react-router-dom';
import { FiPlusCircle, FiBook, FiChevronRight } from 'react-icons/fi';

export default function TeacherCreateCourse() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', description: '', duration: '', level: 'beginner', topics: '', objectives: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!form.name || !form.description) { setError('Vui lòng điền tên và mô tả'); return; }
        setLoading(true); setError('');
        try {
            await coursesAPI.create({
                ...form,
                duration: Number(form.duration) || 0,
                topics: form.topics.split(',').map(t => t.trim()).filter(Boolean),
                objectives: form.objectives.split(',').map(o => o.trim()).filter(Boolean),
            });
            navigate('/teacher/courses');
        } catch (e) { setError(e.response?.data?.message || 'Lỗi tạo khóa học'); }
        setLoading(false);
    };

    const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Tạo khóa học mới</h1>
                <p className="page-subtitle">Thêm khóa học vào hệ thống</p>
            </div>

            <div className="card" style={{ maxWidth: 640 }}>
                <div className="card-header">
                    <div className="card-title"><FiBook size={15} /> Thông tin khóa học</div>
                </div>

                {error && <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.875em' }}>{error}</div>}

                <div className="form-group">
                    <label className="form-label">Tên khóa học *</label>
                    <input className="form-input" placeholder="VD: Toán cao cấp A1" {...f('name')} />
                </div>
                <div className="form-group">
                    <label className="form-label">Mô tả *</label>
                    <textarea className="form-input form-textarea" placeholder="Mô tả ngắn về khóa học..." {...f('description')} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                        <label className="form-label">Thời lượng (giờ)</label>
                        <input className="form-input" type="number" placeholder="VD: 30" {...f('duration')} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Cấp độ</label>
                        <select className="form-input" {...f('level')}>
                            <option value="beginner">Sơ cấp</option>
                            <option value="intermediate">Trung cấp</option>
                            <option value="advanced">Nâng cao</option>
                        </select>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Chủ đề (phân cách bằng dấu phẩy)</label>
                    <input className="form-input" placeholder="VD: Giải tích, Đại số, Hình học..." {...f('topics')} />
                </div>
                <div className="form-group">
                    <label className="form-label">Mục tiêu (phân cách bằng dấu phẩy)</label>
                    <input className="form-input" placeholder="VD: Nắm vững nền tảng, Giải được bài tập..." {...f('objectives')} />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button className="btn btn-outline" onClick={() => navigate('/teacher/courses')}>Hủy</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                        {loading ? <span className="spinner" style={{ width: 15, height: 15 }} /> : <FiPlusCircle size={15} />}
                        Tạo khóa học
                    </button>
                </div>
            </div>
        </>
    );
}
