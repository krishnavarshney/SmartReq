import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme, event?: React.MouseEvent) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const storedTheme = window.localStorage.getItem('api-client-theme') as Theme | null;
      return storedTheme || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (t: 'light' | 'dark') => {
      root.classList.remove('light', 'dark');
      if (t === 'light') {
        root.classList.add('light');
      } else {
        root.classList.add('dark');
      }
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const updateTheme = () => applyTheme(mediaQuery.matches ? 'dark' : 'light');
      
      mediaQuery.addEventListener('change', updateTheme);
      updateTheme(); // initial check
      
      return () => mediaQuery.removeEventListener('change', updateTheme);
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme, event?: React.MouseEvent) => {
    const update = () => {
        try {
          window.localStorage.setItem('api-client-theme', newTheme);
          setThemeState(newTheme);
        } catch (e) {
          console.error('Failed to save theme to localStorage', e);
        }
    }

    // @ts-ignore
    if (!document.startViewTransition || !event) {
        update();
        return;
    }
    
    const x = event.clientX;
    const y = event.clientY;

    document.documentElement.style.setProperty('--circle-reveal-x', `${x}px`);
    document.documentElement.style.setProperty('--circle-reveal-y', `${y}px`);

    // @ts-ignore
    document.startViewTransition(update);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};