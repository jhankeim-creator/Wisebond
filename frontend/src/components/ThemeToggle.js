import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-xl transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
      title={theme === 'light' ? 'Mòd Fènwa' : 'Mòd Limyè'}
    >
      {theme === 'light' ? (
        <Moon size={20} className="text-stone-600 dark:text-stone-300" />
      ) : (
        <Sun size={20} className="text-amber-500" />
      )}
    </button>
  );
};

export default ThemeToggle;
