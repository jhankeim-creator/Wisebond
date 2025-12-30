import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import axios from 'axios';
import { 
  Users,
  UserCheck,
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  TrendingUp,
  CreditCard,
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Settings,
  Shield,
  Zap,
  Eye
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export default function AdminDashboard() {
  const { language } = useLanguage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentDeposits, setRecentDeposits] = useState([]);
  const [recentWithdrawals, setRecentWithdrawals] = useState([]);
  const [recentKYC, setRecentKYC] = useState([]);
  const [cardOrders, setCardOrders] = useState([]);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [statsRes, depositsRes, withdrawalsRes, kycRes, cardsRes] = await Promise.all([
        axios.get(`${API}/admin/dashboard`),
        axios.get(`${API}/admin/deposits?status=pending&limit=5`).catch(() => ({ data: { deposits: [] } })),
        axios.get(`${API}/admin/withdrawals?status=pending&limit=5`).catch(() => ({ data: { withdrawals: [] } })),
        axios.get(`${API}/admin/kyc?status=pending&limit=5`).catch(() => ({ data: { submissions: [] } })),
        axios.get(`${API}/admin/virtual-cards?status=pending&limit=5`).catch(() => ({ data: { orders: [] } }))
      ]);
      setStats(statsRes.data);
      setRecentDeposits(depositsRes.data.deposits || []);
      setRecentWithdrawals(withdrawalsRes.data.withdrawals || []);
      setRecentKYC(kycRes.data.submissions || []);
      setCardOrders(cardsRes.data.orders || []);
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

  const totalPending = (stats?.pending_kyc || 0) + (stats?.pending_deposits || 0) + (stats?.pending_withdrawals || 0) + (cardOrders?.length || 0);

  return (
    <AdminLayout title="Dashboard Admin">
      <div className="space-y-6" data-testid="admin-dashboard">
        
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[#0047AB] via-[#0056D2] to-[#EA580C] rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="relative">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold mb-1">
                  {getText('Byenveni, Admin!', 'Bienvenue, Admin!', 'Welcome, Admin!')}
                </h1>
                <p className="text-blue-100">
                  {getText(
                    `Ou gen ${totalPending} aksyon an atant`,
                    `Vous avez ${totalPending} actions en attente`,
                    `You have ${totalPending} pending actions`
                  )}
                </p>
              </div>
              <Button onClick={fetchAllData} variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                {getText('Aktyalize', 'Actualiser', 'Refresh')}
              </Button>
            </div>
          </div>
        </div>

        {/* Urgent Actions - Show if there are pending items */}
        {totalPending > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-white" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-amber-800 dark:text-amber-300">
                  {getText('Aksyon Ijan', 'Actions Urgentes', 'Urgent Actions')}
                </h3>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {getText('Bagay ki bezwen atansyon ou', 'Éléments nécessitant votre attention', 'Items requiring your attention')}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats?.pending_kyc > 0 && (
                <Link to="/admin/kyc" className="flex items-center gap-2 p-3 bg-white dark:bg-stone-800 rounded-lg hover:shadow-md transition-shadow">
                  <UserCheck className="text-amber-500" size={20} />
                  <span className="font-semibold text-stone-700 dark:text-stone-300">{stats.pending_kyc} KYC</span>
                </Link>
              )}
              {stats?.pending_deposits > 0 && (
                <Link to="/admin/deposits" className="flex items-center gap-2 p-3 bg-white dark:bg-stone-800 rounded-lg hover:shadow-md transition-shadow">
                  <ArrowDownCircle className="text-emerald-500" size={20} />
                  <span className="font-semibold text-stone-700 dark:text-stone-300">{stats.pending_deposits} {getText('Depo', 'Dépôts', 'Deposits')}</span>
                </Link>
              )}
              {stats?.pending_withdrawals > 0 && (
                <Link to="/admin/withdrawals" className="flex items-center gap-2 p-3 bg-white dark:bg-stone-800 rounded-lg hover:shadow-md transition-shadow">
                  <ArrowUpCircle className="text-red-500" size={20} />
                  <span className="font-semibold text-stone-700 dark:text-stone-300">{stats.pending_withdrawals} {getText('Retrè', 'Retraits', 'Withdrawals')}</span>
                </Link>
              )}
              {cardOrders?.length > 0 && (
                <Link to="/admin/virtual-cards" className="flex items-center gap-2 p-3 bg-white dark:bg-stone-800 rounded-lg hover:shadow-md transition-shadow">
                  <CreditCard className="text-purple-500" size={20} />
                  <span className="font-semibold text-stone-700 dark:text-stone-300">{cardOrders.length} {getText('Kat', 'Cartes', 'Cards')}</span>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">{getText('Total Itilizatè', 'Total Utilisateurs', 'Total Users')}</p>
                  <p className="text-3xl font-bold mt-1">{loading ? '-' : stats?.total_users || 0}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Users size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm">KYC {getText('An Atant', 'En Attente', 'Pending')}</p>
                  <p className="text-3xl font-bold mt-1">{loading ? '-' : stats?.pending_kyc || 0}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Shield size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm">{getText('Depo An Atant', 'Dépôts En Attente', 'Pending Deposits')}</p>
                  <p className="text-3xl font-bold mt-1">{loading ? '-' : stats?.pending_deposits || 0}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <ArrowDownCircle size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm">{getText('Retrè An Atant', 'Retraits En Attente', 'Pending Withdrawals')}</p>
                  <p className="text-3xl font-bold mt-1">{loading ? '-' : stats?.pending_withdrawals || 0}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <ArrowUpCircle size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Total Balances */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-[#0047AB] to-[#003380] text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-200 text-sm">Total HTG {getText('nan sistèm nan', 'dans le système', 'in system')}</p>
                  <p className="text-3xl font-bold mt-1">
                    {loading ? '-' : `G ${(stats?.total_htg || 0).toLocaleString()}`}
                  </p>
                </div>
                <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center">
                  <span className="text-2xl font-bold">G</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-200 text-sm">Total USD {getText('nan sistèm nan', 'dans le système', 'in system')}</p>
                  <p className="text-3xl font-bold mt-1">
                    {loading ? '-' : `$${(stats?.total_usd || 0).toLocaleString()}`}
                  </p>
                </div>
                <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center">
                  <DollarSign size={28} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-700 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-200 text-sm">{getText('Kat Aktif', 'Cartes Actives', 'Active Cards')}</p>
                  <p className="text-3xl font-bold mt-1">
                    {loading ? '-' : stats?.active_cards || 0}
                  </p>
                </div>
                <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center">
                  <CreditCard size={28} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Pending Deposits */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ArrowDownCircle className="text-emerald-500" size={20} />
                {getText('Depo An Atant', 'Dépôts En Attente', 'Pending Deposits')}
              </CardTitle>
              <Link to="/admin/deposits">
                <Button variant="ghost" size="sm" className="text-emerald-600">
                  {getText('Wè tout', 'Voir tout', 'View all')}
                  <ChevronRight size={16} />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}
                </div>
              ) : recentDeposits.length === 0 ? (
                <div className="text-center py-8 text-stone-500">
                  <CheckCircle className="mx-auto mb-2 text-emerald-500" size={32} />
                  <p>{getText('Pa gen depo an atant', 'Aucun dépôt en attente', 'No pending deposits')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentDeposits.slice(0, 5).map((deposit) => (
                    <div key={deposit.deposit_id} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800 rounded-lg">
                      <div>
                        <p className="font-medium text-stone-900 dark:text-white">{deposit.user_name || deposit.user_id}</p>
                        <p className="text-xs text-stone-500">{new Date(deposit.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">{formatCurrency(deposit.amount, deposit.currency)}</p>
                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                          <Clock size={10} className="mr-1" />
                          {getText('An atant', 'En attente', 'Pending')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Pending Withdrawals */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ArrowUpCircle className="text-red-500" size={20} />
                {getText('Retrè An Atant', 'Retraits En Attente', 'Pending Withdrawals')}
              </CardTitle>
              <Link to="/admin/withdrawals">
                <Button variant="ghost" size="sm" className="text-red-600">
                  {getText('Wè tout', 'Voir tout', 'View all')}
                  <ChevronRight size={16} />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}
                </div>
              ) : recentWithdrawals.length === 0 ? (
                <div className="text-center py-8 text-stone-500">
                  <CheckCircle className="mx-auto mb-2 text-emerald-500" size={32} />
                  <p>{getText('Pa gen retrè an atant', 'Aucun retrait en attente', 'No pending withdrawals')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentWithdrawals.slice(0, 5).map((withdrawal) => (
                    <div key={withdrawal.withdrawal_id} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800 rounded-lg">
                      <div>
                        <p className="font-medium text-stone-900 dark:text-white">{withdrawal.user_name || withdrawal.user_id}</p>
                        <p className="text-xs text-stone-500">{withdrawal.method} • {new Date(withdrawal.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">{formatCurrency(withdrawal.amount, withdrawal.currency)}</p>
                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                          <Clock size={10} className="mr-1" />
                          {getText('An atant', 'En attente', 'Pending')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="text-amber-500" size={20} />
              {getText('Aksyon Rapid', 'Actions Rapides', 'Quick Actions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Link to="/admin/kyc" className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-center hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors group">
                <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <UserCheck className="text-white" size={24} />
                </div>
                <p className="font-medium text-amber-700 dark:text-amber-400">{getText('Verifye KYC', 'Vérifier KYC', 'Verify KYC')}</p>
                <p className="text-sm text-amber-600 dark:text-amber-500">{stats?.pending_kyc || 0} {getText('an atant', 'en attente', 'pending')}</p>
              </Link>

              <Link to="/admin/deposits" className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-center hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors group">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <ArrowDownCircle className="text-white" size={24} />
                </div>
                <p className="font-medium text-emerald-700 dark:text-emerald-400">{getText('Apwouve Depo', 'Approuver Dépôts', 'Approve Deposits')}</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-500">{stats?.pending_deposits || 0} {getText('an atant', 'en attente', 'pending')}</p>
              </Link>

              <Link to="/admin/withdrawals" className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-center hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors group">
                <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <ArrowUpCircle className="text-white" size={24} />
                </div>
                <p className="font-medium text-red-700 dark:text-red-400">{getText('Trete Retrè', 'Traiter Retraits', 'Process Withdrawals')}</p>
                <p className="text-sm text-red-600 dark:text-red-500">{stats?.pending_withdrawals || 0} {getText('an atant', 'en attente', 'pending')}</p>
              </Link>

              <Link to="/admin/virtual-cards" className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-center hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group">
                <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <CreditCard className="text-white" size={24} />
                </div>
                <p className="font-medium text-purple-700 dark:text-purple-400">{getText('Kat Vityèl', 'Cartes Virtuelles', 'Virtual Cards')}</p>
                <p className="text-sm text-purple-600 dark:text-purple-500">{cardOrders?.length || 0} {getText('an atant', 'en attente', 'pending')}</p>
              </Link>

              <Link to="/admin/rates" className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <TrendingUp className="text-white" size={24} />
                </div>
                <p className="font-medium text-blue-700 dark:text-blue-400">{getText('To Echanj', 'Taux de Change', 'Exchange Rates')}</p>
                <p className="text-sm text-blue-600 dark:text-blue-500">{getText('Konfigire', 'Configurer', 'Configure')}</p>
              </Link>

              <Link to="/admin/payment-methods" className="p-4 bg-stone-100 dark:bg-stone-800 rounded-xl text-center hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors group">
                <div className="w-12 h-12 bg-stone-600 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Wallet className="text-white" size={24} />
                </div>
                <p className="font-medium text-stone-700 dark:text-stone-300">{getText('Mwayen Peman', 'Moyens de Paiement', 'Payment Methods')}</p>
                <p className="text-sm text-stone-500">{getText('Jere', 'Gérer', 'Manage')}</p>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Management Links */}
        <div className="grid md:grid-cols-3 gap-4">
          <Link to="/admin/users" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                  <Users className="text-blue-600" size={28} />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 dark:text-white">{getText('Jere Itilizatè', 'Gérer Utilisateurs', 'Manage Users')}</h3>
                  <p className="text-sm text-stone-500">{getText('Wè ak modifye kont itilizatè yo', 'Voir et modifier les comptes utilisateurs', 'View and edit user accounts')}</p>
                </div>
                <ChevronRight className="ml-auto text-stone-400" size={20} />
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/settings" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 bg-stone-100 dark:bg-stone-800 rounded-xl flex items-center justify-center">
                  <Settings className="text-stone-600" size={28} />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 dark:text-white">{getText('Paramèt Sistèm', 'Paramètres Système', 'System Settings')}</h3>
                  <p className="text-sm text-stone-500">{getText('Konfigire aplikasyon an', 'Configurer l\'application', 'Configure the application')}</p>
                </div>
                <ChevronRight className="ml-auto text-stone-400" size={20} />
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/logs" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                  <Activity className="text-purple-600" size={28} />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 dark:text-white">{getText('Jounal Aktivite', 'Journal d\'Activité', 'Activity Logs')}</h3>
                  <p className="text-sm text-stone-500">{getText('Swiv tout aktivite yo', 'Suivre toutes les activités', 'Track all activities')}</p>
                </div>
                <ChevronRight className="ml-auto text-stone-400" size={20} />
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
