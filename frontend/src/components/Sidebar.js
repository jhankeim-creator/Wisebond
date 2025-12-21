import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
import { 
  LayoutDashboard, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Send, 
  History, 
  UserCheck, 
  Users, 
  Settings,
  LogOut,
  Shield,
  X,
  CreditCard
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { path: '/deposit', icon: ArrowDownCircle, label: t('deposit') },
    { path: '/withdraw', icon: ArrowUpCircle, label: t('withdraw') },
    { path: '/transfer', icon: Send, label: t('transfer') },
    { path: '/virtual-card', icon: CreditCard, label: 'Carte Virtuelle' },
    { path: '/transactions', icon: History, label: t('transactions') },
    { path: '/kyc', icon: UserCheck, label: t('kyc') },
    { path: '/affiliate', icon: Users, label: t('affiliate') },
    { path: '/settings', icon: Settings, label: t('settings') },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Close button for mobile */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 lg:hidden"
        >
          <X size={24} />
        </button>
        
        {/* Logo */}
        <div className="mb-8">
          <Logo />
        </div>

        {/* User info */}
        <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100">
          <p className="text-stone-900 font-semibold truncate">{user?.full_name}</p>
          <p className="text-stone-500 text-sm font-mono">{user?.client_id}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`w-2 h-2 rounded-full ${
              user?.kyc_status === 'approved' ? 'bg-emerald-500' : 
              user?.kyc_status === 'pending' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className="text-xs text-stone-500 capitalize">{user?.kyc_status}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={isActive ? 'sidebar-item-active' : 'sidebar-item'}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          
          {isAdmin && (
            <>
              <div className="h-px bg-stone-200 my-4" />
              <Link
                to="/admin"
                onClick={onClose}
                className={location.pathname.startsWith('/admin') ? 'sidebar-item-active' : 'sidebar-item'}
              >
                <Shield size={20} />
                <span>{t('admin')}</span>
              </Link>
            </>
          )}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="sidebar-item w-full text-left mt-4 text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          <LogOut size={20} />
          <span>{t('logout')}</span>
        </button>
      </aside>
    </>
  );
};

export default Sidebar;
