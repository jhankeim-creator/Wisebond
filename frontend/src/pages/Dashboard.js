import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserQRCode } from '@/components/QRCode';
import { SensitiveScreenGuard } from '@/components/SensitiveScreenGuard';
import axios from 'axios';
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Send, 
  TrendingUp,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  CreditCard,
  Users,
  Copy,
  Check,
  QrCode,
  Wallet,
  Clock,
  Sparkles,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';

import { API_BASE } from '@/lib/utils';
const API = API_BASE;

export default function Dashboard() {
  const { t, language } = useLanguage();
  const { user, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const copyClientId = () => {
    if (user?.client_id) {
      navigator.clipboard.writeText(user.client_id);
      setCopied(true);
      toast.success(getText('ID kopye!', 'ID copié!', 'ID copied!'));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  // Time-based greeting
  const getGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return getText('Bonjou', 'Bonjour', 'Good morning');
    } else if (hour >= 12 && hour < 18) {
      return getText('Bonswa', 'Bon après-midi', 'Good afternoon');
    } else {
      return getText('Bonswa', 'Bonsoir', 'Good evening');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Calculate total balance in USD
  const totalBalanceUSD = useMemo(() => {
    if (!rates) return 0;
    const htgInUsd = (user?.wallet_htg || 0) * rates.htg_to_usd;
    return htgInUsd + (user?.wallet_usd || 0);
  }, [user?.wallet_htg, user?.wallet_usd, rates]);

  // Get pending transactions count
  const pendingCount = useMemo(() => {
    return transactions.filter(tx => tx.status === 'pending').length;
  }, [transactions]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [txResponse, ratesResponse] = await Promise.all([
        axios.get(`${API}/wallet/transactions?limit=5`),
        axios.get(`${API}/exchange-rates`)
      ]);
      setTransactions(txResponse.data.transactions);
      setRates(ratesResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency) => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    }
    return `G ${new Intl.NumberFormat('fr-HT').format(amount)}`;
  };

  // Convert HTG to USD and vice versa
  const htgToUsd = (htg) => rates ? (htg * rates.htg_to_usd).toFixed(2) : '0.00';
  const usdToHtg = (usd) => rates ? Math.round(usd * rates.usd_to_htg).toLocaleString() : '0';

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownCircle className="text-emerald-500" size={20} />;
      case 'withdrawal':
        return <ArrowUpCircle className="text-red-500" size={20} />;
      case 'transfer_in':
        return <ArrowDownCircle className="text-emerald-500" size={20} />;
      case 'transfer_out':
        return <Send className="text-amber-500" size={20} />;
      default:
        return <RefreshCw className="text-stone-500" size={20} />;
    }
  };

  const quickActions = [
    { to: '/deposit', icon: ArrowDownCircle, label: t('deposit'), color: 'bg-emerald-500 hover:bg-emerald-600' },
    { action: 'qr', icon: QrCode, label: getText('Resevwa', 'Recevoir', 'Receive'), color: 'bg-blue-500 hover:bg-blue-600' },
    { to: '/transfer', icon: Send, label: t('transfer'), color: 'bg-amber-500 hover:bg-amber-600' },
    { to: '/swap', icon: TrendingUp, label: 'Swap', color: 'bg-purple-500 hover:bg-purple-600' },
    { to: '/topup', icon: Phone, label: getText('Minit', 'Minutes', 'Minutes'), color: 'bg-teal-500 hover:bg-teal-600' },
    { to: '/withdraw', icon: ArrowUpCircle, label: t('withdraw'), color: 'bg-[#EA580C] hover:bg-[#C2410C]' }
  ];

  return (
    <DashboardLayout title={`${getGreeting}, ${user?.full_name?.split(' ')[0]}`}>
      <SensitiveScreenGuard>
        <div className="space-y-6 animate-fade-in" data-testid="dashboard">
        {/* KYC Alert - Dark mode compatible */}
        {user?.kyc_status !== 'approved' && (
          <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="text-amber-500" size={20} />
              </div>
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  {user?.kyc_status === 'pending' 
                    ? getText('Verifikasyon KYC an kou', 'Vérification KYC en cours', 'KYC verification in progress')
                    : getText('Verifikasyon KYC obligatwa', 'Vérification KYC requise', 'KYC verification required')}
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {getText('Konplete KYC pou aksè nan tout fonksyonalite yo', 'Complétez votre KYC pour accéder à toutes les fonctionnalités', 'Complete KYC to access all features')}
                </p>
              </div>
            </div>
            <Link to="/kyc" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50">
                {user?.kyc_status === 'pending' ? getText('Wè statis', 'Voir statut', 'View status') : getText('Konplete', 'Compléter', 'Complete')}
              </Button>
            </Link>
          </div>
        )}

        {/* Total Balance Hero Card */}
        <div className="total-balance-card relative overflow-hidden rounded-2xl p-6 sm:p-8 text-white" data-testid="total-balance">
          <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(234,88,12,0.3),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(245,158,11,0.2),transparent_50%)]" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={18} className="text-orange-400" />
              <span className="text-sm text-stone-400 uppercase tracking-wide font-medium">
                {getText('Balans Total', 'Solde Total', 'Total Balance')}
              </span>
            </div>
            
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-bold tracking-tight balance-display">
                ${totalBalanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-lg text-stone-400">USD</span>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wide">{getText('Tranzaksyon', 'Transactions', 'Transactions')}</p>
                <p className="text-xl font-bold text-white mt-1">{transactions.length}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wide">
                  {getText('An atant', 'En attente', 'Pending')}
                </p>
                <p className="text-xl font-bold text-white mt-1 flex items-center gap-2">
                  {pendingCount}
                  {pendingCount > 0 && (
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wide">
                  {getText('To', 'Taux', 'Rate')}
                </p>
                <p className="text-xl font-bold text-white mt-1">
                  {rates ? `G ${rates.usd_to_htg}` : '...'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Cards - Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full">
          {/* HTG Wallet */}
          <div className="wallet-card-htg" data-testid="wallet-htg">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-orange-200 text-sm uppercase tracking-wide">{getText('Balans HTG', 'Solde HTG', 'Balance HTG')}</p>
                <p className="text-3xl font-bold mt-1">
                  {formatCurrency(user?.wallet_htg || 0, 'HTG')}
                </p>
                <p className="text-orange-200 text-sm mt-1">
                  ≈ ${htgToUsd(user?.wallet_htg || 0)} USD
                </p>
              </div>
              <div className="w-14 h-14 bg-orange-700 rounded-xl flex items-center justify-center">
                <span className="text-3xl font-bold">G</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-orange-300/50">
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-orange-200 text-xs">Client ID</p>
                  <p className="font-mono">{user?.client_id}</p>
                </div>
                <button 
                  onClick={copyClientId}
                  className="p-1.5 bg-orange-700 hover:bg-orange-600 rounded-lg transition-colors"
                  title={getText('Kopye ID', 'Copier ID', 'Copy ID')}
                >
                  {copied ? <Check size={16} className="text-emerald-300" /> : <Copy size={16} />}
                </button>
              </div>
              <Logo size="small" />
            </div>
          </div>

          {/* USD Wallet */}
          <div className="wallet-card-usd" data-testid="wallet-usd">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-amber-200 text-sm uppercase tracking-wide">{getText('Balans USD', 'Solde USD', 'Balance USD')}</p>
                <p className="text-3xl font-bold mt-1">
                  {formatCurrency(user?.wallet_usd || 0, 'USD')}
                </p>
                <p className="text-amber-200 text-sm mt-1">
                  ≈ G {usdToHtg(user?.wallet_usd || 0)} HTG
                </p>
              </div>
              <div className="w-14 h-14 bg-amber-600 rounded-xl flex items-center justify-center">
                <span className="text-3xl font-bold">$</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-amber-400/50">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  user?.kyc_status === 'approved' ? 'bg-white' : 'bg-amber-300'
                }`} />
                <span className="text-sm text-amber-200 capitalize">{user?.kyc_status === 'approved' ? getText('Verifye', 'Vérifié', 'Verified') : user?.kyc_status}</span>
              </div>
              {rates && (
                <div className="text-right">
                  <p className="text-amber-200 text-xs">1 USD =</p>
                  <p className="font-semibold">G {rates.usd_to_htg}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            
            // Handle button action (QR code)
            if (action.action === 'qr') {
              return (
                <button key="qr" onClick={() => setShowQRModal(true)} className="group">
                  <div className={`${action.color} text-white rounded-xl p-3 md:p-4 text-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl shadow-lg group-active:scale-95`}>
                    <Icon className="mx-auto mb-1 md:mb-2" size={20} />
                    <span className="font-semibold text-xs md:text-sm block truncate">{action.label}</span>
                  </div>
                </button>
              );
            }
            
            // Handle link action
            return (
              <Link key={action.to} to={action.to} className="group">
                <div className={`${action.color} text-white rounded-xl p-3 md:p-4 text-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl shadow-lg group-active:scale-95`}>
                  <Icon className="mx-auto mb-1 md:mb-2" size={20} />
                  <span className="font-semibold text-xs md:text-sm block truncate">{action.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Recent Transactions & Affiliate */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Transactions - Dark mode compatible */}
          <Card className="lg:col-span-2 dark:bg-stone-900 dark:border-stone-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg dark:text-white flex items-center gap-2">
                <Clock size={18} className="text-stone-400" />
                {t('recentTransactions')}
              </CardTitle>
              <Link to="/transactions" className="text-[#EA580C] text-sm font-medium hover:underline flex items-center gap-1 group">
                {t('viewAll')}
                <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="skeleton w-10 h-10 rounded-full" />
                        <div>
                          <div className="skeleton w-32 h-4 mb-2" />
                          <div className="skeleton w-24 h-3" />
                        </div>
                      </div>
                      <div className="skeleton w-20 h-5" />
                    </div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-stone-500 dark:text-stone-400">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
                    <RefreshCw className="text-stone-400" size={28} />
                  </div>
                  <p className="font-medium">{t('noTransactions')}</p>
                  <p className="text-sm mt-1 text-stone-400">
                    {getText('Fè yon depo pou kòmanse!', 'Faites un dépôt pour commencer!', 'Make a deposit to get started!')}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100 dark:divide-stone-800">
                  {transactions.map((tx) => (
                    <div key={tx.transaction_id} className="flex items-center justify-between py-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 -mx-2 px-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center">
                          {getTransactionIcon(tx.type)}
                        </div>
                        <div>
                          <p className="font-medium text-stone-900 dark:text-white capitalize">
                            {tx.type.replace('_', ' ')}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-stone-500 dark:text-stone-400">
                              {new Date(tx.created_at).toLocaleDateString()}
                            </p>
                            {tx.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                {getText('An atant', 'En attente', 'Pending')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold balance-display ${tx.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount, tx.currency)}
                        </p>
                        <p className="text-xs text-stone-400 dark:text-stone-500">
                          ≈ {tx.currency === 'HTG' ? `$${htgToUsd(Math.abs(tx.amount))}` : `G ${usdToHtg(Math.abs(tx.amount))}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Affiliate Card - Dark mode compatible */}
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 border-amber-200 dark:border-amber-800 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-200/50 dark:from-amber-800/30 to-transparent rounded-bl-full" />
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center">
                  <Users size={18} className="text-amber-600 dark:text-amber-400" />
                </div>
                {t('affiliate')}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-center">
                <div className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 mb-2 bg-amber-100 dark:bg-amber-900/50 px-3 py-1 rounded-full">
                  <Sparkles size={12} />
                  {getText('Lajan afilyasyon', 'Gains d\'affiliation', 'Affiliate Earnings')}
                </div>
                <p className="text-3xl font-bold text-amber-800 dark:text-amber-100 balance-display">
                  G {(user?.affiliate_earnings || 0).toLocaleString()}
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  ≈ ${htgToUsd(user?.affiliate_earnings || 0)} USD
                </p>
              </div>
              
              <div className="mt-6 p-4 bg-white dark:bg-stone-800 rounded-xl border border-amber-100 dark:border-stone-700">
                <p className="text-sm text-stone-600 dark:text-stone-300 text-center leading-relaxed">
                  {getText('Touche G 2,000 pou chak 5 moun ou refere ki komande yon kat!', 'Gagnez 2,000 HTG pour chaque 5 filleuls qui commandent une carte!', 'Earn 2,000 HTG for every 5 referrals who order a card!')}
                </p>
              </div>
              
              <Link to="/affiliate" className="block mt-4">
                <Button className="w-full btn-gold group">
                  {getText('Wè pwogram', 'Voir programme', 'View program')}
                  <ChevronRight className="ml-2 transition-transform group-hover:translate-x-1" size={18} />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Virtual Card Banner */}
        <div className="bg-stone-900 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(234,88,12,0.2),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(245,158,11,0.15),transparent_50%)]" />
          <div className="absolute -right-20 -top-20 w-40 h-40 bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500" />
          
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="hidden sm:flex w-12 h-12 bg-gradient-to-br from-[#EA580C] to-[#F59E0B] rounded-xl items-center justify-center shadow-lg shadow-orange-500/30">
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">
                  {getText('Komande Kat Vityèl Ou', 'Commandez votre Carte Virtuelle', 'Order your Virtual Card')}
                </h3>
                <p className="text-stone-400 text-sm sm:text-base">
                  {getText('Peye toupatou nan mond lan ak kat KAYICOM ou', 'Payez partout dans le monde avec votre carte KAYICOM', 'Pay anywhere in the world with your KAYICOM card')}
                </p>
              </div>
            </div>
            <Link to="/virtual-card" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-gradient-to-r from-[#EA580C] to-[#F59E0B] hover:opacity-90 shadow-lg shadow-orange-500/20 group-hover:shadow-orange-500/40 transition-all">
                <CreditCard className="mr-2" size={18} />
                {getText('Komande', 'Commander', 'Order')}
              </Button>
            </Link>
          </div>
        </div>
        </div>

        {/* QR Code Modal for Receiving Money */}
        <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">
                {getText('Resevwa Lajan', 'Recevoir de l\'Argent', 'Receive Money')}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center py-6">
              <UserQRCode 
                clientId={user?.client_id} 
                userName={user?.full_name}
                size={180}
              />
            </div>
          </DialogContent>
        </Dialog>
      </SensitiveScreenGuard>
    </DashboardLayout>
  );
}
