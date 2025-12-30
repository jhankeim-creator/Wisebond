import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Save, 
  Key, 
  Mail, 
  Wallet, 
  CreditCard, 
  DollarSign, 
  Shield, 
  MessageSquare, 
  Phone, 
  Smartphone, 
  Send,
  Bell,
  Settings2,
  Banknote,
  Users,
  Trash2,
  RefreshCw
} from 'lucide-react';

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
    
    // WhatsApp (CallMeBot - free)
    whatsapp_enabled: false,
    whatsapp_number: '',
    callmebot_api_key: '',
    
    // Telegram (FREE & Unlimited) - RECOMMENDED
    telegram_enabled: false,
    telegram_bot_token: '',
    telegram_chat_id: '',
    
    // USDT (Plisio)
    plisio_enabled: false,
    plisio_api_key: '',
    plisio_secret_key: '',

    // Manual HTG deposits
    moncash_enabled: true,
    moncash_number: '',
    moncash_name: '',
    moncash_qr: '',
    natcash_enabled: true,
    natcash_number: '',
    natcash_name: '',
    natcash_qr: '',
    
    // USD payment info
    zelle_email: '',
    zelle_name: '',
    paypal_email: '',
    paypal_name: '',
    
    // Fees & Affiliate
    card_order_fee_htg: 500,
    affiliate_reward_htg: 2000,
    affiliate_cards_required: 5
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [whatsappTest, setWhatsappTest] = useState({ phone: '', message: '' });
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);
  const [whatsappNotifications, setWhatsappNotifications] = useState([]);
  const [whatsappStats, setWhatsappStats] = useState({});
  const [activeTab, setActiveTab] = useState('notifications');

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    fetchSettings();
    fetchWhatsappNotifications();
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

  const fetchWhatsappNotifications = async () => {
    try {
      const response = await axios.get(`${API}/admin/whatsapp-notifications?limit=10`);
      setWhatsappNotifications(response.data.notifications || []);
      setWhatsappStats(response.data.stats || {});
    } catch (error) {
      console.error('Error fetching WhatsApp notifications:', error);
    }
  };

  const testWhatsapp = async () => {
    if (!whatsappTest.phone) {
      toast.error(getText('Antre nimewo telefòn', 'Entrez le numéro de téléphone', 'Enter phone number'));
      return;
    }
    
    setTestingWhatsapp(true);
    try {
      const response = await axios.post(`${API}/admin/test-whatsapp`, {
        phone_number: whatsappTest.phone,
        message: whatsappTest.message || 'Tès notifikasyon WhatsApp depi KAYICOM 🎉'
      });
      
      if (response.data.success) {
        toast.success(getText('Mesaj voye avèk siksè!', 'Message envoyé avec succès!', 'Message sent successfully!'));
        setWhatsappTest({ phone: '', message: '' });
        fetchWhatsappNotifications();
      } else {
        toast.error(response.data.message || getText('Echèk voye mesaj', 'Échec envoi message', 'Failed to send message'));
      }
    } catch (error) {
      toast.error(getText('Erè koneksyon API', 'Erreur connexion API', 'API connection error'));
    } finally {
      setTestingWhatsapp(false);
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

  // Tab content components
  const NotificationsTab = () => (
    <div className="space-y-4">
      {/* Email Settings (Resend) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Mail size={20} className="text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">{getText('Imèl (Resend)', 'Email (Resend)', 'Email (Resend)')}</CardTitle>
                <CardDescription className="text-sm">
                  {getText('Voye notifikasyon pa imèl', 'Envoyer des notifications par email', 'Send email notifications')}
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.resend_enabled}
              onCheckedChange={(checked) => setSettings({...settings, resend_enabled: checked})}
            />
          </div>
        </CardHeader>
        {settings.resend_enabled && (
          <CardContent className="space-y-4 border-t pt-4">
            <div>
              <Label htmlFor="resend_key" className="flex items-center gap-2">
                <Key size={14} />
                {getText('Kle API Resend', 'Clé API Resend', 'Resend API Key')}
              </Label>
              <Input
                id="resend_key"
                type="password"
                placeholder={settings.resend_api_key_last4 ? `****${settings.resend_api_key_last4}` : "re_xxxxxxxxxxxxx"}
                value={settings.resend_api_key || ''}
                onChange={(e) => setSettings({...settings, resend_api_key: e.target.value})}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-stone-500 mt-1">
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
          </CardContent>
        )}
      </Card>

      {/* Telegram Notifications (FREE) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Send size={20} className="text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Telegram Bot
                  <Badge className="bg-emerald-500 text-white text-xs">GRATIS</Badge>
                </CardTitle>
                <CardDescription className="text-sm">
                  {getText('Notifikasyon Telegram gratis e san limit', 'Notifications Telegram gratuites et illimitées', 'Free and unlimited Telegram notifications')}
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.telegram_enabled}
              onCheckedChange={(checked) => setSettings({...settings, telegram_enabled: checked})}
            />
          </div>
        </CardHeader>
        {settings.telegram_enabled && (
          <CardContent className="space-y-4 border-t pt-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
              <p className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                {getText('Kijan pou konfigire:', 'Comment configurer:', 'How to setup:')}
              </p>
              <ol className="list-decimal list-inside text-blue-700 dark:text-blue-400 space-y-1 text-xs">
                <li>{getText('Chèche', 'Recherchez', 'Search')} @BotFather {getText('nan Telegram', 'sur Telegram', 'on Telegram')}</li>
                <li>{getText('Voye', 'Envoyez', 'Send')} /newbot</li>
                <li>{getText('Kopye Bot Token', 'Copiez le Bot Token', 'Copy the Bot Token')}</li>
                <li>{getText('Jwenn chat ID ou', 'Trouvez votre chat ID', 'Find your chat ID')}</li>
              </ol>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Bot Token</Label>
                <Input
                  type="password"
                  placeholder="123456789:ABC..."
                  value={settings.telegram_bot_token || ''}
                  onChange={(e) => setSettings({...settings, telegram_bot_token: e.target.value})}
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label>Chat ID</Label>
                <Input
                  placeholder="-1001234567890"
                  value={settings.telegram_chat_id || ''}
                  onChange={(e) => setSettings({...settings, telegram_chat_id: e.target.value})}
                  className="mt-1 font-mono text-sm"
                />
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const res = await axios.post(`${API}/admin/test-telegram`, {
                    message: '🔔 Tès notifikasyon depi KAYICOM Admin!'
                  });
                  if (res.data.success) {
                    toast.success(getText('Mesaj Telegram voye! ✅', 'Message Telegram envoyé! ✅', 'Telegram message sent! ✅'));
                  } else {
                    toast.error(res.data.message);
                  }
                } catch (e) {
                  toast.error(getText('Erè nan tès', 'Erreur de test', 'Test error'));
                }
              }}
            >
              <Send size={14} className="mr-2" />
              {getText('Teste', 'Tester', 'Test')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* WhatsApp Settings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Phone size={20} className="text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">WhatsApp (CallMeBot)</CardTitle>
                <CardDescription className="text-sm">
                  {getText('Notifikasyon WhatsApp pou ajan yo', 'Notifications WhatsApp pour agents', 'WhatsApp notifications for agents')}
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.whatsapp_enabled}
              onCheckedChange={(checked) => setSettings({...settings, whatsapp_enabled: checked})}
            />
          </div>
        </CardHeader>
        {settings.whatsapp_enabled && (
          <CardContent className="space-y-4 border-t pt-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg p-3">
              <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm mb-2">
                {getText('Kijan pou aktive CallMeBot:', 'Comment activer CallMeBot:', 'How to activate CallMeBot:')}
              </p>
              <ol className="list-decimal list-inside text-emerald-700 dark:text-emerald-400 space-y-1 text-xs">
                <li>{getText('Voye mesaj sa a bay', 'Envoyez ce message à', 'Send this message to')} +34 644 71 67 43</li>
                <li className="ml-4 font-mono bg-white dark:bg-stone-800 p-1 rounded text-xs inline-block">I allow callmebot to send me messages</li>
                <li>{getText('Antre apikey la anba a', "Entrez l'apikey ci-dessous", 'Enter the apikey below')}</li>
              </ol>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{getText('Nimewo WhatsApp Sipò', 'Numéro WhatsApp Support', 'Support WhatsApp Number')}</Label>
                <Input
                  placeholder="+50939308318"
                  value={settings.whatsapp_number || ''}
                  onChange={(e) => setSettings({...settings, whatsapp_number: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>CallMeBot API Key</Label>
                <Input
                  placeholder="123456"
                  value={settings.callmebot_api_key || ''}
                  onChange={(e) => setSettings({...settings, callmebot_api_key: e.target.value})}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            {/* WhatsApp Test */}
            <div className="bg-stone-100 dark:bg-stone-800 rounded-lg p-4">
              <p className="font-semibold text-sm mb-3">{getText('Teste WhatsApp', 'Tester WhatsApp', 'Test WhatsApp')}</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="+509XXXXXXXX"
                  value={whatsappTest.phone}
                  onChange={(e) => setWhatsappTest({...whatsappTest, phone: e.target.value})}
                  className="flex-1"
                />
                <Button onClick={testWhatsapp} disabled={testingWhatsapp || !whatsappTest.phone} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  {testingWhatsapp ? '...' : getText('Voye Tès', 'Envoyer Test', 'Send Test')}
                </Button>
              </div>
              
              {/* Stats */}
              {whatsappStats.total > 0 && (
                <div className="mt-3 flex gap-2 text-xs flex-wrap">
                  <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 px-2 py-1 rounded">✅ {whatsappStats.sent || 0}</span>
                  <span className="bg-red-100 dark:bg-red-900/30 text-red-700 px-2 py-1 rounded">❌ {whatsappStats.failed || 0}</span>
                  <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 px-2 py-1 rounded">⏳ {whatsappStats.pending || 0}</span>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Live Chat (Crisp) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <MessageSquare size={20} className="text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-base">{getText('Chat Dirèk (Crisp)', 'Chat en Direct (Crisp)', 'Live Chat (Crisp)')}</CardTitle>
                <CardDescription className="text-sm">
                  {getText('Widget chat pou sipò kliyan', 'Widget chat pour support client', 'Chat widget for customer support')}
                </CardDescription>
              </div>
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
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-stone-500 mt-1">
                <a href="https://crisp.chat" target="_blank" rel="noreferrer" className="text-[#EA580C] hover:underline">crisp.chat</a> → Settings → Website Settings
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );

  const DepositMethodsTab = () => (
    <div className="space-y-4">
      {/* HTG Deposit Methods */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Smartphone size={20} className="text-[#EA580C]" />
            </div>
            <div>
              <CardTitle className="text-base">{getText('Metòd Depo HTG', 'Méthodes Dépôt HTG', 'HTG Deposit Methods')}</CardTitle>
              <CardDescription className="text-sm">
                {getText('Konfigire MonCash ak NatCash pou depo', 'Configurer MonCash et NatCash pour dépôts', 'Configure MonCash and NatCash for deposits')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* MonCash */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-red-500 text-white">MonCash</Badge>
                <span className="text-xs text-stone-500">DEPO</span>
              </div>
              <Switch
                checked={!!settings.moncash_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, moncash_enabled: checked })}
              />
            </div>
            {settings.moncash_enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{getText('Non Reseptè', 'Nom', 'Name')}</Label>
                  <Input
                    placeholder="KAYICOM"
                    value={settings.moncash_name || ''}
                    onChange={(e) => setSettings({ ...settings, moncash_name: e.target.value })}
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">{getText('Nimewo', 'Numéro', 'Number')}</Label>
                  <Input
                    placeholder="+50900000000"
                    value={settings.moncash_number || ''}
                    onChange={(e) => setSettings({ ...settings, moncash_number: e.target.value })}
                    className="mt-1 h-9"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">{getText('QR Kod URL', 'URL QR Code', 'QR Code URL')}</Label>
                  <Input
                    placeholder="https://example.com/qr-moncash.png"
                    value={settings.moncash_qr || ''}
                    onChange={(e) => setSettings({ ...settings, moncash_qr: e.target.value })}
                    className="mt-1 h-9"
                  />
                  {settings.moncash_qr && (
                    <img src={settings.moncash_qr} alt="QR" className="mt-2 w-16 h-16 object-contain rounded border" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* NatCash */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-yellow-500 text-white">NatCash</Badge>
                <span className="text-xs text-stone-500">DEPO</span>
              </div>
              <Switch
                checked={!!settings.natcash_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, natcash_enabled: checked })}
              />
            </div>
            {settings.natcash_enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{getText('Non Reseptè', 'Nom', 'Name')}</Label>
                  <Input
                    placeholder="KAYICOM"
                    value={settings.natcash_name || ''}
                    onChange={(e) => setSettings({ ...settings, natcash_name: e.target.value })}
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">{getText('Nimewo', 'Numéro', 'Number')}</Label>
                  <Input
                    placeholder="+50900000000"
                    value={settings.natcash_number || ''}
                    onChange={(e) => setSettings({ ...settings, natcash_number: e.target.value })}
                    className="mt-1 h-9"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">{getText('QR Kod URL', 'URL QR Code', 'QR Code URL')}</Label>
                  <Input
                    placeholder="https://example.com/qr-natcash.png"
                    value={settings.natcash_qr || ''}
                    onChange={(e) => setSettings({ ...settings, natcash_qr: e.target.value })}
                    className="mt-1 h-9"
                  />
                  {settings.natcash_qr && (
                    <img src={settings.natcash_qr} alt="QR" className="mt-2 w-16 h-16 object-contain rounded border" />
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* USD Deposit Methods */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <DollarSign size={20} className="text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base">{getText('Metòd Depo USD', 'Méthodes Dépôt USD', 'USD Deposit Methods')}</CardTitle>
              <CardDescription className="text-sm">
                {getText('Konfigire Zelle ak PayPal pou depo', 'Configurer Zelle et PayPal pour dépôts', 'Configure Zelle and PayPal for deposits')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Zelle */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-600 text-white">Zelle</Badge>
              <span className="text-xs text-stone-500">DEPO</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{getText('Non Reseptè', 'Nom', 'Name')}</Label>
                <Input
                  placeholder="KAYICOM"
                  value={settings.zelle_name || ''}
                  onChange={(e) => setSettings({ ...settings, zelle_name: e.target.value })}
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  placeholder="payments@kayicom.com"
                  value={settings.zelle_email || ''}
                  onChange={(e) => setSettings({ ...settings, zelle_email: e.target.value })}
                  className="mt-1 h-9"
                />
              </div>
            </div>
          </div>

          {/* PayPal */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-600 text-white">PayPal</Badge>
              <span className="text-xs text-stone-500">DEPO</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{getText('Non Reseptè', 'Nom', 'Name')}</Label>
                <Input
                  placeholder="KAYICOM"
                  value={settings.paypal_name || ''}
                  onChange={(e) => setSettings({ ...settings, paypal_name: e.target.value })}
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  placeholder="payments@kayicom.com"
                  value={settings.paypal_email || ''}
                  onChange={(e) => setSettings({ ...settings, paypal_email: e.target.value })}
                  className="mt-1 h-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* USDT/Crypto */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Wallet size={20} className="text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">USDT (Plisio)</CardTitle>
                <CardDescription className="text-sm">
                  {getText('Peman kriptomone otomatik', 'Paiements crypto automatiques', 'Automatic crypto payments')}
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.plisio_enabled}
              onCheckedChange={(checked) => setSettings({...settings, plisio_enabled: checked})}
            />
          </div>
        </CardHeader>
        {settings.plisio_enabled && (
          <CardContent className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-2">
                  <Key size={14} />
                  {getText('Kle API', 'Clé API', 'API Key')}
                </Label>
                <Input
                  type="password"
                  placeholder={settings.plisio_api_key_last4 ? `****${settings.plisio_api_key_last4}` : "plisio_api_key"}
                  value={settings.plisio_api_key || ''}
                  onChange={(e) => setSettings({...settings, plisio_api_key: e.target.value})}
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <Shield size={14} />
                  {getText('Sekrè', 'Secret', 'Secret')}
                </Label>
                <Input
                  type="password"
                  placeholder={settings.plisio_secret_key_last4 ? `****${settings.plisio_secret_key_last4}` : "plisio_secret_key"}
                  value={settings.plisio_secret_key || ''}
                  onChange={(e) => setSettings({...settings, plisio_secret_key: e.target.value})}
                  className="mt-1 font-mono text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-stone-500">
              <a href="https://plisio.net" target="_blank" rel="noreferrer" className="text-[#EA580C] hover:underline">plisio.net</a>
            </p>
          </CardContent>
        )}
      </Card>

      {/* Info about Payment Methods */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>💡 {getText('Konsèy', 'Conseil', 'Tip')}:</strong> {getText(
            'Pou plis metòd peman avanse (ak opsyon depo/retrè), ale nan "Mwayen Peman" nan meni a.',
            'Pour plus de méthodes de paiement avancées (avec options dépôt/retrait), allez dans "Moyens de paiement" dans le menu.',
            'For more advanced payment methods (with deposit/withdrawal options), go to "Payment Methods" in the menu.'
          )}
        </p>
      </div>
    </div>
  );

  const FeesTab = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <CreditCard size={20} className="text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-base">{getText('Frè ak Afilyasyon', 'Frais et Affiliation', 'Fees & Affiliate')}</CardTitle>
              <CardDescription className="text-sm">
                {getText('Jere frè kat ak pwogram afilyasyon', 'Gérer frais carte et programme affiliation', 'Manage card fees and affiliate program')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <CreditCard size={14} />
                {getText('Frè komand kat (HTG)', 'Frais carte (HTG)', 'Card fee (HTG)')}
              </Label>
              <Input
                type="number"
                value={settings.card_order_fee_htg || 500}
                onChange={(e) => setSettings({...settings, card_order_fee_htg: parseInt(e.target.value)})}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{getText('Rekonpans afilyasyon (HTG)', 'Récompense (HTG)', 'Affiliate reward (HTG)')}</Label>
              <Input
                type="number"
                value={settings.affiliate_reward_htg || 2000}
                onChange={(e) => setSettings({...settings, affiliate_reward_htg: parseInt(e.target.value)})}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{getText('Kat obligatwa', 'Cartes requises', 'Cards required')}</Label>
              <Input
                type="number"
                value={settings.affiliate_cards_required || 5}
                onChange={(e) => setSettings({...settings, affiliate_cards_required: parseInt(e.target.value)})}
                className="mt-1"
              />
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {getText(
                `Paren ap touche G ${settings.affiliate_reward_htg || 2000} pou chak ${settings.affiliate_cards_required || 5} kat ki komande.`,
                `Le parrain gagne G ${settings.affiliate_reward_htg || 2000} pour chaque ${settings.affiliate_cards_required || 5} cartes commandées.`,
                `Referrer earns G ${settings.affiliate_reward_htg || 2000} for every ${settings.affiliate_cards_required || 5} cards ordered.`
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Transparent Fee Display */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <DollarSign size={20} className="text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base">{getText('Transparan Frè', 'Transparence Frais', 'Fee Transparency')}</CardTitle>
              <CardDescription className="text-sm">
                {getText('Enfòmasyon sou frè yo', 'Information sur les frais', 'Information about fees')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <span className="text-sm font-medium">{getText('Depo', 'Dépôt', 'Deposit')}</span>
              <Badge className="bg-emerald-500 text-white">{getText('GRATIS', 'GRATUIT', 'FREE')}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800 rounded-lg">
              <span className="text-sm font-medium">{getText('Retrè', 'Retrait', 'Withdrawal')}</span>
              <span className="text-sm text-stone-600">{getText('Depann de metòd', 'Selon méthode', 'Depends on method')}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800 rounded-lg">
              <span className="text-sm font-medium">{getText('Transfè Entèn', 'Transfert Interne', 'Internal Transfer')}</span>
              <Badge className="bg-emerald-500 text-white">{getText('GRATIS', 'GRATUIT', 'FREE')}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <span className="text-sm font-medium">{getText('Konvèsyon (Swap)', 'Conversion (Swap)', 'Swap')}</span>
              <span className="text-sm text-stone-600">{getText('Selon to chanj', 'Selon taux change', 'Per exchange rate')}</span>
            </div>
          </div>
          <p className="text-xs text-stone-500 mt-4">
            {getText(
              'Pou jere frè retrè detaye, ale nan "Frè ak Limit" nan meni a.',
              'Pour gérer les frais de retrait détaillés, allez dans "Frais et limites" dans le menu.',
              'To manage detailed withdrawal fees, go to "Fees & Limits" in the menu.'
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const SystemTab = () => (
    <div className="space-y-4">
      {/* Diagnostics */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-900/30 flex items-center justify-center">
              <Shield size={20} className="text-slate-600" />
            </div>
            <div>
              <CardTitle className="text-base">{getText('Dyagnostik Sistèm', 'Diagnostics Système', 'System Diagnostics')}</CardTitle>
              <CardDescription className="text-sm">
                {getText('Verifye konfigirasyon ak koneksyon', 'Vérifier configuration et connexion', 'Check configuration and connection')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={fetchDiagnostics} disabled={diagnosticsLoading}>
              <RefreshCw size={16} className={`mr-2 ${diagnosticsLoading ? 'animate-spin' : ''}`} />
              {getText('Kouri dyagnostik', 'Lancer diagnostics', 'Run diagnostics')}
            </Button>
            <Button variant="outline" onClick={purgeOldRecords} className="text-red-600 border-red-200 hover:bg-red-50">
              <Trash2 size={16} className="mr-2" />
              {getText('Efase istorik > 7 jou', 'Supprimer > 7 jours', 'Delete > 7 days')}
            </Button>
          </div>

          {diagnostics && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800 rounded-lg">
                <span className="font-medium">Database</span>
                <Badge className={diagnostics.diagnostics?.db_ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                  {diagnostics.diagnostics?.db_ok ? 'OK' : 'KO'}
                </Badge>
              </div>

              {Array.isArray(diagnostics.warnings) && diagnostics.warnings.length > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="font-medium text-amber-800 mb-2 text-sm">Warnings</p>
                  <ul className="list-disc pl-5 text-amber-700 text-sm space-y-1">
                    {diagnostics.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-sm">
                  {getText('Pa gen pwoblèm detekte.', 'Aucun problème détecté.', 'No issues detected.')}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <AdminLayout title={getText('Paramèt', 'Paramètres', 'Settings')}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw size={32} className="animate-spin mx-auto text-[#EA580C] mb-4" />
            <p className="text-stone-500">{getText('Chajman...', 'Chargement...', 'Loading...')}</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={getText('Paramèt', 'Paramètres', 'Settings')}>
      <div className="max-w-4xl mx-auto space-y-6" data-testid="admin-settings">
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <TabsTrigger value="notifications" className="flex items-center gap-2 text-xs sm:text-sm py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-stone-900">
              <Bell size={16} />
              <span className="hidden sm:inline">{getText('Notifikasyon', 'Notifications', 'Notifications')}</span>
              <span className="sm:hidden">{getText('Notif', 'Notif', 'Notif')}</span>
            </TabsTrigger>
            <TabsTrigger value="deposit" className="flex items-center gap-2 text-xs sm:text-sm py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-stone-900">
              <Banknote size={16} />
              <span className="hidden sm:inline">{getText('Metòd Depo', 'Méthodes Dépôt', 'Deposit Methods')}</span>
              <span className="sm:hidden">{getText('Depo', 'Dépôt', 'Deposit')}</span>
            </TabsTrigger>
            <TabsTrigger value="fees" className="flex items-center gap-2 text-xs sm:text-sm py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-stone-900">
              <DollarSign size={16} />
              <span className="hidden sm:inline">{getText('Frè', 'Frais', 'Fees')}</span>
              <span className="sm:hidden">{getText('Frè', 'Frais', 'Fees')}</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2 text-xs sm:text-sm py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-stone-900">
              <Settings2 size={16} />
              <span className="hidden sm:inline">{getText('Sistèm', 'Système', 'System')}</span>
              <span className="sm:hidden">{getText('Sist', 'Syst', 'Sys')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="mt-6">
            <NotificationsTab />
          </TabsContent>

          <TabsContent value="deposit" className="mt-6">
            <DepositMethodsTab />
          </TabsContent>

          <TabsContent value="fees" className="mt-6">
            <FeesTab />
          </TabsContent>

          <TabsContent value="system" className="mt-6">
            <SystemTab />
          </TabsContent>
        </Tabs>

        {/* Save Button - Always visible */}
        <div className="sticky bottom-4 z-10">
          <Button 
            onClick={saveSettings} 
            disabled={saving} 
            className="w-full btn-primary shadow-lg"
          >
            <Save size={18} className="mr-2" />
            {saving 
              ? getText('Anrejistreman...', 'Enregistrement...', 'Saving...') 
              : getText('Anrejistre paramèt yo', 'Enregistrer les paramètres', 'Save settings')}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
