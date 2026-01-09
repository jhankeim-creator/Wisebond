import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { API_BASE as API } from '@/lib/utils';
import { toast } from 'sonner';
import axios from 'axios';
import { Check, X, Eye, RefreshCw } from 'lucide-react';

export default function AdminWithdrawals() {
  const { language } = useLanguage();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}/admin/withdrawals`;
      if (filter !== 'all') url += `?status=${filter}`;
      const response = await axios.get(url);
      setWithdrawals(response.data.withdrawals);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const handleProcess = async (action) => {
    setProcessing(true);
    try {
      await axios.patch(`${API}/admin/withdrawals/${selectedWithdrawal.withdrawal_id}?action=${action}`);
      toast.success(action === 'approve' 
        ? getText('Retrè apwouve!', 'Retrait approuvé!', 'Withdrawal approved!') 
        : getText('Retrè rejte (lajan ranbouse)', 'Retrait rejeté (montant remboursé)', 'Withdrawal rejected (amount refunded)'));
      setShowModal(false);
      fetchWithdrawals();
    } catch (error) {
      toast.error(getText('Erè pandan tretman', 'Erreur lors du traitement', 'Error processing'));
    } finally {
      setProcessing(false);
    }
  };

  const fmt = (amount, currency) => {
    if (currency === 'HTG') return `G ${Number(amount || 0).toLocaleString()}`;
    return `$${Number(amount || 0).toFixed(2)}`;
  };

  const getMethodName = (w) => w?.payment_method_name || w?.method || '—';
  const isDataUrl = (v) => typeof v === 'string' && v.startsWith('data:');

  return (
    <AdminLayout title={getText('Jesyon Retrè', 'Gestion des retraits', 'Withdrawal Management')}>
      <div className="space-y-6" data-testid="admin-withdrawals">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              {['pending', 'completed', 'rejected', 'all'].map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className={filter === f ? 'bg-[#EA580C]' : ''}
                >
                  {f === 'pending' ? getText('An Atant', 'En attente', 'Pending') : 
                   f === 'completed' ? getText('Konplete', 'Complétés', 'Completed') : 
                   f === 'rejected' ? getText('Rejte', 'Rejetés', 'Rejected') : 
                   getText('Tout', 'Tous', 'All')}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={fetchWithdrawals} className="ml-auto">
                <RefreshCw size={16} className="mr-2" />
                {getText('Aktyalize', 'Actualiser', 'Refresh')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Withdrawals Table */}
        <Card>
          <CardHeader>
            <CardTitle>{getText('Retrè', 'Retraits', 'Withdrawals')} ({withdrawals.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client ID</th>
                    <th>{getText('Montan', 'Montant', 'Amount')}</th>
                    <th>{getText('Frè', 'Frais', 'Fee')}</th>
                    <th>{getText('Nèt', 'Net', 'Net')}</th>
                    <th>{getText('Metòd', 'Méthode', 'Method')}</th>
                    <th>{getText('Destinasyon', 'Destination', 'Destination')}</th>
                    <th>Date</th>
                    <th>{getText('Statis', 'Statut', 'Status')}</th>
                    <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</td>
                    </tr>
                  ) : withdrawals.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-8">{getText('Pa gen retrè', 'Aucun retrait', 'No withdrawals')}</td>
                    </tr>
                  ) : (
                    withdrawals.map((w) => (
                      <tr key={w.withdrawal_id}>
                        <td className="font-mono text-sm">{w.client_id}</td>
                        <td>{fmt(w.amount, w.currency)}</td>
                        <td className="text-red-500">-{fmt(w.fee, w.currency)}</td>
                        <td className="font-semibold text-emerald-600">{fmt(w.net_amount, w.currency)}</td>
                        <td className="capitalize">{getMethodName(w)}</td>
                        <td className="max-w-[150px] truncate">
                          {w.destination || (w.field_values ? Object.values(w.field_values)[0] : '')}
                        </td>
                        <td>{new Date(w.created_at).toLocaleDateString()}</td>
                        <td>
                          <Badge className={
                            w.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            w.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }>
                            {w.status}
                          </Badge>
                        </td>
                        <td>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => { setSelectedWithdrawal(w); setShowModal(true); }}
                          >
                            <Eye size={16} />
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

        {/* Review Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{getText('Detay Retrè', 'Détails du retrait', 'Withdrawal Details')}</DialogTitle>
            </DialogHeader>
            {selectedWithdrawal && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Client ID</p>
                    <p className="font-mono">{selectedWithdrawal.client_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{getText('Montan brit', 'Montant brut', 'Gross Amount')}</p>
                    <p className="font-semibold">{fmt(selectedWithdrawal.amount, selectedWithdrawal.currency)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{getText('Frè', 'Frais', 'Fee')}</p>
                    <p className="text-red-500">-{fmt(selectedWithdrawal.fee, selectedWithdrawal.currency)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{getText('Montan nèt', 'Montant net', 'Net Amount')}</p>
                    <p className="font-semibold text-emerald-600">{fmt(selectedWithdrawal.net_amount, selectedWithdrawal.currency)}</p>
                  </div>
                </div>

                {selectedWithdrawal.source_currency && selectedWithdrawal.source_currency !== selectedWithdrawal.currency && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    {getText('Dedwi nan balans', 'Déduit du solde', 'Deducted from balance')} {selectedWithdrawal.source_currency}: {fmt(selectedWithdrawal.amount_deducted, selectedWithdrawal.source_currency)} ({getText('konvèsyon', 'conversion', 'conversion')})
                  </div>
                )}

                <div>
                  <p className="text-sm text-slate-500">{getText('Metòd', 'Méthode', 'Method')}</p>
                  <p className="capitalize">{getMethodName(selectedWithdrawal)}</p>
                </div>

                {selectedWithdrawal.field_values && Object.keys(selectedWithdrawal.field_values).length > 0 ? (
                  <div className="border rounded-lg p-3">
                    <p className="text-sm text-slate-500 mb-2">{getText('Chan yo', 'Champs', 'Fields')}</p>
                    <div className="space-y-2">
                      {Object.entries(selectedWithdrawal.field_values).map(([k, v]) => (
                        <div key={k} className="text-sm">
                          <p className="text-slate-500">{k}</p>
                          {isDataUrl(v) ? (
                            <img src={v} alt={k} className="mt-1 rounded border max-w-full max-h-64 object-contain" />
                          ) : (
                            <code className="text-sm bg-slate-100 dark:bg-slate-800 p-2 rounded block break-all">
                              {String(v)}
                            </code>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-slate-500">{getText('Destinasyon', 'Destination', 'Destination')}</p>
                    <code className="text-sm bg-slate-100 dark:bg-slate-800 p-2 rounded block break-all">
                      {selectedWithdrawal.destination || '—'}
                    </code>
                  </div>
                )}

                {selectedWithdrawal.status === 'pending' && (
                  <div className="flex gap-4 pt-4 border-t">
                    <Button 
                      onClick={() => handleProcess('approve')}
                      disabled={processing}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                    >
                      <Check size={18} className="mr-2" />
                      {getText('Apwouve', 'Approuver', 'Approve')}
                    </Button>
                    <Button 
                      onClick={() => handleProcess('reject')}
                      disabled={processing}
                      variant="destructive"
                      className="flex-1"
                    >
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
