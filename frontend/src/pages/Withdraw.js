import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Check, 
  AlertCircle,
  DollarSign,
  Building,
  Wallet,
  Smartphone
} from 'lucide-react';

import { API_BASE } from '@/lib/utils';
const API = API_BASE;

// Withdrawal methods by currency - NO cross-currency allowed
// HTG balance can ONLY withdraw to HTG methods
// USD balance can ONLY withdraw to USD methods
const withdrawalMethodsByCurrency = {
  HTG: [
    { id: 'moncash', name: 'MonCash', icon: Smartphone, placeholder: 'Nimewo telefòn MonCash' },
    { id: 'natcash', name: 'NatCash', icon: Smartphone, placeholder: 'Nimewo telefòn NatCash' }
  ],
  USD: [
    { id: 'zelle', name: 'Zelle', icon: DollarSign, placeholder: 'Email ou telefòn Zelle' },
    { id: 'paypal', name: 'PayPal', icon: DollarSign, placeholder: 'Email PayPal' },
    { id: 'usdt', name: 'USDT (TRC-20)', icon: Wallet, placeholder: 'Adrès USDT TRC-20' },
    { id: 'bank_usa', name: 'Bank USA 🇺🇸', icon: Building, placeholder: 'Routing + Account Number' },
    { id: 'bank_mexico', name: 'Bank Mexico 🇲🇽', icon: Building, placeholder: 'CLABE (18 chif)' },
    { id: 'bank_brazil', name: 'Bank Brazil 🇧🇷', icon: Building, placeholder: 'CPF/CNPJ + Chave PIX' },
    { id: 'bank_chile', name: 'Bank Chile 🇨🇱', icon: Building, placeholder: 'RUT + Nimewo kont' }
  ]
};

export default function Withdraw() {
  const { t, language } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [fees, setFees] = useState([]);
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [availableMethods, setAvailableMethods] = useState(withdrawalMethodsByCurrency);
  const [methodMeta, setMethodMeta] = useState({});
  const [methodsLoading, setMethodsLoading] = useState(true);
  
  // Currency selection - source = target (no cross-currency)
  const [currency, setCurrency] = useState('HTG');

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  const getMethodIcon = (methodId) => {
    if (methodId === 'moncash' || methodId === 'natcash') return Smartphone;
    if (methodId.startsWith('bank')) return Building;
    if (methodId === 'usdt') return Wallet;
    return DollarSign;
  };

  const fetchFeesAndLimits = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/withdrawals/fees`);
      setFees(response.data.fees);
      setLimits(response.data.limits);
    } catch (error) {
      console.error('Error fetching fees:', error);
    }
  }, []);

  const fetchPaymentMethods = useCallback(async (cur) => {
    setMethodsLoading(true);
    try {
      const res = await axios.get(`${API}/public/payment-methods?flow=withdrawal&currency=${cur}`);
      const list = Array.isArray(res.data) ? res.data : [];

      const metaById = {};
      const mapped = list
        .filter(m => m.method_id !== 'card') // Exclude card from withdrawal methods
        .slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((m) => {
          metaById[m.method_id] = m;
          const pub = m.public || {};
          return {
            id: m.method_id,
            name: m.display_name,
            icon: getMethodIcon(m.method_id),
            placeholder: pub.placeholder
          };
        });

      setMethodMeta((prev) => ({ ...prev, ...metaById }));
      // Use API methods if available, otherwise keep fallback
      if (mapped.length > 0) {
        setAvailableMethods((prev) => ({ ...prev, [cur]: mapped }));
      }
    } catch (e) {
      // Silent fallback - keep default methods
      console.error('Error fetching withdrawal methods:', e);
    } finally {
      setMethodsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeesAndLimits();
  }, [fetchFeesAndLimits]);

  // Reset method when currency changes
  useEffect(() => {
    setMethod('');
    fetchPaymentMethods(currency);
  }, [currency, fetchPaymentMethods]);

  const calculateFee = () => {
    if (!method || !amount) return 0;
    
    const feeConfig = fees.find(f => 
      f.method === method && 
      parseFloat(amount) >= f.min_amount && 
      parseFloat(amount) <= f.max_amount
    );
    
    if (!feeConfig) return 0;
    
    if (feeConfig.fee_type === 'percentage') {
      return parseFloat(amount) * (feeConfig.fee_value / 100);
    }
    return feeConfig.fee_value;
  };

  const getLimit = () => {
    return limits.find(l => l.method === method) || { min_amount: 10, max_amount: 10000 };
  };

  const getBalance = () => {
    if (currency === 'USD') return user?.wallet_usd || 0;
    return user?.wallet_htg || 0;
  };

  const handleSubmit = async () => {
    const limit = getLimit();
    const amt = parseFloat(amount);
    
    if (amt < limit.min_amount) {
      toast.error(`${getText('Montan minimòm', 'Montant minimum', 'Minimum amount')}: ${currency === 'USD' ? '$' : 'G '}${limit.min_amount}`);
      return;
    }
    
    if (amt > limit.max_amount) {
      toast.error(`${getText('Montan maksimòm', 'Montant maximum', 'Maximum amount')}: ${currency === 'USD' ? '$' : 'G '}${limit.max_amount}`);
      return;
    }

    // Check if user has enough balance
    if (amt > getBalance()) {
      toast.error(getText('Balans ensifizan', 'Solde insuffisant', 'Insufficient balance'));
      return;
    }
    
    if (!destination) {
      toast.error(getText('Antre destinasyon an', 'Entrez la destination', 'Enter destination'));
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/withdrawals/create`, {
        amount: amt,
        currency: currency,
        source_currency: currency, // Same as target - no cross-currency
        method,
        destination
      });
      
      await refreshUser();
      toast.success(getText('Demann retrè soumèt siksè!', 'Demande de retrait soumise avec succès!', 'Withdrawal request submitted successfully!'));
      setStep(3);
    } catch (error) {
      toast.error(error.response?.data?.detail || getText('Erè nan soumisyon', 'Erreur lors de la soumission', 'Submission error'));
    } finally {
      setLoading(false);
    }
  };

  const fee = calculateFee();
  const netAmount = parseFloat(amount || 0) - fee;

  const currentMethods = availableMethods[currency] || withdrawalMethodsByCurrency[currency] || [];

  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Balance Selection - This determines which withdrawal methods are available */}
      <div>
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">
          {getText('Chwazi ki balans pou retire', 'Choisir quel solde retirer', 'Choose which balance to withdraw')}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div 
            className={`p-4 rounded-xl cursor-pointer transition-all ${
              currency === 'HTG' 
                ? 'bg-[#EA580C] text-white ring-2 ring-[#EA580C] ring-offset-2' 
                : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 hover:border-[#EA580C]'
            }`}
            onClick={() => setCurrency('HTG')}
          >
            <p className={`text-sm ${currency === 'HTG' ? 'text-orange-100' : 'text-stone-500 dark:text-stone-400'}`}>
              {getText('Balans HTG', 'Solde HTG', 'HTG Balance')}
            </p>
            <p className={`text-xl font-bold ${currency === 'HTG' ? 'text-white' : 'text-stone-900 dark:text-white'}`}>
              G {(user?.wallet_htg || 0).toLocaleString()}
            </p>
            <p className={`text-xs mt-1 ${currency === 'HTG' ? 'text-orange-200' : 'text-stone-400'}`}>
              → MonCash, NatCash
            </p>
          </div>
          
          <div 
            className={`p-4 rounded-xl cursor-pointer transition-all ${
              currency === 'USD' 
                ? 'bg-amber-500 text-white ring-2 ring-amber-500 ring-offset-2' 
                : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:border-amber-500'
            }`}
            onClick={() => setCurrency('USD')}
          >
            <p className={`text-sm ${currency === 'USD' ? 'text-amber-100' : 'text-stone-500 dark:text-stone-400'}`}>
              {getText('Balans USD', 'Solde USD', 'USD Balance')}
            </p>
            <p className={`text-xl font-bold ${currency === 'USD' ? 'text-white' : 'text-stone-900 dark:text-white'}`}>
              ${(user?.wallet_usd || 0).toFixed(2)}
            </p>
            <p className={`text-xs mt-1 ${currency === 'USD' ? 'text-amber-200' : 'text-stone-400'}`}>
              → Zelle, PayPal, USDT, Bank
            </p>
          </div>
        </div>
      </div>

      {/* Info box about currency restriction */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {currency === 'HTG' 
            ? getText(
                '💡 Balans HTG ka retire sèlman via MonCash oswa NatCash.',
                '💡 Le solde HTG ne peut être retiré que via MonCash ou NatCash.',
                '💡 HTG balance can only be withdrawn via MonCash or NatCash.'
              )
            : getText(
                '💡 Balans USD ka retire via Zelle, PayPal, USDT, oswa Bank. Pou ajoute kòb sou kat vityèl, ale nan paj Kat Vityèl.',
                '💡 Le solde USD peut être retiré via Zelle, PayPal, USDT ou Bank. Pour ajouter des fonds à votre carte virtuelle, allez sur la page Carte Virtuelle.',
                '💡 USD balance can be withdrawn via Zelle, PayPal, USDT, or Bank. To add funds to your virtual card, go to the Virtual Card page.'
              )
          }
        </p>
      </div>

      <div>
        <h3 className="font-semibold text-stone-900 dark:text-white mb-4">
          {getText('Chwazi metòd retrè', 'Choisir la méthode de retrait', 'Choose withdrawal method')}
        </h3>
        <div className="space-y-3">
          {methodsLoading ? (
            <div className="text-center py-8 text-stone-500">
              {getText('Chajman metod yo...', 'Chargement des methodes...', 'Loading methods...')}
            </div>
          ) : currentMethods.length === 0 ? (
            <div className="text-center py-8 text-stone-500">
              <p>{getText(`Pa gen metod disponib pou ${currency}`, `Aucune methode disponible pour ${currency}`, `No methods available for ${currency}`)}</p>
            </div>
          ) : (
            currentMethods.map((m) => {
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
            })
          )}
        </div>
      </div>

      <Button 
        onClick={() => setStep(2)} 
        disabled={!method}
        className="btn-primary w-full"
        data-testid="withdraw-continue"
      >
        {getText('Kontinye', 'Continuer', 'Continue')}
      </Button>
    </div>
  );

  const renderStep2 = () => {
    const selectedMethod = currentMethods.find(m => m.id === method);
    const limit = getLimit();
    
    return (
      <div className="space-y-6">
        <div>
          <Label>{getText('Destinasyon', 'Destination', 'Destination')}</Label>
          <Input
            placeholder={selectedMethod?.placeholder}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="mt-2"
            data-testid="withdraw-destination"
          />
        </div>

        <div className="text-center">
          <Label className="text-stone-600 dark:text-stone-400">{getText('Montan', 'Montant', 'Amount')} ({currency})</Label>
          <div className="relative mt-2">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl text-stone-400">
              {currency === 'USD' ? '$' : 'G'}
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="amount-input py-4 pl-12"
              placeholder="0.00"
              data-testid="withdraw-amount"
            />
          </div>
          <p className="text-sm text-stone-500 mt-2">
            Min: {currency === 'USD' ? '$' : 'G '}{limit.min_amount} | Max: {currency === 'USD' ? '$' : 'G '}{limit.max_amount}
          </p>
          <p className="text-sm text-stone-400 mt-1">
            {getText('Balans disponib', 'Solde disponible', 'Available balance')}: {currency === 'USD' ? '$' : 'G '}{getBalance().toLocaleString()}
          </p>
        </div>

        {amount && parseFloat(amount) > 0 && (
          <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-stone-600 dark:text-stone-400">
              <span>{getText('Montan', 'Montant', 'Amount')}</span>
              <span>{currency === 'USD' ? '$' : 'G '}{parseFloat(amount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-stone-600 dark:text-stone-400">
              <span>{getText('Frè', 'Frais', 'Fee')}</span>
              <span className="text-red-500">-{currency === 'USD' ? '$' : 'G '}{fee.toFixed(2)}</span>
            </div>
            <div className="border-t border-stone-200 dark:border-stone-700 pt-2 flex justify-between font-semibold text-stone-900 dark:text-white">
              <span>{getText('Montan nèt', 'Montant net', 'Net amount')}</span>
              <span className="text-emerald-600">{currency === 'USD' ? '$' : 'G '}{netAmount.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
            {getText('Retounen', 'Retour', 'Back')}
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading || !amount || !destination || parseFloat(amount) <= 0}
            className="btn-primary flex-1"
            data-testid="withdraw-submit"
          >
            {loading ? getText('Chajman...', 'Chargement...', 'Loading...') : getText('Soumèt retrè', 'Soumettre', 'Submit withdrawal')}
          </Button>
        </div>
      </div>
    );
  };

  const renderSuccess = () => (
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check className="text-emerald-500" size={40} />
      </div>
      <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-2">
        {getText('Demann soumèt!', 'Demande soumise!', 'Request submitted!')}
      </h3>
      <p className="text-stone-600 dark:text-stone-400 mb-6">
        {getText(
          `Demann retrè ${currency === 'USD' ? '$' : 'G '}${amount} ${currency} ap trete.`,
          `Votre demande de retrait de ${currency === 'USD' ? '$' : 'G '}${amount} ${currency} est en cours de traitement.`,
          `Your withdrawal request of ${currency === 'USD' ? '$' : 'G '}${amount} ${currency} is being processed.`
        )}
      </p>
      <Button onClick={() => { setStep(1); setAmount(''); setDestination(''); setMethod(''); }} className="btn-primary">
        {getText('Nouvo retrè', 'Nouveau retrait', 'New withdrawal')}
      </Button>
    </div>
  );

  return (
    <DashboardLayout title={getText('Retire lajan', 'Retirer des fonds', 'Withdraw funds')}>
      {user?.kyc_status !== 'approved' ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
            <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-2">{getText('Verifikasyon KYC obligatwa', 'Vérification KYC requise', 'KYC verification required')}</h3>
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              {getText(
                'Ou dwe konplete verifikasyon KYC pou fè retrè.',
                'Vous devez compléter votre vérification KYC pour effectuer des retraits.',
                'You must complete KYC verification to make withdrawals.'
              )}
            </p>
            <Button className="btn-primary" onClick={() => window.location.href = '/kyc'}>
              {getText('Konplete KYC', 'Compléter KYC', 'Complete KYC')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>{step < 3 ? `${getText('Etap', 'Étape', 'Step')} ${step}/2` : getText('Siksè', 'Succès', 'Success')}</CardTitle>
          </CardHeader>
          <CardContent>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderSuccess()}
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
