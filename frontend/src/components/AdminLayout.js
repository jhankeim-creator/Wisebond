import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';
import { 
  LayoutDashboard, 
  Users,
  UserCheck,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  DollarSign,
  Settings,
  Wallet,
  Mail,
  LogOut,
  ChevronLeft,
  Menu,
  X,
  CreditCard,
  Phone,
  Home,
  Bell,
  UserCog
} from 'lucide-react';

export const AdminLayout = ({ children, title }) => {
  const { language } = useLanguage();
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    { path: '/admin', icon: LayoutDashboard, label: getText('Tablo bò', 'Tableau de bord', 'Dashboard'), exact: true },
    { path: '/admin/users', icon: Users, label: getText('Kliyan', 'Clients', 'Clients') },
    { path: '/admin/team', icon: UserCog, label: getText('Ekip', 'Équipe', 'Team') },
    { path: '/admin/kyc', icon: UserCheck, label: 'KYC' },
    { path: '/admin/deposits', icon: ArrowDownCircle, label: getText('Depo', 'Dépôts', 'Deposits') },
    { path: '/admin/withdrawals', icon: ArrowUpCircle, label: getText('Retrè', 'Retraits', 'Withdrawals') },
    { path: '/admin/virtual-cards', icon: CreditCard, label: getText('Komand Kat', 'Commandes Cartes', 'Card Orders') },
    { path: '/admin/topup', icon: Phone, label: getText('Komand Minit', 'Commandes Minutes', 'Minute Orders') },
    { path: '/admin/payment-methods', icon: Wallet, label: getText('Mwayen Peman', 'Paiements', 'Payments') },
    { path: '/admin/rates', icon: RefreshCw, label: getText('To chanj', 'Taux de change', 'Exchange Rates') },
    { path: '/admin/fees', icon: DollarSign, label: getText('Frè', 'Frais', 'Fees') },
    { path: '/admin/bulk-email', icon: Mail, label: getText('Imèl', 'Emails', 'Emails') },
    { path: '/admin/settings', icon: Settings, label: getText('Paramèt', 'Paramètres', 'Settings') },
  ];

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-900">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-0 h-screen w-64 bg-stone-900 text-white flex flex-col z-50 transition-transform duration-300
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile Close Button */}
        <button 
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg"
        >
          <X size={20} />
        </button>

        {/* Admin Header in Sidebar */}
        <div className="p-4 border-b border-stone-700">
          <div className="bg-gradient-to-r from-[#EA580C] to-amber-500 rounded-lg p-3">
            <p className="text-white font-bold text-sm">Admin Panel</p>
            <p className="text-white/80 text-xs truncate">{user?.full_name}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path, item.exact);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  active 
                    ? 'bg-[#EA580C] text-white' 
                    : 'text-stone-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={18} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-stone-700 space-y-1">
          <Link
            to="/"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10"
          >
            <Home size={18} />
            <span className="text-sm">{getText('Akèy', 'Accueil', 'Home')}</span>
          </Link>
          <Link
            to="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10"
          >
            <ChevronLeft size={18} />
            <span className="text-sm">{getText('Tablo bò kliyan', 'Dashboard client', 'Client Dashboard')}</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 w-full"
          >
            <LogOut size={18} />
            <span className="text-sm">{getText('Dekonekte', 'Déconnexion', 'Logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen">
        {/* Header with Logo */}
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-stone-800/90 backdrop-blur-xl border-b border-stone-200 dark:border-stone-700">
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg"
              >
                <Menu size={24} className="text-stone-700 dark:text-stone-300" />
              </button>
              
              {/* Logo */}
              <Link to="/" className="hover:opacity-80 transition-opacity">
                <Logo size="small" />
              </Link>
              
              {/* Title - Desktop */}
              <div className="hidden lg:block">
                <h1 className="text-xl font-bold text-stone-900 dark:text-white">{title}</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <LanguageSwitcher />
              
              <button className="relative p-2 rounded-xl hover:bg-orange-50 dark:hover:bg-stone-700 transition-colors">
                <Bell size={20} className="text-stone-600 dark:text-stone-300" />
              </button>
            </div>
          </div>
        </header>
        
        {/* Mobile Title */}
        <div className="lg:hidden px-4 py-4 bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700">
          <h1 className="text-lg font-bold text-stone-900 dark:text-white">{title}</h1>
        </div>
        
        {/* Page Content */}
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
