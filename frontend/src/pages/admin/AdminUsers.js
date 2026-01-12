import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { API_BASE as API } from '@/lib/utils';
import { toast } from 'sonner';
import axios from 'axios';
import { Search, Eye, Ban, DollarSign, RefreshCw, UserX, CheckCircle, Edit, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function AdminUsers() {
  const { getText } = useLanguage();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ email: '', phone: '', full_name: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
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
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const viewUser = async (userId) => {
    try {
      const response = await axios.get(`${API}/admin/users/${userId}`);
      setSelectedUser(response.data);
      setEditForm({
        email: response.data.user.email || '',
        phone: response.data.user.phone || '',
        full_name: response.data.user.full_name || ''
      });
      setEditing(false);
      setShowModal(true);
    } catch (error) {
      toast.error(getText('Erè pandan chajman', 'Erreur lors du chargement', 'Error loading'));
    }
  };

  const saveUserInfo = async () => {
    if (!selectedUser) return;
    
    setSavingEdit(true);
    try {
      await axios.patch(`${API}/admin/users/${selectedUser.user.user_id}/info`, editForm);
      toast.success(getText('Enfòmasyon kliyan mete ajou!', 'Informations client mises à jour!', 'Client info updated!'));
      setEditing(false);
      
      // Refresh the user data
      const response = await axios.get(`${API}/admin/users/${selectedUser.user.user_id}`);
      setSelectedUser(response.data);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || getText('Erè pandan mizajou', 'Erreur lors de la mise à jour', 'Error updating'));
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await axios.patch(`${API}/admin/users/${userId}/status`, {
        is_active: !currentStatus
      });
      toast.success(getText('Statis mete ajou', 'Statut mis à jour', 'Status updated'));
      fetchUsers();
    } catch (error) {
      toast.error(getText('Erè pandan mizajou', 'Erreur lors de la mise à jour', 'Error updating'));
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

  const getKycText = (status) => {
    if (status === 'approved') return getText('Verifye', 'Vérifié', 'Verified');
    if (status === 'pending') return getText('An atant', 'En attente', 'Pending');
    if (status === 'rejected') return getText('Rejte', 'Rejeté', 'Rejected');
    return getText('Pa soumèt', 'Non soumis', 'Not submitted');
  };

  return (
    <AdminLayout title={getText('Jesyon Kliyan', 'Gestion des clients', 'Client Management')}>
      <div className="space-y-6" data-testid="admin-users">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-blue-50 dark:bg-blue-900/30">
            <CardContent className="p-4 text-center">
              <p className="text-blue-800 dark:text-blue-300 font-bold text-2xl">{users.length}</p>
              <p className="text-blue-600 dark:text-blue-400 text-sm">{getText('Total Kliyan', 'Total Clients', 'Total Clients')}</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 dark:bg-emerald-900/30">
            <CardContent className="p-4 text-center">
              <p className="text-emerald-800 dark:text-emerald-300 font-bold text-2xl">{users.filter(u => u.kyc_status === 'approved').length}</p>
              <p className="text-emerald-600 dark:text-emerald-400 text-sm">{getText('KYC Verifye', 'KYC Vérifié', 'KYC Verified')}</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-900/30">
            <CardContent className="p-4 text-center">
              <p className="text-amber-800 dark:text-amber-300 font-bold text-2xl">{users.filter(u => u.kyc_status === 'pending').length}</p>
              <p className="text-amber-600 dark:text-amber-400 text-sm">{getText('KYC An Atant', 'KYC En Attente', 'KYC Pending')}</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-900/30">
            <CardContent className="p-4 text-center">
              <p className="text-red-800 dark:text-red-300 font-bold text-2xl">{users.filter(u => !u.is_active).length}</p>
              <p className="text-red-600 dark:text-red-400 text-sm">{getText('Bloke', 'Bloqués', 'Blocked')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <Input
                placeholder={getText('Chèche pa imèl, non oswa ID...', 'Rechercher par email, nom ou ID...', 'Search by email, name or ID...')}
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
              <span>{getText('Lis Kliyan', 'Liste des clients', 'Client List')} ({users.length})</span>
              <Button variant="outline" size="sm" onClick={fetchUsers}>
                <RefreshCw size={16} className="mr-2" />
                {getText('Aktyalize', 'Actualiser', 'Refresh')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client ID</th>
                    <th>{getText('Non', 'Nom', 'Name')}</th>
                    <th>{getText('Imèl', 'Email', 'Email')}</th>
                    <th>KYC</th>
                    <th>{getText('Balans USD', 'Solde USD', 'USD Balance')}</th>
                    <th>{getText('Balans HTG', 'Solde HTG', 'HTG Balance')}</th>
                    <th>{getText('Statis', 'Statut', 'Status')}</th>
                    <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8">{getText('Pa gen kliyan', 'Aucun client', 'No clients')}</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.user_id}>
                        <td className="font-mono text-sm">{user.client_id}</td>
                        <td>{user.full_name}</td>
                        <td>{user.email}</td>
                        <td>
                          <Badge className={getKycBadge(user.kyc_status)}>
                            {getKycText(user.kyc_status)}
                          </Badge>
                        </td>
                        <td className="font-semibold text-emerald-600">${user.wallet_usd?.toFixed(2)}</td>
                        <td className="font-semibold text-blue-600">G {user.wallet_htg?.toLocaleString()}</td>
                        <td>
                          <Badge className={user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                            {user.is_active ? getText('Aktif', 'Actif', 'Active') : getText('Bloke', 'Bloqué', 'Blocked')}
                          </Badge>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => viewUser(user.user_id)} title={getText('Wè detay', 'Voir détails', 'View details')}>
                              <Eye size={16} />
                            </Button>
                            <Button 
                              size="sm" 
                              variant={user.is_active ? 'destructive' : 'default'}
                              onClick={() => toggleUserStatus(user.user_id, user.is_active)}
                              title={user.is_active ? getText('Bloke', 'Bloquer', 'Block') : getText('Debloke', 'Débloquer', 'Unblock')}
                            >
                              {user.is_active ? <UserX size={16} /> : <CheckCircle size={16} />}
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
              <DialogTitle className="flex items-center justify-between">
                <span>{getText('Detay Kliyan', 'Détails du client', 'Client Details')}</span>
                {selectedUser && !editing && (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    <Edit size={16} className="mr-2" />
                    {getText('Modifye', 'Modifier', 'Edit')}
                  </Button>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                {editing ? (
                  /* Edit Mode */
                  <div className="space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 mb-4">
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        {getText('Modifye enfòmasyon kliyan an', 'Modifier les informations du client', 'Edit client information')}
                      </p>
                    </div>
                    
                    <div>
                      <Label>{getText('Non konplè', 'Nom complet', 'Full name')}</Label>
                      <Input
                        value={editForm.full_name}
                        onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label>{getText('Imèl', 'Email', 'Email')}</Label>
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label>{getText('Telefòn', 'Téléphone', 'Phone')}</Label>
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                        className="mt-1"
                        placeholder="+509 00 00 0000"
                      />
                    </div>
                    
                    <div className="flex gap-4 pt-4 border-t">
                      <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">
                        {getText('Anile', 'Annuler', 'Cancel')}
                      </Button>
                      <Button 
                        onClick={saveUserInfo}
                        disabled={savingEdit}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                      >
                        <Save size={16} className="mr-2" />
                        {savingEdit ? getText('Anrejistreman...', 'Enregistrement...', 'Saving...') : getText('Anrejistre', 'Enregistrer', 'Save')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">{getText('Non konplè', 'Nom complet', 'Full name')}</p>
                        <p className="font-medium">{selectedUser.user.full_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Client ID</p>
                        <p className="font-mono">{selectedUser.user.client_id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{getText('Imèl', 'Email', 'Email')}</p>
                        <p>{selectedUser.user.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{getText('Telefòn', 'Téléphone', 'Phone')}</p>
                        <p>{selectedUser.user.phone || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{getText('Balans USD', 'Solde USD', 'USD Balance')}</p>
                        <p className="font-semibold text-emerald-600">${selectedUser.user.wallet_usd?.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{getText('Balans HTG', 'Solde HTG', 'HTG Balance')}</p>
                        <p className="font-semibold text-blue-600">G {selectedUser.user.wallet_htg?.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-2">{getText('Dènye Tranzaksyon', 'Transactions récentes', 'Recent Transactions')}</h4>
                      {selectedUser.recent_transactions?.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedUser.recent_transactions.map((tx) => (
                            <div key={tx.transaction_id} className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                              <span className="capitalize">{tx.type.replace('_', ' ')}</span>
                              <span className={tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                                {tx.amount >= 0 ? '+' : ''}{tx.currency === 'USD' ? '$' : 'G '}{Math.abs(tx.amount).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500">{getText('Pa gen tranzaksyon', 'Aucune transaction', 'No transactions')}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
