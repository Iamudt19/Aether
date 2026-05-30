'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark'); // Default to dark for a high-end dynamic feel
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load from localStorage or system preference on mount
    const savedTheme = localStorage.getItem('aether-theme') as Theme;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(savedTheme);
    } else {
      // Default to dark
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add('dark');
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('aether-theme', nextTheme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {mounted ? children : <div style={{ opacity: 0 }}>{children}</div>}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
