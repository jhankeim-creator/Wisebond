import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  Zap, 
  Globe, 
  Users, 
  ArrowRight,
  ChevronRight,
  CreditCard,
  RefreshCw,
  CheckCircle,
  TrendingUp,
  Smartphone,
  DollarSign,
  Download,
  Wifi,
  Battery,
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';

// Install App Button Component - Shows at bottom of page
function InstallAppButton({ getText }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      alert(getText(
        'Pou enstale: Klike sou Menu (⋮) nan Chrome epi chwazi "Add to Home screen"',
        'Pour installer: Cliquez sur Menu (⋮) dans Chrome et choisissez "Ajouter à l\'écran d\'accueil"',
        'To install: Click Menu (⋮) in Chrome and select "Add to Home screen"'
      ));
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) return null;

  return (
    <section className="py-6 px-6 bg-stone-800">
      <div className="max-w-4xl mx-auto flex justify-center">
        <Button
          onClick={handleInstall}
          className="bg-gradient-to-r from-[#EA580C] to-[#F59E0B] hover:from-[#C2410C] hover:to-[#D97706] text-white font-bold px-8 py-4 h-auto rounded-full shadow-lg shadow-orange-500/30"
        >
          <Download size={20} className="mr-2" />
          {getText('Enstale Aplikasyon an', 'Installer l\'Application', 'Install Application')}
        </Button>
      </div>
    </section>
  );
}

// Install App Section Component
function InstallAppSection({ getText }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check platform
    const userAgent = navigator.userAgent.toLowerCase();
    setIsAndroid(/android/i.test(userAgent));

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const appFeatures = [
    {
      icon: Wifi,
      title: getText('Travay san entènèt', 'Fonctionne hors ligne', 'Works offline'),
      desc: getText('Wè balans ou menm san entènèt', 'Consultez votre solde même sans internet', 'Check balance even without internet')
    },
    {
      icon: Battery,
      title: getText('Leje anpil', 'Très légère', 'Very lightweight'),
      desc: getText('Pa pran espas sou telefòn ou', 'Ne prend pas d\'espace sur votre téléphone', 'Doesn\'t take up phone storage')
    },
    {
      icon: Clock,
      title: getText('Rapid tankou zèklè', 'Rapide comme l\'éclair', 'Lightning fast'),
      desc: getText('Louvri enstantaneman, pa bezwen tann', 'S\'ouvre instantanément, pas besoin d\'attendre', 'Opens instantly, no waiting')
    }
  ];

  return (
    <section className="py-12 sm:py-20 px-4 sm:px-6 bg-stone-900 text-white relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_30%,rgba(234,88,12,0.15),transparent_40%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_70%,rgba(245,158,11,0.1),transparent_40%)]" />
      </div>
      
      <div className="max-w-7xl mx-auto relative">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Content */}
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-[#EA580C]/20 to-amber-500/20 rounded-full text-amber-400 text-xs sm:text-sm font-semibold mb-4 sm:mb-6 border border-amber-500/30">
                <Smartphone size={14} className="sm:hidden" />
                <Smartphone size={16} className="hidden sm:block" />
                <span>{getText('App Android', 'Application Android', 'Android App')}</span>
              </div>
              
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">
                {getText('Enstale KAYICOM sou telefòn ou', 'Installez KAYICOM sur votre téléphone', 'Install KAYICOM on your phone')}
              </h2>
              
              <p className="text-sm sm:text-lg text-stone-400 mb-6 sm:mb-8 max-w-lg mx-auto lg:mx-0">
                {getText(
                  'Telechaje app leje a dirèkteman sou telefòn Android ou. Pa bezwen ale nan Play Store!',
                  'Téléchargez l\'app légère directement sur votre téléphone Android. Pas besoin d\'aller sur Play Store!',
                  'Download the lightweight app directly on your Android phone. No need to go to Play Store!'
                )}
              </p>
              
              {/* Features */}
              <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 text-left max-w-md mx-auto lg:mx-0">
                {appFeatures.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <motion.div
                      key={feature.title}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-start gap-3 sm:gap-4"
                    >
                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-[#EA580C] to-amber-500 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon size={18} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm sm:text-base">{feature.title}</h3>
                        <p className="text-stone-400 text-xs sm:text-sm">{feature.desc}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              
              {/* Install Button */}
              {isInstalled ? (
                <div className="flex items-center justify-center lg:justify-start gap-3 text-emerald-400 bg-emerald-500/10 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-emerald-500/30">
                  <CheckCircle size={20} />
                  <span className="font-semibold text-base sm:text-lg">
                    {getText('App enstale!', 'App installée!', 'App installed!')}
                  </span>
                </div>
              ) : (
                <Button
                  onClick={handleInstall}
                  disabled={!deferredPrompt && !isAndroid}
                  className="bg-gradient-to-r from-[#EA580C] to-amber-500 hover:from-[#C2410C] hover:to-amber-600 text-white font-bold text-sm sm:text-lg px-6 sm:px-8 py-4 sm:py-6 h-auto rounded-xl sm:rounded-2xl shadow-lg shadow-orange-500/20 disabled:opacity-50"
                >
                  <Download size={20} className="mr-2 sm:mr-3" />
                  {getText('Enstale App KAYICOM', 'Installer App KAYICOM', 'Install KAYICOM App')}
                </Button>
              )}
              
              {!deferredPrompt && !isInstalled && (
                <p className="text-stone-500 text-xs sm:text-sm mt-3 sm:mt-4">
                  {getText(
                    '💡 Louvri sit sa nan Chrome sou Android pou w ka enstale app la.',
                    '💡 Ouvrez ce site dans Chrome sur Android pour installer l\'app.',
                    '💡 Open this site in Chrome on Android to install the app.'
                  )}
                </p>
              )}
            </motion.div>
          </div>
          
          {/* Phone Mockup - Hidden on mobile */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="hidden lg:flex justify-center"
          >
            <div className="relative">
              {/* Phone frame */}
              <div className="w-72 h-[580px] bg-gradient-to-b from-stone-800 to-stone-900 rounded-[3rem] p-3 shadow-2xl border border-stone-700">
                {/* Screen */}
                <div className="w-full h-full bg-stone-950 rounded-[2.5rem] overflow-hidden relative">
                  {/* Status bar */}
                  <div className="h-8 bg-stone-900 flex items-center justify-between px-6">
                    <span className="text-white text-xs font-medium">9:41</span>
                    <div className="flex items-center gap-1">
                      <Wifi size={12} className="text-white" />
                      <Battery size={12} className="text-white" />
                    </div>
                  </div>
                  
                  {/* App content preview */}
                  <div className="p-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#EA580C] to-amber-500 rounded-xl flex items-center justify-center">
                        <span className="text-white font-black text-lg">K</span>
                      </div>
                      <div className="text-right">
                        <p className="text-stone-500 text-xs">Balans Total</p>
                        <p className="text-white font-bold">$1,234.56</p>
                      </div>
                    </div>
                    
                    {/* Wallet cards */}
                    <div className="space-y-3">
                      <div className="bg-gradient-to-r from-[#EA580C] to-orange-600 rounded-2xl p-4 text-white">
                        <p className="text-orange-200 text-xs">HTG Wallet</p>
                        <p className="text-xl font-bold">G 45,678</p>
                      </div>
                      <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-4 text-white">
                        <p className="text-amber-200 text-xs">USD Wallet</p>
                        <p className="text-xl font-bold">$567.89</p>
                      </div>
                    </div>
                    
                    {/* Quick actions */}
                    <div className="grid grid-cols-4 gap-2">
                      {['Depo', 'Retrè', 'Swap', 'Kat'].map((action) => (
                        <div key={action} className="bg-stone-800 rounded-xl p-3 text-center">
                          <div className="w-8 h-8 bg-[#EA580C] rounded-lg mx-auto mb-1" />
                          <p className="text-white text-xs">{action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-[#EA580C]/30 to-amber-500/30 rounded-full blur-2xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-br from-amber-500/20 to-[#EA580C]/20 rounded-full blur-2xl" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { t, language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Helper for trilingual text
  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  const features = [
    {
      icon: Shield,
      title: getText('Sekirite Maksimòm', 'Sécurité Maximale', 'Maximum Security'),
      description: getText('Lajan ou pwoteje ak kriptaj nivo bank.', 'Vos fonds sont protégés avec un cryptage bancaire.', 'Your funds are protected with bank-level encryption.'),
      color: 'bg-orange-100 text-[#EA580C]'
    },
    {
      icon: Zap,
      title: getText('Transfè Enstantane', 'Transferts Instantanés', 'Instant Transfers'),
      description: getText('Voye lajan nan kèk segonn.', 'Envoyez de l\'argent en quelques secondes.', 'Send money in seconds.'),
      color: 'bg-amber-100 text-amber-600'
    },
    {
      icon: Globe,
      title: getText('Multi-Deviz HTG & USD', 'Multi-Devises HTG & USD', 'Multi-Currency HTG & USD'),
      description: getText('Jere Goud ak Dola nan yon sèl kont.', 'Gérez Gourdes et Dollars dans un seul compte.', 'Manage Gourdes and Dollars in one account.'),
      color: 'bg-emerald-100 text-emerald-600'
    },
    {
      icon: CreditCard,
      title: getText('Kat Vityèl', 'Carte Virtuelle', 'Virtual Card'),
      description: getText('Komande kat ou pou peye toupatou.', 'Commandez votre carte pour payer partout.', 'Order your card to pay anywhere.'),
      color: 'bg-purple-100 text-purple-600'
    }
  ];

  const depositMethods = [
    { name: 'MonCash', currency: 'HTG', icon: Smartphone },
    { name: 'NatCash', currency: 'HTG', icon: Smartphone },
    { name: 'Zelle', currency: 'USD', icon: RefreshCw },
    { name: 'PayPal', currency: 'USD', icon: RefreshCw },
    { name: 'USDT Crypto', currency: 'USD', icon: TrendingUp }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-b border-stone-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Logo size="small" />
            
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>
              {isAuthenticated ? (
                <Button onClick={() => navigate('/dashboard')} className="btn-primary text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-3">
                  Dashboard
                </Button>
              ) : (
                <>
                  <Link to="/login" className="hidden sm:block">
                    <Button variant="ghost" className="font-medium text-stone-600 hover:text-[#EA580C] hover:bg-stone-100">
                      {t('login')}
                    </Button>
                  </Link>
                  <Link to="/login" className="sm:hidden">
                    <Button variant="ghost" size="sm" className="font-medium text-stone-600 px-3">
                      {t('login')}
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button className="btn-primary text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-3">
                      {t('register')}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6 relative overflow-hidden w-full">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-orange-100 rounded-full text-[#EA580C] text-xs sm:text-sm font-semibold mb-4 sm:mb-6">
                <Shield size={14} className="sm:w-4 sm:h-4" />
                <span className="whitespace-nowrap">{getText('Sekirize & Fyab', 'Sécurisé & Fiable', 'Secure & Reliable')}</span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-stone-900 leading-tight mb-4 sm:mb-6">
                {getText('Pòtfèy Ou', 'Votre Portefeuille', 'Your Wallet')}{' '}
                <span className="gradient-text block sm:inline">{getText('Multi-Deviz', 'Multi-Devises', 'Multi-Currency')}</span>
              </h1>
              
              <p className="text-base sm:text-lg text-stone-600 mb-6 sm:mb-8 max-w-lg leading-relaxed">
                {getText(
                  'Jere finans ou an HTG ak USD, fè transfè enstantane, komande kat vityèl ou epi touche ak pwogram afilyasyon nou.',
                  'Gérez vos finances en HTG et USD, effectuez des transferts instantanés, commandez votre carte virtuelle et gagnez avec notre programme d\'affiliation.',
                  'Manage your finances in HTG and USD, make instant transfers, order your virtual card and earn with our affiliate program.'
                )}
              </p>
              
              <div className="flex flex-wrap gap-3 sm:gap-4">
                <Link to="/register">
                  <Button className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 h-auto rounded-full shadow-lg shadow-orange-500/20" data-testid="get-started-btn">
                    {t('getStarted')}
                    <ArrowRight size={18} className="ml-2 sm:ml-2" />
                  </Button>
                </Link>
                <Button variant="outline" className="btn-secondary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 h-auto">
                  {t('learnMore')}
                </Button>
              </div>
              
              {/* Trust indicators */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-8 mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-stone-200">
                <div>
                  <p className="text-2xl sm:text-3xl font-bold text-stone-900">10K+</p>
                  <p className="text-xs sm:text-sm text-stone-500">{getText('Itilizatè', 'Utilisateurs', 'Users')}</p>
                </div>
                <div className="hidden sm:block h-10 w-px bg-stone-200" />
                <div>
                  <p className="text-2xl sm:text-3xl font-bold text-stone-900">$5M+</p>
                  <p className="text-xs sm:text-sm text-stone-500">{getText('Tranzaksyon', 'Transactions', 'Transactions')}</p>
                </div>
                <div className="hidden sm:block h-10 w-px bg-stone-200" />
                <div>
                  <p className="text-2xl sm:text-3xl font-bold text-stone-900">99.9%</p>
                  <p className="text-xs sm:text-sm text-stone-500">Uptime</p>
                </div>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              {/* Professional Black Woman Image - Desktop only */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img 
                  src="https://images.unsplash.com/photo-1589156280159-27698a70f29e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                  alt="Professional woman using KAYICOM"
                  className="w-full h-auto object-cover rounded-3xl"
                />
                {/* Overlay Card */}
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="bg-white rounded-2xl p-5 shadow-xl border border-stone-200">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#EA580C] to-amber-500 rounded-full flex items-center justify-center">
                        <DollarSign className="text-white" size={24} />
                      </div>
                      <div>
                        <p className="text-stone-500 text-sm">{getText('Balans Total', 'Solde Total', 'Total Balance')}</p>
                        <p className="text-2xl font-bold text-stone-900">$3,245.00</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-emerald-100 rounded-lg p-2 text-center border border-emerald-200">
                        <p className="text-emerald-600 font-semibold text-sm">+12.5%</p>
                        <p className="text-xs text-stone-500">{getText('Mwa sa', 'Ce mois', 'This month')}</p>
                      </div>
                      <div className="flex-1 bg-orange-100 rounded-lg p-2 text-center border border-orange-200">
                        <p className="text-[#EA580C] font-semibold text-sm">G 431K</p>
                        <p className="text-xs text-stone-500">HTG</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Mobile Hero Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="lg:hidden mt-8"
            >
              <div className="bg-gradient-to-br from-stone-900 to-stone-800 rounded-2xl p-5 shadow-xl border border-stone-700">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#EA580C] to-amber-500 rounded-xl flex items-center justify-center">
                    <DollarSign className="text-white" size={24} />
                  </div>
                  <div>
                    <p className="text-stone-400 text-sm">{getText('Balans Total', 'Solde Total', 'Total Balance')}</p>
                    <p className="text-2xl font-bold text-white">$3,245.00</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-stone-800 rounded-xl p-3 text-center border border-stone-700">
                    <p className="text-emerald-400 font-semibold">+12.5%</p>
                    <p className="text-xs text-stone-500">{getText('Mwa sa', 'Ce mois', 'This month')}</p>
                  </div>
                  <div className="bg-stone-800 rounded-xl p-3 text-center border border-stone-700">
                    <p className="text-[#EA580C] font-semibold">G 431K</p>
                    <p className="text-xs text-stone-500">HTG</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-stone-900 mb-3 sm:mb-4">
              {getText('Karakteristik', 'Fonctionnalités', 'Features')}
            </h2>
            <p className="text-base sm:text-lg text-stone-600 max-w-2xl mx-auto px-2">
              {getText(
                'Tout sa ou bezwen pou jere finans ou fasil.',
                'Tout ce dont vous avez besoin pour gérer vos finances en toute simplicité.',
                'Everything you need to manage your finances with ease.'
              )}
            </p>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-stone-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 border border-stone-200 hover:border-[#EA580C]/50 transition-all group"
                >
                  <div className={`w-10 h-10 sm:w-14 sm:h-14 ${feature.color} rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon size={20} className="sm:hidden" />
                    <Icon size={28} className="hidden sm:block" />
                  </div>
                  <h3 className="text-sm sm:text-lg lg:text-xl font-bold text-stone-900 mb-1 sm:mb-2 leading-tight">{feature.title}</h3>
                  <p className="text-xs sm:text-sm lg:text-base text-stone-600 leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Virtual Card Section */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-stone-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(234,88,12,0.15),transparent_50%)]" />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Card Preview - Mobile first */}
            <div className="flex justify-center lg:order-2">
              <div className="virtual-card w-full max-w-[280px] sm:max-w-sm transform hover:scale-105 transition-transform duration-300">
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <Logo size="small" />
                    <div className="w-10 sm:w-12 h-6 sm:h-8 bg-gradient-to-r from-amber-400 to-amber-600 rounded opacity-80" />
                  </div>
                  
                  <div className="mt-auto">
                    <p className="font-mono text-base sm:text-xl tracking-widest mb-3 sm:mb-4">
                      •••• •••• •••• 4532
                    </p>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-stone-400 text-[10px] sm:text-xs uppercase">{getText('Titilè', 'Titulaire', 'Holder')}</p>
                        <p className="font-medium text-sm sm:text-base">JEAN PIERRE</p>
                      </div>
                      <div className="text-right">
                        <p className="text-stone-400 text-[10px] sm:text-xs uppercase">{getText('Ekspire', 'Expire', 'Expiry')}</p>
                        <p className="font-medium text-sm sm:text-base">12/28</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="lg:order-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-900 rounded-full text-amber-400 text-xs sm:text-sm font-semibold mb-4 sm:mb-6 border border-amber-700">
                <CreditCard size={14} className="sm:hidden" />
                <CreditCard size={16} className="hidden sm:block" />
                <span>{getText('Nouvo', 'Nouveau', 'New')}</span>
              </div>
              
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">
                {getText('Kat Vityèl KAYICOM', 'Carte Virtuelle KAYICOM', 'KAYICOM Virtual Card')}
              </h2>
              <p className="text-sm sm:text-lg text-stone-400 mb-6 sm:mb-8 max-w-lg mx-auto lg:mx-0">
                {getText(
                  'Komande kat vityèl ou epi peye toupatou nan mond lan. Konpatib ak tout sit ak sèvis sou entènèt.',
                  'Commandez votre carte virtuelle et payez partout dans le monde. Compatible avec tous les sites et services en ligne.',
                  'Order your virtual card and pay anywhere in the world. Compatible with all online sites and services.'
                )}
              </p>
              
              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 text-left max-w-md mx-auto lg:mx-0">
                {[
                  getText('Peman sou entènèt sekirize', 'Paiements en ligne sécurisés', 'Secure online payments'),
                  getText('Konpatib ak Netflix, Amazon, elatriye', 'Compatible Netflix, Amazon, etc.', 'Works with Netflix, Amazon, etc.'),
                  getText('Rechajab depi nan wallet ou', 'Rechargeable depuis votre wallet', 'Rechargeable from your wallet')
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="text-emerald-400 flex-shrink-0" size={18} />
                    <span className="text-sm sm:text-base">{item}</span>
                  </li>
                ))}
              </ul>
              
              <Link to="/register" className="inline-block">
                <Button className="btn-gold text-sm sm:text-base px-6 sm:px-8">
                  {getText('Komande kat mwen', 'Commander ma carte', 'Order my card')}
                  <ChevronRight className="ml-2" size={18} />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Deposit Methods */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-stone-900 mb-3 sm:mb-4 text-center lg:text-left">
                {getText('Plizyè metòd depo', 'Multiples méthodes de dépôt', 'Multiple deposit methods')}
              </h2>
              <p className="text-sm sm:text-lg text-stone-600 mb-6 sm:mb-8 text-center lg:text-left">
                {getText(
                  'Depoze fasil an HTG oswa USD ak metòd peman ki pi popilè yo.',
                  'Déposez facilement en HTG ou USD avec les méthodes de paiement les plus populaires.',
                  'Easily deposit in HTG or USD with the most popular payment methods.'
                )}
              </p>
              
              <div className="space-y-3 sm:space-y-4">
                {depositMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <div 
                      key={method.name}
                      className="flex items-center justify-between p-3 sm:p-4 bg-stone-50 rounded-xl border border-stone-200 hover:border-[#EA580C]/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                          <Icon size={18} className="text-stone-600" />
                        </div>
                        <span className="font-medium text-stone-900 text-sm sm:text-base">{method.name}</span>
                      </div>
                      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${
                        method.currency === 'HTG' ? 'bg-orange-100 text-[#EA580C]' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {method.currency}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="relative hidden lg:block">
              <img 
                src="https://images.unsplash.com/photo-1548025991-cb332f419f05?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"
                alt="Mobile banking"
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Affiliate Section */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-100 rounded-full text-amber-700 text-xs sm:text-sm font-semibold mb-4 sm:mb-6">
            <Users size={14} className="sm:hidden" />
            <Users size={16} className="hidden sm:block" />
            <span>{getText('Pwogram Afilyasyon', 'Programme d\'Affiliation', 'Affiliate Program')}</span>
          </div>
          
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-stone-900 mb-3 sm:mb-4">
            {getText('Touche G 2,000', 'Gagnez 2,000 HTG', 'Earn 2,000 HTG')}
          </h2>
          <p className="text-sm sm:text-lg text-stone-600 mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
            {getText(
              'Pou chak 5 moun ou refere ki komande yon kat vityèl, ou resevwa G 2,000!',
              'Pour chaque 5 personnes que vous référez qui commandent une carte virtuelle, vous recevez 2,000 HTG!',
              'For every 5 people you refer who order a virtual card, you receive 2,000 HTG!'
            )}
          </p>
          
          <div className="grid grid-cols-3 gap-2 sm:gap-6 mb-8 sm:mb-10">
            {[
              { step: '1', title: getText('Pataje', 'Partagez', 'Share'), desc: getText('Lyen inik ou', 'Votre lien unique', 'Your unique link') },
              { step: '2', title: getText('Yo komande', 'Ils commandent', 'They order'), desc: getText('Yon kat vityèl', 'Une carte virtuelle', 'A virtual card') },
              { step: '3', title: getText('Ou touche', 'Vous gagnez', 'You earn'), desc: 'G 2,000 / 5 kat' }
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm border border-stone-200">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#EA580C] to-[#F59E0B] rounded-full flex items-center justify-center text-white font-bold mx-auto mb-2 sm:mb-4 text-sm sm:text-base">
                  {item.step}
                </div>
                <h3 className="font-bold text-stone-900 mb-0.5 sm:mb-1 text-xs sm:text-base">{item.title}</h3>
                <p className="text-stone-500 text-[10px] sm:text-sm leading-tight">{item.desc}</p>
              </div>
            ))}
          </div>
          
          <Link to="/register">
            <Button className="btn-gold text-sm sm:text-lg px-6 sm:px-10 py-3 sm:py-4 h-auto">
              {getText('Kòmanse touche', 'Commencer à gagner', 'Start earning')}
              <ChevronRight className="ml-2" size={18} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Install App Section */}
      <InstallAppSection getText={getText} />

      {/* CTA Section */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-gradient-to-r from-[#EA580C] to-[#C2410C]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">
            {getText('Pare pou kòmanse?', 'Prêt à commencer?', 'Ready to start?')}
          </h2>
          <p className="text-base sm:text-xl text-orange-100 mb-6 sm:mb-8 px-2">
            {getText(
              'Kreye kont ou nan kèk minit epi kòmanse jere finans ou.',
              'Créez votre compte en quelques minutes et commencez à gérer vos finances.',
              'Create your account in minutes and start managing your finances.'
            )}
          </p>
          <Link to="/register">
            <Button className="bg-white text-[#EA580C] hover:bg-orange-50 text-sm sm:text-lg px-6 sm:px-10 py-3 sm:py-4 h-auto font-bold rounded-full shadow-lg">
              {getText('Kreye kont gratis', 'Créer un compte gratuit', 'Create free account')}
              <ChevronRight className="ml-2" size={18} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Install App Button - Bottom */}
      <InstallAppButton getText={getText} />

      {/* Footer */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6 bg-stone-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center gap-4 sm:gap-6">
            <Logo size="small" />
            
            <div className="flex items-center gap-4 sm:gap-6">
              <Link to="/terms" className="text-stone-400 hover:text-white transition-colors text-sm">
                {getText('Kondisyon', 'Conditions', 'Terms')}
              </Link>
              <span className="text-stone-700">|</span>
              <Link to="/privacy" className="text-stone-400 hover:text-white transition-colors text-sm">
                {getText('Konfidansyalite', 'Confidentialité', 'Privacy')}
              </Link>
            </div>
            
            <p className="text-stone-500 text-xs sm:text-sm text-center">
              © 2024 KAYICOM Wallet. {getText('Tout dwa rezève.', 'Tous droits réservés.', 'All rights reserved.')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
