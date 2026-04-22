import React from 'react';

/**
 * [C6] SkeletonCard — Placeholder khi đang load data
 * Dùng thay spinner để giữ layout ổn định
 *
 * @param {number} rows - số dòng text skeleton
 * @param {boolean} hasHeader - có dòng tiêu đề lớn không
 * @param {boolean} hasAvatar - có avatar circle không
 */
export function SkeletonCard({ rows = 3, hasHeader = true, hasAvatar = false }) {
    return (
        <div className="skeleton-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {hasAvatar && (
                    <div className="skeleton skeleton-avatar" style={{ width: 40, height: 40 }} />
                )}
                <div style={{ flex: 1 }}>
                    {hasHeader && (
                        <div className="skeleton skeleton-text lg w-3/4" style={{ marginBottom: 6 }} />
                    )}
                    {Array.from({ length: rows }).map((_, i) => (
                        <div
                            key={i}
                            className={`skeleton skeleton-text ${i === rows - 1 ? 'w-1/2' : 'w-full'}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * [C6] SkeletonStats — 4 stat cards placeholder
 */
export function SkeletonStats({ count = 4 }) {
    return (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="skeleton skeleton-stat" />
            ))}
        </div>
    );
}

/**
 * [C6] SkeletonList — danh sách các dòng
 */
export function SkeletonList({ rows = 5 }) {
    return (
        <div className="card">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                    borderBottom: i < rows - 1 ? '1px solid var(--border)' : 'none'
                }}>
                    <div className="skeleton skeleton-avatar" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <div className="skeleton skeleton-text w-3/4" />
                        <div className="skeleton skeleton-text sm w-1/2" />
                    </div>
                    <div className="skeleton skeleton-text" style={{ width: 60, height: 22 }} />
                </div>
            ))}
        </div>
    );
}

export default SkeletonCard;
