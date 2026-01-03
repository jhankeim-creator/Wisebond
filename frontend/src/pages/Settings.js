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
  MessageSquare,
  Copy
} from 'lucide-react';
import { API_BASE } from '@/lib/utils';

const API = API_BASE;

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const { user, setUser } = useAuth();
  
  const [notifications, setNotifications] = useState(true);
  const [twoFactor, setTwoFactor] = useState(user?.two_factor_enabled || false);
  const [telegramActivated, setTelegramActivated] = useState(false);
  const [activationCode, setActivationCode] = useState(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    checkTelegramStatus();
  }, [user]);

  const checkTelegramStatus = async () => {
    try {
      const response = await axios.get(`${API}/telegram/activation-status`);
      setTelegramActivated(response.data.activated);
      setActivationCode(response.data.activation_code);
    } catch (error) {
      console.error('Error checking Telegram status:', error);
    }
  };

  const generateActivationCode = async () => {
    setGeneratingCode(true);
    try {
      const response = await axios.post(`${API}/telegram/generate-activation-code`);
      setActivationCode(response.data.activation_code);
      toast.success(language === 'fr' 
        ? 'Code d\'activation généré! Envoyez /start CODE au bot Telegram' 
        : 'Activation code generated! Send /start CODE to the Telegram bot');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error generating activation code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const refreshStatus = async () => {
    setCheckingStatus(true);
    try {
      await checkTelegramStatus();
      toast.success(language === 'fr' 
        ? 'Statut vérifié' 
        : 'Status checked');
    } catch (error) {
      toast.error('Error checking status');
    } finally {
      setCheckingStatus(false);
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
                <div className="flex-1">
                  <p className="font-medium text-blue-900 dark:text-blue-300">
                    {language === 'fr' ? 'Notifications Telegram' : 'Telegram Notifications'}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    {language === 'fr' 
                      ? 'Recevez des notifications sur Telegram pour vos dépôts d\'agent' 
                      : 'Receive notifications on Telegram for your agent deposits'}
                  </p>
                </div>
                {telegramActivated && (
                  <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-semibold">
                    {language === 'fr' ? 'Activé' : 'Activated'}
                  </span>
                )}
              </div>
              
              {telegramActivated ? (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700">
                    <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
                      ✅ {language === 'fr' ? 'Telegram activé avec succès!' : 'Telegram activated successfully!'}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                      {language === 'fr' 
                        ? 'Vous recevrez des notifications sur Telegram pour vos transactions.'
                        : 'You will receive notifications on Telegram for your transactions.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {activationCode ? (
                    <>
                      <div className="p-4 bg-white dark:bg-stone-800 rounded-lg border-2 border-blue-300 dark:border-blue-600">
                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-2 font-semibold">
                          {language === 'fr' ? 'CODE D\'ACTIVATION' : 'ACTIVATION CODE'}
                        </p>
                        <div className="flex items-center gap-2 mb-3">
                          <code className="text-2xl font-bold text-blue-900 dark:text-blue-100 font-mono tracking-wider">
                            {activationCode}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(activationCode);
                              toast.success(language === 'fr' ? 'Code copié!' : 'Code copied!');
                            }}
                          >
                            <Copy size={14} />
                          </Button>
                        </div>
                        <div className="space-y-2 text-sm text-stone-700 dark:text-stone-300">
                          <p className="font-semibold">{language === 'fr' ? 'Étapes:' : 'Steps:'}</p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>{language === 'fr' 
                              ? 'Ouvrez Telegram et recherchez le bot KAYICOM (configurez-le dans les paramètres admin)'
                              : 'Open Telegram and search for the KAYICOM bot (configure it in admin settings)'}</li>
                            <li>{language === 'fr' 
                              ? `Envoyez: /start ${activationCode}`
                              : `Send: /start ${activationCode}`}</li>
                            <li>{language === 'fr' 
                              ? 'Cliquez sur "Vérifier l\'activation" ci-dessous'
                              : 'Click "Check Activation" below'}</li>
                          </ol>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={refreshStatus}
                          disabled={checkingStatus}
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                          {checkingStatus 
                            ? (language === 'fr' ? 'Vérification...' : 'Checking...')
                            : (language === 'fr' ? 'Vérifier l\'activation' : 'Check Activation')
                          }
                        </Button>
                        <Button
                          onClick={generateActivationCode}
                          variant="outline"
                          disabled={generatingCode}
                        >
                          {language === 'fr' ? 'Nouveau code' : 'New Code'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-stone-600 dark:text-stone-400">
                        {language === 'fr' 
                          ? 'Activez les notifications Telegram en générant un code d\'activation.'
                          : 'Activate Telegram notifications by generating an activation code.'}
                      </p>
                      <Button
                        onClick={generateActivationCode}
                        disabled={generatingCode}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {generatingCode 
                          ? (language === 'fr' ? 'Génération...' : 'Generating...')
                          : (language === 'fr' ? 'Générer le code d\'activation' : 'Generate Activation Code')
                        }
                      </Button>
                    </div>
                  )}
                </div>
              )}
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
