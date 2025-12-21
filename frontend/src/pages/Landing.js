import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  Zap, 
  Globe, 
  Users, 
  ArrowRight,
  ChevronRight,
  Wallet,
  RefreshCw,
  CheckCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function Landing() {
  const { t } = useLanguage();

  const features = [
    {
      icon: Shield,
      title: t('secureWallet'),
      description: t('secureWalletDesc'),
      color: 'bg-blue-100 text-[#0047AB]'
    },
    {
      icon: Zap,
      title: t('instantTransfers'),
      description: t('instantTransfersDesc'),
      color: 'bg-emerald-100 text-emerald-600'
    },
    {
      icon: Globe,
      title: t('multiCurrency'),
      description: t('multiCurrencyDesc'),
      color: 'bg-orange-100 text-orange-600'
    },
    {
      icon: Users,
      title: t('affiliateProgram'),
      description: t('affiliateProgramDesc'),
      color: 'bg-purple-100 text-purple-600'
    }
  ];

  const depositMethods = [
    { name: 'MonCash', currency: 'HTG' },
    { name: 'NatCash', currency: 'HTG' },
    { name: 'Zelle', currency: 'USD' },
    { name: 'PayPal', currency: 'USD' },
    { name: 'USDT', currency: 'USD' }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#0047AB] rounded-xl flex items-center justify-center">
                <Wallet className="text-white" size={24} />
              </div>
              <span className="text-xl font-bold text-slate-900">KAYICOM</span>
            </div>
            
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <Link to="/login">
                <Button variant="ghost" className="font-medium">
                  {t('login')}
                </Button>
              </Link>
              <Link to="/register">
                <Button className="btn-primary">
                  {t('register')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full text-[#0047AB] text-sm font-medium mb-6">
                <Shield size={16} />
                <span>Sécurisé & Fiable</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight mb-6">
                {t('heroTitle')}
              </h1>
              
              <p className="text-lg text-slate-600 mb-8 max-w-lg">
                {t('heroSubtitle')}
              </p>
              
              <div className="flex flex-wrap gap-4">
                <Link to="/register">
                  <Button className="btn-primary text-lg px-8 py-4 h-auto" data-testid="get-started-btn">
                    {t('getStarted')}
                    <ArrowRight className="ml-2" size={20} />
                  </Button>
                </Link>
                <Button variant="outline" className="btn-outline text-lg px-8 py-4 h-auto">
                  {t('learnMore')}
                </Button>
              </div>
              
              {/* Trust indicators */}
              <div className="flex items-center gap-6 mt-10 pt-10 border-t border-slate-200">
                <div>
                  <p className="text-3xl font-bold text-slate-900">10K+</p>
                  <p className="text-sm text-slate-500">Utilisateurs</p>
                </div>
                <div className="h-10 w-px bg-slate-200" />
                <div>
                  <p className="text-3xl font-bold text-slate-900">$5M+</p>
                  <p className="text-sm text-slate-500">Transactions</p>
                </div>
                <div className="h-10 w-px bg-slate-200" />
                <div>
                  <p className="text-3xl font-bold text-slate-900">99.9%</p>
                  <p className="text-sm text-slate-500">Uptime</p>
                </div>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              {/* Wallet Cards Preview */}
              <div className="relative">
                <div className="wallet-card mb-4 transform rotate-2 hover:rotate-0 transition-transform duration-300">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <p className="text-blue-200 text-sm">Balance HTG</p>
                      <p className="text-3xl font-bold">125,450.00</p>
                    </div>
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl font-bold">G</span>
                    </div>
                  </div>
                  <p className="text-blue-200 text-sm">Client ID</p>
                  <p className="font-mono text-lg">KC8A4F2B1E</p>
                </div>
                
                <div className="wallet-card wallet-card-usd transform -rotate-2 hover:rotate-0 transition-transform duration-300 ml-8">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <p className="text-emerald-200 text-sm">Balance USD</p>
                      <p className="text-3xl font-bold">3,245.00</p>
                    </div>
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl font-bold">$</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-200" />
                    <span className="text-sm text-emerald-200">KYC Vérifié</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              {t('features')}
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Tout ce dont vous avez besoin pour gérer vos finances en toute simplicité.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="card-hover p-6"
                >
                  <div className={`w-14 h-14 ${feature.color} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-600">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Deposit Methods */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Multiples méthodes de dépôt
              </h2>
              <p className="text-lg text-slate-600 mb-8">
                Déposez facilement en HTG ou USD avec les méthodes de paiement les plus populaires en Haïti et à l'international.
              </p>
              
              <div className="space-y-4">
                {depositMethods.map((method) => (
                  <div 
                    key={method.name}
                    className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                        <RefreshCw size={20} className="text-slate-600" />
                      </div>
                      <span className="font-medium text-slate-900">{method.name}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      method.currency === 'HTG' ? 'bg-blue-100 text-[#0047AB]' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {method.currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1633504214759-e1013f422ed7?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"
                alt="Mobile banking"
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-[#0047AB]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Prêt à commencer?
          </h2>
          <p className="text-xl text-blue-200 mb-8">
            Créez votre compte en quelques minutes et commencez à gérer vos finances.
          </p>
          <Link to="/register">
            <Button className="bg-white text-[#0047AB] hover:bg-slate-100 text-lg px-8 py-4 h-auto font-semibold rounded-full">
              Créer un compte gratuit
              <ChevronRight className="ml-2" size={20} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#0047AB] rounded-xl flex items-center justify-center">
                <Wallet className="text-white" size={24} />
              </div>
              <span className="text-xl font-bold text-white">KAYICOM</span>
            </div>
            
            <p className="text-slate-400 text-sm">
              © 2024 KAYICOM Wallet. Tous droits réservés.
            </p>
            
            <div className="flex items-center gap-6">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                Conditions
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                Confidentialité
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
