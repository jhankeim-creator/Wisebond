import React, { useState, useEffect } from 'react';
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
  CreditCard,
  Building,
  Wallet,
  ArrowLeftRight,
  Smartphone
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

// Metòd retrè separe pa deviz
// HTG: MonCash, NatCash sèlman
// USD: Zelle, PayPal, USDT, Bank USA, Kat Vityèl
const fallbackWithdrawalMethodsByTargetCurrency = {
  HTG: [
    { id: 'moncash', name: 'MonCash', icon: Smartphone, placeholder: 'Nimewo telefòn MonCash' },
    { id: 'natcash', name: 'NatCash', icon: Smartphone, placeholder: 'Nimewo telefòn NatCash' }
  ],
  USD: [
    { id: 'card', name: 'Kat Vityèl', icon: CreditCard, placeholder: 'Email kat vityèl ou', onlyField: 'email' },
    { id: 'zelle', name: 'Zelle', icon: DollarSign, placeholder: 'Email ou telefòn Zelle' },
    { id: 'paypal', name: 'PayPal', icon: DollarSign, placeholder: 'Email PayPal' },
    { id: 'usdt', name: 'USDT', icon: Wallet, placeholder: 'Adrès USDT (TRC-20 ou ERC-20)' },
    { id: 'bank_usa', name: 'Bank USA', icon: Building, placeholder: 'Routing + Account Number' }
  ]
};

export default function Withdraw() {
  const { t, language } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [cardEmail, setCardEmail] = useState('');
  const [fees, setFees] = useState([]);
  const [cardFees, setCardFees] = useState([]);
  const [limits, setLimits] = useState([]);
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [availableMethods, setAvailableMethods] = useState(fallbackWithdrawalMethodsByTargetCurrency);
  const [methodMeta, setMethodMeta] = useState({});
  
  // Currency selection for cross-currency withdrawal
  const [sourceCurrency, setSourceCurrency] = useState('HTG');
  const [targetCurrency, setTargetCurrency] = useState('HTG');

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    fetchFeesAndLimits();
    fetchRates();
  }, []);

  // Reset method when target currency changes
  useEffect(() => {
    setMethod('');
    fetchPaymentMethods(targetCurrency);
  }, [targetCurrency]);

  const fetchFeesAndLimits = async () => {
    try {
      const response = await axios.get(`${API}/withdrawals/fees`);
      setFees(response.data.fees);
      setLimits(response.data.limits);
      setCardFees(response.data.card_fees || []);
    } catch (error) {
      console.error('Error fetching fees:', error);
    }
  };

  const getMethodIcon = (methodId) => {
    if (methodId === 'moncash' || methodId === 'natcash') return Smartphone;
    if (methodId === 'bank_usa') return Building;
    if (methodId === 'card') return CreditCard;
    if (methodId === 'usdt') return Wallet;
    return DollarSign;
  };

  const fetchPaymentMethods = async (cur) => {
    try {
      const res = await axios.get(`${API}/public/payment-methods?flow=withdrawal&currency=${cur}`);
      const list = Array.isArray(res.data) ? res.data : [];
      if (list.length === 0) return;

      const metaById = {};
      const mapped = list
        .slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((m) => {
          metaById[m.method_id] = m;
          const pub = m.public || {};
          return {
            id: m.method_id,
            name: m.display_name,
            icon: getMethodIcon(m.method_id),
            placeholder: pub.placeholder,
            onlyField: pub.onlyField
          };
        });

      setMethodMeta((prev) => ({ ...prev, ...metaById }));
      setAvailableMethods((prev) => ({ ...prev, [cur]: mapped }));
    } catch (e) {
      // Silent fallback
    }
  };

  const fetchRates = async () => {
    try {
      const response = await axios.get(`${API}/exchange-rates`);
      setRates(response.data);
    } catch (error) {
      console.error('Error fetching rates:', error);
    }
  };

  const calculateFee = () => {
    if (!method || !amount) return 0;

    if (method === 'card') {
      const amt = parseFloat(amount);
      const range = (cardFees || []).find((f) => amt >= f.min_amount && amt <= f.max_amount);
      return range ? Number(range.fee || 0) : 0;
    }
    
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

  const getSourceBalance = () => {
    if (sourceCurrency === 'USD') return user?.wallet_usd || 0;
    return user?.wallet_htg || 0;
  };

  const convertAmount = (amt, from, to) => {
    if (!rates || from === to) return amt;
    if (from === 'HTG' && to === 'USD') return amt * rates.htg_to_usd;
    if (from === 'USD' && to === 'HTG') return amt * rates.usd_to_htg;
    return amt;
  };

  const handleSubmit = async () => {
    const limit = getLimit();
    const amt = parseFloat(amount);
    
    if (amt < limit.min_amount) {
      toast.error(`${getText('Montan minimòm', 'Montant minimum', 'Minimum amount')}: ${targetCurrency === 'USD' ? '$' : 'G '}${limit.min_amount}`);
      return;
    }
    
    if (amt > limit.max_amount) {
      toast.error(`${getText('Montan maksimòm', 'Montant maximum', 'Maximum amount')}: ${targetCurrency === 'USD' ? '$' : 'G '}${limit.max_amount}`);
      return;
    }

    // Check if user has enough balance in source currency
    const amountInSourceCurrency = convertAmount(amt, targetCurrency, sourceCurrency);
    if (amountInSourceCurrency > getSourceBalance()) {
      toast.error(getText('Balans ensifizan', 'Solde insuffisant', 'Insufficient balance'));
      return;
    }

    // For card withdrawal, use cardEmail as destination
    const finalDestination = method === 'card' ? cardEmail : destination;
    
    if (!finalDestination) {
      toast.error(getText('Antre destinasyon an', 'Entrez la destination', 'Enter destination'));
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/withdrawals/create`, {
        amount: amt,
        currency: targetCurrency,
        source_currency: sourceCurrency,
        method,
        destination: finalDestination
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

  const currentMethods = availableMethods[targetCurrency] || fallbackWithdrawalMethodsByTargetCurrency[targetCurrency] || [];

  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Balance Cards - Select source */}
      <div>
        <p className="text-sm font-medium text-stone-700 mb-3">
          {getText('Chwazi balans sous', 'Choisir le solde source', 'Choose source balance')}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div 
            className={`p-4 rounded-xl cursor-pointer transition-all ${
              sourceCurrency === 'HTG' 
                ? 'bg-[#EA580C] text-white ring-2 ring-[#EA580C] ring-offset-2' 
                : 'bg-orange-50 border border-orange-200 hover:border-[#EA580C]'
            }`}
            onClick={() => setSourceCurrency('HTG')}
          >
            <p className={`text-sm ${sourceCurrency === 'HTG' ? 'text-orange-100' : 'text-stone-500'}`}>
              {getText('Balans HTG', 'Solde HTG', 'HTG Balance')}
            </p>
            <p className={`text-xl font-bold ${sourceCurrency === 'HTG' ? 'text-white' : 'text-stone-900'}`}>
              G {(user?.wallet_htg || 0).toLocaleString()}
            </p>
            {rates && (
              <p className={`text-xs ${sourceCurrency === 'HTG' ? 'text-orange-200' : 'text-stone-400'}`}>
                ≈ ${((user?.wallet_htg || 0) * rates.htg_to_usd).toFixed(2)} USD
              </p>
            )}
          </div>
          
          <div 
            className={`p-4 rounded-xl cursor-pointer transition-all ${
              sourceCurrency === 'USD' 
                ? 'bg-amber-500 text-white ring-2 ring-amber-500 ring-offset-2' 
                : 'bg-amber-50 border border-amber-200 hover:border-amber-500'
            }`}
            onClick={() => setSourceCurrency('USD')}
          >
            <p className={`text-sm ${sourceCurrency === 'USD' ? 'text-amber-100' : 'text-stone-500'}`}>
              {getText('Balans USD', 'Solde USD', 'USD Balance')}
            </p>
            <p className={`text-xl font-bold ${sourceCurrency === 'USD' ? 'text-white' : 'text-stone-900'}`}>
              ${(user?.wallet_usd || 0).toFixed(2)}
            </p>
            {rates && (
              <p className={`text-xs ${sourceCurrency === 'USD' ? 'text-amber-200' : 'text-stone-400'}`}>
                ≈ G {Math.round((user?.wallet_usd || 0) * rates.usd_to_htg).toLocaleString()} HTG
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Target Currency Selection */}
      <div className="bg-stone-50 rounded-xl p-4">
        <p className="text-sm font-medium text-stone-700 mb-3">
          {getText('Chwazi deviz pou retire', 'Choisir la devise à retirer', 'Choose withdrawal currency')}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setTargetCurrency('HTG')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              targetCurrency === 'HTG' 
                ? 'bg-[#EA580C] text-white' 
                : 'bg-white border border-stone-200 text-stone-600 hover:border-[#EA580C]'
            }`}
          >
            HTG (Goud)
          </button>
          <button
            onClick={() => setTargetCurrency('USD')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              targetCurrency === 'USD' 
                ? 'bg-amber-500 text-white' 
                : 'bg-white border border-stone-200 text-stone-600 hover:border-amber-500'
            }`}
          >
            USD (Dola)
          </button>
        </div>
        
        {sourceCurrency !== targetCurrency && rates && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-center gap-2">
            <ArrowLeftRight size={18} className="text-blue-600" />
            <p className="text-sm text-blue-700">
              {getText('Konvèsyon otomatik', 'Conversion automatique', 'Auto conversion')}: 1 {sourceCurrency} = {sourceCurrency === 'HTG' ? rates.htg_to_usd.toFixed(4) : rates.usd_to_htg} {targetCurrency}
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-stone-900 mb-4">
          {getText('Chwazi metòd retrè', 'Choisir la méthode de retrait', 'Choose withdrawal method')}
        </h3>
        <div className="space-y-3">
          {currentMethods.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                  method === m.id 
                    ? 'border-[#EA580C] bg-orange-50' 
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="w-12 h-12 bg-stone-100 rounded-lg flex items-center justify-center">
                  <Icon size={24} className="text-stone-600" />
                </div>
                <span className="font-medium text-stone-900">{m.name}</span>
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
        data-testid="withdraw-continue"
      >
        {getText('Kontinye', 'Continuer', 'Continue')}
      </Button>
    </div>
  );

  const renderStep2 = () => {
    const selectedMethod = currentMethods.find(m => m.id === method);
    const limit = getLimit();
    const isCardMethod = method === 'card';
    
    return (
      <div className="space-y-6">
        {/* For card withdrawal, only need email */}
        {isCardMethod ? (
          <div>
            <Label>{getText('Email kat vityèl ou', 'Email de votre carte virtuelle', 'Your virtual card email')}</Label>
            <Input
              type="email"
              placeholder="example@email.com"
              value={cardEmail}
              onChange={(e) => setCardEmail(e.target.value)}
              className="mt-2"
              data-testid="withdraw-card-email"
            />
            <p className="text-sm text-stone-500 mt-2">
              {getText(
                'Nou ap voye lajan an sou kat vityèl ki asosye ak email sa a.',
                'Nous enverrons les fonds sur la carte virtuelle associée à cet email.',
                'We will send the funds to the virtual card associated with this email.'
              )}
            </p>
          </div>
        ) : (
          <div>
            <Label>{t('destination')}</Label>
            <Input
              placeholder={selectedMethod?.placeholder}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="mt-2"
              data-testid="withdraw-destination"
            />
          </div>
        )}

        <div className="text-center">
          <Label className="text-stone-600">{t('amount')} ({targetCurrency})</Label>
          <div className="relative mt-2">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl text-stone-400">
              {targetCurrency === 'USD' ? '$' : 'G'}
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
            Min: {targetCurrency === 'USD' ? '$' : 'G '}{limit.min_amount} | Max: {targetCurrency === 'USD' ? '$' : 'G '}{limit.max_amount}
          </p>
        </div>

        {amount && parseFloat(amount) > 0 && (
          <div className="bg-stone-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-stone-600">
              <span>{t('amount')}</span>
              <span>{targetCurrency === 'USD' ? '$' : 'G '}{parseFloat(amount).toLocaleString()}</span>
            </div>
            {sourceCurrency !== targetCurrency && rates && (
              <div className="flex justify-between text-blue-600">
                <span>{getText('Konvèsyon', 'Conversion', 'Conversion')}</span>
                <span>
                  {sourceCurrency === 'USD' ? '$' : 'G '}{convertAmount(parseFloat(amount), targetCurrency, sourceCurrency).toLocaleString(undefined, {maximumFractionDigits: 2})} {sourceCurrency}
                </span>
              </div>
            )}
            <div className="flex justify-between text-stone-600">
              <span>{t('fee')}</span>
              <span className="text-red-500">-{targetCurrency === 'USD' ? '$' : 'G '}{fee.toFixed(2)}</span>
            </div>
            <div className="border-t border-stone-200 pt-2 flex justify-between font-semibold text-stone-900">
              <span>{t('netAmount')}</span>
              <span className="text-emerald-600">{targetCurrency === 'USD' ? '$' : 'G '}{netAmount.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
            {getText('Retounen', 'Retour', 'Back')}
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading || !amount || (!destination && !cardEmail) || parseFloat(amount) <= 0}
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
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check className="text-emerald-500" size={40} />
      </div>
      <h3 className="text-2xl font-bold text-stone-900 mb-2">
        {getText('Demann soumèt!', 'Demande soumise!', 'Request submitted!')}
      </h3>
      <p className="text-stone-600 mb-6">
        {getText(
          `Demann retrè ${targetCurrency === 'USD' ? '$' : 'G '}${amount} ${targetCurrency} ap trete.`,
          `Votre demande de retrait de ${targetCurrency === 'USD' ? '$' : 'G '}${amount} ${targetCurrency} est en cours de traitement.`,
          `Your withdrawal request of ${targetCurrency === 'USD' ? '$' : 'G '}${amount} ${targetCurrency} is being processed.`
        )}
      </p>
      <Button onClick={() => { setStep(1); setAmount(''); setDestination(''); setCardEmail(''); setMethod(''); }} className="btn-primary">
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
            <h3 className="text-xl font-bold text-stone-900 mb-2">{getText('Verifikasyon KYC obligatwa', 'Vérification KYC requise', 'KYC verification required')}</h3>
            <p className="text-stone-600 mb-6">
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
