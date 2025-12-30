import React, { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Upload, 
  Check, 
  AlertCircle,
  DollarSign,
  Smartphone,
  Wallet,
  Building
} from 'lucide-react';

import { API_BASE } from '@/lib/utils';
const API = API_BASE;

export default function Deposit() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState('HTG');
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdDeposit, setCreatedDeposit] = useState(null);
  const [usdtNetworks, setUsdtNetworks] = useState([]);
  const [usdtNetwork, setUsdtNetwork] = useState('');
  const [usdtLoading, setUsdtLoading] = useState(false);
  const [usdtEnabled, setUsdtEnabled] = useState(false);
  
  // Dynamic payment methods from API
  const [depositMethods, setDepositMethods] = useState({ HTG: [], USD: [] });
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [selectedMethodData, setSelectedMethodData] = useState(null);
  
  // Sender info for deposit proof
  const [senderInfo, setSenderInfo] = useState({
    sender_name: '',
    sender_phone: ''
  });

  const getText = useCallback((ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  }, [language]);

  // Get icon based on method_id
  const getMethodIcon = (methodId) => {
    if (methodId === 'moncash' || methodId === 'natcash') return Smartphone;
    if (methodId?.startsWith('bank')) return Building;
    if (methodId === 'usdt') return Wallet;
    return DollarSign;
  };

  // Fetch deposit methods from API
  const fetchDepositMethods = useCallback(async (cur) => {
    setMethodsLoading(true);
    try {
      const res = await axios.get(`${API}/public/payment-methods?flow=deposit&currency=${cur}`);
      const list = Array.isArray(res.data) ? res.data : [];
      
      const mapped = list
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((m) => ({
          id: m.method_id,
          name: m.display_name,
          icon: getMethodIcon(m.method_id),
          public: m.public || {}
        }));
      
      setDepositMethods((prev) => ({ ...prev, [cur]: mapped }));
    } catch (e) {
      console.error('Error fetching deposit methods:', e);
      setDepositMethods((prev) => ({ ...prev, [cur]: [] }));
    } finally {
      setMethodsLoading(false);
    }
  }, []);

  // Fetch methods when currency changes
  useEffect(() => {
    fetchDepositMethods(currency);
    setMethod('');
    setSelectedMethodData(null);
  }, [currency, fetchDepositMethods]);

  const loadNetworks = useCallback(async () => {
    if (currency !== 'USD' || method !== 'usdt') return;
    setUsdtLoading(true);
    try {
      const resp = await axios.get(`${API}/deposits/usdt-options`);
      const nets = resp.data?.networks || [];
      setUsdtEnabled(!!resp.data?.enabled);
      setUsdtNetworks(nets);
      // auto-select first if none selected
      setUsdtNetwork((prev) => prev || (nets.length > 0 ? nets[0].code : ''));
    } catch (e) {
      setUsdtNetworks([]);
      setUsdtEnabled(false);
    } finally {
      setUsdtLoading(false);
    }
  }, [currency, method]);

  useEffect(() => {
    loadNetworks();
  }, [loadNetworks]);

  // Reset USDT fields when method changes
  useEffect(() => {
    if (method !== 'usdt') {
      setUsdtNetwork('');
      setUsdtNetworks([]);
      setUsdtEnabled(false);
    }
  }, [method]);

  // Update selected method data when method changes
  useEffect(() => {
    if (method) {
      const methodData = depositMethods[currency]?.find(m => m.id === method);
      setSelectedMethodData(methodData || null);
    } else {
      setSelectedMethodData(null);
    }
  }, [method, currency, depositMethods]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error(getText('Antre yon montan valid', 'Veuillez entrer un montant valide', 'Please enter a valid amount'));
      return;
    }

    if (method === 'usdt') {
      if (!usdtEnabled) {
        toast.error(getText('Plisio pa aktive (admin dwe mete kle yo)', 'Plisio non active (admin doit mettre les cles)', 'Plisio not enabled (admin must set keys)'));
        return;
      }
      if (!usdtNetwork) {
        toast.error(getText('Chwazi rezo USDT la', 'Choisissez le reseau USDT', 'Select USDT network'));
        return;
      }
    }

    if (method !== 'usdt' && !proofImage) {
      toast.error(getText('Telechaje prev peman an', 'Veuillez telecharger la preuve de paiement', 'Please upload payment proof'));
      return;
    }

    setLoading(true);

    try {
      const payload = {
        amount: parseFloat(amount),
        currency,
        method,
        proof_image: method === 'usdt' ? null : (proofImage || null),
        wallet_address: method === 'usdt' ? null : null,
        network: method === 'usdt' ? usdtNetwork : null
      };

      const resp = await axios.post(`${API}/deposits/create`, payload);
      setCreatedDeposit(resp.data.deposit);
      toast.success(getText('Demann depo soumit sikse!', 'Demande de depot soumise avec succes!', 'Deposit request submitted successfully!'));
      setStep(4);
    } catch (error) {
      toast.error(error.response?.data?.detail || getText('Ere nan soumisyon', 'Erreur lors de la soumission', 'Submission error'));
    } finally {
      setLoading(false);
    }
  };

  // Get instructions for the selected method from API data
  const getMethodInstructions = () => {
    if (!selectedMethodData) return getText('Metod sa pa configure.', 'Methode non configuree.', 'Method not configured.');
    
    const pub = selectedMethodData.public || {};
    const recipient = pub.recipient || pub.number || '';
    const instructions = pub.instructions || '';
    
    if (recipient) {
      return getText(
        `${instructions || 'Voye montan an nan'} ${selectedMethodData.name}: ${recipient}`,
        `${instructions || 'Envoyez le montant sur'} ${selectedMethodData.name}: ${recipient}`,
        `${instructions || 'Send the amount to'} ${selectedMethodData.name}: ${recipient}`
      );
    }
    
    if (instructions) return instructions;
    
    return getText(
      'Voye montan an, epi telechaje prev la.',
      'Envoyez le montant, puis telechargez la preuve.',
      'Send the amount, then upload the proof.'
    );
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-stone-900 dark:text-white mb-4">{getText('Chwazi deviz', 'Choisir la devise', 'Choose currency')}</h3>
        <div className="grid grid-cols-2 gap-4">
          {['HTG', 'USD'].map((cur) => (
            <button
              key={cur}
              onClick={() => { setCurrency(cur); setMethod(''); }}
              className={`p-6 rounded-xl border-2 transition-all ${
                currency === cur 
                  ? cur === 'HTG' ? 'border-[#EA580C] bg-orange-50 dark:bg-orange-900/20' : 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                  : 'border-stone-200 dark:border-stone-700 hover:border-stone-300'
              }`}
            >
              <div className="text-3xl font-bold text-stone-900 dark:text-white mb-1">
                {cur === 'HTG' ? 'G' : '$'}
              </div>
              <div className="text-stone-600 dark:text-stone-400">{cur === 'HTG' ? 'Goud' : 'Dola'}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-stone-900 dark:text-white mb-4">{getText('Chwazi metod', 'Choisir la methode', 'Choose method')}</h3>
        <div className="space-y-3">
          {methodsLoading ? (
            <div className="text-center py-8 text-stone-500">
              {getText('Chajman metod yo...', 'Chargement des methodes...', 'Loading methods...')}
            </div>
          ) : depositMethods[currency]?.length === 0 ? (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
              {getText(
                `Pa gen metod depo ki aktive pou ${currency}. Kontakte admin.`,
                `Aucune methode de depot activee pour ${currency}. Contactez l'admin.`,
                `No ${currency} deposit methods are enabled. Contact admin.`
              )}
            </div>
          ) : depositMethods[currency]?.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                  method === m.id 
                    ? 'border-[#EA580C] bg-orange-50 dark:bg-orange-900/20' 
                    : 'border-stone-200 dark:border-stone-700 hover:border-stone-300'
                }`}
              >
                <div className="w-12 h-12 bg-stone-100 dark:bg-stone-800 rounded-lg flex items-center justify-center">
                  <Icon size={24} className="text-stone-600 dark:text-stone-400" />
                </div>
                <span className="font-medium text-stone-900 dark:text-white">{m.name}</span>
                {method === m.id && (
                  <Check className="ml-auto text-[#EA580C]" size={20} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Button 
        onClick={() => setStep(2)} 
        disabled={!method}
        className="btn-primary w-full"
        data-testid="deposit-continue"
      >
        {getText('Kontinye', 'Continuer', 'Continue')}
      </Button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Label className="text-stone-600 dark:text-stone-400">{getText('Montan pou depoze', 'Montant a deposer', 'Amount to deposit')} ({currency})</Label>
        <div className="relative mt-2">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl text-stone-400">
            {currency === 'HTG' ? 'G' : '$'}
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="amount-input py-4 pl-12"
            placeholder="0.00"
            data-testid="deposit-amount"
          />
        </div>
      </div>

      {method === 'usdt' ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-500 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">{getText('Enstriksyon USDT (Plisio)', 'Instructions USDT (Plisio)', 'USDT Instructions (Plisio)')}</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                {getText(
                  'Chwazi rezo a, epi n ap kreye yon lyen peman otomatik. Depo a ap valide otomatikman apre peman an konfime.',
                  'Choisissez le reseau, puis nous creerons un lien de paiement automatique. Le depot sera valide automatiquement apres confirmation.',
                  'Select the network and we will generate an automatic payment link. Deposit will auto-validate after confirmation.'
                )}
              </p>
              <div className="mt-3">
                <Label>{getText('Rezo USDT', 'Reseau USDT', 'USDT Network')}</Label>
                {usdtLoading ? (
                  <div className="text-sm text-stone-600 mt-2">{getText('Chajman rezo yo...', 'Chargement des reseaux...', 'Loading networks...')}</div>
                ) : (
                  <Select value={usdtNetwork} onValueChange={setUsdtNetwork}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder={getText('Chwazi rezo a', 'Choisir le reseau', 'Select network')} />
                    </SelectTrigger>
                    <SelectContent>
                      {usdtNetworks.map((n) => (
                        <SelectItem key={n.code} value={n.code}>{n.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!usdtLoading && usdtNetworks.length === 0 && (
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-2">
                    {getText(
                      'Plisio pa disponib kounye a. Kontakte admin pou aktive li.',
                      'Plisio nest pas disponible pour le moment. Contactez ladmin pour lactiver.',
                      'Plisio is not available right now. Ask admin to enable it.'
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-4">
            <p className="font-medium text-orange-800 dark:text-orange-300">
              {getText('Enstriksyon', 'Instructions', 'Instructions')} {selectedMethodData?.name}
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
              {getMethodInstructions()}
            </p>
          </div>

          <div>
            <Label>{getText('Telechaje prev peman', 'Telecharger preuve de paiement', 'Upload payment proof')}</Label>
            <div 
              className={`file-upload-zone mt-2 ${proofImage ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
              onClick={() => document.getElementById('proof-upload').click()}
            >
              {proofImage ? (
                <div className="flex items-center justify-center gap-3">
                  <Check className="text-emerald-500" size={24} />
                  <span className="text-emerald-700 dark:text-emerald-400">{getText('Imaj telechaje', 'Image telechargee', 'Image uploaded')}</span>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto text-stone-400 mb-2" size={32} />
                  <p className="text-stone-600 dark:text-stone-400">{getText('Klike pou telechaje', 'Cliquez pour telecharger', 'Click to upload')}</p>
                  <p className="text-sm text-stone-400 mt-1">PNG, JPG {getText('jiska', "jusqu'a", 'up to')} 5MB</p>
                </>
              )}
            </div>
            <input
              id="proof-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              data-testid="deposit-proof-upload"
            />
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
          {getText('Retounen', 'Retour', 'Back')}
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={loading || !amount}
          className="btn-primary flex-1"
          data-testid="deposit-submit"
        >
          {loading ? getText('Chajman...', 'Chargement...', 'Loading...') : getText('Soumet', 'Soumettre', 'Submit')}
        </Button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check className="text-emerald-500" size={40} />
      </div>
      <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-2">{getText('Demann soumet!', 'Demande soumise!', 'Request submitted!')}</h3>
      <p className="text-stone-600 dark:text-stone-400 mb-6">
        {getText(
          `Demann depo ${currency === 'HTG' ? 'G' : '$'}${amount} ${currency} ap tann validasyon.`,
          `Votre demande de depot de ${currency === 'HTG' ? 'G' : '$'}${amount} ${currency} est en attente de validation.`,
          `Your deposit request of ${currency === 'HTG' ? 'G' : '$'}${amount} ${currency} is pending validation.`
        )}
      </p>

      {createdDeposit?.provider === 'plisio' && createdDeposit?.plisio_invoice_url && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 mb-6 text-left">
          <p className="font-semibold text-amber-800 dark:text-amber-300 mb-2">
            {getText('Peye ak Plisio (USDT)', 'Payer avec Plisio (USDT)', 'Pay with Plisio (USDT)')}
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
            {getText(
              'Klike sou lyen an pou fini peman an. Depo a ap valide otomatikman apre peman an konfime.',
              'Cliquez sur le lien pour finaliser le paiement. Le depot sera valide automatiquement apres confirmation.',
              'Click the link to complete payment. Deposit will auto-validate after confirmation.'
            )}
          </p>
          <a
            href={createdDeposit.plisio_invoice_url}
            target="_blank"
            rel="noreferrer"
            className="text-[#EA580C] font-medium hover:underline break-all"
          >
            {createdDeposit.plisio_invoice_url}
          </a>
          <div className="mt-4 flex gap-3">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const resp = await axios.post(`${API}/deposits/${createdDeposit.deposit_id}/sync`);
                  setCreatedDeposit(resp.data.deposit);
                  toast.success(getText('Mizajou fet', 'Mise a jour effectuee', 'Updated'));
                } catch (e) {
                  toast.error(getText('Ere pandan sync', 'Erreur sync', 'Sync error'));
                }
              }}
            >
              {getText('Verifye peman an', 'Verifier le paiement', 'Check payment')}
            </Button>
          </div>
          {createdDeposit.provider_status && (
            <p className="text-sm text-stone-700 dark:text-stone-300 mt-3">
              {getText('Estati', 'Statut', 'Status')}: <span className="font-semibold">{createdDeposit.provider_status}</span>
            </p>
          )}
        </div>
      )}

      <Button onClick={() => { setStep(1); setAmount(''); setProofImage(''); setMethod(''); }} className="btn-primary">
        {getText('Nouvo depo', 'Nouveau depot', 'New deposit')}
      </Button>
    </div>
  );

  return (
    <DashboardLayout title={getText('Depoze lajan', 'Deposer des fonds', 'Deposit funds')}>
      {user?.kyc_status !== 'approved' ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
            <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-2">{getText('Verifikasyon KYC obligatwa', 'Verification KYC requise', 'KYC verification required')}</h3>
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              {getText('Ou dwe konplete KYC ou pou fe depo.', 'Vous devez completer votre verification KYC pour effectuer des depots.', 'You must complete KYC verification to make deposits.')}
            </p>
            <Button className="btn-primary" onClick={() => window.location.href = '/kyc'}>
              {getText('Konplete KYC', 'Completer KYC', 'Complete KYC')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>{step < 4 ? `${getText('Etap', 'Etape', 'Step')} ${step}/2` : getText('Sikse', 'Succes', 'Success')}</CardTitle>
          </CardHeader>
          <CardContent>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 4 && renderSuccess()}
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
