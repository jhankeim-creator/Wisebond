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
  CreditCard,
  ArrowDownUp,
  Phone,
  Home
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const { t, language } = useLanguage();
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
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

  const menuItems = [
    { path: '/', icon: Home, label: getText('Akèy', 'Accueil', 'Home') },
    { path: '/dashboard', icon: LayoutDashboard, label: getText('Tablo bò', 'Tableau de bord', 'Dashboard') },
    { path: '/deposit', icon: ArrowDownCircle, label: getText('Depoze', 'Déposer', 'Deposit') },
    { path: '/withdraw', icon: ArrowUpCircle, label: getText('Retire', 'Retirer', 'Withdraw') },
    { path: '/swap', icon: ArrowDownUp, label: 'Swap' },
    { path: '/transfer', icon: Send, label: getText('Voye', 'Envoyer', 'Transfer') },
    { path: '/virtual-card', icon: CreditCard, label: getText('Kat Vityèl', 'Carte Virtuelle', 'Virtual Card') },
    { path: '/topup', icon: Phone, label: getText('Minit Entènasyonal', 'Minutes Internationales', 'International Minutes') },
    { path: '/transactions', icon: History, label: getText('Tranzaksyon', 'Transactions', 'Transactions') },
    { path: '/kyc', icon: UserCheck, label: getText('Verifikasyon KYC', 'Vérification KYC', 'KYC Verification') },
    { path: '/affiliate', icon: Users, label: getText('Afilyasyon', 'Affiliation', 'Affiliate') },
    { path: '/settings', icon: Settings, label: getText('Paramèt', 'Paramètres', 'Settings') },
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
        
        {/* Logo - Clickable to go home */}
        <div className="mb-8">
          <Link to="/" className="block hover:opacity-80 transition-opacity">
            <Logo linkToHome={false} />
            {isAdmin && (
              <p className="text-xs text-stone-400 mt-1 text-center">
                <Link to="/admin" className="hover:text-[#EA580C]">{getText('Ale nan admin', 'Aller à admin', 'Go to admin')}</Link>
              </p>
            )}
          </Link>
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
                <span>{getText('Administrasyon', 'Administration', 'Administration')}</span>
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
          <span>{getText('Dekonekte', 'Déconnexion', 'Logout')}</span>
        </button>
      </aside>
    </>
  );
};

export default Sidebar;
