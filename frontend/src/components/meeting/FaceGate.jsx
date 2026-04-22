import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * [B1] FaceGate — Chặn vào lớp nếu chưa đăng ký khuôn mặt
 * Extracted from MeetingRoom.jsx
 */
export default function FaceGate() {
    const navigate = useNavigate();

    return (
        <div className="gate-overlay">
            <div className="gate-card">
                <div className="gate-icon" style={{
                    background: 'rgba(249,115,22,0.15)',
                    border: '2px solid rgba(249,115,22,0.3)'
                }}>⚠️</div>
                <h2 style={{ fontWeight: 700, fontSize: '1.3em', margin: '0 0 10px' }}>
                    Chưa đăng ký khuôn mặt
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9em', lineHeight: 1.6, margin: '0 0 24px' }}>
                    Bạn cần đăng ký khuôn mặt trước khi vào lớp học.<br />
                    Vui lòng vào <strong style={{ color: 'var(--accent)' }}>Menu → Khuôn mặt</strong> để đăng ký.
                </p>
                <button
                    className="btn btn-primary btn-lg btn-block"
                    onClick={() => navigate(-1)}
                >
                    ← Quay lại
                </button>
            </div>
        </div>
    );
}
