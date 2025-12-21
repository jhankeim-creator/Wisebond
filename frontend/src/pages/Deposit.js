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
  Upload, 
  Check, 
  AlertCircle,
  DollarSign,
  Smartphone,
  Wallet
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Metòd depo: HTG = MonCash/NatCash sèlman, USD = Zelle/PayPal/USDT sèlman
const depositMethods = {
  HTG: [
    { id: 'moncash', name: 'MonCash', icon: Smartphone },
    { id: 'natcash', name: 'NatCash', icon: Smartphone }
  ],
  USD: [
    { id: 'zelle', name: 'Zelle', icon: DollarSign },
    { id: 'paypal', name: 'PayPal', icon: DollarSign },
    { id: 'usdt_trc20', name: 'USDT (TRC-20)', icon: Wallet },
    { id: 'usdt_erc20', name: 'USDT (ERC-20)', icon: Wallet }
  ]
};

export default function Deposit() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState('HTG');
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

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

    if (!method.includes('usdt') && !proofImage) {
      toast.error(getText('Telechaje prèv peman an', 'Veuillez télécharger la preuve de paiement', 'Please upload payment proof'));
      return;
    }

    setLoading(true);

    try {
      const payload = {
        amount: parseFloat(amount),
        currency,
        method,
        proof_image: proofImage || null,
        wallet_address: method.includes('usdt') ? walletAddress : null,
        network: method.includes('trc20') ? 'TRC-20' : method.includes('erc20') ? 'ERC-20' : null
      };

      await axios.post(`${API}/deposits/create`, payload);
      toast.success(getText('Demann depo soumèt siksè!', 'Demande de dépôt soumise avec succès!', 'Deposit request submitted successfully!'));
      setStep(4);
    } catch (error) {
      toast.error(error.response?.data?.detail || getText('Erè nan soumisyon', 'Erreur lors de la soumission', 'Submission error'));
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-stone-900 mb-4">{getText('Chwazi deviz', 'Choisir la devise', 'Choose currency')}</h3>
        <div className="grid grid-cols-2 gap-4">
          {['HTG', 'USD'].map((cur) => (
            <button
              key={cur}
              onClick={() => { setCurrency(cur); setMethod(''); }}
              className={`p-6 rounded-xl border-2 transition-all ${
                currency === cur 
                  ? cur === 'HTG' ? 'border-[#EA580C] bg-orange-50' : 'border-amber-500 bg-amber-50'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <div className="text-3xl font-bold text-stone-900 mb-1">
                {cur === 'HTG' ? 'G' : '$'}
              </div>
              <div className="text-stone-600">{cur === 'HTG' ? 'Goud' : 'Dola'}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-stone-900 mb-4">{getText('Chwazi metòd', 'Choisir la méthode', 'Choose method')}</h3>
        <div className="space-y-3">
          {depositMethods[currency].map((m) => {
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
        data-testid="deposit-continue"
      >
        {getText('Kontinye', 'Continuer', 'Continue')}
      </Button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Label className="text-stone-600">{getText('Montan pou depoze', 'Montant à déposer', 'Amount to deposit')} ({currency})</Label>
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

      {method.includes('usdt') ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-500 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-amber-800">{getText('Enstriksyon USDT', 'Instructions USDT', 'USDT Instructions')}</p>
              <p className="text-sm text-amber-700 mt-1">
                {getText(
                  `Voye USDT ou nan adrès sa a sou rezo ${method.includes('trc20') ? 'TRC-20' : 'ERC-20'}:`,
                  `Envoyez votre USDT à l'adresse suivante sur le réseau ${method.includes('trc20') ? 'TRC-20' : 'ERC-20'}:`,
                  `Send your USDT to this address on ${method.includes('trc20') ? 'TRC-20' : 'ERC-20'} network:`
                )}
              </p>
              <code className="block bg-white rounded p-2 mt-2 text-xs break-all">
                TRx1234567890abcdefghijklmnop
              </code>
              <div className="mt-3">
                <Label>{getText('Adrès retou ou (opsyonèl)', 'Votre adresse de retour (optionnel)', 'Your return address (optional)')}</Label>
                <Input 
                  placeholder={getText('Adrès USDT ou', 'Votre adresse USDT', 'Your USDT address')}
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <p className="font-medium text-orange-800">
              {getText('Enstriksyon', 'Instructions', 'Instructions')} {depositMethods[currency].find(m => m.id === method)?.name}
            </p>
            <p className="text-sm text-orange-700 mt-1">
              {currency === 'HTG' 
                ? getText('Voye montan an nan nimewo sa a: +509 0000 0000', 'Envoyez le montant au numéro: +509 0000 0000', 'Send amount to: +509 0000 0000')
                : method === 'zelle' 
                  ? getText('Voye nan: payments@kayicom.com', 'Envoyez à: payments@kayicom.com', 'Send to: payments@kayicom.com')
                  : getText('Voye nan: payments@kayicom.com', 'Envoyez à: payments@kayicom.com', 'Send to: payments@kayicom.com')
              }
            </p>
          </div>

          <div>
            <Label>{getText('Telechaje prèv peman', 'Télécharger preuve de paiement', 'Upload payment proof')}</Label>
            <div 
              className={`file-upload-zone mt-2 ${proofImage ? 'border-emerald-500 bg-emerald-50' : ''}`}
              onClick={() => document.getElementById('proof-upload').click()}
            >
              {proofImage ? (
                <div className="flex items-center justify-center gap-3">
                  <Check className="text-emerald-500" size={24} />
                  <span className="text-emerald-700">{getText('Imaj telechaje', 'Image téléchargée', 'Image uploaded')}</span>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto text-stone-400 mb-2" size={32} />
                  <p className="text-stone-600">{getText('Klike pou telechaje', 'Cliquez pour télécharger', 'Click to upload')}</p>
                  <p className="text-sm text-stone-400 mt-1">PNG, JPG {getText('jiska', "jusqu'à", 'up to')} 5MB</p>
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
          {loading ? getText('Chajman...', 'Chargement...', 'Loading...') : getText('Soumèt', 'Soumettre', 'Submit')}
        </Button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check className="text-emerald-500" size={40} />
      </div>
      <h3 className="text-2xl font-bold text-stone-900 mb-2">{getText('Demann soumèt!', 'Demande soumise!', 'Request submitted!')}</h3>
      <p className="text-stone-600 mb-6">
        {getText(
          `Demann depo ${currency === 'HTG' ? 'G' : '$'}${amount} ${currency} ap tann validasyon.`,
          `Votre demande de dépôt de ${currency === 'HTG' ? 'G' : '$'}${amount} ${currency} est en attente de validation.`,
          `Your deposit request of ${currency === 'HTG' ? 'G' : '$'}${amount} ${currency} is pending validation.`
        )}
      </p>
      <Button onClick={() => { setStep(1); setAmount(''); setProofImage(''); setMethod(''); }} className="btn-primary">
        {getText('Nouvo depo', 'Nouveau dépôt', 'New deposit')}
      </Button>
    </div>
  );

  return (
    <DashboardLayout title={getText('Depoze lajan', 'Déposer des fonds', 'Deposit funds')}>
      {user?.kyc_status !== 'approved' ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
            <h3 className="text-xl font-bold text-stone-900 mb-2">{getText('Verifikasyon KYC obligatwa', 'Vérification KYC requise', 'KYC verification required')}</h3>
            <p className="text-stone-600 mb-6">
              {getText('Ou dwe konplete KYC ou pou fè depo.', 'Vous devez compléter votre vérification KYC pour effectuer des dépôts.', 'You must complete KYC verification to make deposits.')}
            </p>
            <Button className="btn-primary" onClick={() => window.location.href = '/kyc'}>
              {getText('Konplete KYC', 'Compléter KYC', 'Complete KYC')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>{step < 4 ? `${getText('Etap', 'Étape', 'Step')} ${step}/2` : getText('Siksè', 'Succès', 'Success')}</CardTitle>
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
