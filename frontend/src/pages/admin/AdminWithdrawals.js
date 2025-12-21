import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { Check, X, Eye, RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchWithdrawals();
  }, [filter]);

  const fetchWithdrawals = async () => {
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
  };

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
                        <td>${w.amount?.toFixed(2)}</td>
                        <td className="text-red-500">-${w.fee?.toFixed(2)}</td>
                        <td className="font-semibold text-emerald-600">${w.net_amount?.toFixed(2)}</td>
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
                    <p className="font-semibold">${selectedWithdrawal.amount?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Frais</p>
                    <p className="text-red-500">-${selectedWithdrawal.fee?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Montant net</p>
                    <p className="font-semibold text-emerald-600">${selectedWithdrawal.net_amount?.toFixed(2)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-500">Méthode</p>
                  <p className="capitalize">{selectedWithdrawal.method?.replace('_', ' ')}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">Destination</p>
                  <code className="text-sm bg-slate-100 p-2 rounded block break-all">
                    {selectedWithdrawal.destination}
                  </code>
                </div>

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
