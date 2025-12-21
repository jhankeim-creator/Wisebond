import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import axios from 'axios';
import { 
  Users,
  UserCheck,
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  TrendingUp
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/dashboard`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { 
      label: 'Total Utilisateurs', 
      value: stats?.total_users || 0, 
      icon: Users, 
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50'
    },
    { 
      label: 'KYC en attente', 
      value: stats?.pending_kyc || 0, 
      icon: UserCheck, 
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50'
    },
    { 
      label: 'Dépôts en attente', 
      value: stats?.pending_deposits || 0, 
      icon: ArrowDownCircle, 
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50'
    },
    { 
      label: 'Retraits en attente', 
      value: stats?.pending_withdrawals || 0, 
      icon: ArrowUpCircle, 
      color: 'bg-red-500',
      bgColor: 'bg-red-50'
    },
  ];

  return (
    <AdminLayout title="Dashboard Admin">
      <div className="space-y-6" data-testid="admin-dashboard">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className={stat.bgColor}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">{stat.label}</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1">
                        {loading ? '-' : stat.value}
                      </p>
                    </div>
                    <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}>
                      <Icon size={24} className="text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Total Balances */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-[#0047AB] to-[#003380] text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-200 text-sm">Total HTG dans le système</p>
                  <p className="text-3xl font-bold mt-1">
                    {loading ? '-' : `G ${stats?.total_htg?.toLocaleString() || 0}`}
                  </p>
                </div>
                <TrendingUp size={32} className="text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-200 text-sm">Total USD dans le système</p>
                  <p className="text-3xl font-bold mt-1">
                    {loading ? '-' : `$${stats?.total_usd?.toLocaleString() || 0}`}
                  </p>
                </div>
                <DollarSign size={32} className="text-emerald-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Actions rapides</h3>
            <div className="grid md:grid-cols-4 gap-4">
              <a href="/admin/kyc" className="p-4 bg-amber-50 rounded-xl text-center hover:bg-amber-100 transition-colors">
                <UserCheck className="mx-auto text-amber-600 mb-2" size={24} />
                <p className="font-medium text-amber-700">Vérifier KYC</p>
                <p className="text-sm text-amber-600">{stats?.pending_kyc || 0} en attente</p>
              </a>
              <a href="/admin/deposits" className="p-4 bg-emerald-50 rounded-xl text-center hover:bg-emerald-100 transition-colors">
                <ArrowDownCircle className="mx-auto text-emerald-600 mb-2" size={24} />
                <p className="font-medium text-emerald-700">Approuver dépôts</p>
                <p className="text-sm text-emerald-600">{stats?.pending_deposits || 0} en attente</p>
              </a>
              <a href="/admin/withdrawals" className="p-4 bg-red-50 rounded-xl text-center hover:bg-red-100 transition-colors">
                <ArrowUpCircle className="mx-auto text-red-600 mb-2" size={24} />
                <p className="font-medium text-red-700">Traiter retraits</p>
                <p className="text-sm text-red-600">{stats?.pending_withdrawals || 0} en attente</p>
              </a>
              <a href="/admin/rates" className="p-4 bg-blue-50 rounded-xl text-center hover:bg-blue-100 transition-colors">
                <TrendingUp className="mx-auto text-blue-600 mb-2" size={24} />
                <p className="font-medium text-blue-700">Taux de change</p>
                <p className="text-sm text-blue-600">Configurer</p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
