import React from 'react';
import { BookOpen, Moon, Sun, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const Header: React.FC<HeaderProps> = ({ darkMode, toggleDarkMode }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
        
        {/* Logo Section */}
        <div className="flex items-center gap-2 md:gap-3 group cursor-pointer select-none">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-brand-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-full"></div>
            <div className="relative bg-gradient-to-br from-brand-500 to-indigo-600 p-2 md:p-2.5 rounded-xl text-white shadow-lg shadow-brand-500/20 transform group-hover:scale-105 transition-transform duration-300">
              <BookOpen className="w-4 h-4 md:w-6 md:h-6" />
            </div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-base md:text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-none group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              VTU Notes
            </h1>
            <span className="text-[8px] md:text-[10px] font-semibold tracking-widest text-slate-400 dark:text-slate-500 uppercase">For All</span>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-800/50">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SECURE & LOCAL</span>
          </div>
          
          <button 
            onClick={toggleDarkMode}
            className="p-2 md:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 border border-transparent dark:border-slate-700"
            aria-label={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <Sun className="w-4 h-4 md:w-5 md:h-5" /> : <Moon className="w-4 h-4 md:w-5 md:h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;