import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { API_BASE as API } from '@/lib/utils';
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
  Calendar,
  Phone,
  MessageCircle,
  FileText,
  AlertTriangle
} from 'lucide-react';

export default function KYC() {
  const { language } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [kycData, setKycData] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    date_of_birth: '',
    full_address: '',
    city: '',
    country: 'Haiti',
    nationality: '',
    phone_number: '',
    whatsapp_number: '',
    id_type: 'id_card',
    id_number: '',
    id_front_image: '',
    id_back_image: '',
    selfie_with_id: ''
  });
  const [loading, setLoading] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

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
        toast.error(getText('Imaj la twò gwo (maks 5MB)', 'Image trop grande (max 5MB)', 'Image too large (max 5MB)'));
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
    
    // Validate required fields
    if (!formData.full_name || !formData.date_of_birth || !formData.full_address || 
        !formData.phone_number || !formData.id_front_image || !formData.selfie_with_id) {
      toast.error(getText(
        'Tanpri ranpli tout chan obligatwa yo',
        'Veuillez remplir tous les champs obligatoires',
        'Please fill all required fields'
      ));
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/kyc/submit`, formData);
      await refreshUser();
      await fetchKycStatus();
      toast.success(getText('Dokiman KYC soumèt siksè!', 'Documents KYC soumis avec succès!', 'KYC documents submitted successfully!'));
    } catch (error) {
      toast.error(error.response?.data?.detail || getText('Erè nan soumisyon', 'Erreur lors de la soumission', 'Submission error'));
    } finally {
      setLoading(false);
    }
  };

  if (user?.kyc_status === 'approved') {
    return (
      <DashboardLayout title={getText('Verifikasyon KYC', 'Vérification KYC', 'KYC Verification')}>
        <Card className="max-w-xl mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="text-emerald-500" size={40} />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 mb-2">
              {getText('KYC Apwouve!', 'KYC Approuvé!', 'KYC Approved!')}
            </h3>
            <p className="text-stone-600">
              {getText(
                'Idantite ou verifye avèk siksè. Ou gen aksè nan tout fonksyonalite yo.',
                'Votre identité a été vérifiée avec succès. Vous avez accès à toutes les fonctionnalités.',
                'Your identity has been successfully verified. You have access to all features.'
              )}
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (user?.kyc_status === 'pending' && kycData) {
    return (
      <DashboardLayout title={getText('Verifikasyon KYC', 'Vérification KYC', 'KYC Verification')}>
        <Card className="max-w-xl mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Clock className="text-amber-500" size={40} />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 mb-2">
              {getText('Ap tann verifikasyon', 'Vérification en cours', 'Verification pending')}
            </h3>
            <p className="text-stone-600 mb-4">
              {getText(
                'Dokiman ou yo ap verifye. Sa ka pran jiska 24 èdtan.',
                'Vos documents sont en cours de vérification. Cela peut prendre jusqu\'à 24 heures.',
                'Your documents are being verified. This may take up to 24 hours.'
              )}
            </p>
            <div className="bg-stone-50 rounded-xl p-4 text-left">
              <p className="text-sm text-stone-500">{getText('Soumèt le', 'Soumis le', 'Submitted on')}:</p>
              <p className="font-medium">{new Date(kycData.submitted_at).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={getText('Verifikasyon KYC', 'Vérification KYC', 'KYC Verification')}>
      <div className="max-w-2xl mx-auto space-y-6" data-testid="kyc-page">
        {/* Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-500 mt-0.5" size={24} />
            <div>
              <h3 className="font-semibold text-amber-800 mb-1">
                {getText('KYC OBLIGATWA', 'KYC OBLIGATOIRE', 'KYC REQUIRED')}
              </h3>
              <p className="text-sm text-amber-700">
                {getText(
                  'Ou dwe konplete verifikasyon KYC ANVAN ou ka itilize nenpòt sèvis nan platfòm nan (depo, retrè, transfè, kat vityèl).',
                  'Vous devez compléter la vérification KYC AVANT de pouvoir utiliser tout service sur la plateforme (dépôt, retrait, transfert, carte virtuelle).',
                  'You must complete KYC verification BEFORE you can use any service on the platform (deposit, withdrawal, transfer, virtual card).'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Rejection Notice */}
        {user?.kyc_status === 'rejected' && kycData?.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <X className="text-red-500 mt-0.5" size={24} />
              <div>
                <h3 className="font-semibold text-red-800 mb-1">{getText('Demann rejte', 'Demande rejetée', 'Request rejected')}</h3>
                <p className="text-sm text-red-700">{kycData.rejection_reason}</p>
                <p className="text-sm text-red-600 mt-2">{getText('Tanpri soumèt dokiman yo ankò.', 'Veuillez soumettre à nouveau vos documents.', 'Please resubmit your documents.')}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Personal Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User size={20} className="text-[#EA580C]" />
                {getText('Enfòmasyon Pèsonèl', 'Informations Personnelles', 'Personal Information')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="full_name">
                  <User size={16} className="inline mr-2" />
                  {getText('Non konplè (jan li ye sou ID ou)', 'Nom complet (tel qu\'il apparaît sur votre ID)', 'Full name (as it appears on your ID)')} *
                </Label>
                <Input
                  id="full_name"
                  placeholder={getText('Non Prenon Siyati', 'Nom Prénom Signature', 'First Middle Last Name')}
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  required
                  className="mt-1"
                  data-testid="kyc-fullname"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dob">
                    <Calendar size={16} className="inline mr-2" />
                    {getText('Dat nesans', 'Date de naissance', 'Date of birth')} *
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
                    {getText('Nasyonalite', 'Nationalité', 'Nationality')} *
                  </Label>
                  <Input
                    id="nationality"
                    placeholder={getText('Ayisyen', 'Haïtien', 'Haitian')}
                    value={formData.nationality}
                    onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                    required
                    className="mt-1"
                    data-testid="kyc-nationality"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address & Contact */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin size={20} className="text-[#EA580C]" />
                {getText('Adrès & Kontak', 'Adresse & Contact', 'Address & Contact')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="full_address">
                  <MapPin size={16} className="inline mr-2" />
                  {getText('Adrès konplè', 'Adresse complète', 'Full address')} *
                </Label>
                <Textarea
                  id="full_address"
                  placeholder={getText('Nimewo kay, ri, katye, vil', 'Numéro, rue, quartier, ville', 'Number, street, neighborhood, city')}
                  value={formData.full_address}
                  onChange={(e) => setFormData({...formData, full_address: e.target.value})}
                  required
                  className="mt-1"
                  rows={2}
                  data-testid="kyc-address"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">{getText('Vil', 'Ville', 'City')}</Label>
                  <Input
                    id="city"
                    placeholder={getText('Pòtoprens', 'Port-au-Prince', 'Port-au-Prince')}
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="country">{getText('Peyi', 'Pays', 'Country')}</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({...formData, country: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone_number">
                    <Phone size={16} className="inline mr-2" />
                    {getText('Nimewo telefòn', 'Numéro de téléphone', 'Phone number')} *
                  </Label>
                  <Input
                    id="phone_number"
                    type="tel"
                    placeholder="+509 00 00 0000"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                    required
                    className="mt-1"
                    data-testid="kyc-phone"
                  />
                </div>
                <div>
                  <Label htmlFor="whatsapp_number">
                    <MessageCircle size={16} className="inline mr-2" />
                    {getText('Nimewo WhatsApp', 'Numéro WhatsApp', 'WhatsApp number')}
                  </Label>
                  <Input
                    id="whatsapp_number"
                    type="tel"
                    placeholder="+509 00 00 0000"
                    value={formData.whatsapp_number}
                    onChange={(e) => setFormData({...formData, whatsapp_number: e.target.value})}
                    className="mt-1"
                    data-testid="kyc-whatsapp"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ID Document */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard size={20} className="text-[#EA580C]" />
                {getText('Pyès Idantite', 'Pièce d\'identité', 'ID Document')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>{getText('Tip dokiman', 'Type de document', 'Document type')} *</Label>
                  <Select 
                    value={formData.id_type} 
                    onValueChange={(v) => setFormData({...formData, id_type: v})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="id_card">{getText('Kat Idantite Nasyonal (CIN)', 'Carte d\'Identité Nationale', 'National ID Card')}</SelectItem>
                      <SelectItem value="passport">{getText('Paspò', 'Passeport', 'Passport')}</SelectItem>
                      <SelectItem value="driver_license">{getText('Pèmi kondwi', 'Permis de conduire', 'Driver\'s License')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="id_number">
                    <FileText size={16} className="inline mr-2" />
                    {getText('Nimewo ID', 'Numéro d\'ID', 'ID Number')}
                  </Label>
                  <Input
                    id="id_number"
                    placeholder={getText('Nimewo sou pyès la', 'Numéro sur le document', 'Number on document')}
                    value={formData.id_number}
                    onChange={(e) => setFormData({...formData, id_number: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>{getText('Foto devan ID', 'Photo recto ID', 'Front of ID')} *</Label>
                  <div 
                    className={`file-upload-zone mt-2 cursor-pointer ${formData.id_front_image ? 'border-emerald-500 bg-emerald-50' : ''}`}
                    onClick={() => document.getElementById('id-front').click()}
                  >
                    {formData.id_front_image ? (
                      <div className="flex items-center justify-center gap-2">
                        <Check className="text-emerald-500" size={20} />
                        <span className="text-emerald-700 text-sm">{getText('Imaj telechaje', 'Image téléchargée', 'Image uploaded')}</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto text-stone-400 mb-2" size={24} />
                        <p className="text-sm text-stone-600">{getText('Klike pou telechaje', 'Cliquez pour télécharger', 'Click to upload')}</p>
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

                <div>
                  <Label>{getText('Foto dèyè ID', 'Photo verso ID', 'Back of ID')}</Label>
                  <div 
                    className={`file-upload-zone mt-2 cursor-pointer ${formData.id_back_image ? 'border-emerald-500 bg-emerald-50' : ''}`}
                    onClick={() => document.getElementById('id-back').click()}
                  >
                    {formData.id_back_image ? (
                      <div className="flex items-center justify-center gap-2">
                        <Check className="text-emerald-500" size={20} />
                        <span className="text-emerald-700 text-sm">{getText('Imaj telechaje', 'Image téléchargée', 'Image uploaded')}</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto text-stone-400 mb-2" size={24} />
                        <p className="text-sm text-stone-600">{getText('Klike pou telechaje', 'Cliquez pour télécharger', 'Click to upload')}</p>
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
              </div>
            </CardContent>
          </Card>

          {/* Selfie with ID */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera size={20} className="text-[#EA580C]" />
                {getText('Selfie ak ID nan men', 'Selfie avec ID en main', 'Selfie with ID in hand')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {getText(
                    'Pran yon foto de ou menm kote ou kenbe pyès idantite ou bò kote figi ou. Toude dwe parèt klè.',
                    'Prenez une photo de vous en tenant votre pièce d\'identité à côté de votre visage. Les deux doivent être clairement visibles.',
                    'Take a photo of yourself holding your ID document next to your face. Both must be clearly visible.'
                  )}
                </p>
              </div>

              {/* Example Images */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center">
                  <div className="border-2 border-emerald-300 rounded-xl p-4 bg-emerald-50 dark:bg-emerald-900/20">
                    <div className="relative mx-auto w-24 h-24 mb-2">
                      <div className="absolute inset-0 bg-gradient-to-br from-stone-300 to-stone-400 rounded-full flex items-center justify-center">
                        <User size={32} className="text-white" />
                      </div>
                      <div className="absolute -right-2 bottom-0 w-8 h-10 bg-blue-100 border border-blue-300 rounded flex items-center justify-center text-xs">
                        ID
                      </div>
                    </div>
                    <Check className="mx-auto text-emerald-500 mb-1" size={20} />
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                      {getText('Bon egzanp', 'Bon exemple', 'Good example')}
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      {getText('Figi ak ID klè', 'Visage et ID clairs', 'Face and ID clear')}
                    </p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="border-2 border-red-300 rounded-xl p-4 bg-red-50 dark:bg-red-900/20">
                    <div className="relative mx-auto w-24 h-24 mb-2 opacity-50 blur-[1px]">
                      <div className="absolute inset-0 bg-gradient-to-br from-stone-300 to-stone-400 rounded-full flex items-center justify-center">
                        <User size={32} className="text-white" />
                      </div>
                    </div>
                    <X className="mx-auto text-red-500 mb-1" size={20} />
                    <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                      {getText('Move egzanp', 'Mauvais exemple', 'Bad example')}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {getText('Twò floute oswa san ID', 'Trop floue ou sans ID', 'Too blurry or no ID')}
                    </p>
                  </div>
                </div>
              </div>

              <div 
                className={`file-upload-zone cursor-pointer ${formData.selfie_with_id ? 'border-emerald-500 bg-emerald-50' : ''}`}
                onClick={() => document.getElementById('selfie').click()}
              >
                {formData.selfie_with_id ? (
                  <div className="flex items-center justify-center gap-2">
                    <Check className="text-emerald-500" size={24} />
                    <span className="text-emerald-700">{getText('Selfie telechaje', 'Selfie téléchargé', 'Selfie uploaded')}</span>
                  </div>
                ) : (
                  <>
                    <Camera className="mx-auto text-stone-400 mb-2" size={32} />
                    <p className="text-stone-600">{getText('Klike pou telechaje selfie ou', 'Cliquez pour télécharger votre selfie', 'Click to upload your selfie')}</p>
                    <p className="text-sm text-stone-400 mt-1">PNG, JPG {getText('jiska', "jusqu'à", 'up to')} 5MB</p>
                  </>
                )}
              </div>
              <input
                id="selfie"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload('selfie_with_id')}
              />
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            className="btn-primary w-full"
            disabled={loading}
            data-testid="kyc-submit"
          >
            {loading ? getText('Ap soumèt...', 'Soumission...', 'Submitting...') : getText('Soumèt Verifikasyon', 'Soumettre la Vérification', 'Submit Verification')}
          </Button>
        </form>
      </div>
    </DashboardLayout>
  );
}
