import React, { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Menu, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const DashboardLayout = ({ children, title }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Mobile menu button */}
      <button 
        onClick={() => setSidebarOpen(true)}
        className="mobile-menu-btn"
        data-testid="mobile-menu-btn"
      >
        <Menu size={24} className="text-slate-700" />
      </button>
      
      <main className="main-content">
        {/* Header */}
        <header className="sticky top-0 z-20 glass-effect border-b border-slate-200">
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="text-xl font-bold text-slate-900 hidden lg:block">{title}</h1>
            <div className="lg:hidden w-8" /> {/* Spacer for mobile */}
            
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              
              <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <Bell size={20} className="text-slate-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              
              <div className="hidden md:flex items-center gap-3">
                <div className="w-10 h-10 bg-[#0047AB] rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">
                    {user?.full_name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        {/* Page content */}
        <div className="p-6 lg:p-8">
          {/* Mobile title */}
          <h1 className="text-2xl font-bold text-slate-900 mb-6 lg:hidden">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
