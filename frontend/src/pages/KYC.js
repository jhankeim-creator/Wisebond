import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Upload, 
  Check, 
  X,
  Clock,
  Camera,
  CreditCard,
  User,
  MapPin,
  Flag,
  Calendar
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function KYC() {
  const { t } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [kycData, setKycData] = useState(null);
  const [formData, setFormData] = useState({
    date_of_birth: '',
    address: '',
    nationality: '',
    id_type: 'id_card',
    id_front_image: '',
    id_back_image: '',
    selfie_image: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchKycStatus();
  }, []);

  const fetchKycStatus = async () => {
    try {
      const response = await axios.get(`${API}/kyc/status`);
      setKycData(response.data.kyc);
    } catch (error) {
      console.error('Error fetching KYC status:', error);
    }
  };

  const handleImageUpload = (field) => (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image trop grande (max 5MB)');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, [field]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.id_front_image || !formData.selfie_image) {
      toast.error('Veuillez télécharger tous les documents requis');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/kyc/submit`, formData);
      await refreshUser();
      await fetchKycStatus();
      toast.success('Documents KYC soumis avec succès!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la soumission');
    } finally {
      setLoading(false);
    }
  };

  const getStatusDisplay = () => {
    switch (user?.kyc_status) {
      case 'approved':
        return {
          icon: <Check className="text-emerald-500" size={32} />,
          color: 'bg-emerald-100 border-emerald-200',
          text: t('kycApproved'),
          textColor: 'text-emerald-700'
        };
      case 'pending':
        return {
          icon: <Clock className="text-amber-500" size={32} />,
          color: 'bg-amber-100 border-amber-200',
          text: t('kycPending'),
          textColor: 'text-amber-700'
        };
      case 'rejected':
        return {
          icon: <X className="text-red-500" size={32} />,
          color: 'bg-red-100 border-red-200',
          text: t('kycRejected'),
          textColor: 'text-red-700'
        };
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay();

  if (user?.kyc_status === 'approved') {
    return (
      <DashboardLayout title={t('kycVerification')}>
        <Card className="max-w-xl mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="text-emerald-500" size={40} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">{t('kycApproved')}</h3>
            <p className="text-slate-600">
              Votre identité a été vérifiée avec succès. Vous avez accès à toutes les fonctionnalités.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (user?.kyc_status === 'pending' && kycData) {
    return (
      <DashboardLayout title={t('kycVerification')}>
        <Card className="max-w-xl mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Clock className="text-amber-500" size={40} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">{t('kycPending')}</h3>
            <p className="text-slate-600 mb-4">
              Vos documents sont en cours de vérification. Cela peut prendre jusqu'à 24 heures.
            </p>
            <div className="bg-slate-50 rounded-xl p-4 text-left">
              <p className="text-sm text-slate-500">Soumis le:</p>
              <p className="font-medium">{new Date(kycData.submitted_at).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t('kycVerification')}>
      <div className="max-w-2xl mx-auto space-y-6" data-testid="kyc-page">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-800 mb-2">Pourquoi la vérification KYC?</h3>
          <p className="text-sm text-blue-700">
            La vérification de votre identité est requise pour la sécurité de votre compte et pour respecter les réglementations financières.
          </p>
        </div>

        {/* Rejection Notice */}
        {user?.kyc_status === 'rejected' && kycData?.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h3 className="font-semibold text-red-800 mb-2">Demande rejetée</h3>
            <p className="text-sm text-red-700">{kycData.rejection_reason}</p>
            <p className="text-sm text-red-600 mt-2">Veuillez soumettre à nouveau vos documents.</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Personal Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User size={20} />
                Informations personnelles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dob">
                    <Calendar size={16} className="inline mr-2" />
                    {t('dateOfBirth')}
                  </Label>
                  <Input
                    id="dob"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                    required
                    className="mt-1"
                    data-testid="kyc-dob"
                  />
                </div>
                <div>
                  <Label htmlFor="nationality">
                    <Flag size={16} className="inline mr-2" />
                    {t('nationality')}
                  </Label>
                  <Input
                    id="nationality"
                    placeholder="Haïtien"
                    value={formData.nationality}
                    onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                    required
                    className="mt-1"
                    data-testid="kyc-nationality"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="address">
                  <MapPin size={16} className="inline mr-2" />
                  {t('address')}
                </Label>
                <Input
                  id="address"
                  placeholder="Votre adresse complète"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  required
                  className="mt-1"
                  data-testid="kyc-address"
                />
              </div>
            </CardContent>
          </Card>

          {/* ID Document */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard size={20} />
                Document d'identité
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('idType')}</Label>
                <Select 
                  value={formData.id_type} 
                  onValueChange={(v) => setFormData({...formData, id_type: v})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="id_card">{t('idCard')}</SelectItem>
                    <SelectItem value="passport">{t('passport')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('frontPhoto')} *</Label>
                  <div 
                    className={`file-upload-zone mt-2 ${formData.id_front_image ? 'border-emerald-500 bg-emerald-50' : ''}`}
                    onClick={() => document.getElementById('id-front').click()}
                  >
                    {formData.id_front_image ? (
                      <div className="flex items-center justify-center gap-2">
                        <Check className="text-emerald-500" size={20} />
                        <span className="text-emerald-700 text-sm">Image téléchargée</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto text-slate-400 mb-2" size={24} />
                        <p className="text-sm text-slate-600">Cliquez pour télécharger</p>
                      </>
                    )}
                  </div>
                  <input
                    id="id-front"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload('id_front_image')}
                  />
                </div>

                {formData.id_type === 'id_card' && (
                  <div>
                    <Label>{t('backPhoto')}</Label>
                    <div 
                      className={`file-upload-zone mt-2 ${formData.id_back_image ? 'border-emerald-500 bg-emerald-50' : ''}`}
                      onClick={() => document.getElementById('id-back').click()}
                    >
                      {formData.id_back_image ? (
                        <div className="flex items-center justify-center gap-2">
                          <Check className="text-emerald-500" size={20} />
                          <span className="text-emerald-700 text-sm">Image téléchargée</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="mx-auto text-slate-400 mb-2" size={24} />
                          <p className="text-sm text-slate-600">Cliquez pour télécharger</p>
                        </>
                      )}
                    </div>
                    <input
                      id="id-back"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload('id_back_image')}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selfie */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera size={20} />
                {t('selfieWithId')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                Prenez une photo de vous en tenant votre document d'identité à côté de votre visage. 
                Les deux doivent être clairement visibles.
              </p>
              <div 
                className={`file-upload-zone ${formData.selfie_image ? 'border-emerald-500 bg-emerald-50' : ''}`}
                onClick={() => document.getElementById('selfie').click()}
              >
                {formData.selfie_image ? (
                  <div className="flex items-center justify-center gap-2">
                    <Check className="text-emerald-500" size={24} />
                    <span className="text-emerald-700">Selfie téléchargé</span>
                  </div>
                ) : (
                  <>
                    <Camera className="mx-auto text-slate-400 mb-2" size={32} />
                    <p className="text-slate-600">Cliquez pour télécharger votre selfie</p>
                    <p className="text-sm text-slate-400 mt-1">PNG, JPG jusqu'à 5MB</p>
                  </>
                )}
              </div>
              <input
                id="selfie"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload('selfie_image')}
              />
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            className="btn-primary w-full"
            disabled={loading}
            data-testid="kyc-submit"
          >
            {loading ? t('loading') : t('submitKyc')}
          </Button>
        </form>
      </div>
    </DashboardLayout>
  );
}
