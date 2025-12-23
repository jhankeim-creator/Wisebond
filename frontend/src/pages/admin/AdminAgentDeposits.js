import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { Check, X, Eye, RefreshCw, Users, DollarSign } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export default function AdminAgentDeposits() {
  const { language } = useLanguage();
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}/admin/agent-deposits`;
      if (filter !== 'all') url += `?status=${filter}`;
      const response = await axios.get(url);
      setDeposits(response.data.deposits || []);
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
      await axios.patch(`${API}/admin/agent-deposits/${selectedDeposit.deposit_id}?action=${action}`);
      toast.success(action === 'approve' 
        ? getText('Depo apwouve! Notifikasyon WhatsApp voye bay ajan an.', 'Dépôt approuvé! Notification WhatsApp envoyée.', 'Deposit approved! WhatsApp notification sent.')
        : getText('Depo rejte', 'Dépôt rejeté', 'Deposit rejected'));
      setShowModal(false);
      fetchDeposits();
    } catch (error) {
      toast.error(getText('Erè pandan tretman', 'Erreur lors du traitement', 'Error processing'));
    } finally {
      setProcessing(false);
    }
  };

  const viewDeposit = async (depositId) => {
    try {
      const response = await axios.get(`${API}/admin/agent-deposits/${depositId}`);
      setSelectedDeposit(response.data.deposit);
      setShowModal(true);
    } catch (error) {
      toast.error(getText('Erè pandan chajman', 'Erreur lors du chargement', 'Error loading'));
    }
  };

  // Calculate totals
  const pendingCount = deposits.filter(d => d.status === 'pending').length;
  const approvedCount = deposits.filter(d => d.status === 'approved').length;
  const totalUSD = deposits.filter(d => d.status === 'approved').reduce((sum, d) => sum + d.amount_usd, 0);

  return (
    <AdminLayout title={getText('Depo Ajan', 'Dépôts Agent', 'Agent Deposits')}>
      <div className="space-y-6" data-testid="admin-agent-deposits">
        
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Users className="text-amber-600 dark:text-amber-400" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-900 dark:text-white">{pendingCount}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{getText('An Atant', 'En Attente', 'Pending')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Check className="text-emerald-600 dark:text-emerald-400" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-900 dark:text-white">{approvedCount}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{getText('Apwouve', 'Approuvés', 'Approved')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <DollarSign className="text-blue-600 dark:text-blue-400" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-900 dark:text-white">${totalUSD.toLocaleString()}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{getText('Total USD', 'Total USD', 'Total USD')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <DollarSign className="text-purple-600 dark:text-purple-400" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-900 dark:text-white">
                    ${deposits.filter(d => d.status === 'approved').reduce((sum, d) => sum + d.commission_usd, 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{getText('Komisyon Peye', 'Commission Payée', 'Commission Paid')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2 flex-wrap">
              {['pending', 'approved', 'rejected', 'all'].map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className={filter === f ? 'bg-[#0047AB]' : ''}
                >
                  {f === 'pending' ? getText('An Atant', 'En Attente', 'Pending') : 
                   f === 'approved' ? getText('Apwouve', 'Approuvés', 'Approved') : 
                   f === 'rejected' ? getText('Rejte', 'Rejetés', 'Rejected') : 
                   getText('Tout', 'Tous', 'All')}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={fetchDeposits} className="ml-auto">
                <RefreshCw size={16} className="mr-2" />
                {getText('Aktyalize', 'Actualiser', 'Refresh')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Deposits Table */}
        <Card>
          <CardHeader>
            <CardTitle>{getText('Depo Ajan', 'Dépôts Agent', 'Agent Deposits')} ({deposits.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{getText('Ajan', 'Agent', 'Agent')}</th>
                    <th>{getText('Kliyan', 'Client', 'Client')}</th>
                    <th>{getText('Montan USD', 'Montant USD', 'USD Amount')}</th>
                    <th>{getText('HTG Resevwa', 'HTG Reçu', 'HTG Received')}</th>
                    <th>{getText('Komisyon', 'Commission', 'Commission')}</th>
                    <th>{getText('Dat', 'Date', 'Date')}</th>
                    <th>{getText('Estati', 'Statut', 'Status')}</th>
                    <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</td>
                    </tr>
                  ) : deposits.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8">{getText('Pa gen depo', 'Aucun dépôt', 'No deposits')}</td>
                    </tr>
                  ) : (
                    deposits.map((deposit) => (
                      <tr key={deposit.deposit_id}>
                        <td>
                          <div>
                            <p className="font-semibold">{deposit.agent_name}</p>
                            <p className="text-xs text-stone-500">{deposit.agent_client_id}</p>
                          </div>
                        </td>
                        <td>
                          <div>
                            <p className="font-semibold">{deposit.client_name}</p>
                            <p className="text-xs text-stone-500">{deposit.client_id}</p>
                          </div>
                        </td>
                        <td className="font-bold text-emerald-600">${deposit.amount_usd?.toLocaleString()}</td>
                        <td className="font-semibold">G {deposit.amount_htg_received?.toLocaleString()}</td>
                        <td className="font-semibold text-blue-600">${deposit.commission_usd?.toFixed(2)}</td>
                        <td className="text-sm">{new Date(deposit.created_at).toLocaleString()}</td>
                        <td>
                          <Badge className={
                            deposit.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            deposit.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }>
                            {deposit.status === 'approved' ? getText('Apwouve', 'Approuvé', 'Approved') :
                             deposit.status === 'pending' ? getText('An Atant', 'En Attente', 'Pending') :
                             getText('Rejte', 'Rejeté', 'Rejected')}
                          </Badge>
                        </td>
                        <td>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => viewDeposit(deposit.deposit_id)}
                          >
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

        {/* Review Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{getText('Detay Depo Ajan', 'Détails du Dépôt Agent', 'Agent Deposit Details')}</DialogTitle>
            </DialogHeader>
            {selectedDeposit && (
              <div className="space-y-4">
                {/* Agent Info */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                    {getText('Enfòmasyon Ajan', 'Informations Agent', 'Agent Information')}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">{getText('Non', 'Nom', 'Name')}</p>
                      <p className="font-semibold">{selectedDeposit.agent_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Client ID</p>
                      <p className="font-mono">{selectedDeposit.agent_client_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">{getText('Telefòn', 'Téléphone', 'Phone')}</p>
                      <p>{selectedDeposit.agent_phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">WhatsApp</p>
                      <p>{selectedDeposit.agent_whatsapp || selectedDeposit.agent_phone}</p>
                    </div>
                  </div>
                </div>

                {/* Client Info */}
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
                  <h4 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                    {getText('Enfòmasyon Kliyan', 'Informations Client', 'Client Information')}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">{getText('Non', 'Nom', 'Name')}</p>
                      <p className="font-semibold">{selectedDeposit.client_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">Client ID</p>
                      <p className="font-mono">{selectedDeposit.client_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">{getText('Telefòn', 'Téléphone', 'Phone')}</p>
                      <p>{selectedDeposit.client_phone}</p>
                    </div>
                  </div>
                </div>

                {/* Transaction Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4">
                    <p className="text-sm text-stone-500 dark:text-stone-400">{getText('Montan USD', 'Montant USD', 'USD Amount')}</p>
                    <p className="text-2xl font-bold text-emerald-600">${selectedDeposit.amount_usd?.toLocaleString()}</p>
                  </div>
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4">
                    <p className="text-sm text-stone-500 dark:text-stone-400">{getText('HTG Resevwa', 'HTG Reçu', 'HTG Received')}</p>
                    <p className="text-2xl font-bold">G {selectedDeposit.amount_htg_received?.toLocaleString()}</p>
                  </div>
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4">
                    <p className="text-sm text-stone-500 dark:text-stone-400">{getText('To Itilize', 'Taux Utilisé', 'Rate Used')}</p>
                    <p className="text-xl font-bold">1 USD = G {selectedDeposit.rate_used}</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                    <p className="text-sm text-purple-600 dark:text-purple-400">{getText('Komisyon Ajan', 'Commission Agent', 'Agent Commission')}</p>
                    <p className="text-xl font-bold text-purple-600">${selectedDeposit.commission_usd?.toFixed(2)} ({selectedDeposit.commission_percentage}%)</p>
                  </div>
                </div>

                {/* HTG Verification */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                  <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                    {getText('Verifikasyon HTG', 'Vérification HTG', 'HTG Verification')}
                  </p>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-amber-600">{getText('HTG Espere', 'HTG Attendu', 'Expected HTG')}</p>
                      <p className="font-bold">G {selectedDeposit.expected_htg?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-600">{getText('HTG Resevwa', 'HTG Reçu', 'Received HTG')}</p>
                      <p className="font-bold">G {selectedDeposit.amount_htg_received?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-600">{getText('Diferans', 'Différence', 'Difference')}</p>
                      <p className={`font-bold ${(selectedDeposit.amount_htg_received - selectedDeposit.expected_htg) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        G {(selectedDeposit.amount_htg_received - selectedDeposit.expected_htg).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Proof Image */}
                {selectedDeposit.proof_image && (
                  <div>
                    <p className="text-sm text-stone-500 dark:text-stone-400 mb-2">{getText('Prèv Peman', 'Preuve de Paiement', 'Payment Proof')}</p>
                    <img 
                      src={selectedDeposit.proof_image} 
                      alt="Proof" 
                      className="rounded-lg border max-w-full max-h-64 object-contain"
                    />
                  </div>
                )}

                {/* Date */}
                <div>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{getText('Dat Soumisyon', 'Date de Soumission', 'Submission Date')}</p>
                  <p>{new Date(selectedDeposit.created_at).toLocaleString()}</p>
                </div>

                {/* Actions */}
                {selectedDeposit.status === 'pending' && (
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
