import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Send, 
  TrendingUp,
  AlertCircle,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Dashboard() {
  const { t } = useLanguage();
  const { user, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);

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
    return new Intl.NumberFormat('fr-HT', { style: 'currency', currency: 'HTG' }).format(amount);
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownCircle className="text-emerald-500" size={20} />;
      case 'withdrawal':
        return <ArrowUpCircle className="text-red-500" size={20} />;
      case 'transfer_in':
        return <ArrowDownCircle className="text-emerald-500" size={20} />;
      case 'transfer_out':
        return <Send className="text-orange-500" size={20} />;
      default:
        return <RefreshCw className="text-slate-500" size={20} />;
    }
  };

  const quickActions = [
    { to: '/deposit', icon: ArrowDownCircle, label: t('deposit'), color: 'bg-emerald-500 hover:bg-emerald-600' },
    { to: '/withdraw', icon: ArrowUpCircle, label: t('withdraw'), color: 'bg-red-500 hover:bg-red-600' },
    { to: '/transfer', icon: Send, label: t('transfer'), color: 'bg-orange-500 hover:bg-orange-600' }
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
                <p className="font-medium text-amber-800">
                  {user?.kyc_status === 'pending' ? 'Vérification KYC en cours' : 'Vérification KYC requise'}
                </p>
                <p className="text-sm text-amber-600">
                  Complétez votre KYC pour accéder à toutes les fonctionnalités
                </p>
              </div>
            </div>
            <Link to="/kyc">
              <Button variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-100">
                {user?.kyc_status === 'pending' ? 'Voir statut' : 'Compléter'}
              </Button>
            </Link>
          </div>
        )}

        {/* Wallet Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="wallet-card" data-testid="wallet-htg">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-blue-200 text-sm uppercase tracking-wide">Balance HTG</p>
                <p className="text-3xl font-bold mt-1">
                  {formatCurrency(user?.wallet_htg || 0, 'HTG')}
                </p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl font-bold">G</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-xs">Client ID</p>
                <p className="font-mono">{user?.client_id}</p>
              </div>
              {rates && (
                <div className="text-right">
                  <p className="text-blue-200 text-xs">1 USD =</p>
                  <p className="font-semibold">{rates.usd_to_htg} HTG</p>
                </div>
              )}
            </div>
          </div>

          <div className="wallet-card wallet-card-usd" data-testid="wallet-usd">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-emerald-200 text-sm uppercase tracking-wide">Balance USD</p>
                <p className="text-3xl font-bold mt-1">
                  {formatCurrency(user?.wallet_usd || 0, 'USD')}
                </p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl font-bold">$</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  user?.kyc_status === 'approved' ? 'bg-white' : 'bg-white/50'
                }`} />
                <span className="text-sm text-emerald-200 capitalize">{user?.kyc_status}</span>
              </div>
              {rates && (
                <div className="text-right">
                  <p className="text-emerald-200 text-xs">1 HTG =</p>
                  <p className="font-semibold">${rates.htg_to_usd}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.to} to={action.to}>
                <div className={`${action.color} text-white rounded-xl p-4 text-center transition-transform hover:scale-105`}>
                  <Icon className="mx-auto mb-2" size={24} />
                  <span className="font-medium">{action.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{t('recentTransactions')}</CardTitle>
            <Link to="/transactions" className="text-[#0047AB] text-sm font-medium hover:underline flex items-center gap-1">
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
              <div className="text-center py-8 text-slate-500">
                <RefreshCw className="mx-auto mb-3 text-slate-400" size={32} />
                <p>{t('noTransactions')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <div key={tx.transaction_id} className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 capitalize">
                          {tx.type.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-slate-500">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <p className={`font-semibold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount, tx.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Affiliate Banner */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">Programme d'Affiliation</h3>
              <p className="text-purple-200">
                Gagnez $1 pour chaque $300 de retraits de vos filleuls
              </p>
              <p className="text-2xl font-bold mt-2">
                Total gagné: {formatCurrency(user?.affiliate_earnings || 0, 'USD')}
              </p>
            </div>
            <Link to="/affiliate">
              <Button className="bg-white text-purple-700 hover:bg-purple-50">
                Voir plus
                <ChevronRight className="ml-1" size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
