import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';
import { Menu, Bell, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { SensitiveScreenGuard } from '@/components/SensitiveScreenGuard';

export const DashboardLayout = ({ children, title }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background dark:bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Mobile menu button */}
      <button 
        onClick={() => setSidebarOpen(true)}
        className="mobile-menu-btn"
        style={{ top: 'calc(1rem + var(--announcement-bar-h, 0px))' }}
        data-testid="mobile-menu-btn"
      >
        <Menu size={24} className="text-stone-700 dark:text-stone-300" />
      </button>
      
      <SensitiveScreenGuard>
        <main className="main-content">
          {/* Header */}
          <header
            className="sticky top-0 z-20 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-700"
            style={{ top: 'var(--announcement-bar-h, 0px)' }}
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-4">
              <div className="flex items-center gap-4">
                <Link to="/" className="hover:opacity-80 transition-opacity">
                  <Logo size="small" />
                </Link>
                <div className="hidden lg:block">
                  <h1 className="text-xl font-bold text-stone-900 dark:text-white">{title}</h1>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3">
                <ThemeToggle />
                <LanguageSwitcher />
                
                <button className="relative p-2 rounded-xl hover:bg-orange-50 dark:hover:bg-stone-800 transition-colors hidden sm:block">
                  <Bell size={20} className="text-stone-600 dark:text-stone-300" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#EA580C] rounded-full" />
                </button>
                
                <div className="hidden md:flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#EA580C] to-[#F59E0B] rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <span className="text-white font-bold">
                      {user?.full_name?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                {/* Logout Button - Always visible */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title={getText('Dekonekte', 'Déconnexion', 'Logout')}
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline text-sm font-medium">{getText('Sòti', 'Sortir', 'Logout')}</span>
                </button>
              </div>
            </div>
          </header>
          
          {/* Page content */}
          <div className="p-4 sm:p-6 lg:p-8 w-full max-w-full overflow-x-hidden">
            {/* Mobile title */}
            <h1 className="text-2xl font-bold text-stone-900 dark:text-white mb-6 lg:hidden text-center sm:text-left">{title}</h1>
            {children}
          </div>
        </main>
      </SensitiveScreenGuard>
    </div>
  );
};

export default DashboardLayout;
