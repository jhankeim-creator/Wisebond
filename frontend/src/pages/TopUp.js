import React, { useState } from 'react';
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
  Phone, 
  Globe, 
  Check, 
  AlertCircle,
  DollarSign
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const countries = [
  { code: 'US', name: 'USA', flag: '🇺🇸', rates: [{ minutes: 30, price: 5 }, { minutes: 60, price: 9 }, { minutes: 120, price: 15 }] },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', rates: [{ minutes: 30, price: 5 }, { minutes: 60, price: 9 }, { minutes: 120, price: 15 }] },
  { code: 'FR', name: 'France', flag: '🇫🇷', rates: [{ minutes: 30, price: 7 }, { minutes: 60, price: 12 }, { minutes: 120, price: 20 }] },
  { code: 'DO', name: 'République Dominicaine', flag: '🇩🇴', rates: [{ minutes: 30, price: 4 }, { minutes: 60, price: 7 }, { minutes: 120, price: 12 }] },
  { code: 'MX', name: 'Mexique', flag: '🇲🇽', rates: [{ minutes: 30, price: 5 }, { minutes: 60, price: 9 }, { minutes: 120, price: 15 }] },
  { code: 'BR', name: 'Brésil', flag: '🇧🇷', rates: [{ minutes: 30, price: 6 }, { minutes: 60, price: 10 }, { minutes: 120, price: 17 }] },
  { code: 'OTHER', name: 'Lòt peyi / Autre pays', flag: '🌍', rates: [{ minutes: 30, price: 10 }, { minutes: 60, price: 18 }, { minutes: 120, price: 30 }] }
];

export default function TopUp() {
  const { language } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [step, setStep] = useState(1);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  const handleSubmit = async () => {
    if (!phoneNumber || phoneNumber.length < 8) {
      toast.error(getText('Antre yon nimewo telefòn valid', 'Entrez un numéro de téléphone valide', 'Enter a valid phone number'));
      return;
    }

    if (user?.wallet_usd < selectedPackage.price) {
      toast.error(getText('Balans USD ensifizan', 'Solde USD insuffisant', 'Insufficient USD balance'));
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/topup/order`, {
        country: selectedCountry.code,
        country_name: selectedCountry.name,
        minutes: selectedPackage.minutes,
        price: selectedPackage.price,
        phone_number: phoneNumber
      });
      
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
                `Ou komande ${selectedPackage.minutes} minit pou ${selectedCountry.name}. Komand la ap trete manyèlman.`,
                `Vous avez commandé ${selectedPackage.minutes} minutes pour ${selectedCountry.name}. La commande sera traitée manuellement.`,
                `You ordered ${selectedPackage.minutes} minutes for ${selectedCountry.name}. The order will be processed manually.`
              )}
            </p>
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
              onClick={() => { setStep(1); setSelectedCountry(null); setSelectedPackage(null); setPhoneNumber(''); setSuccess(false); }}
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
                  {step === 2 && getText('Etap 2: Chwazi forfè', 'Étape 2: Choisir le forfait', 'Step 2: Choose package')}
                  {step === 3 && getText('Etap 3: Konfime', 'Étape 3: Confirmer', 'Step 3: Confirm')}
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
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-2xl">{selectedCountry.flag}</span>
                      <span className="font-bold text-stone-900">{selectedCountry.name}</span>
                      <button 
                        onClick={() => { setStep(1); setSelectedCountry(null); }}
                        className="ml-auto text-sm text-[#EA580C] hover:underline"
                      >
                        {getText('Chanje', 'Changer', 'Change')}
                      </button>
                    </div>

                    <div className="grid gap-4">
                      {selectedCountry.rates.map((pkg, i) => (
                        <button
                          key={i}
                          onClick={() => { setSelectedPackage(pkg); setStep(3); }}
                          className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                            selectedPackage === pkg 
                              ? 'border-[#EA580C] bg-orange-50' 
                              : 'border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-[#EA580C]/10 rounded-lg flex items-center justify-center">
                              <Phone className="text-[#EA580C]" size={24} />
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-stone-900">{pkg.minutes} {getText('minit', 'minutes', 'minutes')}</p>
                              <p className="text-sm text-stone-500">{getText('Apèl entènasyonal', 'Appels internationaux', 'International calls')}</p>
                            </div>
                          </div>
                          <p className="text-xl font-bold text-[#EA580C]">${pkg.price}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 3 && selectedCountry && selectedPackage && (
                  <div className="space-y-6">
                    <div className="bg-stone-50 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-stone-500">{getText('Peyi', 'Pays', 'Country')}</span>
                        <span className="font-medium">{selectedCountry.flag} {selectedCountry.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">{getText('Forfè', 'Forfait', 'Package')}</span>
                        <span className="font-medium">{selectedPackage.minutes} {getText('minit', 'minutes', 'minutes')}</span>
                      </div>
                      <div className="flex justify-between border-t border-stone-200 pt-3">
                        <span className="font-semibold">{getText('Pri', 'Prix', 'Price')}</span>
                        <span className="font-bold text-[#EA580C]">${selectedPackage.price}</span>
                      </div>
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

                    <div className="flex gap-4">
                      <Button 
                        variant="outline" 
                        onClick={() => { setStep(2); setSelectedPackage(null); }}
                        className="flex-1"
                      >
                        {getText('Retounen', 'Retour', 'Back')}
                      </Button>
                      <Button 
                        onClick={handleSubmit}
                        disabled={loading || !phoneNumber}
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
