import React, { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Logo } from '@/components/Logo';
import { Menu, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const DashboardLayout = ({ children, title }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Mobile menu button */}
      <button 
        onClick={() => setSidebarOpen(true)}
        className="mobile-menu-btn"
        data-testid="mobile-menu-btn"
      >
        <Menu size={24} className="text-stone-700" />
      </button>
      
      <main className="main-content">
        {/* Header */}
        <header className="sticky top-0 z-20 glass-effect border-b border-stone-200">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="hidden lg:block">
              <h1 className="text-xl font-bold text-stone-900">{title}</h1>
            </div>
            <div className="lg:hidden">
              <Logo size="small" />
            </div>
            
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              
              <button className="relative p-2 rounded-xl hover:bg-orange-50 transition-colors">
                <Bell size={20} className="text-stone-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#EA580C] rounded-full" />
              </button>
              
              <div className="hidden md:flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#EA580C] to-[#F59E0B] rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <span className="text-white font-bold">
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
          <h1 className="text-2xl font-bold text-stone-900 mb-6 lg:hidden">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
