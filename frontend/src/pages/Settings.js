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
  Bell
} from 'lucide-react';

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const { user } = useAuth();
  
  const [notifications, setNotifications] = useState(true);
  const [twoFactor, setTwoFactor] = useState(user?.two_factor_enabled || false);

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
      </div>
    </DashboardLayout>
  );
}
