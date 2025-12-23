import React, { useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { Send, Users, CheckCircle, AlertCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export default function AdminBulkEmail() {
  const [emailData, setEmailData] = useState({
    subject: '',
    html_content: '',
    recipient_filter: 'all'
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    if (!emailData.subject || !emailData.html_content) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    if (!window.confirm('Êtes-vous sûr de vouloir envoyer cet email à tous les utilisateurs sélectionnés?')) {
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const response = await axios.post(`${API}/admin/bulk-email`, emailData);
      setResult(response.data);
      toast.success('Emails envoyés!');
    } catch (error) {
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  const filterLabels = {
    all: 'Tous les utilisateurs',
    kyc_approved: 'Utilisateurs vérifiés (KYC)',
    active: 'Utilisateurs actifs'
  };

  return (
    <AdminLayout title="Email en masse">
      <div className="max-w-3xl mx-auto space-y-6" data-testid="admin-bulk-email">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send size={20} />
              Composer un email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Destinataires</Label>
              <Select 
                value={emailData.recipient_filter} 
                onValueChange={(v) => setEmailData({...emailData, recipient_filter: v})}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users size={16} />
                      Tous les utilisateurs
                    </div>
                  </SelectItem>
                  <SelectItem value="kyc_approved">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} />
                      Utilisateurs vérifiés (KYC)
                    </div>
                  </SelectItem>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <Users size={16} />
                      Utilisateurs actifs
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="subject">Sujet</Label>
              <Input
                id="subject"
                placeholder="Ex: Nouvelle fonctionnalité disponible!"
                value={emailData.subject}
                onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="content">Contenu (HTML)</Label>
              <Textarea
                id="content"
                placeholder="<h2>Bonjour!</h2><p>Nous avons une nouvelle mise à jour...</p>"
                value={emailData.html_content}
                onChange={(e) => setEmailData({...emailData, html_content: e.target.value})}
                className="mt-1 min-h-[200px] font-mono text-sm"
              />
              <p className="text-sm text-slate-500 mt-1">
                Utilisez du HTML pour formater votre email. Évitez les styles externes.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-amber-500 mt-0.5" size={20} />
                <div>
                  <p className="font-medium text-amber-800">Attention</p>
                  <p className="text-sm text-amber-700">
                    Cette action enverra un email à tous les utilisateurs correspondant au filtre sélectionné. 
                    Assurez-vous d'avoir configuré votre clé API Resend dans les paramètres.
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSend} 
              disabled={sending}
              className="w-full btn-primary"
            >
              <Send size={18} className="mr-2" />
              {sending ? 'Envoi en cours...' : 'Envoyer les emails'}
            </Button>

            {result && (
              <div className={`p-4 rounded-xl ${
                result.message.includes('success') || result.success 
                  ? 'bg-emerald-50 border border-emerald-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <p className="font-medium">{result.message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Templates */}
        <Card>
          <CardHeader>
            <CardTitle>Templates rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => setEmailData({
                  ...emailData,
                  subject: 'Mise à jour importante - KAYICOM',
                  html_content: `<h2>Bonjour,</h2>
<p>Nous avons une mise à jour importante à vous communiquer.</p>
<p>[Votre message ici]</p>
<p>Cordialement,<br>L'équipe KAYICOM</p>`
                })}
                className="p-4 border rounded-xl text-left hover:border-[#0047AB] hover:bg-blue-50 transition-colors"
              >
                <p className="font-medium">Mise à jour générale</p>
                <p className="text-sm text-slate-500">Annonces et mises à jour</p>
              </button>

              <button
                onClick={() => setEmailData({
                  ...emailData,
                  subject: 'Promotion spéciale - KAYICOM',
                  html_content: `<h2>🎉 Offre spéciale!</h2>
<p>Profitez de notre promotion exclusive:</p>
<ul>
<li>[Détail 1]</li>
<li>[Détail 2]</li>
</ul>
<p>Cette offre est valable jusqu'au [date].</p>
<p>Cordialement,<br>L'équipe KAYICOM</p>`
                })}
                className="p-4 border rounded-xl text-left hover:border-[#0047AB] hover:bg-blue-50 transition-colors"
              >
                <p className="font-medium">Promotion</p>
                <p className="text-sm text-slate-500">Offres et promotions</p>
              </button>

              <button
                onClick={() => setEmailData({
                  ...emailData,
                  subject: 'Maintenance prévue - KAYICOM',
                  html_content: `<h2>Maintenance prévue</h2>
<p>Nous vous informons qu'une maintenance est prévue:</p>
<p><strong>Date:</strong> [Date]<br>
<strong>Durée estimée:</strong> [Durée]</p>
<p>Le service sera temporairement indisponible pendant cette période.</p>
<p>Nous nous excusons pour la gêne occasionnée.</p>
<p>L'équipe KAYICOM</p>`
                })}
                className="p-4 border rounded-xl text-left hover:border-[#0047AB] hover:bg-blue-50 transition-colors"
              >
                <p className="font-medium">Maintenance</p>
                <p className="text-sm text-slate-500">Avis de maintenance</p>
              </button>

              <button
                onClick={() => setEmailData({
                  ...emailData,
                  subject: 'Nouveaux taux de change - KAYICOM',
                  html_content: `<h2>Mise à jour des taux</h2>
<p>Nous vous informons de la mise à jour de nos taux de change:</p>
<p><strong>1 USD = [X] HTG</strong></p>
<p>Ces nouveaux taux sont effectifs immédiatement.</p>
<p>Cordialement,<br>L'équipe KAYICOM</p>`
                })}
                className="p-4 border rounded-xl text-left hover:border-[#0047AB] hover:bg-blue-50 transition-colors"
              >
                <p className="font-medium">Taux de change</p>
                <p className="text-sm text-slate-500">Mise à jour des taux</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
