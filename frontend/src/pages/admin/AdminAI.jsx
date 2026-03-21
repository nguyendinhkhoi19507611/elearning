import React, { useEffect, useState } from 'react';
import { aiAPI } from '../../api/api';
import { FiActivity, FiMic, FiBook, FiServer, FiCheckCircle, FiAlertCircle, FiUsers, FiRefreshCw } from 'react-icons/fi';

export default function AdminAI() {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        aiAPI.health()
            .then(r => setHealth(r.data.services || r.data))
            .catch(() => setHealth(null))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const services = [
        { name: 'Vision (YOLO)', key: 'vision', icon: <FiActivity size={22} />, desc: 'Nhận diện trạng thái sinh viên qua camera' },
        { name: 'Voice (ECAPA-TDNN)', key: 'voice', icon: <FiMic size={22} />, desc: 'Xác thực giọng nói, đăng nhập bằng voice' },
        { name: 'Recommendation', key: 'recommendation', icon: <FiBook size={22} />, desc: 'Gợi ý lộ trình học cá nhân hoá' },
    ];

    const microservices = [
        { name: 'Backend API', port: 5000, ok: true },
        { name: 'Vision Service', port: 5001, ok: health?.vision?.status === 'ok' },
        { name: 'Voice Service', port: 5002, ok: health?.voice?.status === 'ok' },
        { name: 'Recommend Service', port: 5003, ok: health?.recommendation?.status === 'ok' },
        { name: 'MongoDB', port: 27017, ok: true },
        { name: 'Frontend', port: 3000, ok: true },
    ];

    return (
        <>
            <div className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1 className="page-title">AI Services</h1>
                        <p className="page-subtitle">Trạng thái các dịch vụ AI trong hệ thống</p>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
                        <FiRefreshCw size={14} className={loading ? 'spin' : ''} /> Làm mới
                    </button>
                </div>
            </div>

            <div className="grid grid-3" style={{ marginBottom: 24 }}>
                {services.map(svc => {
                    const h = health?.[svc.key];
                    const isUp = h?.status === 'ok';
                    return (
                        <div className="card" key={svc.key} style={{ borderColor: isUp ? 'rgba(16,217,126,0.35)' : 'rgba(255,77,106,0.35)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div style={{
                                    width: 46, height: 46, borderRadius: 12,
                                    background: isUp ? 'var(--success-light)' : loading ? 'rgba(255,255,255,0.05)' : 'var(--danger-light)',
                                    color: isUp ? 'var(--success)' : loading ? 'var(--text-muted)' : 'var(--danger)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>{svc.icon}</div>
                                <span className={`badge ${loading ? 'badge-neutral' : isUp ? 'badge-success' : 'badge-danger'}`}>
                                    {loading ? 'Kiểm tra...' : isUp ? 'Online' : 'Offline'}
                                </span>
                            </div>
                            <h3 style={{ fontSize: '0.95em', fontWeight: 700, marginBottom: 4 }}>{svc.name}</h3>
                            <p style={{ fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: 12 }}>{svc.desc}</p>
                            {h && isUp && (
                                <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {h.model_loaded !== undefined && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {h.model_loaded ? <FiCheckCircle size={12} color="var(--success)" /> : <FiAlertCircle size={12} color="var(--warning)" />}
                                            Model: {h.model_loaded ? 'Loaded' : 'Not loaded'}
                                        </div>
                                    )}
                                    {h.registered_users !== undefined && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <FiUsers size={12} /> Users: {h.registered_users}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Architecture */}
            <div className="card">
                <div className="card-header">
                    <div className="card-title"><FiServer size={15} /> Kiến trúc Microservices</div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {microservices.map(s => (
                        <div key={s.name} style={{ padding: '10px 16px', background: 'var(--bg-primary)', borderRadius: 8, borderLeft: `3px solid ${s.ok ? 'var(--success)' : 'var(--danger)'}`, flex: 1, minWidth: 130 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.83em' }}>{s.name}</div>
                            <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', marginTop: 2 }}>:{s.port}</div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
