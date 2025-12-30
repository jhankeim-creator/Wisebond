import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  User, 
  Lock, 
  Globe,
  Shield,
  Bell,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();
  
  const [notifications, setNotifications] = useState(true);
  const [twoFactor, setTwoFactor] = useState(user?.two_factor_enabled || false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  const handleDeleteAccount = async () => {
    if (!deleteReason.trim() || deleteReason.length < 5) {
      toast.error(getText('Rezon an dwe gen omwen 5 karaktè', 'La raison doit contenir au moins 5 caractères', 'Reason must be at least 5 characters'));
      return;
    }

    setDeleting(true);
    try {
      await axios.delete(`${API}/users/me`, { data: { reason: deleteReason } });
      toast.success(getText('Kont ou efase avèk siksè', 'Votre compte a été supprimé avec succès', 'Your account has been deleted successfully'));
      setShowDeleteModal(false);
      // Logout and redirect to home
      setTimeout(() => {
        logout();
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      toast.error(error.response?.data?.detail || getText('Erè pandan sipresyon', 'Erreur lors de la suppression', 'Error deleting account'));
    } finally {
      setDeleting(false);
    }
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    toast.success(lang === 'fr' ? 'Langue changée en français' : 'Language changed to English');
  };

  return (
    <DashboardLayout title={t('settings')}>
      <div className="max-w-2xl mx-auto space-y-6" data-testid="settings-page">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User size={20} />
              Profil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-[#0047AB] rounded-full flex items-center justify-center">
                <span className="text-white text-2xl font-bold">
                  {user?.full_name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold text-slate-900">{user?.full_name}</p>
                <p className="text-slate-500">{user?.email}</p>
                <p className="text-sm text-slate-400 font-mono">{user?.client_id}</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div>
                <Label>{t('fullName')}</Label>
                <Input value={user?.full_name} disabled className="mt-1 bg-slate-50" />
              </div>
              <div>
                <Label>{t('email')}</Label>
                <Input value={user?.email} disabled className="mt-1 bg-slate-50" />
              </div>
              <div>
                <Label>{t('phone')}</Label>
                <Input value={user?.phone} disabled className="mt-1 bg-slate-50" />
              </div>
              <div>
                <Label>Client ID</Label>
                <Input value={user?.client_id} disabled className="mt-1 bg-slate-50 font-mono" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe size={20} />
              Langue / Language
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <button
                onClick={() => handleLanguageChange('fr')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  language === 'fr' 
                    ? 'border-[#0047AB] bg-blue-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-2xl">🇫🇷</span>
                <p className="font-medium mt-2">Français</p>
              </button>
              <button
                onClick={() => handleLanguageChange('en')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  language === 'en' 
                    ? 'border-[#0047AB] bg-blue-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-2xl">🇬🇧</span>
                <p className="font-medium mt-2">English</p>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={20} />
              Sécurité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Lock size={20} className="text-slate-500" />
                <div>
                  <p className="font-medium text-slate-900">Authentification à deux facteurs (2FA)</p>
                  <p className="text-sm text-slate-500">Ajoutez une couche de sécurité supplémentaire</p>
                </div>
              </div>
              <Switch 
                checked={twoFactor} 
                onCheckedChange={setTwoFactor}
                disabled
              />
            </div>
            <p className="text-sm text-slate-500">
              * La fonctionnalité 2FA sera disponible prochainement
            </p>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell size={20} />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-slate-500" />
                <div>
                  <p className="font-medium text-slate-900">Notifications email</p>
                  <p className="text-sm text-slate-500">Recevez des alertes pour vos transactions</p>
                </div>
              </div>
              <Switch 
                checked={notifications} 
                onCheckedChange={setNotifications}
              />
            </div>
          </CardContent>
        </Card>

        {/* KYC Status */}
        <Card>
          <CardHeader>
            <CardTitle>Statut de vérification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`p-4 rounded-xl ${
              user?.kyc_status === 'approved' 
                ? 'bg-emerald-50 border border-emerald-200' 
                : user?.kyc_status === 'pending'
                  ? 'bg-amber-50 border border-amber-200'
                  : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  user?.kyc_status === 'approved' 
                    ? 'bg-emerald-500' 
                    : user?.kyc_status === 'pending'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-red-500'
                }`} />
                <span className={`font-medium capitalize ${
                  user?.kyc_status === 'approved' 
                    ? 'text-emerald-700' 
                    : user?.kyc_status === 'pending'
                      ? 'text-amber-700'
                      : 'text-red-700'
                }`}>
                  KYC: {t(user?.kyc_status === 'approved' ? 'kycApproved' : user?.kyc_status === 'pending' ? 'kycPending' : 'kycRejected')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Trash2 size={20} />
              {getText('Siprime Kont', 'Supprimer le Compte', 'Delete Account')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">
              {getText(
                'Si ou siprime kont ou, tout done ou yo ap pèdi pou tout tan. Aksyon sa a pap ka anile.',
                'Si vous supprimez votre compte, toutes vos données seront perdues définitivement. Cette action est irréversible.',
                'If you delete your account, all your data will be permanently lost. This action cannot be undone.'
              )}
            </p>
            <Button 
              variant="outline" 
              className="text-red-600 border-red-300 hover:bg-red-50"
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 size={16} className="mr-2" />
              {getText('Siprime kont mwen', 'Supprimer mon compte', 'Delete my account')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={24} />
              {getText('Siprime Kont Ou', 'Supprimer votre Compte', 'Delete Your Account')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700 text-sm">
                <strong>{getText('Atansyon!', 'Attention!', 'Warning!')}</strong> {getText(
                  'Aksyon sa a pap ka anile. Tout done ou yo (KYC, tranzaksyon, depo, retrè, kat vityèl) ap efase pou tout tan.',
                  'Cette action est irréversible. Toutes vos données (KYC, transactions, dépôts, retraits, cartes virtuelles) seront définitivement supprimées.',
                  'This action cannot be undone. All your data (KYC, transactions, deposits, withdrawals, virtual cards) will be permanently deleted.'
                )}
              </p>
            </div>

            <div>
              <Label className="text-red-700">{getText('Poukisa ou vle siprime kont ou? (Obligatwa)', 'Pourquoi voulez-vous supprimer votre compte? (Obligatoire)', 'Why do you want to delete your account? (Required)')}</Label>
              <Textarea
                placeholder={getText('Ekri rezon an isit...', 'Écrivez la raison ici...', 'Write the reason here...')}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="mt-2"
                rows={3}
              />
              <p className="text-xs text-slate-500 mt-1">{getText('Omwen 5 karaktè', 'Minimum 5 caractères', 'Minimum 5 characters')}</p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="flex-1">
                {getText('Anile', 'Annuler', 'Cancel')}
              </Button>
              <Button 
                onClick={handleDeleteAccount}
                disabled={deleting || !deleteReason.trim() || deleteReason.length < 5}
                variant="destructive"
                className="flex-1"
              >
                <Trash2 size={16} className="mr-2" />
                {deleting ? getText('Sipresyon...', 'Suppression...', 'Deleting...') : getText('Siprime', 'Supprimer', 'Delete')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
