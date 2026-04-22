import React from 'react';

/**
 * [B1] AttendanceBanner — Banner điểm danh + banner thành công
 * Extracted from MeetingRoom.jsx
 */
export function AttendanceBanner({ session, onCheckIn }) {
    if (!session || session.status === 'ended') return null;

    return (
        <div className="floating-banner floating-banner-accent">
            <div>
                <div style={{ fontWeight: 700, fontSize: '0.95em' }}>
                    📋 Giáo viên đang điểm danh!
                </div>
                <div style={{ fontSize: '0.8em', opacity: 0.85, marginTop: 2 }}>
                    {session.startTime} - {session.endTime}
                </div>
            </div>
            <button
                onClick={onCheckIn}
                style={{
                    background: '#fff', color: '#6366f1',
                    border: 'none', borderRadius: 10,
                    padding: '10px 20px', fontWeight: 700,
                    fontSize: '0.9em', cursor: 'pointer',
                    whiteSpace: 'nowrap', flexShrink: 0
                }}
            >
                📸 Điểm danh ngay
            </button>
        </div>
    );
}

export function AttendanceSuccessBanner({ show }) {
    if (!show) return null;
    return (
        <div className="floating-banner floating-banner-success">
            <span style={{ fontSize: '1.2em' }}>✅</span>
            <span style={{ fontWeight: 700, fontSize: '0.9em' }}>
                Đã điểm danh thành công!
            </span>
        </div>
    );
}
