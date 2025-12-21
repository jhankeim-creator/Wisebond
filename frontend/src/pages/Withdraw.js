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
  Wallet
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const withdrawalMethods = [
  { id: 'zelle', name: 'Zelle', icon: DollarSign, placeholder: 'Email ou téléphone Zelle' },
  { id: 'paypal', name: 'PayPal', icon: DollarSign, placeholder: 'Email PayPal' },
  { id: 'usdt', name: 'USDT', icon: Wallet, placeholder: 'Adresse USDT (TRC-20 ou ERC-20)' },
  { id: 'bank_mexico', name: 'Bank Mexico', icon: Building, placeholder: 'CLABE bancaire' }
];

export default function Withdraw() {
  const { t } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [fees, setFees] = useState([]);
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFeesAndLimits();
  }, []);

  const fetchFeesAndLimits = async () => {
    try {
      const response = await axios.get(`${API}/withdrawals/fees`);
      setFees(response.data.fees);
      setLimits(response.data.limits);
    } catch (error) {
      console.error('Error fetching fees:', error);
    }
  };

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

  const handleSubmit = async () => {
    const limit = getLimit();
    const amt = parseFloat(amount);
    
    if (amt < limit.min_amount) {
      toast.error(`Montant minimum: $${limit.min_amount}`);
      return;
    }
    
    if (amt > limit.max_amount) {
      toast.error(`Montant maximum: $${limit.max_amount}`);
      return;
    }
    
    if (amt > user.wallet_usd) {
      toast.error(t('insufficientBalance'));
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/withdrawals/create`, {
        amount: amt,
        currency: 'USD',
        method,
        destination
      });
      
      await refreshUser();
      toast.success('Demande de retrait soumise avec succès!');
      setStep(3);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la soumission');
    } finally {
      setLoading(false);
    }
  };

  const fee = calculateFee();
  const netAmount = parseFloat(amount || 0) - fee;

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-emerald-700">Solde disponible</p>
        <p className="text-2xl font-bold text-emerald-800">
          ${user?.wallet_usd?.toFixed(2) || '0.00'} USD
        </p>
      </div>

      <div>
        <h3 className="font-semibold text-slate-900 mb-4">Choisir la méthode de retrait</h3>
        <div className="space-y-3">
          {withdrawalMethods.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                  method === m.id 
                    ? 'border-[#0047AB] bg-blue-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Icon size={24} className="text-slate-600" />
                </div>
                <span className="font-medium text-slate-900">{m.name}</span>
                {method === m.id && (
                  <Check className="ml-auto text-[#0047AB]" size={20} />
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
        Continuer
      </Button>
    </div>
  );

  const renderStep2 = () => {
    const selectedMethod = withdrawalMethods.find(m => m.id === method);
    const limit = getLimit();
    
    return (
      <div className="space-y-6">
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

        <div className="text-center">
          <Label className="text-slate-600">{t('amount')} (USD)</Label>
          <div className="relative mt-2">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl text-slate-400">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="amount-input py-4 pl-12"
              placeholder="0.00"
              max={user?.wallet_usd}
              data-testid="withdraw-amount"
            />
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Min: ${limit.min_amount} | Max: ${limit.max_amount}
          </p>
        </div>

        {amount && parseFloat(amount) > 0 && (
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>{t('amount')}</span>
              <span>${parseFloat(amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>{t('fee')}</span>
              <span className="text-red-500">-${fee.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-slate-900">
              <span>{t('netAmount')}</span>
              <span className="text-emerald-600">${netAmount.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
            Retour
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading || !amount || !destination || parseFloat(amount) <= 0}
            className="btn-primary flex-1"
            data-testid="withdraw-submit"
          >
            {loading ? t('loading') : t('submitWithdrawal')}
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
      <h3 className="text-2xl font-bold text-slate-900 mb-2">Demande soumise!</h3>
      <p className="text-slate-600 mb-6">
        Votre demande de retrait de ${amount} USD est en cours de traitement.
      </p>
      <Button onClick={() => { setStep(1); setAmount(''); setDestination(''); setMethod(''); }} className="btn-primary">
        Nouveau retrait
      </Button>
    </div>
  );

  return (
    <DashboardLayout title={t('withdrawFunds')}>
      {user?.kyc_status !== 'approved' ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
            <h3 className="text-xl font-bold text-slate-900 mb-2">{t('kycRequired')}</h3>
            <p className="text-slate-600 mb-6">
              Vous devez compléter votre vérification KYC pour effectuer des retraits.
            </p>
            <Button className="btn-primary" onClick={() => window.location.href = '/kyc'}>
              Compléter KYC
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>{step < 3 ? `Étape ${step}/2` : 'Succès'}</CardTitle>
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
