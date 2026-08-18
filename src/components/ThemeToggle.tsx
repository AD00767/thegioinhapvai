import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { applyTheme, ThemeMode } from '../lib/themeFont';
import { useAuthStore } from '../store/useAuthStore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import toast from 'react-hot-toast';

export default function ThemeToggle() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuthStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [currentMode, setCurrentMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('app_theme_mode') as ThemeMode) || 'SYSTEM';
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeMode>;
      if (customEvent.detail) {
        setCurrentMode(customEvent.detail);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('app-theme-changed', handleThemeChange);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('app-theme-changed', handleThemeChange);
    };
  }, []);

  const handleSelect = async (mode: ThemeMode) => {
    setCurrentMode(mode);
    applyTheme(mode);
    setIsOpen(false);

    toast.success(
      mode === 'LIGHT' ? 'Chế độ Sáng' :
      mode === 'DARK' ? 'Chế độ Tối' :
      'Chế độ Theo hệ thống'
    );

    if (user?.id) {
      try {
        await updateDoc(doc(db, 'users', user.id), {
          themePreference: mode
        });
      } catch (err) {
        console.error("Failed to save theme in Firestore:", err);
      }
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors flex items-center justify-center"
        title="Đổi giao diện (Theme)"
        aria-label="Theme selector"
      >
        {currentMode === 'LIGHT' && <Sun className="w-5 h-5 text-amber-500" />}
        {currentMode === 'DARK' && <Moon className="w-5 h-5 text-blue-400" />}
        {currentMode === 'SYSTEM' && <Laptop className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl z-50 p-1.5 space-y-1 animate-fade-in">
          <button
            onClick={() => handleSelect('LIGHT')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              currentMode === 'LIGHT'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Sáng (Light)</span>
            </div>
            {currentMode === 'LIGHT' && <Check className="w-3.5 h-3.5 text-amber-500" />}
          </button>

          <button
            onClick={() => handleSelect('DARK')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              currentMode === 'DARK'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-blue-400" />
              <span>Tối (Dark)</span>
            </div>
            {currentMode === 'DARK' && <Check className="w-3.5 h-3.5 text-amber-500" />}
          </button>

          <button
            onClick={() => handleSelect('SYSTEM')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              currentMode === 'SYSTEM'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-indigo-400" />
              <span>Theo hệ thống</span>
            </div>
            {currentMode === 'SYSTEM' && <Check className="w-3.5 h-3.5 text-amber-500" />}
          </button>
        </div>
      )}
    </div>
  );
}
