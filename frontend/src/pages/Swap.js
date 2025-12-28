import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { ArrowDownUp, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { API_BASE } from '@/lib/utils';

const API = API_BASE;

export default function Swap() {
  const { language } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [fromCurrency, setFromCurrency] = useState('HTG');
  const [toCurrency, setToCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const response = await axios.get(`${API}/exchange-rates`);
      setRates(response.data);
    } catch (error) {
      console.error('Error fetching rates:', error);
    }
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setAmount('');
  };

  const getConvertedAmount = () => {
    if (!amount || !rates) return 0;
    const amt = parseFloat(amount);
    if (fromCurrency === 'HTG' && toCurrency === 'USD') {
      return (amt * rates.htg_to_usd).toFixed(2);
    }
    return Math.round(amt * rates.usd_to_htg);
  };

  const getSourceBalance = () => {
    if (fromCurrency === 'HTG') return user?.wallet_htg || 0;
    return user?.wallet_usd || 0;
  };

  const handleSwap = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error(getText('Antre yon montan valid', 'Entrez un montant valide', 'Enter a valid amount'));
      return;
    }

    if (amt > getSourceBalance()) {
      toast.error(getText('Balans ensifizan', 'Solde insuffisant', 'Insufficient balance'));
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/wallet/swap`, {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        amount: amt
      });
      
      await refreshUser();
      setSuccess(true);
      toast.success(getText('Konvèsyon reyisi!', 'Conversion réussie!', 'Conversion successful!'));
    } catch (error) {
      toast.error(error.response?.data?.detail || getText('Erè nan konvèsyon', 'Erreur de conversion', 'Conversion error'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setSuccess(false);
  };

  if (success) {
    return (
      <DashboardLayout title={getText('Swap Deviz', 'Échange de Devises', 'Currency Swap')}>
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="text-emerald-500" size={40} />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 mb-2">
              {getText('Konvèsyon reyisi!', 'Conversion réussie!', 'Conversion successful!')}
            </h3>
            <p className="text-stone-600 mb-6">
              {getText(
                `Ou konvèti ${fromCurrency === 'HTG' ? 'G ' : '$'}${amount} an ${toCurrency === 'HTG' ? 'G ' : '$'}${getConvertedAmount()}`,
                `Vous avez converti ${fromCurrency === 'HTG' ? 'G ' : '$'}${amount} en ${toCurrency === 'HTG' ? 'G ' : '$'}${getConvertedAmount()}`,
                `You converted ${fromCurrency === 'HTG' ? 'G ' : '$'}${amount} to ${toCurrency === 'HTG' ? 'G ' : '$'}${getConvertedAmount()}`
              )}
            </p>
            <Button onClick={resetForm} className="btn-primary">
              {getText('Nouvo swap', 'Nouveau swap', 'New swap')}
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={getText('Swap Deviz', 'Échange de Devises', 'Currency Swap')}>
      <div className="max-w-md mx-auto space-y-6">
        {/* Current Rate Card */}
        {rates && (
          <Card className="bg-gradient-to-r from-[#EA580C] to-amber-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">{getText('To chanj aktyèl', 'Taux actuel', 'Current rate')}</p>
                  <p className="text-2xl font-bold">1 USD = G {rates.usd_to_htg}</p>
                </div>
                <RefreshCw className="text-white/50" size={32} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Swap Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownUp size={20} className="text-[#EA580C]" />
              {getText('Swap', 'Échanger', 'Swap')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* From Currency */}
            <div className={`p-4 rounded-xl border-2 ${
              fromCurrency === 'HTG' ? 'border-[#EA580C] bg-orange-50' : 'border-amber-500 bg-amber-50'
            }`}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-stone-500">{getText('Soti nan', 'De', 'From')}</span>
                <span className="text-sm text-stone-500">
                  {getText('Balans', 'Solde', 'Balance')}: {fromCurrency === 'HTG' ? 'G ' : '$'}{getSourceBalance().toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold text-white ${
                  fromCurrency === 'HTG' ? 'bg-[#EA580C]' : 'bg-amber-500'
                }`}>
                  {fromCurrency === 'HTG' ? 'G' : '$'}
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-2xl font-bold bg-transparent border-none outline-none text-stone-900"
                    data-testid="swap-amount"
                  />
                  <p className="text-sm text-stone-500">{fromCurrency}</p>
                </div>
              </div>
              <button 
                onClick={() => setAmount(getSourceBalance().toString())}
                className="mt-2 text-xs text-[#EA580C] font-semibold hover:underline"
              >
                MAX
              </button>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center">
              <button
                onClick={swapCurrencies}
                className="w-12 h-12 bg-stone-100 hover:bg-stone-200 rounded-full flex items-center justify-center transition-all hover:scale-110"
              >
                <ArrowDownUp size={20} className="text-stone-600" />
              </button>
            </div>

            {/* To Currency */}
            <div className={`p-4 rounded-xl border-2 ${
              toCurrency === 'HTG' ? 'border-[#EA580C] bg-orange-50' : 'border-amber-500 bg-amber-50'
            }`}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-stone-500">{getText('Pou', 'Vers', 'To')}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold text-white ${
                  toCurrency === 'HTG' ? 'bg-[#EA580C]' : 'bg-amber-500'
                }`}>
                  {toCurrency === 'HTG' ? 'G' : '$'}
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold text-stone-900">
                    {getConvertedAmount() || '0.00'}
                  </p>
                  <p className="text-sm text-stone-500">{toCurrency}</p>
                </div>
              </div>
            </div>

            {/* Summary */}
            {amount && parseFloat(amount) > 0 && (
              <div className="bg-stone-50 rounded-xl p-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">{getText('Montan', 'Montant', 'Amount')}</span>
                  <span className="font-medium">{fromCurrency === 'HTG' ? 'G ' : '$'}{parseFloat(amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">{getText('To', 'Taux', 'Rate')}</span>
                  <span className="font-medium">
                    1 {fromCurrency} = {fromCurrency === 'HTG' ? rates?.htg_to_usd?.toFixed(4) : rates?.usd_to_htg} {toCurrency}
                  </span>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-2">
                  <span className="font-semibold text-stone-700">{getText('Ou ap resevwa', 'Vous recevez', 'You receive')}</span>
                  <span className="font-bold text-emerald-600">
                    {toCurrency === 'HTG' ? 'G ' : '$'}{getConvertedAmount()}
                  </span>
                </div>
              </div>
            )}

            <Button 
              onClick={handleSwap}
              disabled={loading || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > getSourceBalance()}
              className="w-full btn-primary"
              data-testid="swap-submit"
            >
              {loading ? getText('Konvèsyon...', 'Conversion...', 'Converting...') : getText('Konvèti', 'Convertir', 'Convert')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
