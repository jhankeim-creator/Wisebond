import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserQRCode } from '@/components/QRCode';
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
  QrCode
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
    { to: '/withdraw', icon: ArrowUpCircle, label: t('withdraw'), color: 'bg-[#EA580C] hover:bg-[#C2410C]' }
  ];

  return (
    <DashboardLayout title={`${t('welcomeBack')}, ${user?.full_name?.split(' ')[0]}`}>
      <div className="space-y-6 animate-fade-in" data-testid="dashboard">
        {/* KYC Alert */}
        {user?.kyc_status !== 'approved' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-amber-500" size={24} />
              <div>
                <p className="font-semibold text-amber-800">
                  {user?.kyc_status === 'pending' 
                    ? getText('Verifikasyon KYC an kou', 'Vérification KYC en cours', 'KYC verification in progress')
                    : getText('Verifikasyon KYC obligatwa', 'Vérification KYC requise', 'KYC verification required')}
                </p>
                <p className="text-sm text-amber-600">
                  {getText('Konplete KYC pou aksè nan tout fonksyonalite yo', 'Complétez votre KYC pour accéder à toutes les fonctionnalités', 'Complete KYC to access all features')}
                </p>
              </div>
            </div>
            <Link to="/kyc">
              <Button variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-100">
                {user?.kyc_status === 'pending' ? getText('Wè statis', 'Voir statut', 'View status') : getText('Konplete', 'Compléter', 'Complete')}
              </Button>
            </Link>
          </div>
        )}

        {/* Wallet Cards - Bento Grid */}
        <div className="grid md:grid-cols-2 gap-6">
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
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-3xl font-bold">G</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-white/20">
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-orange-200 text-xs">Client ID</p>
                  <p className="font-mono">{user?.client_id}</p>
                </div>
                <button 
                  onClick={copyClientId}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  title={getText('Kopye ID', 'Copier ID', 'Copy ID')}
                >
                  {copied ? <Check size={16} className="text-emerald-300" /> : <Copy size={16} />}
                </button>
              </div>
              <Logo size="small" className="opacity-70" />
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
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-3xl font-bold">$</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-white/20">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  user?.kyc_status === 'approved' ? 'bg-white' : 'bg-white/50'
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
        <div className="grid grid-cols-5 gap-3 md:gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            
            // Handle button action (QR code)
            if (action.action === 'qr') {
              return (
                <button key="qr" onClick={() => setShowQRModal(true)}>
                  <div className={`${action.color} text-white rounded-xl p-3 md:p-4 text-center transition-all hover:scale-105 shadow-lg`}>
                    <Icon className="mx-auto mb-1 md:mb-2" size={20} />
                    <span className="font-semibold text-xs md:text-sm">{action.label}</span>
                  </div>
                </button>
              );
            }
            
            // Handle link action
            return (
              <Link key={action.to} to={action.to}>
                <div className={`${action.color} text-white rounded-xl p-3 md:p-4 text-center transition-all hover:scale-105 shadow-lg`}>
                  <Icon className="mx-auto mb-1 md:mb-2" size={20} />
                  <span className="font-semibold text-xs md:text-sm">{action.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Recent Transactions & Affiliate */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Transactions */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{t('recentTransactions')}</CardTitle>
              <Link to="/transactions" className="text-[#EA580C] text-sm font-medium hover:underline flex items-center gap-1">
                {t('viewAll')}
                <ChevronRight size={16} />
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
                <div className="text-center py-8 text-stone-500">
                  <RefreshCw className="mx-auto mb-3 text-stone-400" size={32} />
                  <p>{t('noTransactions')}</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {transactions.map((tx) => (
                    <div key={tx.transaction_id} className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center">
                          {getTransactionIcon(tx.type)}
                        </div>
                        <div>
                          <p className="font-medium text-stone-900 capitalize">
                            {tx.type.replace('_', ' ')}
                          </p>
                          <p className="text-sm text-stone-500">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount, tx.currency)}
                        </p>
                        <p className="text-xs text-stone-400">
                          ≈ {tx.currency === 'HTG' ? `$${htgToUsd(Math.abs(tx.amount))}` : `G ${usdToHtg(Math.abs(tx.amount))}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Affiliate Card */}
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <Users size={20} />
                {t('affiliate')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-sm text-amber-700 mb-2">{getText('Lajan afilyasyon', 'Gains d\'affiliation', 'Affiliate Earnings')}</p>
                <p className="text-3xl font-bold text-amber-800">
                  G {(user?.affiliate_earnings || 0).toLocaleString()}
                </p>
                <p className="text-sm text-amber-600 mt-1">
                  ≈ ${htgToUsd(user?.affiliate_earnings || 0)} USD
                </p>
              </div>
              
              <div className="mt-6 p-4 bg-white rounded-xl">
                <p className="text-sm text-stone-600 text-center">
                  {getText('Touche G 2,000 pou chak 5 moun ou refere ki komande yon kat!', 'Gagnez 2,000 HTG pour chaque 5 filleuls qui commandent une carte!', 'Earn 2,000 HTG for every 5 referrals who order a card!')}
                </p>
              </div>
              
              <Link to="/affiliate" className="block mt-4">
                <Button className="w-full btn-gold">
                  {getText('Wè pwogram', 'Voir programme', 'View program')}
                  <ChevronRight className="ml-2" size={18} />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Virtual Card Banner */}
        <div className="bg-stone-900 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(234,88,12,0.2),transparent_50%)]" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">
                {getText('Komande Kat Vityèl Ou', 'Commandez votre Carte Virtuelle', 'Order your Virtual Card')}
              </h3>
              <p className="text-stone-400">
                {getText('Peye toupatou nan mond lan ak kat KAYICOM ou', 'Payez partout dans le monde avec votre carte KAYICOM', 'Pay anywhere in the world with your KAYICOM card')}
              </p>
            </div>
            <Link to="/virtual-card">
              <Button className="bg-gradient-to-r from-[#EA580C] to-[#F59E0B] hover:opacity-90">
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
    </DashboardLayout>
  );
}
