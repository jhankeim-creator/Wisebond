import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { Check, X, Eye, RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminDeposits() {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}/admin/deposits`;
      if (filter !== 'all') url += `?status=${filter}`;
      const response = await axios.get(url);
      setDeposits(response.data.deposits);
    } catch (error) {
      console.error('Error fetching deposits:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  const handleProcess = async (action) => {
    setProcessing(true);
    try {
      await axios.patch(`${API}/admin/deposits/${selectedDeposit.deposit_id}?action=${action}`);
      toast.success(action === 'approve' ? 'Dépôt approuvé!' : 'Dépôt rejeté');
      setShowModal(false);
      fetchDeposits();
    } catch (error) {
      toast.error('Erreur lors du traitement');
    } finally {
      setProcessing(false);
    }
  };

  const viewDeposit = async (depositId) => {
    try {
      const response = await axios.get(`${API}/admin/deposits/${depositId}`);
      setSelectedDeposit(response.data.deposit);
      setShowModal(true);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
  };

  const syncProvider = async () => {
    try {
      const resp = await axios.post(`${API}/admin/deposits/${selectedDeposit.deposit_id}/sync-provider`);
      setSelectedDeposit(resp.data.deposit);
      toast.success('Mise à jour effectuée');
    } catch (e) {
      toast.error('Erreur lors du sync');
    }
  };

  return (
    <AdminLayout title="Gestion des dépôts">
      <div className="space-y-6" data-testid="admin-deposits">
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
              <Button variant="outline" size="sm" onClick={fetchDeposits} className="ml-auto">
                <RefreshCw size={16} className="mr-2" />
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Deposits Table */}
        <Card>
          <CardHeader>
            <CardTitle>Dépôts ({deposits.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client ID</th>
                    <th>Montant</th>
                    <th>Méthode</th>
                    <th>Date</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8">Chargement...</td>
                    </tr>
                  ) : deposits.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8">Aucun dépôt</td>
                    </tr>
                  ) : (
                    deposits.map((deposit) => (
                      <tr key={deposit.deposit_id}>
                        <td className="font-mono text-sm">{deposit.client_id}</td>
                        <td className="font-semibold">
                          {deposit.currency === 'USD' ? '$' : 'G '}{deposit.amount?.toLocaleString()}
                        </td>
                        <td className="capitalize">{deposit.method?.replace('_', ' ')}</td>
                        <td>{new Date(deposit.created_at).toLocaleString()}</td>
                        <td>
                          <Badge className={
                            deposit.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            deposit.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }>
                            {deposit.status}
                          </Badge>
                        </td>
                        <td>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => viewDeposit(deposit.deposit_id)}
                          >
                            <Eye size={16} className="mr-2" />
                            Voir
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Détails du dépôt</DialogTitle>
            </DialogHeader>
            {selectedDeposit && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Client ID</p>
                    <p className="font-mono">{selectedDeposit.client_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Montant</p>
                    <p className="font-semibold text-lg">
                      {selectedDeposit.currency === 'USD' ? '$' : 'G '}{selectedDeposit.amount?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Méthode</p>
                    <p className="capitalize">{selectedDeposit.method?.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Date</p>
                    <p>{new Date(selectedDeposit.created_at).toLocaleString()}</p>
                  </div>
                </div>

                {selectedDeposit.provider === 'plisio' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="font-medium text-amber-800 mb-2">Plisio</p>
                    <div className="text-sm space-y-1">
                      <div><span className="text-slate-600">Status:</span> <span className="font-semibold">{selectedDeposit.provider_status || selectedDeposit.status}</span></div>
                      <div><span className="text-slate-600">Txn:</span> <code className="text-xs bg-white p-1 rounded">{selectedDeposit.plisio_txn_id || '-'}</code></div>
                      {selectedDeposit.plisio_invoice_url && (
                        <div>
                          <span className="text-slate-600">Invoice URL:</span>{' '}
                          <a className="text-[#EA580C] hover:underline break-all" href={selectedDeposit.plisio_invoice_url} target="_blank" rel="noreferrer">
                            {selectedDeposit.plisio_invoice_url}
                          </a>
                        </div>
                      )}
                      {selectedDeposit.plisio_currency && (
                        <div><span className="text-slate-600">Network:</span> <span className="font-semibold">{selectedDeposit.plisio_currency}</span></div>
                      )}
                    </div>
                    <div className="mt-3">
                      <Button variant="outline" size="sm" onClick={syncProvider}>
                        Sync Plisio
                      </Button>
                    </div>
                  </div>
                )}

                {selectedDeposit.proof_image && (
                  <div>
                    <p className="text-sm text-slate-500 mb-2">Preuve de paiement</p>
                    <img 
                      src={selectedDeposit.proof_image} 
                      alt="Proof" 
                      className="rounded-lg border max-w-full max-h-64 object-contain"
                    />
                  </div>
                )}

                {selectedDeposit.wallet_address && (
                  <div>
                    <p className="text-sm text-slate-500">Adresse USDT</p>
                    <code className="text-sm bg-slate-100 p-2 rounded block break-all">
                      {selectedDeposit.wallet_address}
                    </code>
                  </div>
                )}

                {selectedDeposit.status === 'pending' && (
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
