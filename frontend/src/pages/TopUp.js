import React, { useEffect, useMemo, useState } from 'react';
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
  Phone, 
  Globe, 
  Check, 
  AlertCircle,
  DollarSign
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const countries = [
  { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DO', name: 'République Dominicaine', flag: '🇩🇴' },
  { code: 'MX', name: 'Mexique', flag: '🇲🇽' },
  { code: 'BR', name: 'Brésil', flag: '🇧🇷' },
  { code: 'OTHER', name: 'Lòt peyi / Autre pays', flag: '🌍' }
];

export default function TopUp() {
  const { language } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [step, setStep] = useState(1);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [feeTiers, setFeeTiers] = useState([]);
  const [lastOrder, setLastOrder] = useState(null);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/public/app-config`);
        setFeeTiers(res.data?.topup_fee_tiers || []);
      } catch (e) {
        setFeeTiers([]);
      }
    })();
  }, []);

  const fee = useMemo(() => {
    const a = parseFloat(amount);
    if (!a || !Array.isArray(feeTiers) || feeTiers.length === 0) return 0;
    const t = feeTiers.find(x => a >= x.min_amount && a <= x.max_amount);
    if (!t) return 0;
    if (t.is_percentage) return a * (t.fee_value / 100);
    return Number(t.fee_value || 0);
  }, [amount, feeTiers]);
  const total = useMemo(() => {
    const a = parseFloat(amount) || 0;
    return a + (fee || 0);
  }, [amount, fee]);

  const handleSubmit = async () => {
    if (!phoneNumber || phoneNumber.length < 8) {
      toast.error(getText('Antre yon nimewo telefòn valid', 'Entrez un numéro de téléphone valide', 'Enter a valid phone number'));
      return;
    }

    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error(getText('Antre montan an', 'Entrez le montant', 'Enter amount'));
      return;
    }

    if (user?.wallet_usd < total) {
      toast.error(getText('Balans USD ensifizan', 'Solde USD insuffisant', 'Insufficient USD balance'));
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(`${API}/topup/order`, {
        country: selectedCountry.code,
        country_name: selectedCountry.name,
        phone_number: phoneNumber,
        amount: amt
      });
      setLastOrder(res.data?.order || null);
      
      await refreshUser();
      setSuccess(true);
      toast.success(getText('Komand soumèt siksè!', 'Commande soumise avec succès!', 'Order submitted successfully!'));
    } catch (error) {
      toast.error(error.response?.data?.detail || getText('Erè nan komand', 'Erreur de commande', 'Order error'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <DashboardLayout title={getText('Achte Minit', 'Acheter des Minutes', 'Buy Minutes')}>
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="text-emerald-500" size={40} />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 mb-2">
              {getText('Komand soumèt!', 'Commande soumise!', 'Order submitted!')}
            </h3>
            <p className="text-stone-600 mb-4">
              {getText(
                `Ou komande yon rechaj pou ${selectedCountry.name}. Komand la ap trete manyèlman.`,
                `Vous avez soumis une recharge pour ${selectedCountry.name}. La commande sera traitée manuellement.`,
                `You submitted a top-up for ${selectedCountry.name}. The order will be processed manually.`
              )}
            </p>
            {lastOrder && (
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 mb-6 text-left">
                <p className="text-sm text-stone-600"><strong>{getText('Montan', 'Montant', 'Amount')}:</strong> ${Number(lastOrder.amount || 0).toFixed(2)}</p>
                <p className="text-sm text-stone-600"><strong>{getText('Frè', 'Frais', 'Fee')}:</strong> ${Number(lastOrder.fee || 0).toFixed(2)}</p>
                <p className="text-sm text-stone-900 font-semibold"><strong>{getText('Total', 'Total', 'Total')}:</strong> ${Number(lastOrder.total || 0).toFixed(2)}</p>
              </div>
            )}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-amber-700">
                {getText(
                  'Minit yo ap disponib nan 1-24 èdtan. Nou ap kontakte ou sou WhatsApp.',
                  'Les minutes seront disponibles dans 1-24 heures. Nous vous contacterons sur WhatsApp.',
                  'Minutes will be available in 1-24 hours. We will contact you on WhatsApp.'
                )}
              </p>
            </div>
            <Button 
              onClick={() => { setStep(1); setSelectedCountry(null); setPhoneNumber(''); setAmount(''); setSuccess(false); setLastOrder(null); }}
              className="btn-primary"
            >
              {getText('Nouvo komand', 'Nouvelle commande', 'New order')}
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={getText('Achte Minit Entènasyonal', 'Acheter des Minutes Internationales', 'Buy International Minutes')}>
      <div className="max-w-2xl mx-auto space-y-6" data-testid="topup-page">
        {/* KYC Check */}
        {user?.kyc_status !== 'approved' ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
              <h3 className="text-xl font-bold text-stone-900 mb-2">
                {getText('Verifikasyon KYC obligatwa', 'Vérification KYC requise', 'KYC verification required')}
              </h3>
              <p className="text-stone-600 mb-6">
                {getText(
                  'Ou dwe konplete verifikasyon KYC ou pou achte minit.',
                  'Vous devez compléter votre vérification KYC pour acheter des minutes.',
                  'You must complete KYC verification to buy minutes.'
                )}
              </p>
              <Button className="btn-primary" onClick={() => window.location.href = '/kyc'}>
                {getText('Konplete KYC', 'Compléter KYC', 'Complete KYC')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Balance Display */}
            <Card className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-100 text-sm">{getText('Balans USD disponib', 'Solde USD disponible', 'Available USD balance')}</p>
                    <p className="text-2xl font-bold">${(user?.wallet_usd || 0).toFixed(2)}</p>
                  </div>
                  <DollarSign size={32} className="text-white/50" />
                </div>
              </CardContent>
            </Card>

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Globe className="text-blue-500 mt-0.5" size={20} />
                <div>
                  <p className="font-medium text-blue-800">
                    {getText('Sèvis Manyèl', 'Service Manuel', 'Manual Service')}
                  </p>
                  <p className="text-sm text-blue-700">
                    {getText(
                      'Komand minit yo ap trete manyèlman. Minit yo ap disponib nan 1-24 èdtan.',
                      'Les commandes de minutes sont traitées manuellement. Les minutes seront disponibles dans 1-24 heures.',
                      'Minute orders are processed manually. Minutes will be available within 1-24 hours.'
                    )}
                  </p>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone size={20} className="text-[#EA580C]" />
                  {step === 1 && getText('Etap 1: Chwazi peyi', 'Étape 1: Choisir le pays', 'Step 1: Choose country')}
                  {step === 2 && getText('Etap 2: Antre enfòmasyon', 'Étape 2: Entrer infos', 'Step 2: Enter details')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {step === 1 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {countries.map((country) => (
                      <button
                        key={country.code}
                        onClick={() => { setSelectedCountry(country); setStep(2); }}
                        className="p-4 rounded-xl border-2 border-stone-200 hover:border-[#EA580C] hover:bg-orange-50 transition-all text-center"
                      >
                        <span className="text-3xl mb-2 block">{country.flag}</span>
                        <span className="font-medium text-stone-900 text-sm">{country.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {step === 2 && selectedCountry && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-2xl">{selectedCountry.flag}</span>
                      <span className="font-bold text-stone-900">{selectedCountry.name}</span>
                      <button 
                        onClick={() => { setStep(1); setSelectedCountry(null); setPhoneNumber(''); setAmount(''); }}
                        className="ml-auto text-sm text-[#EA580C] hover:underline"
                      >
                        {getText('Chanje', 'Changer', 'Change')}
                      </button>
                    </div>

                    <div>
                      <Label htmlFor="phone">
                        <Phone size={16} className="inline mr-2" />
                        {getText('Nimewo telefòn pou rechaje', 'Numéro à recharger', 'Phone number to recharge')}
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder={getText('Antre nimewo telefòn lan', 'Entrez le numéro de téléphone', 'Enter phone number')}
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="mt-2"
                        data-testid="topup-phone"
                      />
                      <p className="text-sm text-stone-500 mt-1">
                        {getText('Avèk kòd peyi (ex: +1 pou USA)', 'Avec code pays (ex: +1 pour USA)', 'With country code (e.g., +1 for USA)')}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="amount">
                        <DollarSign size={16} className="inline mr-2" />
                        {getText('Montan (USD)', 'Montant (USD)', 'Amount (USD)')}
                      </Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="mt-2"
                        data-testid="topup-amount"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    {amount && parseFloat(amount) > 0 && (
                      <div className="bg-stone-50 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between text-stone-600">
                          <span>{getText('Montan', 'Montant', 'Amount')}</span>
                          <span>${(parseFloat(amount) || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-stone-600">
                          <span>{getText('Frè', 'Frais', 'Fee')}</span>
                          <span className="text-red-600">+${(fee || 0).toFixed(2)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-semibold">
                          <span>{getText('Total pou peye', 'Total à payer', 'Total to pay')}</span>
                          <span className="text-stone-900">${(total || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-4">
                      <Button 
                        variant="outline" 
                        onClick={() => { setStep(1); setSelectedCountry(null); setPhoneNumber(''); setAmount(''); }}
                        className="flex-1"
                      >
                        {getText('Retounen', 'Retour', 'Back')}
                      </Button>
                      <Button 
                        onClick={handleSubmit}
                        disabled={loading || !phoneNumber || !amount}
                        className="btn-primary flex-1"
                        data-testid="topup-submit"
                      >
                        {loading ? getText('Ap soumèt...', 'Soumission...', 'Submitting...') : getText('Konfime komand', 'Confirmer la commande', 'Confirm order')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
