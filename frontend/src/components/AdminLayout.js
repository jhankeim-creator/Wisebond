import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
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
  FileText,
  LogOut,
  ChevronLeft,
  Wallet
} from 'lucide-react';

export const AdminLayout = ({ children, title }) => {
  const { t } = useLanguage();
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { path: '/admin/users', icon: Users, label: t('users') },
    { path: '/admin/kyc', icon: UserCheck, label: 'KYC' },
    { path: '/admin/deposits', icon: ArrowDownCircle, label: t('deposits') },
    { path: '/admin/withdrawals', icon: ArrowUpCircle, label: t('withdrawals') },
    { path: '/admin/rates', icon: RefreshCw, label: t('exchangeRates') },
    { path: '/admin/fees', icon: DollarSign, label: t('fees') },
    { path: '/admin/bulk-email', icon: Mail, label: t('bulkEmail') },
    { path: '/admin/settings', icon: Settings, label: t('settings') },
  ];

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white p-6 flex flex-col z-40">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-[#0047AB] rounded-xl flex items-center justify-center">
            <Wallet className="text-white" size={24} />
          </div>
          <div>
            <span className="font-bold text-lg">KAYICOM</span>
            <p className="text-xs text-slate-400">Admin Panel</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path, item.exact);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  active 
                    ? 'bg-[#0047AB] text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-700 pt-4 space-y-2">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ChevronLeft size={20} />
            <span>Retour au Dashboard</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 w-full"
          >
            <LogOut size={20} />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 min-h-screen">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200">
          <div className="flex items-center justify-between px-8 py-4">
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            <LanguageSwitcher />
          </div>
        </header>
        
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
