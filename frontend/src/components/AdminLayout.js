import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
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
  X
} from 'lucide-react';

export const AdminLayout = ({ children, title }) => {
  const { t, language } = useLanguage();
  const { logout, isAdmin } = useAuth();
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
    { path: '/admin/users', icon: Users, label: getText('Itilizatè', 'Utilisateurs', 'Users') },
    { path: '/admin/kyc', icon: UserCheck, label: 'KYC' },
    { path: '/admin/deposits', icon: ArrowDownCircle, label: getText('Depo', 'Dépôts', 'Deposits') },
    { path: '/admin/withdrawals', icon: ArrowUpCircle, label: getText('Retrè', 'Retraits', 'Withdrawals') },
    { path: '/admin/rates', icon: RefreshCw, label: getText('To chanj', 'Taux de change', 'Exchange Rates') },
    { path: '/admin/fees', icon: DollarSign, label: getText('Frè', 'Frais', 'Fees') },
    { path: '/admin/bulk-email', icon: Mail, label: getText('Imèl an mas', 'Email en masse', 'Bulk Email') },
    { path: '/admin/settings', icon: Settings, label: getText('Paramèt', 'Paramètres', 'Settings') },
  ];

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-stone-900 text-white px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/10 rounded-lg">
          <Menu size={24} />
        </button>
        <Link to="/admin">
          <Logo size="small" />
        </Link>
        <LanguageSwitcher />
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
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

        <div className="p-6">
          <Link to="/admin" className="flex items-center gap-2">
            <Logo size="small" />
          </Link>
          <p className="text-xs text-stone-400 mt-1 ml-12">Admin Panel</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path, item.exact);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  active 
                    ? 'bg-[#EA580C] text-white' 
                    : 'text-stone-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={20} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-stone-700 space-y-2">
          <Link
            to="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-stone-400 hover:text-white hover:bg-white/10"
          >
            <ChevronLeft size={20} />
            <span className="text-sm">{getText('Retounen nan Dashboard', 'Retour au Dashboard', 'Back to Dashboard')}</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 w-full"
          >
            <LogOut size={20} />
            <span className="text-sm">{getText('Dekonekte', 'Déconnexion', 'Logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-stone-200 hidden lg:block">
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            <h1 className="text-lg lg:text-xl font-bold text-stone-900">{title}</h1>
            <LanguageSwitcher />
          </div>
        </header>
        
        {/* Mobile Title */}
        <div className="lg:hidden px-4 py-4 border-b border-stone-200 bg-white">
          <h1 className="text-lg font-bold text-stone-900">{title}</h1>
        </div>
        
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
