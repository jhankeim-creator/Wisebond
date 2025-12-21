import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import axios from 'axios';
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Send, 
  RefreshCw,
  Filter
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Transactions() {
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ currency: 'all', type: 'all' });

  useEffect(() => {
    fetchTransactions();
  }, [filter]);

  const fetchTransactions = async () => {
    try {
      let url = `${API}/wallet/transactions?limit=100`;
      if (filter.currency !== 'all') url += `&currency=${filter.currency}`;
      if (filter.type !== 'all') url += `&transaction_type=${filter.type}`;
      
      const response = await axios.get(url);
      setTransactions(response.data.transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
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
      case 'affiliate_commission':
        return <RefreshCw className="text-purple-500" size={20} />;
      default:
        return <RefreshCw className="text-slate-500" size={20} />;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'status-badge status-completed',
      pending: 'status-badge status-pending',
      rejected: 'status-badge status-rejected'
    };
    return styles[status] || 'status-badge';
  };

  return (
    <DashboardLayout title={t('transactions')}>
      <div className="space-y-6" data-testid="transactions-page">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <Filter size={20} className="text-slate-500" />
              <Select value={filter.currency} onValueChange={(v) => setFilter({...filter, currency: v})}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Devise" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="HTG">HTG</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filter.type} onValueChange={(v) => setFilter({...filter, type: v})}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="deposit">Dépôts</SelectItem>
                  <SelectItem value="withdrawal">Retraits</SelectItem>
                  <SelectItem value="transfer_in">Reçus</SelectItem>
                  <SelectItem value="transfer_out">Envoyés</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="sm" onClick={fetchTransactions}>
                <RefreshCw size={16} className="mr-2" />
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <CardTitle>{t('transactions')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 border-b border-slate-100">
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
              <div className="text-center py-12 text-slate-500">
                <RefreshCw className="mx-auto mb-3 text-slate-400" size={48} />
                <p className="text-lg">{t('noTransactions')}</p>
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
                          {new Date(tx.created_at).toLocaleString()}
                        </p>
                        {tx.description && (
                          <p className="text-xs text-slate-400 mt-1">{tx.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount, tx.currency)}
                      </p>
                      <span className={getStatusBadge(tx.status)}>
                        {t(tx.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
