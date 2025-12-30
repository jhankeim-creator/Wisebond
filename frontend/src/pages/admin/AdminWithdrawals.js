import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { Check, X, Eye, RefreshCw, User, Phone, Mail, Wallet } from 'lucide-react';

import { API_BASE } from '@/lib/utils';
const API = API_BASE;

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);

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
      toast.success(action === 'approve' ? 'Retrait approuvé!' : 'Retrait rejeté (montant remboursé)');
      setShowModal(false);
      fetchWithdrawals();
    } catch (error) {
      toast.error('Erreur lors du traitement');
    } finally {
      setProcessing(false);
    }
  };

  const fmt = (amount, currency) => {
    if (currency === 'HTG') return `G ${Number(amount || 0).toLocaleString()}`;
    return `$${Number(amount || 0).toFixed(2)}`;
  };

  return (
    <AdminLayout title="Gestion des retraits">
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
                  className={filter === f ? 'bg-[#0047AB]' : ''}
                >
                  {f === 'pending' ? 'En attente' : f === 'completed' ? 'Complétés' : f === 'rejected' ? 'Rejetés' : 'Tous'}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={fetchWithdrawals} className="ml-auto">
                <RefreshCw size={16} className="mr-2" />
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Withdrawals Table */}
        <Card>
          <CardHeader>
            <CardTitle>Retraits ({withdrawals.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client ID</th>
                    <th>Montant</th>
                    <th>Frais</th>
                    <th>Net</th>
                    <th>Méthode</th>
                    <th>Destination</th>
                    <th>Date</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="text-center py-8">Chargement...</td>
                    </tr>
                  ) : withdrawals.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-8">Aucun retrait</td>
                    </tr>
                  ) : (
                    withdrawals.map((w) => (
                      <tr key={w.withdrawal_id}>
                        <td className="font-mono text-sm">{w.client_id}</td>
                        <td>{fmt(w.amount, w.currency)}</td>
                        <td className="text-red-500">-{fmt(w.fee, w.currency)}</td>
                        <td className="font-semibold text-emerald-600">{fmt(w.net_amount, w.currency)}</td>
                        <td className="capitalize">{w.method?.replace('_', ' ')}</td>
                        <td className="max-w-[150px] truncate">{w.destination}</td>
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
              <DialogTitle>Détails du retrait</DialogTitle>
            </DialogHeader>
            {selectedWithdrawal && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Client ID</p>
                    <p className="font-mono">{selectedWithdrawal.client_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Montant brut</p>
                    <p className="font-semibold">{fmt(selectedWithdrawal.amount, selectedWithdrawal.currency)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Frais</p>
                    <p className="text-red-500">-{fmt(selectedWithdrawal.fee, selectedWithdrawal.currency)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Montant net</p>
                    <p className="font-semibold text-emerald-600">{fmt(selectedWithdrawal.net_amount, selectedWithdrawal.currency)}</p>
                  </div>
                </div>

                {selectedWithdrawal.source_currency && selectedWithdrawal.source_currency !== selectedWithdrawal.currency && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    Déduit du solde {selectedWithdrawal.source_currency}: {fmt(selectedWithdrawal.amount_deducted, selectedWithdrawal.source_currency)} (conversion)
                  </div>
                )}

                <div>
                  <p className="text-sm text-slate-500">Méthode</p>
                  <p className="capitalize">{selectedWithdrawal.method?.replace('_', ' ')}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Destination</p>
                  <code className="text-sm bg-slate-100 dark:bg-slate-800 p-2 rounded block break-all text-slate-900 dark:text-slate-100">
                    {selectedWithdrawal.destination}
                  </code>
                </div>

                {/* Client Info */}
                {selectedWithdrawal.client_info && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                    <p className="font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <User size={16} />
                      Informations Client
                    </p>
                    <div className="text-sm space-y-1 text-blue-700 dark:text-blue-400">
                      <div className="flex items-center gap-2">
                        <User size={14} />
                        <span>{selectedWithdrawal.client_info.full_name || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail size={14} />
                        <span>{selectedWithdrawal.client_info.email || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={14} />
                        <span>{selectedWithdrawal.client_info.phone || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wallet size={14} />
                        <span>USD: ${selectedWithdrawal.client_info.wallet_usd?.toFixed(2) || '0.00'} | HTG: G {selectedWithdrawal.client_info.wallet_htg?.toLocaleString() || '0'}</span>
                      </div>
                    </div>
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
                      Approuver
                    </Button>
                    <Button 
                      onClick={() => handleProcess('reject')}
                      disabled={processing}
                      variant="destructive"
                      className="flex-1"
                    >
                      <X size={18} className="mr-2" />
                      Rejeter
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
