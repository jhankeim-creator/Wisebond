import React, { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Upload, 
  Check, 
  AlertCircle,
  DollarSign,
  Users,
  Clock,
  Search,
  Phone,
  Wallet,
  ArrowRight
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export default function AgentDeposit() {
  const { language } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [isAgent, setIsAgent] = useState(false);
  const [agentRequest, setAgentRequest] = useState(null);
  const [settings, setSettings] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [deposits, setDeposits] = useState([]);
  
  // Deposit form
  const [clientIdentifier, setClientIdentifier] = useState('');
  const [amountUSD, setAmountUSD] = useState('');
  const [amountHTG, setAmountHTG] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const getText = useCallback((ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  }, [language]);

  // Check agent status on mount
  useEffect(() => {
    checkAgentStatus();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (isAgent) {
      fetchDashboard();
      fetchDeposits();
    }
  }, [isAgent]);

  const checkAgentStatus = async () => {
    try {
      const response = await axios.get(`${API}/agent/status`);
      setIsAgent(response.data.is_agent);
      setAgentRequest(response.data.request);
    } catch (error) {
      console.error('Error checking agent status:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/agent/settings`);
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(`${API}/agent/dashboard`);
      setDashboard(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  };

  const fetchDeposits = async () => {
    try {
      const response = await axios.get(`${API}/agent/deposits`);
      setDeposits(response.data.deposits || []);
    } catch (error) {
      console.error('Error fetching deposits:', error);
    }
  };

  const requestAgentAccess = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/agent/register`);
      toast.success(getText(
        'Demann ajan soumèt! Tann apwobasyon admin.',
        'Demande d\'agent soumise! Attendez l\'approbation admin.',
        'Agent request submitted! Wait for admin approval.'
      ));
      await checkAgentStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(getText('Imaj la twò gwo (maks 5MB)', 'Image trop grande (max 5MB)', 'Image too large (max 5MB)'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Calculate expected values
  const expectedHTG = settings ? (parseFloat(amountUSD) || 0) * settings.rate_usd_to_htg : 0;
  const commission = settings ? (parseFloat(amountUSD) || 0) * (settings.commission_percentage / 100) : 0;

  const handleSubmitDeposit = async () => {
    if (!clientIdentifier || !amountUSD || !amountHTG) {
      toast.error(getText('Ranpli tout chan yo', 'Remplissez tous les champs', 'Fill all fields'));
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/agent/deposits/create`, {
        client_phone_or_id: clientIdentifier,
        amount_usd: parseFloat(amountUSD),
        amount_htg_received: parseFloat(amountHTG),
        proof_image: proofImage || null
      });
      
      toast.success(getText(
        'Depo soumèt siksè! Tann apwobasyon admin.',
        'Dépôt soumis avec succès! Attendez l\'approbation admin.',
        'Deposit submitted successfully! Wait for admin approval.'
      ));
      
      // Reset form
      setClientIdentifier('');
      setAmountUSD('');
      setAmountHTG('');
      setProofImage('');
      setShowConfirm(false);
      
      // Refresh data
      await fetchDashboard();
      await fetchDeposits();
    } catch (error) {
      toast.error(error.response?.data?.detail || getText('Erè nan soumisyon', 'Erreur de soumission', 'Submission error'));
    } finally {
      setLoading(false);
    }
  };

  const withdrawCommission = async () => {
    if (!dashboard || dashboard.agent_wallet_usd <= 0) {
      toast.error(getText('Pa gen komisyon pou retire', 'Pas de commission à retirer', 'No commission to withdraw'));
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/agent/withdraw-commission`);
      toast.success(getText(
        'Komisyon transfere nan bous ou!',
        'Commission transférée dans votre portefeuille!',
        'Commission transferred to your wallet!'
      ));
      await refreshUser();
      await fetchDashboard();
    } catch (error) {
      toast.error(error.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    } finally {
      setLoading(false);
    }
  };

  // If user is not an agent and has not requested
  if (!isAgent && !agentRequest) {
    return (
      <DashboardLayout title={getText('Ajan Depo', 'Agent Dépôt', 'Agent Deposit')}>
        <Card className="max-w-xl mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="text-[#EA580C]" size={40} />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-2">
              {getText('Vin yon Ajan KAYICOM', 'Devenir Agent KAYICOM', 'Become a KAYICOM Agent')}
            </h3>
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              {getText(
                'Antan ke ajan, ou ka fè depo dola pou kliyan yo epi touche komisyon sou chak depo.',
                'En tant qu\'agent, vous pouvez faire des dépôts dollar pour les clients et gagner une commission sur chaque dépôt.',
                'As an agent, you can make dollar deposits for clients and earn commission on each deposit.'
              )}
            </p>
            
            {user?.kyc_status !== 'approved' ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 mb-6">
                <AlertCircle className="mx-auto text-amber-500 mb-2" size={24} />
                <p className="text-amber-700 dark:text-amber-300">
                  {getText(
                    'Ou dwe konplete KYC ou anvan ou ka vin yon ajan.',
                    'Vous devez compléter votre KYC avant de devenir agent.',
                    'You must complete KYC before becoming an agent.'
                  )}
                </p>
                <Button className="mt-4 btn-primary" onClick={() => window.location.href = '/kyc'}>
                  {getText('Konplete KYC', 'Compléter KYC', 'Complete KYC')}
                </Button>
              </div>
            ) : (
              <>
                {settings && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-4 mb-6 text-left">
                    <h4 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                      {getText('Avantaj Ajan', 'Avantages Agent', 'Agent Benefits')}
                    </h4>
                    <ul className="text-sm text-emerald-700 dark:text-emerald-400 space-y-1">
                      <li>✓ {getText(`Komisyon ${settings.commission_percentage}% sou chak depo`, `Commission ${settings.commission_percentage}% sur chaque dépôt`, `${settings.commission_percentage}% commission on each deposit`)}</li>
                      <li>✓ {getText('Retire komisyon ou dirèkteman nan bous ou', 'Retirez votre commission directement dans votre portefeuille', 'Withdraw commission directly to your wallet')}</li>
                      <li>✓ {getText('Tablo de bò pou swiv depo ou yo', 'Tableau de bord pour suivre vos dépôts', 'Dashboard to track your deposits')}</li>
                    </ul>
                  </div>
                )}
                
                <Button 
                  onClick={requestAgentAccess} 
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? getText('Chajman...', 'Chargement...', 'Loading...') : getText('Mande vin Ajan', 'Demander à devenir Agent', 'Request to become Agent')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // If agent request is pending
  if (!isAgent && agentRequest?.status === 'pending') {
    return (
      <DashboardLayout title={getText('Ajan Depo', 'Agent Dépôt', 'Agent Deposit')}>
        <Card className="max-w-xl mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Clock className="text-amber-500" size={40} />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-2">
              {getText('Demann an Atant', 'Demande en Attente', 'Request Pending')}
            </h3>
            <p className="text-stone-600 dark:text-stone-400 mb-4">
              {getText(
                'Demann ou pou vin ajan ap tann apwobasyon. Sa ka pran jiska 24 èdtan.',
                'Votre demande pour devenir agent est en attente d\'approbation. Cela peut prendre jusqu\'à 24 heures.',
                'Your request to become an agent is pending approval. This may take up to 24 hours.'
              )}
            </p>
            <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4 text-left">
              <p className="text-sm text-stone-500 dark:text-stone-400">{getText('Soumèt le', 'Soumis le', 'Submitted on')}:</p>
              <p className="font-medium">{new Date(agentRequest.created_at).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // If agent request was rejected
  if (!isAgent && agentRequest?.status === 'rejected') {
    return (
      <DashboardLayout title={getText('Ajan Depo', 'Agent Dépôt', 'Agent Deposit')}>
        <Card className="max-w-xl mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="text-red-500" size={40} />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-2">
              {getText('Demann Rejte', 'Demande Rejetée', 'Request Rejected')}
            </h3>
            <p className="text-stone-600 dark:text-stone-400 mb-4">
              {getText(
                'Malerezman, demann ou pou vin ajan te rejte.',
                'Malheureusement, votre demande pour devenir agent a été rejetée.',
                'Unfortunately, your request to become an agent was rejected.'
              )}
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // Agent deposits disabled
  if (isAgent && settings && !settings.enabled) {
    return (
      <DashboardLayout title={getText('Ajan Depo', 'Agent Dépôt', 'Agent Deposit')}>
        <Card className="max-w-xl mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
            <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-2">
              {getText('Depo Ajan pa Disponib', 'Dépôts Agent non Disponibles', 'Agent Deposits Unavailable')}
            </h3>
            <p className="text-stone-600 dark:text-stone-400">
              {getText(
                'Sistèm depo ajan an pa aktive kounye a. Tanpri eseye pita.',
                'Le système de dépôt agent n\'est pas activé actuellement. Veuillez réessayer plus tard.',
                'The agent deposit system is not currently active. Please try again later.'
              )}
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // Main agent dashboard
  return (
    <DashboardLayout title={getText('Ajan Depo', 'Agent Dépôt', 'Agent Deposit')}>
      <div className="max-w-4xl mx-auto space-y-6" data-testid="agent-deposit-page">
        
        {/* Agent Dashboard Stats */}
        {dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-stone-900 dark:text-white">{dashboard.total_deposits}</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">{getText('Total Depo', 'Total Dépôts', 'Total Deposits')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{dashboard.pending_deposits}</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">{getText('An Atant', 'En Attente', 'Pending')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">${dashboard.total_usd_deposited?.toLocaleString()}</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">{getText('USD Depoze', 'USD Déposés', 'USD Deposited')}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-purple-600">${dashboard.agent_wallet_usd?.toFixed(2)}</p>
                <p className="text-sm text-purple-600 dark:text-purple-400">{getText('Komisyon Disponib', 'Commission Disponible', 'Available Commission')}</p>
                {dashboard.agent_wallet_usd > 0 && (
                  <Button 
                    size="sm" 
                    className="mt-2 bg-purple-500 hover:bg-purple-600"
                    onClick={withdrawCommission}
                    disabled={loading}
                  >
                    {getText('Retire', 'Retirer', 'Withdraw')}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Current Rates */}
        {settings && (
          <Card className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="text-[#EA580C]" size={24} />
                  <div>
                    <p className="text-sm text-orange-700 dark:text-orange-400">{getText('To Aktyèl', 'Taux Actuel', 'Current Rate')}</p>
                    <p className="text-xl font-bold text-stone-900 dark:text-white">1 USD = G {settings.rate_usd_to_htg}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Wallet className="text-emerald-600" size={24} />
                  <div>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">{getText('Komisyon ou', 'Votre Commission', 'Your Commission')}</p>
                    <p className="text-xl font-bold text-emerald-600">{settings.commission_percentage}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* New Deposit Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="text-[#EA580C]" size={20} />
              {getText('Nouvo Depo pou Kliyan', 'Nouveau Dépôt pour Client', 'New Deposit for Client')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Client Search */}
            <div>
              <Label htmlFor="client">
                <Search size={16} className="inline mr-2" />
                {getText('Nimewo Telefòn oswa Client ID Kliyan', 'Numéro de Téléphone ou Client ID', 'Client Phone Number or Client ID')}
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="client"
                  placeholder={getText('Ex: +50937000000 oswa KC12345', 'Ex: +50937000000 ou KC12345', 'Ex: +50937000000 or KC12345')}
                  value={clientIdentifier}
                  onChange={(e) => setClientIdentifier(e.target.value)}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-stone-500 mt-1">
                {getText(
                  'Antre nimewo telefòn oswa Client ID kliyan w ap fè depo pou li a',
                  'Entrez le numéro de téléphone ou le Client ID du client pour lequel vous faites le dépôt',
                  'Enter the phone number or Client ID of the client you are making the deposit for'
                )}
              </p>
            </div>

            {/* Amount USD */}
            <div>
              <Label htmlFor="amount_usd">
                <DollarSign size={16} className="inline mr-2" />
                {getText('Montan USD pou depoze', 'Montant USD à déposer', 'USD Amount to Deposit')}
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-stone-400">$</span>
                <Input
                  id="amount_usd"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amountUSD}
                  onChange={(e) => setAmountUSD(e.target.value)}
                  className="pl-12 text-xl font-semibold"
                />
              </div>
            </div>

            {/* Calculated Values */}
            {amountUSD && settings && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                  <p className="text-sm text-amber-700 dark:text-amber-400">{getText('HTG Espere (selon to a)', 'HTG Attendu (selon le taux)', 'Expected HTG (per rate)')}</p>
                  <p className="text-2xl font-bold text-stone-900 dark:text-white">G {expectedHTG.toLocaleString()}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">{getText('Komisyon ou ap touche', 'Commission que vous gagnerez', 'Commission you will earn')}</p>
                  <p className="text-2xl font-bold text-emerald-600">${commission.toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Amount HTG Received */}
            <div>
              <Label htmlFor="amount_htg">
                {getText('Montan HTG ou te resevwa nan men kliyan an', 'Montant HTG reçu du client', 'HTG Amount received from client')}
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-stone-400">G</span>
                <Input
                  id="amount_htg"
                  type="number"
                  step="1"
                  placeholder="0"
                  value={amountHTG}
                  onChange={(e) => setAmountHTG(e.target.value)}
                  className="pl-12 text-xl font-semibold"
                />
              </div>
              <p className="text-xs text-stone-500 mt-1">
                {getText(
                  'Antre montan HTG kliyan an te ba ou',
                  'Entrez le montant HTG que le client vous a donné',
                  'Enter the HTG amount the client gave you'
                )}
              </p>
            </div>

            {/* Payment Proof */}
            <div>
              <Label>{getText('Prèv Peman (opsyonèl)', 'Preuve de Paiement (optionnel)', 'Payment Proof (optional)')}</Label>
              <div 
                className={`file-upload-zone mt-2 cursor-pointer ${proofImage ? 'border-emerald-500 bg-emerald-50' : ''}`}
                onClick={() => document.getElementById('proof-upload').click()}
              >
                {proofImage ? (
                  <div className="flex items-center justify-center gap-2">
                    <Check className="text-emerald-500" size={20} />
                    <span className="text-emerald-700 text-sm">{getText('Imaj telechaje', 'Image téléchargée', 'Image uploaded')}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto text-stone-400 mb-2" size={24} />
                    <p className="text-sm text-stone-600">{getText('Klike pou telechaje', 'Cliquez pour télécharger', 'Click to upload')}</p>
                  </>
                )}
              </div>
              <input
                id="proof-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            {/* Submit Button */}
            <Button 
              onClick={() => setShowConfirm(true)}
              disabled={!clientIdentifier || !amountUSD || !amountHTG}
              className="btn-primary w-full"
            >
              {getText('Soumèt Depo', 'Soumettre Dépôt', 'Submit Deposit')}
              <ArrowRight size={18} className="ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Recent Deposits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={20} className="text-stone-500" />
              {getText('Depo Resan', 'Dépôts Récents', 'Recent Deposits')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deposits.length === 0 ? (
              <p className="text-center text-stone-500 py-8">
                {getText('Pa gen depo ankò', 'Pas encore de dépôts', 'No deposits yet')}
              </p>
            ) : (
              <div className="space-y-3">
                {deposits.slice(0, 10).map((deposit) => (
                  <div key={deposit.deposit_id} className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-800 rounded-xl">
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-white">{deposit.client_name}</p>
                      <p className="text-sm text-stone-500">{deposit.client_id}</p>
                      <p className="text-xs text-stone-400">{new Date(deposit.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">${deposit.amount_usd}</p>
                      <Badge className={
                        deposit.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        deposit.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }>
                        {deposit.status === 'approved' ? getText('Apwouve', 'Approuvé', 'Approved') :
                         deposit.status === 'pending' ? getText('An Atant', 'En Attente', 'Pending') :
                         getText('Rejte', 'Rejeté', 'Rejected')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirmation Modal */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{getText('Konfime Depo', 'Confirmer le Dépôt', 'Confirm Deposit')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">{getText('Kliyan', 'Client', 'Client')}:</span>
                  <span className="font-semibold">{clientIdentifier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">{getText('Montan USD', 'Montant USD', 'USD Amount')}:</span>
                  <span className="font-bold text-emerald-600">${amountUSD}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">{getText('HTG Resevwa', 'HTG Reçu', 'HTG Received')}:</span>
                  <span className="font-semibold">G {amountHTG}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-stone-500">{getText('Komisyon ou', 'Votre Commission', 'Your Commission')}:</span>
                  <span className="font-bold text-purple-600">${commission.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {getText(
                    'Apre soumisyon, admin an ap verifye epi apwouve depo a. Ou ap resevwa yon notifikasyon WhatsApp lè li apwouve.',
                    'Après soumission, l\'admin vérifiera et approuvera le dépôt. Vous recevrez une notification WhatsApp une fois approuvé.',
                    'After submission, admin will verify and approve the deposit. You will receive a WhatsApp notification when approved.'
                  )}
                </p>
              </div>

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setShowConfirm(false)} className="flex-1">
                  {getText('Anile', 'Annuler', 'Cancel')}
                </Button>
                <Button 
                  onClick={handleSubmitDeposit}
                  disabled={loading}
                  className="btn-primary flex-1"
                >
                  {loading ? getText('Chajman...', 'Chargement...', 'Loading...') : getText('Konfime', 'Confirmer', 'Confirm')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
