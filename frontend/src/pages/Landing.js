import React from 'react';
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
  Smartphone
} from 'lucide-react';
import { motion } from 'framer-motion';

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
      <nav className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Logo />
            
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              {isAuthenticated ? (
                <Button onClick={() => navigate('/dashboard')} className="btn-primary">
                  Dashboard
                </Button>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" className="font-medium text-stone-600 hover:text-[#EA580C]">
                      {t('login')}
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button className="btn-primary">
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
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full text-[#EA580C] text-sm font-semibold mb-6">
                <Shield size={16} />
                <span>{getText('Sekirize & Fyab', 'Sécurisé & Fiable', 'Secure & Reliable')}</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-stone-900 leading-tight mb-6">
                {getText('Pòtfèy Ou', 'Votre Portefeuille', 'Your Wallet')}{' '}
                <span className="gradient-text">{getText('Multi-Deviz', 'Multi-Devises', 'Multi-Currency')}</span>
              </h1>
              
              <p className="text-lg text-stone-600 mb-8 max-w-lg leading-relaxed">
                {getText(
                  'Jere finans ou an HTG ak USD, fè transfè enstantane, komande kat vityèl ou epi touche ak pwogram afilyasyon nou.',
                  'Gérez vos finances en HTG et USD, effectuez des transferts instantanés, commandez votre carte virtuelle et gagnez avec notre programme d\'affiliation.',
                  'Manage your finances in HTG and USD, make instant transfers, order your virtual card and earn with our affiliate program.'
                )}
              </p>
              
              <div className="flex flex-wrap gap-4">
                <Link to="/register">
                  <Button className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-lg px-8 py-4 h-auto rounded-full shadow-lg shadow-orange-500/20" data-testid="get-started-btn">
                    {t('getStarted')}
                    <ArrowRight className="ml-2" size={20} />
                  </Button>
                </Link>
                <Button variant="outline" className="btn-secondary text-lg px-8 py-4 h-auto">
                  {t('learnMore')}
                </Button>
              </div>
              
              {/* Trust indicators */}
              <div className="flex items-center gap-8 mt-12 pt-8 border-t border-stone-200">
                <div>
                  <p className="text-3xl font-bold text-stone-900">10K+</p>
                  <p className="text-sm text-stone-500">{language === 'fr' ? 'Utilisateurs' : 'Users'}</p>
                </div>
                <div className="h-10 w-px bg-stone-200" />
                <div>
                  <p className="text-3xl font-bold text-stone-900">$5M+</p>
                  <p className="text-sm text-stone-500">{language === 'fr' ? 'Transactions' : 'Transactions'}</p>
                </div>
                <div className="h-10 w-px bg-stone-200" />
                <div>
                  <p className="text-3xl font-bold text-stone-900">99.9%</p>
                  <p className="text-sm text-stone-500">Uptime</p>
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
                <div className="wallet-card-htg mb-4 transform rotate-2 hover:rotate-0 transition-transform duration-300 glow-orange">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <p className="text-orange-200 text-sm uppercase tracking-wide">Balance HTG</p>
                      <p className="text-3xl font-bold mt-1">G 125,450.00</p>
                      <p className="text-orange-200 text-sm mt-1">≈ $940.60 USD</p>
                    </div>
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl font-bold">G</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-200 text-xs">Client ID</p>
                      <p className="font-mono text-lg">KC8A4F2B1E</p>
                    </div>
                    <Logo size="small" className="opacity-70" />
                  </div>
                </div>
                
                <div className="wallet-card-usd transform -rotate-2 hover:rotate-0 transition-transform duration-300 ml-8 glow-gold">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <p className="text-amber-200 text-sm uppercase tracking-wide">Balance USD</p>
                      <p className="text-3xl font-bold mt-1">$3,245.00</p>
                      <p className="text-amber-200 text-sm mt-1">≈ G 431,585 HTG</p>
                    </div>
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl font-bold">$</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-amber-200" />
                    <span className="text-sm text-amber-200">KYC {language === 'fr' ? 'Vérifié' : 'Verified'}</span>
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
            <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-4">
              {t('features')}
            </h2>
            <p className="text-lg text-stone-600 max-w-2xl mx-auto">
              {language === 'fr' 
                ? 'Tout ce dont vous avez besoin pour gérer vos finances en toute simplicité.'
                : 'Everything you need to manage your finances with ease.'}
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
                  className="card-feature group"
                >
                  <div className={`w-14 h-14 ${feature.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 mb-2">{feature.title}</h3>
                  <p className="text-stone-600">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Virtual Card Section */}
      <section className="py-20 px-6 bg-stone-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(234,88,12,0.15),transparent_50%)]" />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-amber-400 text-sm font-semibold mb-6">
                <CreditCard size={16} />
                <span>{language === 'fr' ? 'Nouveau' : 'New'}</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                {language === 'fr' ? 'Carte Virtuelle KAYICOM' : 'KAYICOM Virtual Card'}
              </h2>
              <p className="text-lg text-stone-400 mb-8">
                {language === 'fr' 
                  ? 'Commandez votre carte virtuelle et payez partout dans le monde. Compatible avec tous les sites et services en ligne.'
                  : 'Order your virtual card and pay anywhere in the world. Compatible with all online sites and services.'}
              </p>
              
              <ul className="space-y-4 mb-8">
                {[
                  language === 'fr' ? 'Paiements en ligne sécurisés' : 'Secure online payments',
                  language === 'fr' ? 'Compatible Netflix, Amazon, etc.' : 'Works with Netflix, Amazon, etc.',
                  language === 'fr' ? 'Rechargeable depuis votre wallet' : 'Rechargeable from your wallet'
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="text-emerald-400" size={20} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              
              <Link to="/register">
                <Button className="btn-gold">
                  {language === 'fr' ? 'Commander ma carte' : 'Order my card'}
                  <ChevronRight className="ml-2" size={20} />
                </Button>
              </Link>
            </div>
            
            <div className="flex justify-center">
              <div className="virtual-card w-full max-w-sm transform hover:scale-105 transition-transform duration-300">
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <Logo size="small" />
                    <div className="w-12 h-8 bg-gradient-to-r from-amber-400 to-amber-600 rounded opacity-80" />
                  </div>
                  
                  <div className="mt-auto">
                    <p className="font-mono text-xl tracking-widest mb-4">
                      •••• •••• •••• 4532
                    </p>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-stone-400 text-xs uppercase">Titulaire</p>
                        <p className="font-medium">JEAN PIERRE</p>
                      </div>
                      <div className="text-right">
                        <p className="text-stone-400 text-xs uppercase">Expire</p>
                        <p className="font-medium">12/28</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deposit Methods */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-4">
                {language === 'fr' ? 'Multiples méthodes de dépôt' : 'Multiple deposit methods'}
              </h2>
              <p className="text-lg text-stone-600 mb-8">
                {language === 'fr' 
                  ? 'Déposez facilement en HTG ou USD avec les méthodes de paiement les plus populaires.'
                  : 'Easily deposit in HTG or USD with the most popular payment methods.'}
              </p>
              
              <div className="space-y-4">
                {depositMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <div 
                      key={method.name}
                      className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-200 hover:border-[#EA580C]/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                          <Icon size={20} className="text-stone-600" />
                        </div>
                        <span className="font-medium text-stone-900">{method.name}</span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        method.currency === 'HTG' ? 'bg-orange-100 text-[#EA580C]' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {method.currency}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="relative">
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
      <section className="py-20 px-6 bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-full text-amber-700 text-sm font-semibold mb-6">
            <Users size={16} />
            <span>{language === 'fr' ? 'Programme d\'Affiliation' : 'Affiliate Program'}</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-4">
            {language === 'fr' ? 'Gagnez 2,000 HTG' : 'Earn 2,000 HTG'}
          </h2>
          <p className="text-lg text-stone-600 mb-8 max-w-2xl mx-auto">
            {language === 'fr' 
              ? 'Pour chaque 5 personnes que vous référez qui commandent une carte virtuelle, vous recevez 2,000 HTG!'
              : 'For every 5 people you refer who order a virtual card, you receive 2,000 HTG!'}
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {[
              { step: '1', title: language === 'fr' ? 'Partagez' : 'Share', desc: language === 'fr' ? 'Votre lien unique' : 'Your unique link' },
              { step: '2', title: language === 'fr' ? 'Ils commandent' : 'They order', desc: language === 'fr' ? 'Une carte virtuelle' : 'A virtual card' },
              { step: '3', title: language === 'fr' ? 'Vous gagnez' : 'You earn', desc: '2,000 HTG / 5 cartes' }
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
                <div className="w-10 h-10 bg-gradient-to-br from-[#EA580C] to-[#F59E0B] rounded-full flex items-center justify-center text-white font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-bold text-stone-900 mb-1">{item.title}</h3>
                <p className="text-stone-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
          
          <Link to="/register">
            <Button className="btn-gold text-lg px-10 py-4 h-auto">
              {language === 'fr' ? 'Commencer à gagner' : 'Start earning'}
              <ChevronRight className="ml-2" size={20} />
            </Button>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-[#EA580C] to-[#C2410C]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {language === 'fr' ? 'Prêt à commencer?' : 'Ready to start?'}
          </h2>
          <p className="text-xl text-orange-100 mb-8">
            {language === 'fr' 
              ? 'Créez votre compte en quelques minutes et commencez à gérer vos finances.'
              : 'Create your account in minutes and start managing your finances.'}
          </p>
          <Link to="/register">
            <Button className="bg-white text-[#EA580C] hover:bg-orange-50 text-lg px-10 py-4 h-auto font-bold rounded-full shadow-lg">
              {language === 'fr' ? 'Créer un compte gratuit' : 'Create free account'}
              <ChevronRight className="ml-2" size={20} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-stone-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <Logo />
            
            <p className="text-stone-400 text-sm">
              © 2024 KAYICOM Wallet. {language === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}
            </p>
            
            <div className="flex items-center gap-6">
              <a href="#" className="text-stone-400 hover:text-white transition-colors">
                {language === 'fr' ? 'Conditions' : 'Terms'}
              </a>
              <a href="#" className="text-stone-400 hover:text-white transition-colors">
                {language === 'fr' ? 'Confidentialité' : 'Privacy'}
              </a>
              <a href="#" className="text-stone-400 hover:text-white transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
