import React from 'react';
import { BookOpen } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-xl bg-white/80 border-b border-slate-200/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
        
        {/* Logo Section */}
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="relative">
            <div className="absolute inset-0 bg-brand-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity rounded-full"></div>
            <div className="relative bg-gradient-to-br from-brand-500 to-brand-600 p-2.5 rounded-xl shadow-inner text-white transform group-hover:scale-105 transition-transform duration-300">
              <BookOpen className="w-6 h-6" />
            </div>
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight leading-none group-hover:text-brand-700 transition-colors">
              VTU Notes <span className="text-brand-600">For All</span>
            </h1>
            <p className="text-[10px] md:text-xs text-slate-500 font-medium tracking-wide uppercase mt-0.5">
              Official PDF Merge Tool
            </p>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100/80 px-4 py-2 rounded-full border border-slate-200/50 hover:bg-white hover:shadow-sm transition-all">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>Secure Client-Side Processing</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;