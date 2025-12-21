import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { Search, Eye, Ban, DollarSign, RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminUsers() {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const fetchUsers = async () => {
    try {
      let url = `${API}/admin/users?limit=100`;
      if (search) url += `&search=${search}`;
      const response = await axios.get(url);
      setUsers(response.data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewUser = async (userId) => {
    try {
      const response = await axios.get(`${API}/admin/users/${userId}`);
      setSelectedUser(response.data);
      setShowModal(true);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await axios.patch(`${API}/admin/users/${userId}/status`, {
        is_active: !currentStatus
      });
      toast.success('Statut mis à jour');
      fetchUsers();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const getKycBadge = (status) => {
    const styles = {
      approved: 'bg-emerald-100 text-emerald-700',
      pending: 'bg-amber-100 text-amber-700',
      rejected: 'bg-red-100 text-red-700'
    };
    return styles[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <AdminLayout title={t('users')}>
      <div className="space-y-6" data-testid="admin-users">
        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <Input
                placeholder="Rechercher par email, nom ou ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Liste des utilisateurs ({users.length})</span>
              <Button variant="outline" size="sm" onClick={fetchUsers}>
                <RefreshCw size={16} className="mr-2" />
                Actualiser
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client ID</th>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>KYC</th>
                    <th>Balance USD</th>
                    <th>Balance HTG</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8">Chargement...</td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8">Aucun utilisateur trouvé</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.user_id}>
                        <td className="font-mono text-sm">{user.client_id}</td>
                        <td>{user.full_name}</td>
                        <td>{user.email}</td>
                        <td>
                          <Badge className={getKycBadge(user.kyc_status)}>
                            {user.kyc_status}
                          </Badge>
                        </td>
                        <td>${user.wallet_usd?.toFixed(2)}</td>
                        <td>G {user.wallet_htg?.toLocaleString()}</td>
                        <td>
                          <Badge className={user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                            {user.is_active ? 'Actif' : 'Bloqué'}
                          </Badge>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => viewUser(user.user_id)}>
                              <Eye size={16} />
                            </Button>
                            <Button 
                              size="sm" 
                              variant={user.is_active ? 'destructive' : 'default'}
                              onClick={() => toggleUserStatus(user.user_id, user.is_active)}
                            >
                              <Ban size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* User Detail Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Détails utilisateur</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Nom complet</p>
                    <p className="font-medium">{selectedUser.user.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Client ID</p>
                    <p className="font-mono">{selectedUser.user.client_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <p>{selectedUser.user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Téléphone</p>
                    <p>{selectedUser.user.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Balance USD</p>
                    <p className="font-semibold text-emerald-600">${selectedUser.user.wallet_usd?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Balance HTG</p>
                    <p className="font-semibold text-blue-600">G {selectedUser.user.wallet_htg?.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Transactions récentes</h4>
                  {selectedUser.recent_transactions?.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedUser.recent_transactions.map((tx) => (
                        <div key={tx.transaction_id} className="flex justify-between p-2 bg-slate-50 rounded">
                          <span className="capitalize">{tx.type.replace('_', ' ')}</span>
                          <span className={tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                            {tx.amount >= 0 ? '+' : ''}{tx.currency === 'USD' ? '$' : 'G '}{Math.abs(tx.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500">Aucune transaction</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
