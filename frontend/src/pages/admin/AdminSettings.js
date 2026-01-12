import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Megaphone,
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

    // Virtual Cards (Strowallet) - enable only in production
    strowallet_enabled: false,
    strowallet_base_url: '',
    strowallet_api_key: '',
    strowallet_api_secret: '',
    strowallet_create_user_path: '',
    strowallet_create_card_path: '',
    strowallet_fund_card_path: '',
    strowallet_withdraw_card_path: '',
    strowallet_fetch_card_detail_path: '',
    strowallet_card_transactions_path: '',
    strowallet_brand_name: 'KAYICOM',
    
    // Fees & Affiliate
    card_order_fee_htg: 500,
    affiliate_reward_htg: 2000,
    affiliate_cards_required: 5,

    // Card default background
    card_background_image: null,

    // International minutes (TopUp) fee tiers
    topup_fee_tiers: [],

    // Announcement bar (top banner)
    announcement_enabled: false,
    announcement_text_ht: '',
    announcement_text_fr: '',
    announcement_text_en: '',
    announcement_link: ''
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
      const incoming = { ...(response.data.settings || {}) };
      // Remove legacy payment settings keys if they still exist in DB
      for (const k of Object.keys(incoming)) {
        if (k.startsWith('moncash_') || k.startsWith('natcash_') || k.startsWith('zelle_') || k.startsWith('paypal_')) {
          delete incoming[k];
        }
      }
      setSettings(prev => ({ ...prev, ...incoming }));
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

      // Validate announcement: must have at least one language text if enabled
      if (
        settings.announcement_enabled &&
        !(settings.announcement_text_ht || settings.announcement_text_fr || settings.announcement_text_en)
      ) {
        toast.error(getText(
          'Mete omwen 1 tèks pou anons la (HT/FR/EN) avan ou sove.',
          'Ajoutez au moins 1 texte (HT/FR/EN) avant d’enregistrer.',
          'Add at least 1 announcement text (HT/FR/EN) before saving.'
        ));
        setSaving(false);
        return;
      }

      // Only send supported settings keys (avoid sending legacy payment keys)
      const allowedKeys = new Set([
        'resend_enabled', 'resend_api_key', 'sender_email',
        'crisp_enabled', 'crisp_website_id',
        'whatsapp_enabled', 'whatsapp_number', 'callmebot_api_key',
        'telegram_enabled', 'telegram_bot_token', 'telegram_chat_id',
        'plisio_enabled', 'plisio_api_key', 'plisio_secret_key',
        'strowallet_enabled', 'strowallet_base_url', 'strowallet_api_key', 'strowallet_api_secret',
        'strowallet_create_user_path', 'strowallet_create_card_path', 'strowallet_fund_card_path', 'strowallet_withdraw_card_path',
        'strowallet_fetch_card_detail_path', 'strowallet_card_transactions_path',
        'strowallet_brand_name',
        'card_order_fee_htg', 'affiliate_reward_htg', 'affiliate_cards_required',
        'card_background_image',
        'topup_fee_tiers',
        'announcement_enabled', 'announcement_text_ht', 'announcement_text_fr', 'announcement_text_en', 'announcement_link',
      ]);
      const filteredPayload = Object.fromEntries(
        Object.entries(payload).filter(([k]) => allowedKeys.has(k))
      );
      
      // Clean up empty strings - convert to null for optional fields
      const cleanedPayload = Object.fromEntries(
        Object.entries(filteredPayload).map(([key, value]) => [
          key,
          value === '' ? null : value
        ])
      );
      
      await axios.put(`${API}/admin/settings`, cleanedPayload);
      toast.success(getText('Paramèt anrejistre!', 'Paramètres enregistrés!', 'Settings saved!'));
      fetchSettings(); // Refresh to get updated values
    } catch (error) {
      console.error('Save settings error:', error);
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message || getText('Erè nan anrejistreman', 'Erreur lors de la sauvegarde', 'Error saving');
      toast.error(errorMsg);
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
      {/* Announcement bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Megaphone size={20} className="text-amber-600" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">{getText('Bann Anons', 'Bandeau d’annonce', 'Announcement Bar')}</CardTitle>
                <CardDescription className="text-sm">
                  {getText('Montre yon anons anwo ekran an', 'Afficher une annonce en haut', 'Show a banner at the top')}
                </CardDescription>
              </div>
            </div>
            <div className="flex justify-end sm:justify-normal">
              <Switch
                checked={settings.announcement_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, announcement_enabled: checked })}
              />
            </div>
          </div>
        </CardHeader>
        {settings.announcement_enabled && (
          <CardContent className="space-y-3 border-t pt-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
              {getText(
                'Apre ou sove, refresh paj la pou w wè anons lan anwo ekran an.',
                'Après sauvegarde, rafraîchissez la page pour voir l’annonce en haut.',
                'After saving, refresh the page to see the banner at the top.'
              )}
            </div>
            <div>
              <Label>{getText('Tèks anons la', 'Texte de l’annonce', 'Announcement text')}</Label>
              <Textarea
                value={(settings.announcement_text_ht || settings.announcement_text_fr || settings.announcement_text_en || '')}
                onChange={(e) => {
                  const v = e.target.value;
                  // Single text: apply to all languages so the banner always shows.
                  setSettings({
                    ...settings,
                    announcement_text_ht: v,
                    announcement_text_fr: v,
                    announcement_text_en: v,
                  });
                }}
                rows={3}
                className="mt-1"
              />
              <p className="text-xs text-stone-500 mt-1">
                {getText(
                  'Nòt: menm tèks la ap parèt pou tout lang yo.',
                  'Note: le même texte s’affichera pour toutes les langues.',
                  'Note: the same text will show for all languages.'
                )}
              </p>
            </div>
            <div>
              <Label>{getText('Lyen (opsyonèl)', 'Lien (optionnel)', 'Link (optional)')}</Label>
              <Input value={settings.announcement_link || ''} onChange={(e) => setSettings({ ...settings, announcement_link: e.target.value })} className="mt-1" placeholder="https://..." />
            </div>

            {/* Preview */}
            <div className="pt-2">
              <p className="text-xs text-stone-500 mb-2">{getText('Preview', 'Aperçu', 'Preview')}</p>
              <div className="rounded-xl overflow-hidden border border-black/10 dark:border-white/10">
                <div className="bg-gradient-to-r from-[#EA580C] to-amber-500 text-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <Megaphone size={18} className="text-white/90" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed break-words">
                        {(settings.announcement_text_ht || settings.announcement_text_fr || settings.announcement_text_en || '').trim() ||
                          getText('Mete tèks anons la...', 'Ajoutez le texte...', 'Add announcement text...')}
                      </p>
                      {settings.announcement_link && (
                        <p className="mt-2 text-xs text-white/90 break-all">
                          {settings.announcement_link}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

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
            <div className="pt-2">
              <Button
                type="button"
                onClick={async () => {
                  try {
                    const testEmail = prompt(getText('Antre imèl pou teste', 'Entrez l\'email pour tester', 'Enter email to test') + ':', settings.sender_email || '');
                    if (!testEmail) return;
                    
                    const response = await axios.post(`${API}/admin/test-email`, { email: testEmail });
                    toast.success(getText('Imèl tès voye avèk siksè!', 'Email de test envoyé avec succès!', 'Test email sent successfully!'));
                  } catch (error) {
                    const msg = error.response?.data?.detail || error.message || getText('Erè', 'Erreur', 'Error');
                    toast.error(msg);
                  }
                }}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Mail size={14} className="mr-2" />
                {getText('Tès Imèl', 'Tester Email', 'Test Email')}
              </Button>
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
      {/* Strowallet (White-label cards) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <CreditCard size={20} className="text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-base">Strowallet (White-label Cards)</CardTitle>
                <CardDescription className="text-sm">
                  {getText(
                    'Aktive otomatik kreasyon/top-up/retrè kat (pi bon pou pwodiksyon).',
                    'Activer l’automatisation création/recharge/retrait (plutôt en production).',
                    'Enable automated card create/topup/withdraw (best for production).'
                  )}
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={!!settings.strowallet_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, strowallet_enabled: checked })}
            />
          </div>
        </CardHeader>
        {settings.strowallet_enabled && (
          <CardContent className="space-y-4 border-t pt-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
              {getText(
                'Rekòmande: kenbe API Key yo nan ENV an pwodiksyon; isit la se opsyonèl.',
                'Recommandé: gardez les clés API dans les variables d’environnement en production; ici c’est optionnel.',
                'Recommended: keep API keys in ENV in production; UI fields here are optional.'
              )}
            </div>

            <div>
              <Label>{getText('Non mak (branding)', 'Nom de marque (branding)', 'Brand name (branding)')}</Label>
              <Input
                placeholder="KAYICOM"
                value={settings.strowallet_brand_name || ''}
                onChange={(e) => setSettings({ ...settings, strowallet_brand_name: e.target.value })}
                className="mt-1"
              />
              <p className="text-xs text-stone-500 mt-1">
                {getText(
                  'Sa se non ki ap parèt sou kat la nan app la (white-label).',
                  'C’est le nom affiché sur la carte dans l’app (white-label).',
                  'This name is shown on the card in the app (white-label).'
                )}
              </p>
            </div>

            {/* Simple config: just keys (recommended) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-2">
                  <Key size={14} />
                  {getText('API Key', 'API Key', 'API Key')}
                </Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={settings.strowallet_api_key || ''}
                  onChange={(e) => setSettings({ ...settings, strowallet_api_key: e.target.value })}
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <Shield size={14} />
                  {getText('API Secret', 'API Secret', 'API Secret')}
                </Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={settings.strowallet_api_secret || ''}
                  onChange={(e) => setSettings({ ...settings, strowallet_api_secret: e.target.value })}
                  className="mt-1 font-mono text-sm"
                />
              </div>
            </div>

            {/* Advanced config (optional) */}
            <details className="rounded-lg border border-stone-200 dark:border-stone-700 p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {getText('Avanse (Base URL & endpoints)', 'Avancé (Base URL & endpoints)', 'Advanced (Base URL & endpoints)')}
              </summary>
              <div className="mt-3 space-y-4">
                <div>
                  <Label>{getText('Base URL (si ou bezwen)', 'Base URL (si besoin)', 'Base URL (if needed)')}</Label>
                  <Input
                    placeholder="https://strowallet.com"
                    value={settings.strowallet_base_url || ''}
                    onChange={(e) => setSettings({ ...settings, strowallet_base_url: e.target.value })}
                    className="mt-1 font-mono text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>{getText('Create user path', 'Create user path', 'Create user path')}</Label>
                    <Input
                      placeholder="/api/bitvcard/card-user"
                      value={settings.strowallet_create_user_path || ''}
                      onChange={(e) => setSettings({ ...settings, strowallet_create_user_path: e.target.value })}
                      className="mt-1 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label>{getText('Create path', 'Create path', 'Create path')}</Label>
                    <Input
                      placeholder="/api/bitvcard/create-card/"
                      value={settings.strowallet_create_card_path || ''}
                      onChange={(e) => setSettings({ ...settings, strowallet_create_card_path: e.target.value })}
                      className="mt-1 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label>{getText('Fund path', 'Fund path', 'Fund path')}</Label>
                    <Input
                      placeholder="/api/bitvcard/fund-card/"
                      value={settings.strowallet_fund_card_path || ''}
                      onChange={(e) => setSettings({ ...settings, strowallet_fund_card_path: e.target.value })}
                      className="mt-1 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label>{getText('Withdraw path', 'Withdraw path', 'Withdraw path')}</Label>
                    <Input
                      placeholder="/api/bitvcard/withdraw-card/ (si disponib)"
                      value={settings.strowallet_withdraw_card_path || ''}
                      onChange={(e) => setSettings({ ...settings, strowallet_withdraw_card_path: e.target.value })}
                      className="mt-1 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label>{getText('Fetch card detail path', 'Fetch card detail path', 'Fetch card detail path')}</Label>
                    <Input
                      placeholder="/api/bitvcard/fetch-card-detail/"
                      value={settings.strowallet_fetch_card_detail_path || ''}
                      onChange={(e) => setSettings({ ...settings, strowallet_fetch_card_detail_path: e.target.value })}
                      className="mt-1 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label>{getText('Card transactions path', 'Card transactions path', 'Card transactions path')}</Label>
                    <Input
                      placeholder="/api/bitvcard/card-transactions/"
                      value={settings.strowallet_card_transactions_path || ''}
                      onChange={(e) => setSettings({ ...settings, strowallet_card_transactions_path: e.target.value })}
                      className="mt-1 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            </details>
          </CardContent>
        )}
      </Card>

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
                  {getText('Kle Plisio', 'Clé Plisio', 'Plisio Key')}
                </Label>
                <Input
                  type="password"
                  placeholder={settings.plisio_api_key_last4 ? `****${settings.plisio_api_key_last4}` : "plisio_api_key"}
                  value={settings.plisio_api_key || ''}
                  onChange={(e) => setSettings({...settings, plisio_api_key: e.target.value})}
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-xs text-stone-500 mt-1">
                  {getText(
                    'Plisio souvan mande yon sèl kle. Mete li la.',
                    'Plisio demande souvent une seule clé. Mettez-la ici.',
                    'Plisio often uses a single key. Put it here.'
                  )}
                </p>
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <Shield size={14} />
                  {getText('Sekrè (opsyonèl)', 'Secret (optionnel)', 'Secret (optional)')}
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

      {/* Default Card Background */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <CreditCard size={20} className="text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">{getText('Imaj Fon Kat (pa defo)', 'Image Carte (par défaut)', 'Default Card Background')}</CardTitle>
              <CardDescription className="text-sm">
                {getText('Yon sèl imaj pou tout kat yo', 'Une seule image pour toutes les cartes', 'One image for all cards')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onloadend = () => setSettings({ ...settings, card_background_image: reader.result });
                reader.readAsDataURL(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettings({ ...settings, card_background_image: null })}
            >
              {getText('Retire', 'Retirer', 'Remove')}
            </Button>
          </div>
          {settings.card_background_image && (
            <div className="border rounded-xl p-3 bg-stone-50 dark:bg-stone-800">
              <img src={settings.card_background_image} alt="Default card" className="max-h-40 rounded-lg mx-auto" />
            </div>
          )}
          <p className="text-xs text-stone-500">
            {getText(
              'Si admin pa mete imaj pou yon kat, sistèm nan ap itilize imaj pa defo sa a.',
              'Si l’admin ne met pas d’image, le système utilisera cette image par défaut.',
              'If admin doesn’t set a card image, this default will be used.'
            )}
          </p>
        </CardContent>
      </Card>

      {/* TopUp fee tiers */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <DollarSign size={20} className="text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">{getText('Frè Minit Entènasyonal', 'Frais Minutes Internationales', 'International Minutes Fees')}</CardTitle>
              <CardDescription className="text-sm">
                {getText('Frè an pousantaj oswa fiks selon montan', 'Frais en % ou fixe selon montant', 'Percent or fixed fee by amount')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-stone-600 px-2">
              <div className="col-span-3">{getText('Min ($)', 'Min ($)', 'Min ($)')}</div>
              <div className="col-span-3">{getText('Max ($)', 'Max ($)', 'Max ($)')}</div>
              <div className="col-span-3">{getText('Frè', 'Frais', 'Fee')}</div>
              <div className="col-span-3">{getText('%?', '%?', '%?')}</div>
            </div>
            {(settings.topup_fee_tiers || []).map((tier, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center border rounded-lg p-2 bg-white dark:bg-stone-800">
                <div className="col-span-3">
                  <Input
                    type="number"
                    value={tier.min_amount}
                    onChange={(e) => {
                      const tiers = [...(settings.topup_fee_tiers || [])];
                      tiers[idx] = { ...tiers[idx], min_amount: parseFloat(e.target.value) || 0 };
                      setSettings({ ...settings, topup_fee_tiers: tiers });
                    }}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    value={tier.max_amount}
                    onChange={(e) => {
                      const tiers = [...(settings.topup_fee_tiers || [])];
                      tiers[idx] = { ...tiers[idx], max_amount: parseFloat(e.target.value) || 0 };
                      setSettings({ ...settings, topup_fee_tiers: tiers });
                    }}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    value={tier.fee_value}
                    onChange={(e) => {
                      const tiers = [...(settings.topup_fee_tiers || [])];
                      tiers[idx] = { ...tiers[idx], fee_value: parseFloat(e.target.value) || 0 };
                      setSettings({ ...settings, topup_fee_tiers: tiers });
                    }}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <Switch
                    checked={!!tier.is_percentage}
                    onCheckedChange={(checked) => {
                      const tiers = [...(settings.topup_fee_tiers || [])];
                      tiers[idx] = { ...tiers[idx], is_percentage: checked };
                      setSettings({ ...settings, topup_fee_tiers: tiers });
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const tiers = (settings.topup_fee_tiers || []).filter((_, i) => i !== idx);
                      setSettings({ ...settings, topup_fee_tiers: tiers });
                    }}
                  >
                    {getText('Efase', 'Supprimer', 'Delete')}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const tiers = [...(settings.topup_fee_tiers || [])];
              const last = tiers[tiers.length - 1];
              const min = last ? (parseFloat(last.max_amount) || 0) + 0.01 : 0;
              tiers.push({ min_amount: min, max_amount: min + 100, fee_value: 0, is_percentage: false });
              setSettings({ ...settings, topup_fee_tiers: tiers });
            }}
          >
            {getText('Ajoute nivo frè', 'Ajouter palier', 'Add fee tier')}
          </Button>
          <p className="text-xs text-stone-500">
            {getText(
              'Egzanp: 0–50 = 1$ (fiks), 50–200 = 2% (pousantaj).',
              'Ex: 0–50 = 1$ (fixe), 50–200 = 2% (pourcentage).',
              'Example: 0–50 = $1 (fixed), 50–200 = 2% (percentage).'
            )}
          </p>
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
