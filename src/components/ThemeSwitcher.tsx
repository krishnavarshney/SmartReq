import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';

const THEMES: { id: 'light' | 'dark' | 'system', label: string }[] = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'system', label: 'System' },
];

export const ThemeSwitcher: React.FC = () => {
    const { theme, setTheme } = useTheme();

    return (
        <div className="relative flex items-center p-1 bg-muted rounded-lg">
            {THEMES.map(({ id, label }) => (
                <button
                    key={id}
                    onClick={(e) => setTheme(id, e)}
                    className={`relative flex-1 px-3 py-1 text-sm font-semibold rounded-md transition-colors duration-200 z-10
                      ${theme === id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}
                    `}
                >
                    {label}
                    {theme === id && (
                        <motion.div
                            layoutId="theme-switcher-active"
                            className="absolute inset-0 bg-card shadow-sm rounded-md"
                            style={{ zIndex: -1 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                    )}
                </button>
            ))}
        </div>
    );
};
