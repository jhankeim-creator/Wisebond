import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { QRScanner } from '@/components/QRScanner';
import { 
  Send, 
  Check, 
  AlertCircle,
  User,
  QrCode,
  Keyboard
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export default function Transfer() {
  const { t, language } = useLanguage();
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState('USD');
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [inputMode, setInputMode] = useState('keyboard'); // 'keyboard' or 'qr'

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  // Check if there's a recipient ID in URL params (from QR share link)
  useEffect(() => {
    const toParam = searchParams.get('to');
    if (toParam) {
      setRecipientId(toParam.toUpperCase());
    }
  }, [searchParams]);

  const handleQRScan = (scannedData) => {
    // Extract client ID from scanned data
    let clientId = scannedData.trim().toUpperCase();
    
    // If it's a URL, extract the 'to' parameter
    if (scannedData.includes('transfer?to=')) {
      const url = new URL(scannedData);
      clientId = url.searchParams.get('to')?.toUpperCase() || clientId;
    }
    
    // Validate it looks like a client ID
    if (clientId && clientId.length >= 8) {
      setRecipientId(clientId);
      setShowScanner(false);
      toast.success(getText('ID kliyan jwenn!', 'ID client trouvé!', 'Client ID found!'));
    } else {
      toast.error(getText('QR code invalide', 'QR code invalide', 'Invalid QR code'));
    }
  };

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

      {/* Recipient ID - Two Options */}
      <div>
        <Label>{getText('Moun w ap voye ba li', 'Destinataire', 'Recipient')}</Label>
        
        {/* Toggle between keyboard and QR */}
        <div className="flex gap-2 mt-2 mb-3">
          <button
            onClick={() => setInputMode('keyboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
              inputMode === 'keyboard'
                ? 'border-[#EA580C] bg-orange-50 text-[#EA580C]'
                : 'border-stone-200 text-stone-500 hover:border-stone-300'
            }`}
          >
            <Keyboard size={18} />
            <span className="font-medium text-sm">{getText('Tape ID', 'Saisir ID', 'Type ID')}</span>
          </button>
          <button
            onClick={() => setShowScanner(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
              inputMode === 'qr'
                ? 'border-[#EA580C] bg-orange-50 text-[#EA580C]'
                : 'border-stone-200 text-stone-500 hover:border-stone-300'
            }`}
          >
            <QrCode size={18} />
            <span className="font-medium text-sm">{getText('Skane QR', 'Scanner QR', 'Scan QR')}</span>
          </button>
        </div>

        {/* ID Input */}
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <Input
            placeholder="KC8A4F2B1E"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value.toUpperCase())}
            className="pl-10 uppercase font-mono"
            data-testid="transfer-recipient"
          />
          {recipientId && (
            <button
              onClick={() => setRecipientId('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              ×
            </button>
          )}
        </div>
        <p className="text-sm text-stone-500 mt-1">
          {getText(
            'Antre ID oswa skane QR code moun nan',
            'Entrez l\'ID ou scannez le QR code du destinataire',
            'Enter ID or scan recipient\'s QR code'
          )}
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
      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {user?.kyc_status !== 'approved' ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
            <h3 className="text-xl font-bold text-stone-900 mb-2">{t('kycRequired')}</h3>
            <p className="text-stone-600 mb-6">
              {getText(
                'Ou dwe konplete verifikasyon KYC pou fè transfè.',
                'Vous devez compléter votre vérification KYC pour effectuer des transferts.',
                'You must complete KYC verification to make transfers.'
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
            <CardTitle className="flex items-center gap-2">
              <Send size={24} className="text-[#EA580C]" />
              {getText('Voye Lajan', 'Envoyer de l\'Argent', 'Send Money')}
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
