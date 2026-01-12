import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { Check, X, Eye, RefreshCw, UserCheck, Clock, XCircle, Users, ZoomIn, AlertCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export default function AdminKYC() {
  const { language } = useLanguage();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedKyc, setSelectedKyc] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const getText = useCallback((ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  }, [language]);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}/admin/kyc`;
      if (filter !== 'all') url += `?status=${filter}`;
      const response = await axios.get(url);
      setSubmissions(response.data.submissions || []);
    } catch (error) {
      console.error('Error fetching KYC:', error);
      toast.error(getText('Erè pandan chajman', 'Erreur lors du chargement', 'Error loading'));
    } finally {
      setLoading(false);
    }
  }, [filter, getText]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const viewKyc = async (kycId) => {
    try {
      const response = await axios.get(`${API}/admin/kyc/${kycId}`);
      setSelectedKyc(response.data.kyc);
      setShowModal(true);
    } catch (error) {
      toast.error(getText('Erè pandan chajman', 'Erreur lors du chargement', 'Error loading'));
    }
  };

  const handleReview = async (action) => {
    if (action === 'reject' && !rejectReason) {
      toast.error(getText('Tanpri endike rezon reje a', 'Veuillez indiquer une raison de rejet', 'Please enter a rejection reason'));
      return;
    }

    setProcessing(true);
    try {
      let url = `${API}/admin/kyc/${selectedKyc.kyc_id}?action=${action}`;
      if (action === 'reject') url += `&rejection_reason=${encodeURIComponent(rejectReason)}`;
      
      await axios.patch(url);
      toast.success(action === 'approve' 
        ? getText('KYC apwouve!', 'KYC approuvé!', 'KYC approved!')
        : getText('KYC rejte', 'KYC rejeté', 'KYC rejected'));
      setShowModal(false);
      setRejectReason('');
      fetchSubmissions();
    } catch (error) {
      toast.error(getText('Erè pandan tretman', 'Erreur lors du traitement', 'Error processing'));
    } finally {
      setProcessing(false);
    }
  };

  const openImageModal = (imageUrl, title) => {
    setSelectedImage({ url: imageUrl, title });
    setShowImageModal(true);
  };

  // Stats
  const pendingCount = submissions.filter(s => s.status === 'pending').length;
  const approvedCount = submissions.filter(s => s.status === 'approved').length;
  const rejectedCount = submissions.filter(s => s.status === 'rejected').length;

  return (
    <AdminLayout title={getText('Verifikasyon KYC', 'Vérification KYC', 'KYC Verification')}>
      <div className="space-y-6" data-testid="admin-kyc">
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Clock className="text-amber-600" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                  <p className="text-xs text-stone-500">{getText('An Atant', 'En Attente', 'Pending')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <UserCheck className="text-emerald-600" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{approvedCount}</p>
                  <p className="text-xs text-stone-500">{getText('Apwouve', 'Approuvés', 'Approved')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="text-red-600" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
                  <p className="text-xs text-stone-500">{getText('Rejte', 'Rejetés', 'Rejected')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{submissions.length}</p>
                  <p className="text-xs text-stone-500">{getText('Total', 'Total', 'Total')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {['pending', 'approved', 'rejected', 'all'].map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className={filter === f ? 'bg-[#0047AB]' : ''}
                >
                  {f === 'pending' && <Clock size={14} className="mr-1" />}
                  {f === 'approved' && <Check size={14} className="mr-1" />}
                  {f === 'rejected' && <X size={14} className="mr-1" />}
                  {f === 'pending' ? getText('An Atant', 'En Attente', 'Pending') : 
                   f === 'approved' ? getText('Apwouve', 'Approuvés', 'Approved') : 
                   f === 'rejected' ? getText('Rejte', 'Rejetés', 'Rejected') : 
                   getText('Tout', 'Tous', 'All')}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={fetchSubmissions} className="ml-auto">
                <RefreshCw size={16} className="mr-2" />
                {getText('Aktyalize', 'Actualiser', 'Refresh')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KYC Table */}
        <Card>
          <CardHeader>
            <CardTitle>{getText('Demann KYC', 'Demandes KYC', 'KYC Requests')} ({submissions.length})</CardTitle>
            <CardDescription>{getText('Verifye idantite kliyan yo', 'Vérifier l\'identité des clients', 'Verify customer identity')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw size={24} className="animate-spin mx-auto text-[#EA580C] mb-2" />
                <p className="text-stone-500">{getText('Chajman...', 'Chargement...', 'Loading...')}</p>
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-8 text-stone-500">
                <AlertCircle size={40} className="mx-auto mb-3 text-stone-400" />
                <p>{getText('Pa gen demann KYC', 'Aucune demande KYC', 'No KYC requests')}</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Client ID</th>
                        <th>{getText('Non', 'Nom', 'Name')}</th>
                        <th>{getText('Nasyonalite', 'Nationalité', 'Nationality')}</th>
                        <th>{getText('Tip ID', 'Type ID', 'ID Type')}</th>
                        <th>{getText('Soumèt le', 'Soumis le', 'Submitted')}</th>
                        <th>{getText('Estati', 'Statut', 'Status')}</th>
                        <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((kyc) => (
                        <tr key={kyc.kyc_id}>
                          <td className="font-mono text-sm">{kyc.client_id}</td>
                          <td className="font-medium">{kyc.full_name}</td>
                          <td>{kyc.nationality}</td>
                          <td className="capitalize">{kyc.id_type?.replace('_', ' ')}</td>
                          <td className="text-sm">{new Date(kyc.submitted_at).toLocaleDateString()}</td>
                          <td>
                            <Badge className={
                              kyc.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                              kyc.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }>
                              {kyc.status === 'approved' ? getText('Apwouve', 'Approuvé', 'Approved') :
                               kyc.status === 'pending' ? getText('An Atant', 'En Attente', 'Pending') :
                               getText('Rejte', 'Rejeté', 'Rejected')}
                            </Badge>
                          </td>
                          <td>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => viewKyc(kyc.kyc_id)}
                            >
                              <Eye size={14} className="mr-1" />
                              {getText('Wè', 'Voir', 'View')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {submissions.map((kyc) => (
                    <div key={kyc.kyc_id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{kyc.full_name}</p>
                          <p className="text-xs text-stone-500 font-mono">{kyc.client_id}</p>
                        </div>
                        <Badge className={
                          kyc.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          kyc.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }>
                          {kyc.status === 'approved' ? getText('Apwouve', 'Approuvé', 'Approved') :
                           kyc.status === 'pending' ? getText('An Atant', 'En Attente', 'Pending') :
                           getText('Rejte', 'Rejeté', 'Rejected')}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-stone-500">{kyc.nationality} • {kyc.id_type?.replace('_', ' ')}</span>
                        <Button size="sm" variant="outline" onClick={() => viewKyc(kyc.kyc_id)}>
                          <Eye size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Review Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{getText('Verifikasyon KYC', 'Vérification KYC', 'KYC Verification')} - {selectedKyc?.client_id}</DialogTitle>
            </DialogHeader>
            {selectedKyc && (
              <div className="space-y-6">
                {/* Personal Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-lg p-3">
                    <p className="text-xs text-stone-500">{getText('Non Konplè', 'Nom Complet', 'Full Name')}</p>
                    <p className="font-semibold">{selectedKyc.full_name}</p>
                  </div>
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-lg p-3">
                    <p className="text-xs text-stone-500">{getText('Dat Nesans', 'Date de Naissance', 'Date of Birth')}</p>
                    <p className="font-semibold">{selectedKyc.date_of_birth}</p>
                  </div>
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-lg p-3">
                    <p className="text-xs text-stone-500">{getText('Nasyonalite', 'Nationalité', 'Nationality')}</p>
                    <p className="font-semibold">{selectedKyc.nationality}</p>
                  </div>
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-lg p-3">
                    <p className="text-xs text-stone-500">{getText('Tip ID', 'Type ID', 'ID Type')}</p>
                    <p className="font-semibold capitalize">{selectedKyc.id_type?.replace('_', ' ')}</p>
                  </div>
                  <div className="sm:col-span-2 bg-stone-50 dark:bg-stone-800 rounded-lg p-3">
                    <p className="text-xs text-stone-500">{getText('Adrès', 'Adresse', 'Address')}</p>
                    <p className="font-semibold">{selectedKyc.full_address}</p>
                  </div>
                </div>

                {/* ID Images */}
                <div>
                  <p className="font-semibold mb-3">{getText('Dokiman ID', 'Documents ID', 'ID Documents')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-stone-500 mb-2">{getText('ID Devan', 'ID Recto', 'ID Front')}</p>
                      {selectedKyc.id_front_image ? (
                        <div 
                          className="relative group cursor-pointer"
                          onClick={() => openImageModal(selectedKyc.id_front_image, getText('ID Devan', 'ID Recto', 'ID Front'))}
                        >
                          <img 
                            src={selectedKyc.id_front_image} 
                            alt="ID Front" 
                            className="rounded-lg border w-full h-32 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <ZoomIn className="text-white" size={24} />
                          </div>
                        </div>
                      ) : (
                        <div className="h-32 bg-stone-100 dark:bg-stone-700 rounded-lg flex items-center justify-center text-stone-500 text-sm">
                          {getText('Pa founi', 'Non fourni', 'Not provided')}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-stone-500 mb-2">{getText('ID Dèyè', 'ID Verso', 'ID Back')}</p>
                      {selectedKyc.id_back_image ? (
                        <div 
                          className="relative group cursor-pointer"
                          onClick={() => openImageModal(selectedKyc.id_back_image, getText('ID Dèyè', 'ID Verso', 'ID Back'))}
                        >
                          <img 
                            src={selectedKyc.id_back_image} 
                            alt="ID Back" 
                            className="rounded-lg border w-full h-32 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <ZoomIn className="text-white" size={24} />
                          </div>
                        </div>
                      ) : (
                        <div className="h-32 bg-stone-100 dark:bg-stone-700 rounded-lg flex items-center justify-center text-stone-500 text-sm">
                          {getText('Pa founi', 'Non fourni', 'Not provided')}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-stone-500 mb-2">{getText('Selfie ak ID', 'Selfie avec ID', 'Selfie with ID')}</p>
                      {selectedKyc.selfie_with_id ? (
                        <div 
                          className="relative group cursor-pointer"
                          onClick={() => openImageModal(selectedKyc.selfie_with_id, getText('Selfie ak ID', 'Selfie avec ID', 'Selfie with ID'))}
                        >
                          <img 
                            src={selectedKyc.selfie_with_id} 
                            alt="Selfie" 
                            className="rounded-lg border w-full h-32 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <ZoomIn className="text-white" size={24} />
                          </div>
                        </div>
                      ) : (
                        <div className="h-32 bg-stone-100 dark:bg-stone-700 rounded-lg flex items-center justify-center text-stone-500 text-sm">
                          {getText('Pa founi', 'Non fourni', 'Not provided')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-stone-50 dark:bg-stone-800">
                  <span className="text-sm text-stone-500">{getText('Estati aktyèl:', 'Statut actuel:', 'Current status:')}</span>
                  <Badge className={
                    selectedKyc.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    selectedKyc.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }>
                    {selectedKyc.status === 'approved' ? getText('Apwouve', 'Approuvé', 'Approved') :
                     selectedKyc.status === 'pending' ? getText('An Atant', 'En Attente', 'Pending') :
                     getText('Rejte', 'Rejeté', 'Rejected')}
                  </Badge>
                </div>

                {/* Actions for pending */}
                {selectedKyc.status === 'pending' && (
                  <>
                    <div>
                      <Label className="text-sm">{getText('Rezon reje (si aplikab)', 'Raison de rejet (si applicable)', 'Rejection reason (if applicable)')}</Label>
                      <Textarea
                        placeholder={getText('Ex: Dokiman pa klè, foto flou...', 'Ex: Document illisible, photo floue...', 'Ex: Unreadable document, blurry photo...')}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button 
                        onClick={() => handleReview('approve')}
                        disabled={processing}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                      >
                        <Check size={18} className="mr-2" />
                        {getText('Apwouve', 'Approuver', 'Approve')}
                      </Button>
                      <Button 
                        onClick={() => handleReview('reject')}
                        disabled={processing}
                        variant="destructive"
                        className="flex-1"
                      >
                        <X size={18} className="mr-2" />
                        {getText('Rejte', 'Rejeter', 'Reject')}
                      </Button>
                    </div>
                  </>
                )}

                {/* Show rejection reason if rejected */}
                {selectedKyc.status === 'rejected' && selectedKyc.rejection_reason && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                      {getText('Rezon Reje', 'Raison du Rejet', 'Rejection Reason')}
                    </p>
                    <p className="text-red-700 dark:text-red-400">{selectedKyc.rejection_reason}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Image Zoom Modal */}
        <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedImage?.title}</DialogTitle>
            </DialogHeader>
            {selectedImage && (
              <div className="flex items-center justify-center">
                <img 
                  src={selectedImage.url} 
                  alt={selectedImage.title}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
