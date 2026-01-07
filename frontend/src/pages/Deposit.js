import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  ArrowDownCircle
} from 'lucide-react';

import { API_BASE } from '@/lib/utils';
const API = API_BASE;

export default function Deposit() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState('HTG');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdDeposit, setCreatedDeposit] = useState(null);
  const [methods, setMethods] = useState([]);
  const [fieldValues, setFieldValues] = useState({});

  const getText = useCallback((ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  }, [language]);

  const fetchPaymentGatewayMethods = useCallback(async (cur) => {
    try {
      const res = await axios.get(`${API}/public/payment-gateway/methods?payment_type=deposit&currency=${cur}`);
      setMethods(res.data?.methods || []);
    } catch (e) {
      setMethods([]);
    }
  }, []);

  useEffect(() => {
    fetchPaymentGatewayMethods(currency);
  }, [currency, fetchPaymentGatewayMethods]);

  const selectedMethod = useMemo(
    () => methods.find((m) => m.payment_method_id === paymentMethodId) || null,
    [methods, paymentMethodId]
  );

  const calcFee = useMemo(() => {
    const amt = parseFloat(amount || '0');
    if (!selectedMethod || !amt || amt <= 0) return 0;
    if (selectedMethod.fee_type === 'percentage') return amt * (Number(selectedMethod.fee_value || 0) / 100);
    return Number(selectedMethod.fee_value || 0);
  }, [amount, selectedMethod]);

  const netAmount = useMemo(() => {
    const amt = parseFloat(amount || '0');
    return Math.max(0, amt - (calcFee || 0));
  }, [amount, calcFee]);

  const onFileUpload = (fieldKey, file, accept) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFieldValues((prev) => ({ ...prev, [fieldKey]: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error(getText('Antre yon montan valid', 'Veuillez entrer un montant valide', 'Please enter a valid amount'));
      return;
    }
    if (!selectedMethod) {
      toast.error(getText('Chwazi metòd la', 'Choisissez la méthode', 'Select a method'));
      return;
    }

    const min = Number(selectedMethod.minimum_amount || 0);
    const max = Number(selectedMethod.maximum_amount || 0);
    const amt = parseFloat(amount);
    if (min && amt < min) {
      toast.error(`${getText('Minimòm', 'Minimum', 'Minimum')}: ${min}`);
      return;
    }
    if (max && amt > max) {
      toast.error(`${getText('Maksimòm', 'Maximum', 'Maximum')}: ${max}`);
      return;
    }

    const fields = Array.isArray(selectedMethod.custom_fields) ? selectedMethod.custom_fields : [];
    for (const f of fields) {
      const v = fieldValues?.[f.key];
      if (!f.required) continue;
      if (f.type === 'checkbox') {
        if (v !== true) {
          toast.error(getText(`Chan obligatwa: ${f.label}`, `Champ requis: ${f.label}`, `Required: ${f.label}`));
          return;
        }
      } else if (f.type === 'file') {
        if (!String(v || '').startsWith('data:')) {
          toast.error(getText(`Fichye obligatwa: ${f.label}`, `Fichier requis: ${f.label}`, `File required: ${f.label}`));
          return;
        }
      } else if (!String(v || '').trim()) {
        toast.error(getText(`Chan obligatwa: ${f.label}`, `Champ requis: ${f.label}`, `Required: ${f.label}`));
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        amount: parseFloat(amount),
        currency,
        payment_method_id: selectedMethod.payment_method_id,
        field_values: fieldValues || {},
      };

      const resp = await axios.post(`${API}/deposits/create`, payload);
      setCreatedDeposit(resp.data.deposit);
      toast.success(getText('Demann depo soumèt siksè!', 'Demande de dépôt soumise avec succès!', 'Deposit request submitted successfully!'));
      setStep(3);
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
              onClick={() => { setCurrency(cur); setPaymentMethodId(''); setFieldValues({}); }}
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
          {methods.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              {getText(
                'Pa gen metòd depo ki aktive pou HTG. Kontakte admin.',
                'Aucune méthode de dépôt activée pour HTG. Contactez l’admin.',
                'No deposit methods are enabled for this currency. Contact admin.'
              )}
            </div>
          ) : methods.map((m) => {
            return (
              <button
                key={m.payment_method_id}
                onClick={() => setPaymentMethodId(m.payment_method_id)}
                className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                  paymentMethodId === m.payment_method_id 
                    ? 'border-[#EA580C] bg-orange-50' 
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="w-12 h-12 bg-stone-100 rounded-lg flex items-center justify-center">
                  <ArrowDownCircle size={24} className="text-stone-600" />
                </div>
                <span className="font-medium text-stone-900">{m.payment_method_name}</span>
                {paymentMethodId === m.payment_method_id && (
                  <Check className="ml-auto text-[#EA580C]" size={20} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Button 
        onClick={() => setStep(2)} 
        disabled={!paymentMethodId}
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
        {selectedMethod ? (
          <p className="text-sm text-stone-500 mt-2">
            {getText('Min', 'Min', 'Min')}: {Number(selectedMethod.minimum_amount || 0)} | {getText('Max', 'Max', 'Max')}: {Number(selectedMethod.maximum_amount || 0) || '∞'}
          </p>
        ) : null}
      </div>

      {selectedMethod ? (
        <>
          {(selectedMethod.display?.instructions || selectedMethod.display?.recipient_details || selectedMethod.display?.qr_image) ? (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
              {selectedMethod.display?.instructions ? (
                <div>
                  <p className="font-medium text-orange-800">{getText('Enstriksyon', 'Instructions', 'Instructions')}</p>
                  <p className="text-sm text-orange-700 mt-1 whitespace-pre-wrap">{selectedMethod.display.instructions}</p>
                </div>
              ) : null}
              {selectedMethod.display?.recipient_details ? (
                <div>
                  <p className="font-medium text-orange-800">{getText('Detay reseptè', 'Détails du bénéficiaire', 'Recipient details')}</p>
                  <p className="text-sm text-orange-700 mt-1 whitespace-pre-wrap">{selectedMethod.display.recipient_details}</p>
                </div>
              ) : null}
              {selectedMethod.display?.qr_image ? (
                <div>
                  <p className="font-medium text-orange-800">{getText('QR Code', 'QR Code', 'QR Code')}</p>
                  <img src={selectedMethod.display.qr_image} alt="QR" className="mt-2 max-h-48 border rounded-lg" />
                </div>
              ) : null}
            </div>
          ) : null}

          {(Array.isArray(selectedMethod.custom_fields) && selectedMethod.custom_fields.length > 0) ? (
            <div className="space-y-4">
              {selectedMethod.custom_fields.map((f) => (
                <div key={f.key}>
                  <Label>
                    {f.label} {f.required ? <span className="text-red-500">*</span> : null}
                  </Label>
                  {f.type === 'textarea' ? (
                    <textarea
                      value={fieldValues?.[f.key] || ''}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="mt-2 w-full border rounded-lg px-3 py-2 min-h-[90px]"
                      placeholder={f.placeholder || ''}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      value={fieldValues?.[f.key] || ''}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="mt-2 w-full border rounded-lg px-3 py-2"
                    >
                      <option value="">{getText('Chwazi...', 'Choisir...', 'Select...')}</option>
                      {(f.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : f.type === 'checkbox' ? (
                    <label className="mt-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={fieldValues?.[f.key] === true}
                        onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                      />
                      <span className="text-sm text-stone-700">{f.help_text || f.placeholder || ''}</span>
                    </label>
                  ) : f.type === 'file' ? (
                    <div>
                      <div
                        className={`file-upload-zone mt-2 ${String(fieldValues?.[f.key] || '').startsWith('data:') ? 'border-emerald-500 bg-emerald-50' : ''}`}
                        onClick={() => document.getElementById(`deposit-file-${f.key}`)?.click()}
                      >
                        {String(fieldValues?.[f.key] || '').startsWith('data:') ? (
                          <div className="flex items-center justify-center gap-3">
                            <Check className="text-emerald-500" size={24} />
                            <span className="text-emerald-700">{getText('Fichye telechaje', 'Fichier téléversé', 'File uploaded')}</span>
                          </div>
                        ) : (
                          <>
                            <Upload className="mx-auto text-stone-400 mb-2" size={32} />
                            <p className="text-stone-600">{getText('Klike pou telechaje', 'Cliquez pour téléverser', 'Click to upload')}</p>
                          </>
                        )}
                      </div>
                      <input
                        id={`deposit-file-${f.key}`}
                        type="file"
                        accept={f.accept || '*/*'}
                        className="hidden"
                        onChange={(e) => onFileUpload(f.key, e.target.files?.[0], f.accept)}
                      />
                      {f.help_text ? <p className="text-xs text-stone-500 mt-1">{f.help_text}</p> : null}
                    </div>
                  ) : (
                    <Input
                      type={f.type === 'number' ? 'number' : (f.type === 'email' ? 'email' : 'text')}
                      value={fieldValues?.[f.key] || ''}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="mt-2"
                      placeholder={f.placeholder || ''}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {amount && parseFloat(amount) > 0 ? (
            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-stone-600">
                <span>{getText('Montan', 'Montant', 'Amount')}</span>
                <span>{currency === 'USD' ? '$' : 'G '}{parseFloat(amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>{getText('Frè', 'Frais', 'Fee')}</span>
                <span className="text-red-500">-{currency === 'USD' ? '$' : 'G '}{Number(calcFee || 0).toFixed(2)}</span>
              </div>
              <div className="border-t border-stone-200 pt-2 flex justify-between font-semibold text-stone-900">
                <span>{getText('Nèt kredite', 'Net crédité', 'Net credited')}</span>
                <span className="text-emerald-600">{currency === 'USD' ? '$' : 'G '}{Number(netAmount || 0).toFixed(2)}</span>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          {getText('Chwazi metòd la anvan', 'Choisissez une méthode avant', 'Select a method first')}
        </div>
      )}

      <div className="flex gap-4">
        <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
          {getText('Retounen', 'Retour', 'Back')}
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={loading || !amount || !selectedMethod}
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
      {createdDeposit?.deposit_id ? (
        <p className="text-sm text-stone-500 mb-6">
          {getText('ID', 'ID', 'ID')}: <span className="font-mono">{createdDeposit.deposit_id}</span>
        </p>
      ) : null}

      <Button onClick={() => { setStep(1); setAmount(''); setFieldValues({}); setPaymentMethodId(''); }} className="btn-primary">
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
