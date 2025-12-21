import React, { useState } from 'react';
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
  Send, 
  Check, 
  AlertCircle,
  User
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Transfer() {
  const { t } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState('USD');
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const getBalance = () => {
    return currency === 'USD' ? user?.wallet_usd : user?.wallet_htg;
  };

  const formatCurrency = (amt, cur) => {
    if (cur === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt);
    }
    return new Intl.NumberFormat('fr-HT', { style: 'currency', currency: 'HTG' }).format(amt);
  };

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    
    if (amt <= 0) {
      toast.error('Veuillez entrer un montant valide');
      return;
    }
    
    if (amt > getBalance()) {
      toast.error(t('insufficientBalance'));
      return;
    }
    
    if (!recipientId || recipientId.length < 8) {
      toast.error('ID du destinataire invalide');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/transfers/send`, {
        recipient_client_id: recipientId.toUpperCase(),
        amount: amt,
        currency
      });
      
      await refreshUser();
      toast.success(t('transferSuccess'));
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du transfert');
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => (
    <div className="space-y-6">
      {/* Balance Display */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setCurrency('HTG')}
          className={`p-4 rounded-xl border-2 transition-all ${
            currency === 'HTG' 
              ? 'border-[#0047AB] bg-blue-50' 
              : 'border-slate-200'
          }`}
        >
          <p className="text-sm text-slate-500">Balance HTG</p>
          <p className="text-xl font-bold text-slate-900">
            {formatCurrency(user?.wallet_htg || 0, 'HTG')}
          </p>
        </button>
        <button
          onClick={() => setCurrency('USD')}
          className={`p-4 rounded-xl border-2 transition-all ${
            currency === 'USD' 
              ? 'border-emerald-500 bg-emerald-50' 
              : 'border-slate-200'
          }`}
        >
          <p className="text-sm text-slate-500">Balance USD</p>
          <p className="text-xl font-bold text-slate-900">
            {formatCurrency(user?.wallet_usd || 0, 'USD')}
          </p>
        </button>
      </div>

      {/* Recipient ID */}
      <div>
        <Label>{t('recipientId')}</Label>
        <div className="relative mt-2">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input
            placeholder="KC8A4F2B1E"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value.toUpperCase())}
            className="pl-10 uppercase font-mono"
            data-testid="transfer-recipient"
          />
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Entrez l'ID du destinataire (commence par KC)
        </p>
      </div>

      {/* Amount */}
      <div className="text-center">
        <Label className="text-slate-600">{t('amount')} ({currency})</Label>
        <div className="relative mt-2">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl text-slate-400">
            {currency === 'HTG' ? 'G' : '$'}
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="amount-input py-4 pl-12"
            placeholder="0.00"
            data-testid="transfer-amount"
          />
        </div>
      </div>

      {/* Summary */}
      {amount && parseFloat(amount) > 0 && (
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-slate-600">
            <span>Montant à envoyer</span>
            <span>{formatCurrency(parseFloat(amount), currency)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Destinataire</span>
            <span className="font-mono">{recipientId || '-'}</span>
          </div>
        </div>
      )}

      <Button 
        onClick={handleSubmit}
        disabled={loading || !amount || !recipientId || parseFloat(amount) <= 0}
        className="btn-primary w-full"
        data-testid="transfer-submit"
      >
        {loading ? (
          t('loading')
        ) : (
          <>
            <Send className="mr-2" size={20} />
            {t('sendMoney')}
          </>
        )}
      </Button>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check className="text-emerald-500" size={40} />
      </div>
      <h3 className="text-2xl font-bold text-slate-900 mb-2">{t('transferSuccess')}</h3>
      <p className="text-slate-600 mb-2">
        Vous avez envoyé {formatCurrency(parseFloat(amount), currency)}
      </p>
      <p className="text-slate-500 mb-6">
        à <span className="font-mono font-medium">{recipientId}</span>
      </p>
      <Button onClick={() => { setStep(1); setAmount(''); setRecipientId(''); }} className="btn-primary">
        Nouveau transfert
      </Button>
    </div>
  );

  return (
    <DashboardLayout title={t('sendMoney')}>
      {user?.kyc_status !== 'approved' ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
            <h3 className="text-xl font-bold text-slate-900 mb-2">{t('kycRequired')}</h3>
            <p className="text-slate-600 mb-6">
              Vous devez compléter votre vérification KYC pour effectuer des transferts.
            </p>
            <Button className="btn-primary" onClick={() => window.location.href = '/kyc'}>
              Compléter KYC
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send size={24} className="text-[#0047AB]" />
              {t('sendMoney')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {step === 1 && renderForm()}
            {step === 2 && renderSuccess()}
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
