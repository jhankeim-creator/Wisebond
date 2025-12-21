import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { Save, Key, Mail, MessageCircle, Wallet, CreditCard, DollarSign, Shield } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminSettings() {
  const { language } = useLanguage();
  const [settings, setSettings] = useState({
    resend_api_key: '',
    sender_email: '',
    crisp_website_id: '',
    whatsapp_number: '',
    plisio_api_key: '',
    plisio_secret_key: '',
    card_order_fee_htg: 500,
    affiliate_reward_htg: 2000,
    affiliate_cards_required: 5
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/settings`, settings);
      toast.success(getText('Paramèt anrejistre!', 'Paramètres enregistrés!', 'Settings saved!'));
    } catch (error) {
      toast.error(getText('Erè nan anrejistreman', 'Erreur lors de la sauvegarde', 'Error saving'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title={getText('Paramèt', 'Paramètres', 'Settings')}>
      <div className="max-w-3xl mx-auto space-y-6" data-testid="admin-settings">
        
        {/* Email Settings (Resend) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail size={20} className="text-[#EA580C]" />
              {getText('Konfigirasyon Imèl (Resend)', 'Configuration Email (Resend)', 'Email Configuration (Resend)')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    placeholder="re_xxxxxxxxxxxxx"
                    value={settings.resend_api_key || ''}
                    onChange={(e) => setSettings({...settings, resend_api_key: e.target.value})}
                    className="mt-1 font-mono"
                  />
                  <p className="text-sm text-stone-500 mt-1">
                    {getText('Jwenn kle ou sou', 'Obtenez votre clé sur', 'Get your key at')} <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-[#EA580C] hover:underline">resend.com</a>
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
        </Card>

        {/* USDT/Plisio Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet size={20} className="text-amber-500" />
              {getText('Konfigirasyon USDT (Plisio)', 'Configuration USDT (Plisio)', 'USDT Configuration (Plisio)')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="plisio_key">
                <Key size={16} className="inline mr-2" />
                {getText('Kle API Plisio', 'Clé API Plisio', 'Plisio API Key')}
              </Label>
              <Input
                id="plisio_key"
                type="password"
                placeholder="plisio_api_key"
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
                placeholder="plisio_secret_key"
                value={settings.plisio_secret_key || ''}
                onChange={(e) => setSettings({...settings, plisio_secret_key: e.target.value})}
                className="mt-1 font-mono"
              />
              <p className="text-sm text-stone-500 mt-1">
                {getText('Jwenn kle ou sou', 'Obtenez vos clés sur', 'Get your keys at')} <a href="https://plisio.net" target="_blank" rel="noreferrer" className="text-[#EA580C] hover:underline">plisio.net</a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Live Chat Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle size={20} className="text-emerald-500" />
              {getText('Konfigirasyon Live Chat', 'Configuration Live Chat', 'Live Chat Configuration')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="crisp_id">Crisp Website ID</Label>
              <Input
                id="crisp_id"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={settings.crisp_website_id || ''}
                onChange={(e) => setSettings({...settings, crisp_website_id: e.target.value})}
                className="mt-1 font-mono"
              />
              <p className="text-sm text-stone-500 mt-1">
                {getText('Jwenn ID ou nan Crisp → Settings → Website Settings', 'Trouvez votre ID dans Crisp → Settings → Website Settings', 'Find your ID in Crisp → Settings → Website Settings')}
              </p>
            </div>
            <div>
              <Label htmlFor="whatsapp">{getText('Nimewo WhatsApp Business', 'Numéro WhatsApp Business', 'WhatsApp Business Number')}</Label>
              <Input
                id="whatsapp"
                placeholder="+509xxxxxxxx"
                value={settings.whatsapp_number || ''}
                onChange={(e) => setSettings({...settings, whatsapp_number: e.target.value})}
                className="mt-1"
              />
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
              <p className="text-sm text-stone-500 mt-1">
                {getText(
                  `Paren an ap touche G ${settings.affiliate_reward_htg || 2000} pou chak ${settings.affiliate_cards_required || 5} kat ki komande`,
                  `Le parrain gagne G ${settings.affiliate_reward_htg || 2000} pour chaque ${settings.affiliate_cards_required || 5} cartes commandées`,
                  `Referrer earns G ${settings.affiliate_reward_htg || 2000} for every ${settings.affiliate_cards_required || 5} cards ordered`
                )}
              </p>
            </div>
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
