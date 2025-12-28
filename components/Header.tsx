import React, { useState, useEffect } from 'react';
import { BookOpen, Moon, Sun, ShieldCheck, Zap, Menu, X, Github, Share2 } from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  onShare: () => void;
}

const Header: React.FC<HeaderProps> = ({ darkMode, toggleDarkMode, onShare }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'py-2' : 'py-4'
      }`}
    >
      <div className={`
        max-w-[1400px] mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between rounded-full transition-all duration-300
        ${scrolled 
          ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-white/5 shadow-lg shadow-black/5 mx-4 md:mx-6 w-[calc(100%-2rem)] md:w-[calc(100%-3rem)]' 
          : 'bg-transparent border-transparent w-full'
        }
      `}>
        
        {/* Logo Section */}
        <div className="flex items-center gap-3 select-none pl-2">
          <div className="relative group">
            <div className="absolute inset-0 bg-brand-500 blur-lg opacity-40 group-hover:opacity-60 transition-opacity rounded-full"></div>
            <div className="relative bg-gradient-to-tr from-brand-600 to-indigo-600 p-2 rounded-xl text-white shadow-xl shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-none tracking-tight font-display">
              VTU Notes
            </h1>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase opacity-90">PDF Tools Suite</span>
          </div>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-4">
             <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-md">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>SECURE</span>
                </div>
                <div className="w-px h-3 bg-slate-300 dark:bg-slate-700"></div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-600 dark:text-brand-400">
                    <Zap className="w-3.5 h-3.5" />
                    <span>v2.5.0</span>
                </div>
             </div>

             <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>

             <button onClick={onShare} className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors" title="Share">
                <Share2 className="w-4 h-4" />
             </button>

             <button 
                onClick={toggleDarkMode}
                className="p-2 rounded-full bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all active:scale-95 active:rotate-12"
                aria-label="Toggle Theme"
             >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
             </button>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="md:hidden flex items-center gap-3 pr-2">
            <button 
                onClick={toggleDarkMode}
                className="p-2 text-slate-500 dark:text-slate-400"
            >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
        </div>
      </div>
    </header>
  );
};

export default Header;