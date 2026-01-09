import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { API_BASE as API } from '@/lib/utils';
import { toast } from 'sonner';
import axios from 'axios';
import { Check, X, Eye, RefreshCw, Wallet } from 'lucide-react';

export default function AdminAgentCommissionWithdrawals() {
  const { language } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  const getText = useCallback((ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  }, [language]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}/admin/agent-commission-withdrawals`;
      if (filter !== 'all') url += `?status=${filter}`;
      const res = await axios.get(url);
      setItems(res.data.withdrawals || []);
    } catch (e) {
      toast.error(getText('Erè pandan chajman', 'Erreur lors du chargement', 'Error loading'));
    } finally {
      setLoading(false);
    }
  }, [filter, getText]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openItem = (w) => {
    setSelected(w);
    setAdminNotes(w.admin_notes || '');
    setShowModal(true);
  };

  const process = async (action) => {
    if (!selected) return;
    setProcessing(true);
    try {
      const qs = `?action=${encodeURIComponent(action)}${adminNotes ? `&admin_notes=${encodeURIComponent(adminNotes)}` : ''}`;
      await axios.patch(`${API}/admin/agent-commission-withdrawals/${selected.withdrawal_id}${qs}`);
      toast.success(action === 'approve'
        ? getText('Retrè apwouve', 'Retrait approuvé', 'Withdrawal approved')
        : getText('Retrè rejte', 'Retrait rejeté', 'Withdrawal rejected')
      );
      setShowModal(false);
      fetchItems();
    } catch (e) {
      toast.error(e.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const approvedCount = items.filter(i => i.status === 'approved').length;
  const totalApproved = items.filter(i => i.status === 'approved').reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <AdminLayout title={getText('Retrè Komisyon Ajan', 'Retraits Commission Agent', 'Agent Commission Withdrawals')}>
      <div className="space-y-6" data-testid="admin-agent-commission-withdrawals">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-stone-500">{getText('An atant', 'En attente', 'Pending')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{approvedCount}</p>
              <p className="text-sm text-stone-500">{getText('Apwouve', 'Approuvé', 'Approved')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">${totalApproved.toFixed(2)}</p>
              <p className="text-sm text-stone-500">{getText('Total peye', 'Total payé', 'Total paid')}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2 flex-wrap">
              {['pending', 'approved', 'rejected', 'all'].map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className={filter === f ? 'bg-[#EA580C]' : ''}
                >
                  {f === 'pending' ? getText('An atant', 'En attente', 'Pending') :
                   f === 'approved' ? getText('Apwouve', 'Approuvé', 'Approved') :
                   f === 'rejected' ? getText('Rejte', 'Rejeté', 'Rejected') :
                   getText('Tout', 'Tous', 'All')}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={fetchItems} className="ml-auto">
                <RefreshCw size={16} className="mr-2" />
                {getText('Aktyalize', 'Actualiser', 'Refresh')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet size={18} className="text-[#EA580C]" />
              {getText('Demand retrè yo', 'Demandes de retrait', 'Withdrawal requests')} ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {loading ? (
                <div className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-stone-500">{getText('Pa gen', 'Aucun', 'None')}</div>
              ) : (
                items.map((w) => (
                  <div key={w.withdrawal_id} className="border rounded-xl p-4 bg-white dark:bg-stone-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{w.full_name || w.client_id}</p>
                        <p className="text-xs text-stone-500 font-mono">{w.client_id}</p>
                        <p className="mt-2 font-bold">${Number(w.amount || 0).toFixed(2)} USD</p>
                        <p className="text-xs text-stone-500 break-all">{w.payment_method_name}</p>
                        <p className="text-xs text-stone-400 mt-1">{new Date(w.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={
                          w.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          w.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }>
                          {w.status === 'approved' ? getText('Apwouve', 'Approuvé', 'Approved') :
                           w.status === 'pending' ? getText('An atant', 'En attente', 'Pending') :
                           getText('Rejte', 'Rejeté', 'Rejected')}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => openItem(w)}>
                          <Eye size={16} className="mr-2" />
                          {getText('Wè', 'Voir', 'View')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop table */}
            <div className="overflow-x-auto hidden md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{getText('Ajan', 'Agent', 'Agent')}</th>
                    <th>{getText('Metòd', 'Méthode', 'Method')}</th>
                    <th>{getText('Montan', 'Montant', 'Amount')}</th>
                    <th>{getText('Frè', 'Frais', 'Fee')}</th>
                    <th>{getText('Nèt', 'Net', 'Net')}</th>
                    <th>{getText('Dat', 'Date', 'Date')}</th>
                    <th>{getText('Stati', 'Statut', 'Status')}</th>
                    <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="8" className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan="8" className="text-center py-8">{getText('Pa gen', 'Aucun', 'None')}</td></tr>
                  ) : (
                    items.map((w) => (
                      <tr key={w.withdrawal_id}>
                        <td>
                          <div>
                            <p className="font-semibold">{w.full_name || '-'}</p>
                            <p className="text-xs text-stone-500 font-mono">{w.client_id}</p>
                          </div>
                        </td>
                        <td className="text-sm">{w.payment_method_name}</td>
                        <td className="font-bold">${Number(w.amount || 0).toFixed(2)}</td>
                        <td className="text-red-600">${Number(w.fee || 0).toFixed(2)}</td>
                        <td className="font-semibold">${Number(w.net_amount || 0).toFixed(2)}</td>
                        <td className="text-sm">{new Date(w.created_at).toLocaleString()}</td>
                        <td>
                          <Badge className={
                            w.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            w.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }>
                            {w.status}
                          </Badge>
                        </td>
                        <td>
                          <Button size="sm" variant="outline" onClick={() => openItem(w)}>
                            <Eye size={16} className="mr-2" />
                            {getText('Wè', 'Voir', 'View')}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{getText('Detay Retrè', 'Détails Retrait', 'Withdrawal Details')}</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3">
                    <p className="text-xs text-stone-500">{getText('Ajan', 'Agent', 'Agent')}</p>
                    <p className="font-semibold">{selected.full_name || '-'}</p>
                    <p className="text-xs text-stone-500 font-mono">{selected.client_id}</p>
                  </div>
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3">
                    <p className="text-xs text-stone-500">{getText('Metòd', 'Méthode', 'Method')}</p>
                    <p className="font-semibold">{selected.payment_method_name}</p>
                    <p className="text-xs text-stone-500 font-mono">{selected.payment_method_id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                    <p className="text-xs text-emerald-700">{getText('Montan', 'Montant', 'Amount')}</p>
                    <p className="text-lg font-bold">${Number(selected.amount || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                    <p className="text-xs text-red-700">{getText('Frè', 'Frais', 'Fee')}</p>
                    <p className="text-lg font-bold">${Number(selected.fee || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                    <p className="text-xs text-blue-700">{getText('Nèt', 'Net', 'Net')}</p>
                    <p className="text-lg font-bold">${Number(selected.net_amount || 0).toFixed(2)}</p>
                  </div>
                </div>

                {selected.field_values && Object.keys(selected.field_values).length > 0 && (
                  <div className="border rounded-xl p-4">
                    <p className="font-semibold mb-2">{getText('Enfòmasyon', 'Informations', 'Details')}</p>
                    <div className="space-y-2">
                      {Object.entries(selected.field_values).map(([k, v]) => (
                        <div key={k} className="text-sm">
                          <span className="text-stone-500">{k}:</span>{' '}
                          <span className="break-all">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-stone-500 mb-1">{getText('Nòt admin', 'Notes admin', 'Admin notes')}</p>
                  <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} />
                </div>

                {selected.status === 'pending' && (
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button onClick={() => process('approve')} disabled={processing} className="bg-emerald-600 hover:bg-emerald-700">
                      <Check size={18} className="mr-2" />
                      {getText('Apwouve', 'Approuver', 'Approve')}
                    </Button>
                    <Button onClick={() => process('reject')} disabled={processing} variant="destructive">
                      <X size={18} className="mr-2" />
                      {getText('Rejte', 'Rejeter', 'Reject')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

