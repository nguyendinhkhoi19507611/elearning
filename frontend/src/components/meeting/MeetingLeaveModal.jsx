import React from 'react';

/**
 * [B1] MeetingLeaveModal — Modal xác nhận rời/kết thúc phòng học
 * Extracted from MeetingRoom.jsx to reduce monolith size
 */
export default function MeetingLeaveModal({ userRole, onLeave, onEndForAll, onClose }) {
    const isTeacher = userRole === 'teacher' || userRole === 'admin';

    return (
        <div className="modal-overlay">
            <div className="modal-card">
                <div className="modal-icon">📴</div>
                <div className="modal-title">Rời phòng học?</div>
                {isTeacher ? (
                    <>
                        <div className="modal-desc">
                            Bạn có thể rời phòng hoặc kết thúc buổi học cho tất cả sinh viên.
                        </div>
                        <div className="modal-actions">
                            <button onClick={onEndForAll} style={{
                                background: '#ef4444', border: 'none', borderRadius: 10, padding: '12px 20px',
                                color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.95em'
                            }}>🏁 Kết thúc buổi học (tất cả)</button>
                            <button onClick={onLeave} style={{
                                background: '#374151', border: 'none', borderRadius: 10, padding: '12px 20px',
                                color: '#fff', cursor: 'pointer', fontSize: '0.9em'
                            }}>🚪 Chỉ rời phòng</button>
                            <button onClick={onClose} style={{
                                background: 'transparent', border: '1px solid #ffffff30', borderRadius: 10,
                                padding: '10px 20px', color: '#999', cursor: 'pointer', fontSize: '0.85em'
                            }}>Hủy</button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="modal-desc">Bạn có muốn rời khỏi lớp học không?</div>
                        <div className="modal-actions-row">
                            <button onClick={onLeave} style={{
                                background: '#ef4444', border: 'none', borderRadius: 10, padding: '12px 24px',
                                color: '#fff', cursor: 'pointer', fontWeight: 700
                            }}>Rời phòng</button>
                            <button onClick={onClose} style={{
                                background: '#374151', border: 'none', borderRadius: 10, padding: '12px 24px',
                                color: '#fff', cursor: 'pointer'
                            }}>Ở lại</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
