'use client';

import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle Theme"
      className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-primary)] hover:text-[var(--accent)] hover:border-[var(--accent)] shadow-md hover:shadow-lg transition-all cursor-pointer overflow-hidden outline-none"
    >
      <AnimatePresence mode="wait" initial={false}>
        {theme === 'dark' ? (
          <motion.div
            key="moon"
            initial={{ y: 20, opacity: 0, rotate: 40 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -20, opacity: 0, rotate: -40 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <Moon className="w-5 h-5 fill-current text-[#dad7cd]" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ y: 20, opacity: 0, rotate: -40 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -20, opacity: 0, rotate: 40 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <Sun className="w-5 h-5 fill-current text-[#3a5a40]" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
