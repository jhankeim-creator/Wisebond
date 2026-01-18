import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { isRoleAllowed } from '@/lib/adminRbac';
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
  Mail,
  LogOut,
  ChevronLeft,
  Menu,
  X,
  CreditCard,
  Phone,
  Home,
  Bell,
  MessageSquare,
  Webhook,
  Shield,
  UserPlus,
  Wallet,
  LifeBuoy
} from 'lucide-react';

export const AdminLayout = ({ children, title }) => {
  const { language } = useLanguage();
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const adminRole = (user?.admin_role || 'admin').toLowerCase();

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
    { path: '/admin', icon: LayoutDashboard, label: getText('Tablo de bò', 'Tableau de bord', 'Dashboard'), exact: true, roles: ['support','finance','manager','admin','superadmin'] },
    { path: '/admin/users', icon: Users, label: getText('Kliyan', 'Clients', 'Clients'), roles: ['support','manager','admin','superadmin'] },
    { path: '/admin/kyc', icon: UserCheck, label: 'KYC', roles: ['support','manager','admin','superadmin'] },
    { path: '/admin/deposits', icon: ArrowDownCircle, label: getText('Depo', 'Dépôts', 'Deposits'), roles: ['finance','manager','admin','superadmin'] },
    { path: '/admin/withdrawals', icon: ArrowUpCircle, label: getText('Retrè', 'Retraits', 'Withdrawals'), roles: ['finance','manager','admin','superadmin'] },
    { path: '/admin/agent-deposits', icon: UserPlus, label: getText('Depo Ajan', 'Dépôts Agent', 'Agent Deposits'), roles: ['manager','finance','admin','superadmin'] },
    { path: '/admin/agent-commission-withdrawals', icon: Wallet, label: getText('Retrè Komisyon Ajan', 'Retraits Commission', 'Agent Payouts'), roles: ['manager','finance','admin','superadmin'] },
    { path: '/admin/agent-settings', icon: UserPlus, label: getText('Paramèt Ajan', 'Paramètres Agent', 'Agent Settings'), roles: ['manager','finance','admin','superadmin'] },
    { path: '/admin/virtual-cards', icon: CreditCard, label: getText('Kat Vityèl', 'Cartes Virtuelles', 'Virtual Cards'), roles: ['support','finance','manager','admin','superadmin'] },
    { path: '/admin/topup', icon: Phone, label: getText('Komand Minit', 'Commandes Minutes', 'Minute Orders'), roles: ['support','finance','manager','admin','superadmin'] },
    { path: '/admin/rates', icon: RefreshCw, label: getText('To chanj', 'Taux de change', 'Exchange Rates'), roles: ['finance','admin','superadmin'] },
    { path: '/admin/fees', icon: DollarSign, label: getText('Frè', 'Frais', 'Fees'), roles: ['finance','admin','superadmin'] },
    { path: '/admin/payment-gateway', icon: Wallet, label: getText('Payment Gateway', 'Payment Gateway', 'Payment Gateway'), roles: ['finance','manager','admin','superadmin'] },
    { path: '/admin/help-center', icon: LifeBuoy, label: getText('Sant Èd', 'Centre d’aide', 'Help Center'), roles: ['support','manager','admin','superadmin'] },
    { path: '/admin/bulk-email', icon: Mail, label: getText('Imèl', 'Emails', 'Emails'), roles: ['manager','admin','superadmin'] },
    { path: '/admin/team', icon: Shield, label: getText('Ekip', 'Équipe', 'Team'), roles: ['admin', 'superadmin'] },
    { path: '/admin/rbac', icon: Shield, label: getText('Pèmisyon Wòl', 'Permissions', 'Permissions'), roles: ['admin', 'superadmin'] },
    { path: '/admin/logs', icon: MessageSquare, label: getText('Mesaj', 'Journaux', 'Logs'), roles: ['manager','admin','superadmin'] },
    { path: '/admin/webhook-events', icon: Webhook, label: getText('Webhook', 'Webhook', 'Webhook'), roles: ['manager','admin','superadmin'] },
    { path: '/admin/settings', icon: Settings, label: getText('Paramèt', 'Paramètres', 'Settings'), roles: ['finance','manager','admin','superadmin'] },
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
        fixed left-0 w-64 bg-stone-900 text-white flex flex-col z-50 transition-transform duration-300
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{ top: 'var(--announcement-bar-h, 0px)', height: 'calc(100vh - var(--announcement-bar-h, 0px))', maxHeight: 'calc(100vh - var(--announcement-bar-h, 0px))' }}>
        {/* Mobile Close Button */}
        <button 
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg z-10"
        >
          <X size={20} />
        </button>

        {/* Admin Header in Sidebar - Fixed */}
        <div className="p-4 border-b border-stone-700 flex-shrink-0">
          <div className="bg-gradient-to-r from-[#EA580C] to-amber-500 rounded-lg p-3">
            <p className="text-white font-bold text-sm">Admin Panel</p>
            <p className="text-white/80 text-xs truncate">{user?.full_name}</p>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto min-h-0 overscroll-contain touch-pan-y scrollbar-thin scrollbar-thumb-stone-700 scrollbar-track-transparent">
          {menuItems.filter((item) => isRoleAllowed(adminRole, item.roles || [])).map((item) => {
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

        {/* Footer - Fixed */}
        <div className="p-3 border-t border-stone-700 space-y-1 flex-shrink-0">
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
            <span className="text-sm">{getText('Tablo de bò kliyan', 'Dashboard client', 'Client Dashboard')}</span>
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
      <main
        className="lg:ml-64 flex flex-col overflow-hidden"
        style={{ height: 'calc(100vh - var(--announcement-bar-h, 0px))' }}
      >
          {/* Header with Logo */}
          <header
            className="sticky top-0 z-20 bg-white/90 dark:bg-stone-800/90 backdrop-blur-xl border-b border-stone-200 dark:border-stone-700"
            style={{ top: 'var(--announcement-bar-h, 0px)' }}
          >
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
              
              <div className="flex items-center gap-2 sm:gap-3">
                <ThemeToggle />
                <LanguageSwitcher />
                
                <button className="relative p-2 rounded-xl hover:bg-orange-50 dark:hover:bg-stone-700 transition-colors hidden sm:block">
                  <Bell size={20} className="text-stone-600 dark:text-stone-300" />
                </button>
                
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
          
          {/* Mobile Title */}
          <div className="lg:hidden px-4 py-4 bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700">
            <h1 className="text-lg font-bold text-stone-900 dark:text-white">{title}</h1>
          </div>
          
          {/* Page Content */}
          <div className="flex-1 min-h-0 overflow-y-auto" data-scroll-container="admin">
            <div className="p-4 lg:p-8">
              {children}
            </div>
          </div>
      </main>
    </div>
  );
};

export default AdminLayout;
