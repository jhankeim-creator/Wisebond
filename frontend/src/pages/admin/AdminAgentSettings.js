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
import { Save, Users, DollarSign, Percent, Bell, RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export default function AdminAgentSettings() {
  const { language } = useLanguage();
  const [settings, setSettings] = useState({
    agent_deposit_enabled: false,
    agent_rate_usd_to_htg: 135.0,
    agent_commission_percentage: 2.0,
    agent_whatsapp_notifications: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, agentsRes, requestsRes] = await Promise.all([
        axios.get(`${API}/admin/agent-settings`),
        axios.get(`${API}/admin/agents`),
        axios.get(`${API}/admin/agent-requests?status=pending`)
      ]);
      setSettings(prev => ({ ...prev, ...settingsRes.data.settings }));
      setAgents(agentsRes.data.agents || []);
      setPendingRequests(requestsRes.data.requests || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/agent-settings`, settings);
      toast.success(getText('Paramèt ajan anrejistre!', 'Paramètres agent enregistrés!', 'Agent settings saved!'));
    } catch (error) {
      toast.error(getText('Erè nan anrejistreman', 'Erreur lors de la sauvegarde', 'Error saving'));
    } finally {
      setSaving(false);
    }
  };

  const processRequest = async (requestId, action) => {
    try {
      await axios.patch(`${API}/admin/agent-requests/${requestId}?action=${action}`);
      toast.success(action === 'approve' 
        ? getText('Demann apwouve!', 'Demande approuvée!', 'Request approved!')
        : getText('Demann rejte', 'Demande rejetée', 'Request rejected'));
      fetchData();
    } catch (error) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    }
  };

  return (
    <AdminLayout title={getText('Paramèt Ajan', 'Paramètres Agent', 'Agent Settings')}>
      <div className="max-w-4xl mx-auto space-y-6" data-testid="admin-agent-settings">
        
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="text-blue-600 dark:text-blue-400" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-900 dark:text-white">{agents.length}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{getText('Ajan Aktif', 'Agents Actifs', 'Active Agents')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <DollarSign className="text-amber-600 dark:text-amber-400" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-900 dark:text-white">
                    G {settings.agent_rate_usd_to_htg}
                  </p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{getText('To Aktyèl', 'Taux Actuel', 'Current Rate')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Percent className="text-emerald-600 dark:text-emerald-400" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-900 dark:text-white">
                    {settings.agent_commission_percentage}%
                  </p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{getText('Komisyon Ajan', 'Commission Agent', 'Agent Commission')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users size={20} className="text-[#EA580C]" />
                  {getText('Depo Ajan', 'Dépôts Agent', 'Agent Deposits')}
                </CardTitle>
                <CardDescription>
                  {getText(
                    'Pèmèt ajan yo fè depo dola pou kliyan yo',
                    'Permettre aux agents de faire des dépôts dollar pour les clients',
                    'Allow agents to make dollar deposits for clients'
                  )}
                </CardDescription>
              </div>
              <Switch
                checked={settings.agent_deposit_enabled}
                onCheckedChange={(checked) => setSettings({...settings, agent_deposit_enabled: checked})}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="text-center py-4">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : (
              <>
                {/* Rate Configuration */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                  <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
                    <DollarSign size={18} />
                    {getText('To Chanj Ajan', 'Taux de Change Agent', 'Agent Exchange Rate')}
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mb-4">
                    {getText(
                      'Konbyen Goud kliyan an dwe bay ajan an pou chak dola',
                      'Combien de Gourdes le client doit payer à l\'agent par dollar',
                      'How many Gourdes the client pays the agent per dollar'
                    )}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">1 USD =</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.agent_rate_usd_to_htg}
                      onChange={(e) => setSettings({...settings, agent_rate_usd_to_htg: parseFloat(e.target.value)})}
                      className="w-32 text-lg font-semibold"
                    />
                    <span className="text-lg font-bold">HTG</span>
                  </div>
                </div>

                {/* Commission Configuration */}
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-4">
                  <h3 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-3 flex items-center gap-2">
                    <Percent size={18} />
                    {getText('Komisyon Ajan', 'Commission Agent', 'Agent Commission')}
                  </h3>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-4">
                    {getText(
                      'Pousantaj komisyon ajan an ap resevwa sou chak depo',
                      'Pourcentage de commission que l\'agent reçoit sur chaque dépôt',
                      'Commission percentage the agent receives on each deposit'
                    )}
                  </p>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      step="0.1"
                      value={settings.agent_commission_percentage}
                      onChange={(e) => setSettings({...settings, agent_commission_percentage: parseFloat(e.target.value)})}
                      className="w-24 text-lg font-semibold"
                    />
                    <span className="text-lg font-bold">%</span>
                  </div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                    {getText(
                      `Egzanp: Si ajan an fè yon depo $100, li ap resevwa $${(100 * settings.agent_commission_percentage / 100).toFixed(2)} komisyon`,
                      `Exemple: Si l'agent fait un dépôt de $100, il recevra $${(100 * settings.agent_commission_percentage / 100).toFixed(2)} de commission`,
                      `Example: If agent makes a $100 deposit, they receive $${(100 * settings.agent_commission_percentage / 100).toFixed(2)} commission`
                    )}
                  </p>
                </div>

                {/* WhatsApp Notifications */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
                        <Bell size={18} />
                        {getText('Notifikasyon WhatsApp', 'Notifications WhatsApp', 'WhatsApp Notifications')}
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                        {getText(
                          'Voye notifikasyon bay ajan an lè depo a apwouve',
                          'Envoyer une notification à l\'agent quand le dépôt est approuvé',
                          'Send notification to agent when deposit is approved'
                        )}
                      </p>
                    </div>
                    <Switch
                      checked={settings.agent_whatsapp_notifications}
                      onCheckedChange={(checked) => setSettings({...settings, agent_whatsapp_notifications: checked})}
                    />
                  </div>
                </div>

                <Button onClick={saveSettings} disabled={saving} className="w-full btn-primary">
                  <Save size={18} className="mr-2" />
                  {saving 
                    ? getText('Anrejistreman...', 'Enregistrement...', 'Saving...') 
                    : getText('Anrejistre paramèt yo', 'Enregistrer les paramètres', 'Save settings')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pending Agent Requests */}
        {pendingRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="text-amber-500" size={20} />
                  {getText('Demann Ajan an Atant', 'Demandes d\'Agent en Attente', 'Pending Agent Requests')}
                </span>
                <Badge className="bg-amber-100 text-amber-700">{pendingRequests.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingRequests.map((req) => (
                  <div key={req.request_id} className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-800 rounded-xl">
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-white">{req.full_name}</p>
                      <p className="text-sm text-stone-500 dark:text-stone-400">{req.email}</p>
                      <p className="text-sm text-stone-500 dark:text-stone-400">{req.phone}</p>
                      <p className="text-xs text-stone-400 mt-1">{new Date(req.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="bg-emerald-500 hover:bg-emerald-600"
                        onClick={() => processRequest(req.request_id, 'approve')}
                      >
                        {getText('Apwouve', 'Approuver', 'Approve')}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => processRequest(req.request_id, 'reject')}
                      >
                        {getText('Rejte', 'Rejeter', 'Reject')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Agents List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="text-blue-500" size={20} />
                {getText('Ajan Aktif', 'Agents Actifs', 'Active Agents')}
              </span>
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw size={16} className="mr-2" />
                {getText('Aktyalize', 'Actualiser', 'Refresh')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <div className="text-center py-8 text-stone-500 dark:text-stone-400">
                {getText('Pa gen ajan aktif', 'Aucun agent actif', 'No active agents')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{getText('Non', 'Nom', 'Name')}</th>
                      <th>Client ID</th>
                      <th>{getText('Depo', 'Dépôts', 'Deposits')}</th>
                      <th>{getText('Total USD', 'Total USD', 'Total USD')}</th>
                      <th>{getText('Komisyon Touche', 'Commission Gagnée', 'Commission Earned')}</th>
                      <th>{getText('Balans', 'Solde', 'Balance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => (
                      <tr key={agent.user_id}>
                        <td>
                          <div>
                            <p className="font-semibold">{agent.full_name}</p>
                            <p className="text-xs text-stone-500">{agent.email}</p>
                          </div>
                        </td>
                        <td className="font-mono text-sm">{agent.client_id}</td>
                        <td className="font-semibold">{agent.total_deposits || 0}</td>
                        <td className="font-semibold">${(agent.total_usd_deposited || 0).toLocaleString()}</td>
                        <td className="font-semibold text-emerald-600">${(agent.total_commission_earned || 0).toFixed(2)}</td>
                        <td className="font-semibold text-blue-600">${(agent.agent_wallet_usd || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
