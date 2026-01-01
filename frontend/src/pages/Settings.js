import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  User, 
  Lock, 
  Globe,
  Shield,
  Bell,
  MessageSquare
} from 'lucide-react';
import { API_BASE } from '@/lib/utils';

const API = API_BASE;

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const { user, setUser } = useAuth();
  
  const [notifications, setNotifications] = useState(true);
  const [twoFactor, setTwoFactor] = useState(user?.two_factor_enabled || false);
  const [telegramChatId, setTelegramChatId] = useState(user?.telegram_chat_id || '');
  const [savingTelegram, setSavingTelegram] = useState(false);

  useEffect(() => {
    if (user?.telegram_chat_id) {
      setTelegramChatId(user.telegram_chat_id);
    }
  }, [user]);

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    toast.success(lang === 'fr' ? 'Langue changée en français' : 'Language changed to English');
  };

  const handleSaveTelegram = async () => {
    setSavingTelegram(true);
    try {
      const response = await axios.patch(`${API}/profile`, {
        telegram_chat_id: telegramChatId || null
      });
      setUser(response.data.user);
      toast.success(language === 'fr' 
        ? 'Chat ID Telegram enregistré avec succès!' 
        : 'Telegram chat ID saved successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la sauvegarde');
    } finally {
      setSavingTelegram(false);
    }
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
          <CardContent className="space-y-4">
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

            {/* Telegram Notifications */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <MessageSquare size={20} className="text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-300">
                    {language === 'fr' ? 'Notifications Telegram' : 'Telegram Notifications'}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    {language === 'fr' 
                      ? 'Recevez des notifications sur Telegram pour vos dépôts d\'agent' 
                      : 'Receive notifications on Telegram for your agent deposits'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">
                  {language === 'fr' ? 'Chat ID Telegram' : 'Telegram Chat ID'}
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder={language === 'fr' ? '-1001234567890' : '-1001234567890'}
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button 
                    onClick={handleSaveTelegram}
                    disabled={savingTelegram}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {savingTelegram 
                      ? (language === 'fr' ? 'Enregistrement...' : 'Saving...')
                      : (language === 'fr' ? 'Enregistrer' : 'Save')
                    }
                  </Button>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {language === 'fr' 
                    ? 'Pour trouver votre Chat ID, recherchez @userinfobot sur Telegram'
                    : 'To find your Chat ID, search for @userinfobot on Telegram'}
                </p>
              </div>
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
