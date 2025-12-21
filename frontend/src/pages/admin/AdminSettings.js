import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { Save, Key, Mail, MessageCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    resend_api_key: '',
    sender_email: '',
    crisp_website_id: '',
    whatsapp_number: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/admin/settings`);
      setSettings(response.data.settings || {});
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
      toast.success('Paramètres enregistrés!');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Paramètres">
      <div className="max-w-2xl mx-auto space-y-6" data-testid="admin-settings">
        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail size={20} />
              Configuration Email (Resend)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-center py-4">Chargement...</div>
            ) : (
              <>
                <div>
                  <Label htmlFor="resend_key">
                    <Key size={16} className="inline mr-2" />
                    Clé API Resend
                  </Label>
                  <Input
                    id="resend_key"
                    type="password"
                    placeholder="re_xxxxxxxxxxxxx"
                    value={settings.resend_api_key || ''}
                    onChange={(e) => setSettings({...settings, resend_api_key: e.target.value})}
                    className="mt-1 font-mono"
                  />
                  <p className="text-sm text-slate-500 mt-1">
                    Obtenez votre clé sur <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-[#0047AB] hover:underline">resend.com</a>
                  </p>
                </div>
                <div>
                  <Label htmlFor="sender_email">Email d'envoi</Label>
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

        {/* Live Chat Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle size={20} />
              Configuration Live Chat
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
              <p className="text-sm text-slate-500 mt-1">
                Trouvez votre ID dans Crisp → Settings → Website Settings
              </p>
            </div>
            <div>
              <Label htmlFor="whatsapp">Numéro WhatsApp Business</Label>
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

        <Button onClick={saveSettings} disabled={saving} className="w-full btn-primary">
          <Save size={18} className="mr-2" />
          {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
        </Button>
      </div>
    </AdminLayout>
  );
}
