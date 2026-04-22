import React, { useState, useEffect } from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';

/**
 * [C5] ThemeToggle — light/dark mode switch
 * Default is ALWAYS light (white+purple). Dark mode is opt-in only.
 */
export default function ThemeToggle() {
    const [dark, setDark] = useState(false);

    // On mount: always start light, clear any stale dark preference
    useEffect(() => {
        document.body.classList.remove('dark-mode');
        localStorage.removeItem('theme');
    }, []);

    useEffect(() => {
        if (dark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }, [dark]);

    return (
        <button
            className="theme-toggle"
            onClick={() => setDark(v => !v)}
            title={dark ? 'Chuyển sáng' : 'Chuyển tối'}
            aria-label={dark ? 'Light mode' : 'Dark mode'}
        >
            {dark ? <FiSun size={16} /> : <FiMoon size={16} />}
        </button>
    );
}
