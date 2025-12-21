import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
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
  X
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
          className="absolute top-4 right-4 text-slate-400 hover:text-white lg:hidden"
        >
          <X size={24} />
        </button>
        
        {/* Logo */}
        <div className="sidebar-logo flex items-center gap-2">
          <div className="w-10 h-10 bg-[#0047AB] rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-xl">K</span>
          </div>
          <span>KAYICOM</span>
        </div>

        {/* User info */}
        <div className="mb-6 p-4 bg-white/5 rounded-xl">
          <p className="text-white font-medium truncate">{user?.full_name}</p>
          <p className="text-slate-400 text-sm">{user?.client_id}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`w-2 h-2 rounded-full ${
              user?.kyc_status === 'approved' ? 'bg-emerald-500' : 
              user?.kyc_status === 'pending' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className="text-xs text-slate-400 capitalize">{user?.kyc_status}</span>
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
              <div className="h-px bg-white/10 my-4" />
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
          className="sidebar-item w-full text-left mt-4 text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut size={20} />
          <span>{t('logout')}</span>
        </button>
      </aside>
    </>
  );
};

export default Sidebar;
