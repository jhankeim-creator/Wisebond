import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE as API } from '@/lib/utils';
import { toast } from 'sonner';
import axios from 'axios';
import { QRScanner } from '@/components/QRScanner';
import { 
  Send, 
  Check, 
  AlertCircle,
  User,
  QrCode,
  Keyboard,
  CheckCircle,
  Loader2,
  Phone,
  Mail,
  XCircle
} from 'lucide-react';

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
  
  // Client info state
  const [clientInfo, setClientInfo] = useState(null);
  const [lookingUpClient, setLookingUpClient] = useState(false);
  const [clientNotFound, setClientNotFound] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  // Lookup client info when recipient ID changes
  const lookupClient = useCallback(async (identifier) => {
    if (!identifier || identifier.length < 8) {
      setClientInfo(null);
      setClientNotFound(false);
      return;
    }
    
    setLookingUpClient(true);
    setClientNotFound(false);
    
    try {
      const response = await axios.post(`${API}/transfers/lookup-recipient`, {
        client_id: identifier.toUpperCase()
      });
      
      if (response.data && response.data.client_id) {
        setClientInfo(response.data);
        setClientNotFound(false);
      } else {
        setClientInfo(null);
        setClientNotFound(true);
      }
    } catch (error) {
      setClientInfo(null);
      setClientNotFound(true);
    } finally {
      setLookingUpClient(false);
    }
  }, []);

  // Lookup client when recipientId changes with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (recipientId.length >= 8) {
        lookupClient(recipientId);
      } else {
        setClientInfo(null);
        setClientNotFound(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [recipientId, lookupClient]);

  // Check if there's a recipient ID in URL params (from QR share link)
  useEffect(() => {
    const toParam = searchParams.get('to');
    if (toParam) {
      setRecipientId(toParam.toUpperCase());
    }
  }, [searchParams]);

  const handleQRScan = (scannedData) => {
    // Extract client ID from scanned data
    let clientId = scannedData.trim();
    
    // If it's a URL with transfer?to= parameter, extract it
    if (clientId.includes('transfer?to=')) {
      try {
        const url = new URL(clientId);
        clientId = url.searchParams.get('to') || clientId;
      } catch (e) {
        // If URL parsing fails, try manual extraction
        const match = clientId.match(/transfer\?to=([A-Z0-9]+)/i);
        if (match) {
          clientId = match[1];
        }
      }
    } else if (clientId.includes('/')) {
      // If it's a URL path, try to extract from path
      const match = clientId.match(/transfer\?to=([A-Z0-9]+)/i);
      if (match) {
        clientId = match[1];
      } else {
        // Fallback: get last part of URL
        const parts = clientId.split('/');
        clientId = parts[parts.length - 1];
      }
    }
    
    // Clean up and validate client ID
    clientId = clientId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    // Validate it looks like a client ID (starts with KC and has sufficient length)
    if (clientId && clientId.length >= 8 && clientId.startsWith('KC')) {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          {lookingUpClient && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 animate-spin" size={20} />
          )}
          {recipientId && !lookingUpClient && (
            <button
              onClick={() => { setRecipientId(''); setClientInfo(null); setClientNotFound(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              ×
            </button>
          )}
        </div>
        
        {/* Client Info Card - Shows when client is found */}
        {clientInfo && (
          <div className="mt-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-emerald-800 dark:text-emerald-300 text-lg truncate">
                  {clientInfo.full_name}
                </p>
                <div className="mt-1 space-y-1">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <User size={14} />
                    <span className="font-mono">{clientInfo.client_id}</span>
                  </p>
                  {clientInfo.phone && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-500 flex items-center gap-2">
                      <Phone size={14} />
                      <span>{clientInfo.phone}</span>
                    </p>
                  )}
                  {clientInfo.email && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-500 flex items-center gap-2">
                      <Mail size={14} />
                      <span className="truncate">{clientInfo.email}</span>
                    </p>
                  )}
                </div>
                {clientInfo.kyc_status === 'approved' && (
                  <div className="mt-2 inline-flex items-center gap-1 text-xs bg-emerald-200 dark:bg-emerald-700 text-emerald-800 dark:text-emerald-200 px-2 py-1 rounded-full">
                    <CheckCircle size={12} />
                    {getText('Verifye', 'Vérifié', 'Verified')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Client Not Found - Shows when lookup failed */}
        {clientNotFound && recipientId.length >= 8 && !lookingUpClient && (
          <div className="mt-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center flex-shrink-0">
                <XCircle className="text-red-600 dark:text-red-400" size={20} />
              </div>
              <div>
                <p className="font-semibold text-red-800 dark:text-red-300">
                  {getText('Kliyan pa jwenn', 'Client non trouvé', 'Client not found')}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {getText(
                    'Verifye ID kliyan an epi eseye ankò',
                    'Vérifiez l\'ID du client et réessayez',
                    'Check the client ID and try again'
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <p className="text-sm text-stone-500 mt-2">
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
      {amount && parseFloat(amount) > 0 && clientInfo && (
        <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4 space-y-2 border border-stone-200 dark:border-stone-700">
          <div className="flex justify-between text-stone-600 dark:text-stone-400">
            <span>{getText('Montan pou voye', 'Montant à envoyer', 'Amount to send')}</span>
            <span className="font-semibold text-stone-900 dark:text-white">{formatCurrency(parseFloat(amount), currency)}</span>
          </div>
          <div className="flex justify-between text-stone-600 dark:text-stone-400">
            <span>{getText('Destinatè', 'Destinataire', 'Recipient')}</span>
            <span className="font-semibold text-stone-900 dark:text-white">{clientInfo.full_name}</span>
          </div>
          <div className="flex justify-between text-stone-600 dark:text-stone-400">
            <span>Client ID</span>
            <span className="font-mono text-stone-900 dark:text-white">{recipientId}</span>
          </div>
        </div>
      )}

      <Button 
        onClick={handleSubmit}
        disabled={loading || !amount || !clientInfo || parseFloat(amount) <= 0}
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
      <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check className="text-emerald-500" size={40} />
      </div>
      <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-2">{t('transferSuccess')}</h3>
      <p className="text-stone-600 dark:text-stone-400 mb-2">
        {getText('Ou voye', 'Vous avez envoyé', 'You sent')} {formatCurrency(parseFloat(amount), currency)}
      </p>
      <p className="text-stone-500 dark:text-stone-400 mb-6">
        {getText('bay', 'à', 'to')} <span className="font-semibold text-stone-900 dark:text-white">{clientInfo?.full_name}</span>
        <br />
        <span className="font-mono text-sm">{recipientId}</span>
      </p>
      <Button onClick={() => { setStep(1); setAmount(''); setRecipientId(''); setClientInfo(null); setClientNotFound(false); }} className="btn-primary">
        {getText('Nouvo transfè', 'Nouveau transfert', 'New transfer')}
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
        <Card className="max-w-xl mx-auto w-full">
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
