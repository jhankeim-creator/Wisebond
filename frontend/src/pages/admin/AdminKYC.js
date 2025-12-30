import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';
import { Check, X, Eye, RefreshCw, ZoomIn, Download, ExternalLink } from 'lucide-react';

import { API_BASE } from '@/lib/utils';
const API = API_BASE;

// Image viewer component with zoom and download functionality
const ImageViewer = ({ label, src, alt }) => {
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleDownload = () => {
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = `${alt || 'image'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openInNewTab = () => {
    if (!src) return;
    const newWindow = window.open();
    newWindow.document.write(`<img src="${src}" style="max-width:100%;height:auto;" />`);
  };

  if (!src) {
    return (
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{label}</p>
        <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400">
          Non fourni
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{label}</p>
      <div className="relative group">
        {imageError ? (
          <div className="h-40 bg-red-50 dark:bg-red-900/20 rounded-lg flex flex-col items-center justify-center text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800">
            <X size={24} className="mb-2" />
            <span className="text-xs">Erreur de chargement</span>
            <Button 
              size="sm" 
              variant="outline" 
              className="mt-2"
              onClick={openInNewTab}
            >
              <ExternalLink size={14} className="mr-1" />
              Ouvrir
            </Button>
          </div>
        ) : (
          <>
            <img 
              src={src} 
              alt={alt} 
              className="rounded-lg border border-slate-200 dark:border-slate-700 w-full h-40 object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setShowFullscreen(true)}
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => setShowFullscreen(true)}
              >
                <ZoomIn size={16} />
              </Button>
              <Button 
                size="sm" 
                variant="secondary"
                onClick={handleDownload}
              >
                <Download size={16} />
              </Button>
              <Button 
                size="sm" 
                variant="secondary"
                onClick={openInNewTab}
              >
                <ExternalLink size={16} />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Fullscreen Modal */}
      {showFullscreen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowFullscreen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <img 
              src={src} 
              alt={alt} 
              className="w-full h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <Button 
                size="sm" 
                variant="secondary"
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
              >
                <Download size={16} className="mr-2" />
                Télécharger
              </Button>
              <Button 
                size="sm" 
                variant="secondary"
                onClick={(e) => { e.stopPropagation(); openInNewTab(); }}
              >
                <ExternalLink size={16} className="mr-2" />
                Nouvel onglet
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => setShowFullscreen(false)}
              >
                <X size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function AdminKYC() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedKyc, setSelectedKyc] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
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
  }, [filter]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const viewKyc = async (kycId) => {
    try {
      const response = await axios.get(`${API}/admin/kyc/${kycId}`);
      setSelectedKyc(response.data.kyc);
      setShowModal(true);
    } catch (error) {
      toast.error('Erreur lors du chargement');
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
                        <td>{kyc.full_name}</td>
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
                            onClick={() => viewKyc(kyc.kyc_id)}
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
                    <p className="font-medium">{selectedKyc.full_address}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <ImageViewer 
                    label="ID Recto" 
                    src={selectedKyc.id_front_image} 
                    alt="ID Front"
                  />
                  <ImageViewer 
                    label="ID Verso" 
                    src={selectedKyc.id_back_image} 
                    alt="ID Back"
                  />
                  <ImageViewer 
                    label="Selfie avec ID" 
                    src={selectedKyc.selfie_with_id} 
                    alt="Selfie"
                  />
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
