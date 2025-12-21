import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';
import { Check, X, Eye, RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminKYC() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedKyc, setSelectedKyc] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [filter]);

  const fetchSubmissions = async () => {
    try {
      let url = `${API}/admin/kyc`;
      if (filter !== 'all') url += `?status=${filter}`;
      const response = await axios.get(url);
      setSubmissions(response.data.submissions);
    } catch (error) {
      console.error('Error fetching KYC:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (action) => {
    if (action === 'reject' && !rejectReason) {
      toast.error('Veuillez indiquer une raison de rejet');
      return;
    }

    setProcessing(true);
    try {
      let url = `${API}/admin/kyc/${selectedKyc.kyc_id}?action=${action}`;
      if (action === 'reject') url += `&rejection_reason=${encodeURIComponent(rejectReason)}`;
      
      await axios.patch(url);
      toast.success(action === 'approve' ? 'KYC approuvé!' : 'KYC rejeté');
      setShowModal(false);
      setRejectReason('');
      fetchSubmissions();
    } catch (error) {
      toast.error('Erreur lors du traitement');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AdminLayout title="Vérification KYC">
      <div className="space-y-6" data-testid="admin-kyc">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              {['pending', 'approved', 'rejected', 'all'].map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className={filter === f ? 'bg-[#0047AB]' : ''}
                >
                  {f === 'pending' ? 'En attente' : f === 'approved' ? 'Approuvés' : f === 'rejected' ? 'Rejetés' : 'Tous'}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={fetchSubmissions} className="ml-auto">
                <RefreshCw size={16} className="mr-2" />
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KYC Table */}
        <Card>
          <CardHeader>
            <CardTitle>Demandes KYC ({submissions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client ID</th>
                    <th>Nom</th>
                    <th>Nationalité</th>
                    <th>Type ID</th>
                    <th>Soumis le</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8">Chargement...</td>
                    </tr>
                  ) : submissions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8">Aucune demande</td>
                    </tr>
                  ) : (
                    submissions.map((kyc) => (
                      <tr key={kyc.kyc_id}>
                        <td className="font-mono text-sm">{kyc.client_id}</td>
                        <td>{kyc.nationality}</td>
                        <td>{kyc.nationality}</td>
                        <td className="capitalize">{kyc.id_type?.replace('_', ' ')}</td>
                        <td>{new Date(kyc.submitted_at).toLocaleDateString()}</td>
                        <td>
                          <Badge className={
                            kyc.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            kyc.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }>
                            {kyc.status}
                          </Badge>
                        </td>
                        <td>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => { setSelectedKyc(kyc); setShowModal(true); }}
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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Vérification KYC - {selectedKyc?.client_id}</DialogTitle>
            </DialogHeader>
            {selectedKyc && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Date de naissance</p>
                    <p className="font-medium">{selectedKyc.date_of_birth}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Nationalité</p>
                    <p className="font-medium">{selectedKyc.nationality}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-slate-500">Adresse</p>
                    <p className="font-medium">{selectedKyc.address}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-2">ID Recto</p>
                    {selectedKyc.id_front_image ? (
                      <img 
                        src={selectedKyc.id_front_image} 
                        alt="ID Front" 
                        className="rounded-lg border w-full h-40 object-cover"
                      />
                    ) : (
                      <div className="h-40 bg-slate-100 rounded-lg flex items-center justify-center">
                        Non fourni
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-2">ID Verso</p>
                    {selectedKyc.id_back_image ? (
                      <img 
                        src={selectedKyc.id_back_image} 
                        alt="ID Back" 
                        className="rounded-lg border w-full h-40 object-cover"
                      />
                    ) : (
                      <div className="h-40 bg-slate-100 rounded-lg flex items-center justify-center">
                        Non fourni
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-2">Selfie avec ID</p>
                    {selectedKyc.selfie_image ? (
                      <img 
                        src={selectedKyc.selfie_image} 
                        alt="Selfie" 
                        className="rounded-lg border w-full h-40 object-cover"
                      />
                    ) : (
                      <div className="h-40 bg-slate-100 rounded-lg flex items-center justify-center">
                        Non fourni
                      </div>
                    )}
                  </div>
                </div>

                {selectedKyc.status === 'pending' && (
                  <>
                    <div>
                      <p className="text-sm text-slate-500 mb-2">Raison de rejet (si applicable)</p>
                      <Textarea
                        placeholder="Ex: Document illisible, photo floue..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-4">
                      <Button 
                        onClick={() => handleReview('approve')}
                        disabled={processing}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                      >
                        <Check size={18} className="mr-2" />
                        Approuver
                      </Button>
                      <Button 
                        onClick={() => handleReview('reject')}
                        disabled={processing}
                        variant="destructive"
                        className="flex-1"
                      >
                        <X size={18} className="mr-2" />
                        Rejeter
                      </Button>
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
