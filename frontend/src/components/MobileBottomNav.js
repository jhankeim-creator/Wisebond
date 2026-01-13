import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { 
  LayoutDashboard, 
  ArrowDownCircle, 
  Send, 
  History, 
  MoreHorizontal 
} from 'lucide-react';

export const MobileBottomNav = () => {
  const location = useLocation();
  const { language } = useLanguage();

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: getText('Akèy', 'Accueil', 'Home') },
    { path: '/deposit', icon: ArrowDownCircle, label: getText('Depoze', 'Dépôt', 'Deposit') },
    { path: '/transfer', icon: Send, label: getText('Voye', 'Envoyer', 'Send') },
    { path: '/transactions', icon: History, label: getText('Istorik', 'Historique', 'History') },
    { path: '/settings', icon: MoreHorizontal, label: getText('Plis', 'Plus', 'More') },
  ];

  // Don't show on certain pages
  const hiddenPaths = ['/', '/login', '/register', '/forgot-password', '/reset-password'];
  if (hiddenPaths.includes(location.pathname)) {
    return null;
  }

  return (
    <nav className="mobile-bottom-nav lg:hidden">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
                          (item.path === '/settings' && ['/settings', '/kyc', '/affiliate', '/virtual-card', '/topup', '/agent-deposit', '/swap', '/withdraw'].includes(location.pathname));
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-bottom-nav-item flex-1 ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
