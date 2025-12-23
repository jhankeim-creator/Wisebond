import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { Save, Key, Mail, Wallet, CreditCard, DollarSign, Shield, MessageSquare, Phone, Smartphone } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export default function AdminSettings() {
  const { language } = useLanguage();
  const [settings, setSettings] = useState({
    // Email (Resend)
    resend_enabled: false,
    resend_api_key: '',
    sender_email: '',
    
    // Live Chat (Crisp)
    crisp_enabled: false,
    crisp_website_id: '',
    
    // WhatsApp
    whatsapp_enabled: false,
    whatsapp_number: '',
    
    // USDT (Plisio)
    plisio_enabled: false,
    plisio_api_key: '',
    plisio_secret_key: '',

    // Manual HTG deposits
    moncash_enabled: true,
    moncash_number: '',
    natcash_enabled: true,
    natcash_number: '',
    
    // Fees & Affiliate
    card_order_fee_htg: 500,
    affiliate_reward_htg: 2000,
    affiliate_cards_required: 5
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/admin/settings`);
      setSettings(prev => ({ ...prev, ...response.data.settings }));
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiagnostics = async () => {
    setDiagnosticsLoading(true);
    try {
      const response = await axios.get(`${API}/admin/diagnostics`);
      setDiagnostics(response.data);
    } catch (error) {
      toast.error(getText('Erè pandan dyagnostik', 'Erreur diagnostic', 'Diagnostics error'));
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Do not send derived fields back to API
      const {
        resend_api_key_last4,
        plisio_api_key_last4,
        plisio_secret_key_last4,
        ...payload
      } = settings;
      await axios.put(`${API}/admin/settings`, payload);
      toast.success(getText('Paramèt anrejistre!', 'Paramètres enregistrés!', 'Settings saved!'));
    } catch (error) {
      toast.error(getText('Erè nan anrejistreman', 'Erreur lors de la sauvegarde', 'Error saving'));
    } finally {
      setSaving(false);
    }
  };

  const purgeOldRecords = async () => {
    try {
      const resp = await axios.post(`${API}/admin/purge-old-records?days=7`);
      const r = resp.data?.result;
      toast.success(getText(
        `Netwayaj fèt: ${r.deleted_deposits} depo, ${r.deleted_withdrawals} retrè, ${r.deleted_transactions} tranzaksyon efase`,
        `Nettoyage effectué: ${r.deleted_deposits} dépôts, ${r.deleted_withdrawals} retraits, ${r.deleted_transactions} transactions supprimés`,
        `Cleanup done: deleted ${r.deleted_deposits} deposits, ${r.deleted_withdrawals} withdrawals, ${r.deleted_transactions} transactions`
      ));
    } catch (e) {
      toast.error(getText('Erè pandan netwayaj', 'Erreur nettoyage', 'Cleanup error'));
    }
  };

  return (
    <AdminLayout title={getText('Paramèt', 'Paramètres', 'Settings')}>
      <div className="max-w-3xl mx-auto space-y-6" data-testid="admin-settings">
        
        {/* Email Settings (Resend) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail size={20} className="text-blue-500" />
                  {getText('Imèl (Resend)', 'Email (Resend)', 'Email (Resend)')}
                </CardTitle>
                <CardDescription>
                  {getText('Voye notifikasyon pa imèl', 'Envoyer des notifications par email', 'Send email notifications')}
                </CardDescription>
              </div>
              <Switch
                checked={settings.resend_enabled}
                onCheckedChange={(checked) => setSettings({...settings, resend_enabled: checked})}
              />
            </div>
          </CardHeader>
          {settings.resend_enabled && (
            <CardContent className="space-y-4 border-t pt-4">
              {loading ? (
                <div className="text-center py-4">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="resend_key">
                      <Key size={16} className="inline mr-2" />
                      {getText('Kle API Resend', 'Clé API Resend', 'Resend API Key')}
                    </Label>
                    <Input
                      id="resend_key"
                      type="password"
                      placeholder={
                        settings.resend_api_key_last4
                          ? `Configured (****${settings.resend_api_key_last4}) - enter new to replace`
                          : "re_xxxxxxxxxxxxx"
                      }
                      value={settings.resend_api_key || ''}
                      onChange={(e) => setSettings({...settings, resend_api_key: e.target.value})}
                      className="mt-1 font-mono"
                    />
                    <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                      {getText('Jwenn kle ou sou', 'Obtenez votre clé sur', 'Get your key at')}{' '}
                      <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-[#EA580C] hover:underline">resend.com</a>
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="sender_email">{getText('Imèl anvwa', "Email d'envoi", 'Sender Email')}</Label>
                    <Input
                      id="sender_email"
                      type="email"
                      placeholder="notifications@kayicom.com"
                      value={settings.sender_email || ''}
                      onChange={(e) => setSettings({...settings, sender_email: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                </>
              )}
            </CardContent>
          )}
        </Card>

        {/* Live Chat Settings (Crisp) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare size={20} className="text-purple-500" />
                  {getText('Chat Dirèk (Crisp)', 'Chat en Direct (Crisp)', 'Live Chat (Crisp)')}
                </CardTitle>
                <CardDescription>
                  {getText('Widget chat pou sipò kliyan', 'Widget chat pour support client', 'Chat widget for customer support')}
                </CardDescription>
              </div>
              <Switch
                checked={settings.crisp_enabled}
                onCheckedChange={(checked) => setSettings({...settings, crisp_enabled: checked})}
              />
            </div>
          </CardHeader>
          {settings.crisp_enabled && (
            <CardContent className="space-y-4 border-t pt-4">
              <div>
                <Label htmlFor="crisp_id">Crisp Website ID</Label>
                <Input
                  id="crisp_id"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={settings.crisp_website_id || ''}
                  onChange={(e) => setSettings({...settings, crisp_website_id: e.target.value})}
                  className="mt-1 font-mono"
                />
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                  {getText(
                    'Jwenn ID ou nan Crisp → Settings → Website Settings',
                    'Trouvez votre ID dans Crisp → Settings → Website Settings',
                    'Find your ID in Crisp → Settings → Website Settings'
                  )}
                  {' '}<a href="https://crisp.chat" target="_blank" rel="noreferrer" className="text-[#EA580C] hover:underline">crisp.chat</a>
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* WhatsApp Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Phone size={20} className="text-emerald-500" />
                  WhatsApp
                </CardTitle>
                <CardDescription>
                  {getText('Bouton WhatsApp pou kontakte sipò', 'Bouton WhatsApp pour contacter le support', 'WhatsApp button to contact support')}
                </CardDescription>
              </div>
              <Switch
                checked={settings.whatsapp_enabled}
                onCheckedChange={(checked) => setSettings({...settings, whatsapp_enabled: checked})}
              />
            </div>
          </CardHeader>
          {settings.whatsapp_enabled && (
            <CardContent className="space-y-4 border-t pt-4">
              <div>
                <Label htmlFor="whatsapp">{getText('Nimewo WhatsApp Business', 'Numéro WhatsApp Business', 'WhatsApp Business Number')}</Label>
                <Input
                  id="whatsapp"
                  placeholder="+50939308318"
                  value={settings.whatsapp_number || ''}
                  onChange={(e) => setSettings({...settings, whatsapp_number: e.target.value})}
                  className="mt-1"
                />
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                  {getText('Format: +509XXXXXXXX', 'Format: +509XXXXXXXX', 'Format: +509XXXXXXXX')}
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* USDT/Plisio Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wallet size={20} className="text-amber-500" />
                  USDT (Plisio)
                </CardTitle>
                <CardDescription>
                  {getText('Peman kriptomone otomatik', 'Paiements crypto automatiques', 'Automatic crypto payments')}
                </CardDescription>
              </div>
              <Switch
                checked={settings.plisio_enabled}
                onCheckedChange={(checked) => setSettings({...settings, plisio_enabled: checked})}
              />
            </div>
          </CardHeader>
          {settings.plisio_enabled && (
            <CardContent className="space-y-4 border-t pt-4">
              <div>
                <Label htmlFor="plisio_key">
                  <Key size={16} className="inline mr-2" />
                  {getText('Kle API Plisio', 'Clé API Plisio', 'Plisio API Key')}
                </Label>
                <Input
                  id="plisio_key"
                  type="password"
                      placeholder={
                        settings.plisio_api_key_last4
                          ? `Configured (****${settings.plisio_api_key_last4}) - enter new to replace`
                          : "plisio_api_key"
                      }
                  value={settings.plisio_api_key || ''}
                  onChange={(e) => setSettings({...settings, plisio_api_key: e.target.value})}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="plisio_secret">
                  <Shield size={16} className="inline mr-2" />
                  {getText('Sekrè Plisio', 'Secret Plisio', 'Plisio Secret')}
                </Label>
                <Input
                  id="plisio_secret"
                  type="password"
                  placeholder={
                    settings.plisio_secret_key_last4
                      ? `Configured (****${settings.plisio_secret_key_last4}) - enter new to replace`
                      : "plisio_secret_key"
                  }
                  value={settings.plisio_secret_key || ''}
                  onChange={(e) => setSettings({...settings, plisio_secret_key: e.target.value})}
                  className="mt-1 font-mono"
                />
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                  {getText('Jwenn kle ou sou', 'Obtenez vos clés sur', 'Get your keys at')}{' '}
                  <a href="https://plisio.net" target="_blank" rel="noreferrer" className="text-[#EA580C] hover:underline">plisio.net</a>
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Manual HTG Deposits (MonCash/NatCash) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone size={20} className="text-[#EA580C]" />
              {getText('Depo manyèl (HTG)', 'Dépôts manuels (HTG)', 'Manual deposits (HTG)')}
            </CardTitle>
            <CardDescription>
              {getText(
                'Jere nimewo MonCash/NatCash pou resevwa depo yo, epi aktive/deaktive yo.',
                'Gérez les numéros MonCash/NatCash pour recevoir les dépôts, et activez/désactivez-les.',
                'Manage MonCash/NatCash numbers for manual deposits and enable/disable them.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">MonCash</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {getText('Mete nimewo a (ex: +509XXXXXXXX)', 'Numéro (ex: +509XXXXXXXX)', 'Number (e.g. +509XXXXXXXX)')}
                  </p>
                </div>
                <Switch
                  checked={!!settings.moncash_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, moncash_enabled: checked })}
                />
              </div>
              <div>
                <Label htmlFor="moncash_number">{getText('Nimewo MonCash', 'Numéro MonCash', 'MonCash number')}</Label>
                <Input
                  id="moncash_number"
                  placeholder="+50900000000"
                  value={settings.moncash_number || ''}
                  onChange={(e) => setSettings({ ...settings, moncash_number: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">NatCash</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {getText('Mete nimewo a (ex: +509XXXXXXXX)', 'Numéro (ex: +509XXXXXXXX)', 'Number (e.g. +509XXXXXXXX)')}
                  </p>
                </div>
                <Switch
                  checked={!!settings.natcash_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, natcash_enabled: checked })}
                />
              </div>
              <div>
                <Label htmlFor="natcash_number">{getText('Nimewo NatCash', 'Numéro NatCash', 'NatCash number')}</Label>
                <Input
                  id="natcash_number"
                  placeholder="+50900000000"
                  value={settings.natcash_number || ''}
                  onChange={(e) => setSettings({ ...settings, natcash_number: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fees & Affiliate Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign size={20} className="text-purple-500" />
              {getText('Frè & Afilyasyon', 'Frais & Affiliation', 'Fees & Affiliate')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="card_fee">
                  <CreditCard size={16} className="inline mr-2" />
                  {getText('Frè komand kat (HTG)', 'Frais commande carte (HTG)', 'Card order fee (HTG)')}
                </Label>
                <Input
                  id="card_fee"
                  type="number"
                  value={settings.card_order_fee_htg || 500}
                  onChange={(e) => setSettings({...settings, card_order_fee_htg: parseInt(e.target.value)})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="affiliate_reward">
                  {getText('Rekonpans afilyasyon (HTG)', 'Récompense affiliation (HTG)', 'Affiliate reward (HTG)')}
                </Label>
                <Input
                  id="affiliate_reward"
                  type="number"
                  value={settings.affiliate_reward_htg || 2000}
                  onChange={(e) => setSettings({...settings, affiliate_reward_htg: parseInt(e.target.value)})}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="cards_required">
                {getText('Kat obligatwa pou rekonpans', 'Cartes requises pour récompense', 'Cards required for reward')}
              </Label>
              <Input
                id="cards_required"
                type="number"
                value={settings.affiliate_cards_required || 5}
                onChange={(e) => setSettings({...settings, affiliate_cards_required: parseInt(e.target.value)})}
                className="mt-1"
              />
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                {getText(
                  `Paren an ap touche G ${settings.affiliate_reward_htg || 2000} pou chak ${settings.affiliate_cards_required || 5} kat ki komande`,
                  `Le parrain gagne G ${settings.affiliate_reward_htg || 2000} pour chaque ${settings.affiliate_cards_required || 5} cartes commandées`,
                  `Referrer earns G ${settings.affiliate_reward_htg || 2000} for every ${settings.affiliate_cards_required || 5} cards ordered`
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Diagnostics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={20} className="text-slate-600" />
              {getText('Dyagnostik', 'Diagnostics', 'Diagnostics')}
            </CardTitle>
            <CardDescription>
              {getText(
                'Verifye si konfig admin yo byen ploge (Resend/WhatsApp/Plisio) epi si DB a OK.',
                'Vérifier la configuration admin (Resend/WhatsApp/Plisio) et la connexion DB.',
                'Verify admin configuration (Resend/WhatsApp/Plisio) and DB connectivity.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" onClick={fetchDiagnostics} disabled={diagnosticsLoading}>
              {diagnosticsLoading ? getText('Chajman...', 'Chargement...', 'Loading...') : getText('Kouri dyagnostik', 'Lancer diagnostics', 'Run diagnostics')}
            </Button>

            <Button variant="outline" onClick={purgeOldRecords}>
              {getText('Efase istorik ki depase 7 jou', 'Supprimer l’historique > 7 jours', 'Delete history older than 7 days')}
            </Button>

            {diagnostics && (
              <div className="text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span>DB</span>
                  <Badge className={diagnostics.diagnostics?.db_ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                    {diagnostics.diagnostics?.db_ok ? 'OK' : 'KO'}
                  </Badge>
                </div>

                {Array.isArray(diagnostics.warnings) && diagnostics.warnings.length > 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="font-medium text-amber-800 mb-1">Warnings</p>
                    <ul className="list-disc pl-5 text-amber-700">
                      {diagnostics.warnings.map((w) => <li key={w}>{w}</li>)}
                    </ul>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800">
                    {getText('Pa gen pwoblèm detekte.', 'Aucun problème détecté.', 'No issues detected.')}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Button onClick={saveSettings} disabled={saving} className="w-full btn-primary">
          <Save size={18} className="mr-2" />
          {saving 
            ? getText('Anrejistreman...', 'Enregistrement...', 'Saving...') 
            : getText('Anrejistre paramèt yo', 'Enregistrer les paramètres', 'Save settings')}
        </Button>
      </div>
    </AdminLayout>
  );
}
