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
import { Save, Key, Mail, Wallet, CreditCard, DollarSign, Shield, MessageSquare, Phone, Smartphone, Send } from 'lucide-react';

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
    whatsapp_api_provider: 'callmebot',
    callmebot_api_key: '',
    ultramsg_instance_id: '',
    ultramsg_token: '',
    waha_api_url: '',
    waha_session: 'default',
    
    // Telegram (FREE & Unlimited)
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
                  {getText('Notifikasyon WhatsApp otomatik pou ajan yo', 'Notifications WhatsApp automatiques pour les agents', 'Automatic WhatsApp notifications for agents')}
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
                <Label htmlFor="whatsapp">{getText('Nimewo WhatsApp Sipò', 'Numéro WhatsApp Support', 'Support WhatsApp Number')}</Label>
                <Input
                  id="whatsapp"
                  placeholder="+50939308318"
                  value={settings.whatsapp_number || ''}
                  onChange={(e) => setSettings({...settings, whatsapp_number: e.target.value})}
                  className="mt-1"
                />
              </div>

              {/* WhatsApp API Provider Selection */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-4">
                <h4 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-3">
                  {getText('API pou voye mesaj otomatik', 'API pour envoi de messages automatiques', 'API for automatic message sending')}
                </h4>
                
                <div className="mb-4">
                  <Label>{getText('Chwazi Founi API', 'Choisir Fournisseur API', 'Choose API Provider')}</Label>
                  <select
                    value={settings.whatsapp_api_provider || 'callmebot'}
                    onChange={(e) => setSettings({...settings, whatsapp_api_provider: e.target.value})}
                    className="w-full mt-1 p-2 border rounded-lg bg-white dark:bg-stone-800"
                  >
                    <option value="callmebot">CallMeBot (Gratis / Free)</option>
                    <option value="ultramsg">UltraMsg (Peye / Paid)</option>
                    <option value="waha">WAHA (Self-Hosted)</option>
                  </select>
                </div>

                {/* CallMeBot Settings */}
                {(settings.whatsapp_api_provider === 'callmebot' || !settings.whatsapp_api_provider) && (
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-stone-800 rounded-lg p-3 text-sm">
                      <p className="font-medium text-emerald-700 dark:text-emerald-300 mb-2">
                        {getText('Kijan pou aktive CallMeBot:', 'Comment activer CallMeBot:', 'How to activate CallMeBot:')}
                      </p>
                      <ol className="list-decimal list-inside text-emerald-600 dark:text-emerald-400 space-y-1">
                        <li>{getText('Voye mesaj sa a bay +34 644 71 67 43:', 'Envoyez ce message à +34 644 71 67 43:', 'Send this message to +34 644 71 67 43:')}</li>
                        <li className="ml-4 font-mono bg-stone-100 dark:bg-stone-700 p-1 rounded text-xs">I allow callmebot to send me messages</li>
                        <li>{getText('Ou ap resevwa yon apikey nan repons lan', 'Vous recevrez une apikey dans la réponse', 'You will receive an apikey in the response')}</li>
                        <li>{getText('Antre apikey la anba a', 'Entrez l\'apikey ci-dessous', 'Enter the apikey below')}</li>
                      </ol>
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
                )}

                {/* UltraMsg Settings */}
                {settings.whatsapp_api_provider === 'ultramsg' && (
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-stone-800 rounded-lg p-3 text-sm">
                      <p className="text-emerald-600 dark:text-emerald-400">
                        {getText('Kreye yon kont sou', 'Créez un compte sur', 'Create an account on')}{' '}
                        <a href="https://ultramsg.com" target="_blank" rel="noreferrer" className="text-[#EA580C] hover:underline">ultramsg.com</a>
                      </p>
                    </div>
                    <div>
                      <Label>Instance ID</Label>
                      <Input
                        placeholder="instance12345"
                        value={settings.ultramsg_instance_id || ''}
                        onChange={(e) => setSettings({...settings, ultramsg_instance_id: e.target.value})}
                        className="mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <Label>Token</Label>
                      <Input
                        type="password"
                        placeholder="your-token"
                        value={settings.ultramsg_token || ''}
                        onChange={(e) => setSettings({...settings, ultramsg_token: e.target.value})}
                        className="mt-1 font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* WAHA Settings */}
                {settings.whatsapp_api_provider === 'waha' && (
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-stone-800 rounded-lg p-3 text-sm">
                      <p className="text-emerald-600 dark:text-emerald-400">
                        {getText('WAHA se yon solisyon self-hosted.', 'WAHA est une solution self-hosted.', 'WAHA is a self-hosted solution.')}{' '}
                        <a href="https://github.com/devlikeapro/waha" target="_blank" rel="noreferrer" className="text-[#EA580C] hover:underline">GitHub</a>
                      </p>
                    </div>
                    <div>
                      <Label>WAHA API URL</Label>
                      <Input
                        placeholder="https://your-waha-server.com"
                        value={settings.waha_api_url || ''}
                        onChange={(e) => setSettings({...settings, waha_api_url: e.target.value})}
                        className="mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <Label>Session Name</Label>
                      <Input
                        placeholder="default"
                        value={settings.waha_session || 'default'}
                        onChange={(e) => setSettings({...settings, waha_session: e.target.value})}
                        className="mt-1 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* WhatsApp Test Section */}
              <div className="bg-stone-100 dark:bg-stone-800 border rounded-xl p-4 mt-4">
                <h4 className="font-semibold mb-3">
                  {getText('Teste Notifikasyon WhatsApp', 'Tester Notification WhatsApp', 'Test WhatsApp Notification')}
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label>{getText('Nimewo Telefòn', 'Numéro de Téléphone', 'Phone Number')}</Label>
                    <Input
                      placeholder="+509XXXXXXXX"
                      value={whatsappTest.phone}
                      onChange={(e) => setWhatsappTest({...whatsappTest, phone: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>{getText('Mesaj (Opsyonèl)', 'Message (Optionnel)', 'Message (Optional)')}</Label>
                    <Input
                      placeholder="Tès notifikasyon..."
                      value={whatsappTest.message}
                      onChange={(e) => setWhatsappTest({...whatsappTest, message: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <Button
                    onClick={testWhatsapp}
                    disabled={testingWhatsapp || !whatsappTest.phone}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    {testingWhatsapp ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⏳</span>
                        {getText('Ap voye...', 'Envoi en cours...', 'Sending...')}
                      </span>
                    ) : (
                      getText('Voye Tès', 'Envoyer Test', 'Send Test')
                    )}
                  </Button>
                </div>

                {/* Notification Stats */}
                {whatsappStats.total > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h5 className="text-sm font-medium mb-2">
                      {getText('Estatistik Notifikasyon', 'Statistiques Notifications', 'Notification Stats')}
                    </h5>
                    <div className="flex gap-3 text-xs">
                      <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded">
                        ✅ {getText('Voye', 'Envoyé', 'Sent')}: {whatsappStats.sent || 0}
                      </span>
                      <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded">
                        ❌ {getText('Echwe', 'Échoué', 'Failed')}: {whatsappStats.failed || 0}
                      </span>
                      <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded">
                        ⏳ {getText('Annatant', 'En attente', 'Pending')}: {whatsappStats.pending || 0}
                      </span>
                    </div>
                  </div>
                )}

                {/* Recent Notifications */}
                {whatsappNotifications.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h5 className="text-sm font-medium mb-2">
                      {getText('Dènye Notifikasyon', 'Notifications Récentes', 'Recent Notifications')}
                    </h5>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {whatsappNotifications.slice(0, 5).map((notif, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-white dark:bg-stone-700 p-2 rounded">
                          <span className="font-mono">{notif.phone_number}</span>
                          <Badge variant={notif.status === 'sent' ? 'default' : notif.status === 'failed' ? 'destructive' : 'secondary'}>
                            {notif.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Telegram Notifications (FREE) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Send size={20} className="text-blue-500" />
                  Telegram Bot
                  <Badge className="bg-emerald-500 text-white text-xs">GRATIS / FREE</Badge>
                </CardTitle>
                <CardDescription>
                  {getText('Notifikasyon Telegram gratis e san limit', 'Notifications Telegram gratuites et illimitées', 'Free and unlimited Telegram notifications')}
                </CardDescription>
              </div>
              <Switch
                checked={settings.telegram_enabled}
                onCheckedChange={(checked) => setSettings({...settings, telegram_enabled: checked})}
              />
            </div>
          </CardHeader>
          {settings.telegram_enabled && (
            <CardContent className="space-y-4 border-t pt-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3">
                  {getText('Kijan pou konfigire Telegram Bot:', 'Comment configurer le bot Telegram:', 'How to setup Telegram Bot:')}
                </h4>
                <ol className="list-decimal list-inside text-blue-700 dark:text-blue-400 space-y-2 text-sm">
                  <li>{getText('Chèche', 'Recherchez', 'Search for')} <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">@BotFather</code> {getText('nan Telegram', 'sur Telegram', 'on Telegram')}</li>
                  <li>{getText('Voye', 'Envoyez', 'Send')} <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/newbot</code> {getText('epi swiv enstriksyon yo', 'et suivez les instructions', 'and follow instructions')}</li>
                  <li>{getText('Kopye Bot Token ou resevwa a', 'Copiez le Bot Token reçu', 'Copy the Bot Token you receive')}</li>
                  <li>{getText('Voye yon mesaj bay bot ou a', 'Envoyez un message à votre bot', 'Send a message to your bot')}</li>
                  <li>{getText('Ale sou', 'Allez sur', 'Go to')} <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">https://api.telegram.org/bot[TOKEN]/getUpdates</code></li>
                  <li>{getText('Jwenn', 'Trouvez', 'Find')} <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">chat.id</code> {getText('nan repons lan', 'dans la réponse', 'in the response')}</li>
                </ol>
              </div>
              
              <div>
                <Label>Bot Token</Label>
                <Input
                  type="password"
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  value={settings.telegram_bot_token || ''}
                  onChange={(e) => setSettings({...settings, telegram_bot_token: e.target.value})}
                  className="mt-1 font-mono"
                />
              </div>
              
              <div>
                <Label>Chat ID</Label>
                <Input
                  placeholder="-1001234567890"
                  value={settings.telegram_chat_id || ''}
                  onChange={(e) => setSettings({...settings, telegram_chat_id: e.target.value})}
                  className="mt-1 font-mono"
                />
                <p className="text-xs text-stone-500 mt-1">
                  {getText('Chat ID ou oswa ID gwoup la', 'Votre Chat ID ou ID du groupe', 'Your Chat ID or group ID')}
                </p>
              </div>
              
              {/* Test Telegram */}
              <div className="bg-stone-100 dark:bg-stone-800 rounded-xl p-4">
                <h4 className="font-semibold mb-3">
                  {getText('Teste Notifikasyon Telegram', 'Tester Notification Telegram', 'Test Telegram Notification')}
                </h4>
                <Button
                  variant="outline"
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
                  className="w-full"
                >
                  <Send size={16} className="mr-2" />
                  {getText('Voye Tès Telegram', 'Envoyer Test Telegram', 'Send Telegram Test')}
                </Button>
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
                    {getText('Enfòmasyon pou kliyan yo voye lajan', 'Informations pour que les clients envoient de l\'argent', 'Information for clients to send money')}
                  </p>
                </div>
                <Switch
                  checked={!!settings.moncash_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, moncash_enabled: checked })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="moncash_name">{getText('Non Reseptè', 'Nom du destinataire', 'Recipient Name')}</Label>
                  <Input
                    id="moncash_name"
                    placeholder="KAYICOM"
                    value={settings.moncash_name || ''}
                    onChange={(e) => setSettings({ ...settings, moncash_name: e.target.value })}
                    className="mt-1"
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
              <div>
                <Label htmlFor="moncash_qr">{getText('QR Kod (URL imaj)', 'QR Code (URL image)', 'QR Code (image URL)')}</Label>
                <Input
                  id="moncash_qr"
                  placeholder="https://example.com/qr-moncash.png"
                  value={settings.moncash_qr || ''}
                  onChange={(e) => setSettings({ ...settings, moncash_qr: e.target.value })}
                  className="mt-1"
                />
                <p className="text-xs text-stone-500 mt-1">{getText('Opsyonèl - ap afiche sou paj depo a', 'Optionnel - s\'affichera sur la page de dépôt', 'Optional - will display on deposit page')}</p>
                {settings.moncash_qr && (
                  <img src={settings.moncash_qr} alt="MonCash QR" className="mt-2 w-24 h-24 object-contain rounded border" />
                )}
              </div>
            </div>

            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">NatCash</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {getText('Enfòmasyon pou kliyan yo voye lajan', 'Informations pour que les clients envoient de l\'argent', 'Information for clients to send money')}
                  </p>
                </div>
                <Switch
                  checked={!!settings.natcash_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, natcash_enabled: checked })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="natcash_name">{getText('Non Reseptè', 'Nom du destinataire', 'Recipient Name')}</Label>
                  <Input
                    id="natcash_name"
                    placeholder="KAYICOM"
                    value={settings.natcash_name || ''}
                    onChange={(e) => setSettings({ ...settings, natcash_name: e.target.value })}
                    className="mt-1"
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
              <div>
                <Label htmlFor="natcash_qr">{getText('QR Kod (URL imaj)', 'QR Code (URL image)', 'QR Code (image URL)')}</Label>
                <Input
                  id="natcash_qr"
                  placeholder="https://example.com/qr-natcash.png"
                  value={settings.natcash_qr || ''}
                  onChange={(e) => setSettings({ ...settings, natcash_qr: e.target.value })}
                  className="mt-1"
                />
                <p className="text-xs text-stone-500 mt-1">{getText('Opsyonèl - ap afiche sou paj depo a', 'Optionnel - s\'affichera sur la page de dépôt', 'Optional - will display on deposit page')}</p>
                {settings.natcash_qr && (
                  <img src={settings.natcash_qr} alt="NatCash QR" className="mt-2 w-24 h-24 object-contain rounded border" />
                )}
              </div>
            </div>

            {/* USD Payment Methods */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold text-stone-800 dark:text-stone-200 mb-3">{getText('Metòd USD', 'Méthodes USD', 'USD Methods')}</h4>
              
              <div className="border rounded-xl p-4 space-y-3 mb-4">
                <p className="font-medium">Zelle</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{getText('Non Reseptè', 'Nom du destinataire', 'Recipient Name')}</Label>
                    <Input
                      placeholder="KAYICOM"
                      value={settings.zelle_name || ''}
                      onChange={(e) => setSettings({ ...settings, zelle_name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Email Zelle</Label>
                    <Input
                      placeholder="payments@kayicom.com"
                      value={settings.zelle_email || ''}
                      onChange={(e) => setSettings({ ...settings, zelle_email: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="border rounded-xl p-4 space-y-3">
                <p className="font-medium">PayPal</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{getText('Non Reseptè', 'Nom du destinataire', 'Recipient Name')}</Label>
                    <Input
                      placeholder="KAYICOM"
                      value={settings.paypal_name || ''}
                      onChange={(e) => setSettings({ ...settings, paypal_name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Email PayPal</Label>
                    <Input
                      placeholder="payments@kayicom.com"
                      value={settings.paypal_email || ''}
                      onChange={(e) => setSettings({ ...settings, paypal_email: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
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
