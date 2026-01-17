import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { API_BASE as API } from '@/lib/utils';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, Trash2, RefreshCw, CreditCard, ArrowUpCircle, Wand2, DollarSign, Percent, Info, CheckCircle, Save } from 'lucide-react';

export default function AdminFees() {
  const { language } = useLanguage();
  const [fees, setFees] = useState([]);
  const [cardFees, setCardFees] = useState([]);
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardTopupFeeFixedUsd, setCardTopupFeeFixedUsd] = useState(3);
  const [cardTopupFeePercent, setCardTopupFeePercent] = useState(6);
  const [cardTopupMinUsd, setCardTopupMinUsd] = useState(10);
  const [savingCardTopupFees, setSavingCardTopupFees] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [showCardFeeModal, setShowCardFeeModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [newFee, setNewFee] = useState({
    method: 'zelle',
    fee_type: 'fixed',
    fee_value: 0,
    min_amount: 0,
    max_amount: 10000
  });
  const [newCardFee, setNewCardFee] = useState({
    min_amount: 0,
    max_amount: 100,
    fee: 5,
    is_percentage: false
  });
  const [newLimit, setNewLimit] = useState({
    method: 'zelle',
    min_amount: 10,
    max_amount: 10000,
    waiting_hours: 24
  });

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  const methods = ['zelle', 'paypal', 'usdt', 'bank_usa', 'bank_mexico', 'bank_brazil', 'bank_chile', 'moncash', 'natcash', 'card', 'internal_transfer'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [feesRes, limitsRes, cardFeesRes, settingsRes] = await Promise.all([
        axios.get(`${API}/admin/fees`),
        axios.get(`${API}/admin/withdrawal-limits`),
        axios.get(`${API}/admin/card-fees`).catch(() => ({ data: { fees: [] } })),
        axios.get(`${API}/admin/settings`).catch(() => ({ data: { settings: {} } }))
      ]);
      setFees(feesRes.data.fees || []);
      setLimits(limitsRes.data.limits || []);
      setCardFees(cardFeesRes.data.fees || []);
      const settings = settingsRes?.data?.settings || {};
      setCardTopupFeeFixedUsd(
        typeof settings.card_topup_fee_fixed_usd === 'number' ? settings.card_topup_fee_fixed_usd : 3
      );
      setCardTopupFeePercent(
        typeof settings.card_topup_fee_percent === 'number' ? settings.card_topup_fee_percent : 6
      );
      setCardTopupMinUsd(
        typeof settings.card_topup_min_usd === 'number' ? settings.card_topup_min_usd : 10
      );
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createFee = async () => {
    try {
      await axios.post(`${API}/admin/fees`, newFee);
      toast.success(getText('Frè kreye!', 'Frais créé!', 'Fee created!'));
      setShowFeeModal(false);
      setNewFee({ method: 'zelle', fee_type: 'fixed', fee_value: 0, min_amount: 0, max_amount: 10000 });
      fetchData();
    } catch (error) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    }
  };

  const deleteFee = async (feeId) => {
    if (!window.confirm(getText('Siprime frè sa?', 'Supprimer ce frais?', 'Delete this fee?'))) return;
    try {
      await axios.delete(`${API}/admin/fees/${feeId}`);
      toast.success(getText('Frè siprime', 'Frais supprimé', 'Fee deleted'));
      fetchData();
    } catch (error) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    }
  };

  const createCardFee = async () => {
    try {
      await axios.post(`${API}/admin/card-fees`, newCardFee);
      toast.success(getText('Frè kat kreye!', 'Frais carte créé!', 'Card fee created!'));
      setShowCardFeeModal(false);
      setNewCardFee({ min_amount: 0, max_amount: 100, fee: 5, is_percentage: false });
      fetchData();
    } catch (error) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    }
  };

  const deleteCardFee = async (feeId) => {
    if (!window.confirm(getText('Siprime frè kat sa?', 'Supprimer ce frais carte?', 'Delete this card fee?'))) return;
    try {
      await axios.delete(`${API}/admin/card-fees/${feeId}`);
      toast.success(getText('Frè kat siprime', 'Frais carte supprimé', 'Card fee deleted'));
      fetchData();
    } catch (error) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    }
  };

  const seedDefaultCardFees = async () => {
    if (!window.confirm(getText(
      'Sa ap ranplase tout frè kat egzistan yo. Kontinye?', 
      'Cela remplacera tous les frais carte existants. Continuer?', 
      'This will replace all existing card fees. Continue?'
    ))) return;
    
    try {
      const response = await axios.post(`${API}/admin/card-fees/seed-defaults`);
      toast.success(getText(
        `${response.data.fees?.length || 10} frè kat ajoute!`, 
        `${response.data.fees?.length || 10} frais carte ajoutés!`, 
        `${response.data.fees?.length || 10} card fees added!`
      ));
      fetchData();
    } catch (error) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    }
  };

  const saveLimit = async () => {
    try {
      await axios.put(`${API}/admin/withdrawal-limits`, newLimit);
      toast.success(getText('Limit mete ajou!', 'Limite mise à jour!', 'Limit updated!'));
      setShowLimitModal(false);
      fetchData();
    } catch (error) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    }
  };

  const saveCardTopupFees = async () => {
    setSavingCardTopupFees(true);
    try {
      await axios.put(`${API}/admin/settings`, {
        card_topup_fee_fixed_usd: Number(cardTopupFeeFixedUsd || 0),
        card_topup_fee_percent: Number(cardTopupFeePercent || 0),
        card_topup_min_usd: Number(cardTopupMinUsd || 0),
      });
      toast.success(getText('Frè depo kat mete ajou!', 'Frais recharge mis à jour!', 'Card top-up fees updated!'));
      fetchData();
    } catch (error) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    } finally {
      setSavingCardTopupFees(false);
    }
  };

  return (
    <AdminLayout title={getText('Frè ak Limit', 'Frais et limites', 'Fees & Limits')}>
      <div className="space-y-6" data-testid="admin-fees">
        
        {/* Transparent Fee Information */}
        <Card className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 border-emerald-200 dark:border-emerald-700">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Info size={20} className="text-emerald-600" />
              {getText('Transparan Frè', 'Transparence des Frais', 'Fee Transparency')}
            </CardTitle>
            <CardDescription>
              {getText('Enfòmasyon sou frè yo pou itilizatè yo', 'Information sur les frais pour les utilisateurs', 'Fee information for users')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-stone-800 rounded-lg border">
                <CheckCircle className="text-emerald-500 flex-shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-sm">{getText('Depo', 'Dépôt', 'Deposit')}</p>
                  <p className="text-xs text-emerald-600 font-bold">{getText('GRATIS', 'GRATUIT', 'FREE')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-stone-800 rounded-lg border">
                <ArrowUpCircle className="text-orange-500 flex-shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-sm">{getText('Retrè', 'Retrait', 'Withdrawal')}</p>
                  <p className="text-xs text-stone-600">{getText('Selon metòd', 'Selon méthode', 'Per method')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-stone-800 rounded-lg border">
                <CheckCircle className="text-emerald-500 flex-shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-sm">{getText('Transfè Entèn', 'Transfert', 'Transfer')}</p>
                  <p className="text-xs text-emerald-600 font-bold">{getText('GRATIS', 'GRATUIT', 'FREE')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-stone-800 rounded-lg border">
                <CreditCard className="text-purple-500 flex-shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-sm">{getText('Kat Vityèl', 'Carte Virtuelle', 'Virtual Card')}</p>
                  <p className="text-xs text-stone-600">{getText('Selon limit', 'Selon limite', 'Per limit')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Top-up Fees */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CreditCard className="text-emerald-600" size={20} />
                </div>
                <div>
                  <CardTitle className="text-lg">{getText('Frè depo kat', 'Frais recharge carte', 'Card top-up fees')}</CardTitle>
                  <CardDescription>
                    {getText('Fikse frè depo kat yo (USD)', 'Définir les frais de recharge (USD)', 'Set card top-up fees (USD)')}
                  </CardDescription>
                </div>
              </div>
              <Button
                size="sm"
                onClick={saveCardTopupFees}
                disabled={savingCardTopupFees}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save size={16} className="mr-2" />
                {savingCardTopupFees
                  ? getText('Anrejistreman...', 'Enregistrement...', 'Saving...')
                  : getText('Anrejistre', 'Enregistrer', 'Save')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>{getText('Frè fiks (USD)', 'Frais fixe (USD)', 'Fixed fee (USD)')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={cardTopupFeeFixedUsd}
                  onChange={(e) => setCardTopupFeeFixedUsd(parseFloat(e.target.value || '0'))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{getText('Pousantaj (%)', 'Pourcentage (%)', 'Percentage (%)')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={cardTopupFeePercent}
                  onChange={(e) => setCardTopupFeePercent(parseFloat(e.target.value || '0'))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{getText('Minimòm (USD)', 'Minimum (USD)', 'Minimum (USD)')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={cardTopupMinUsd}
                  onChange={(e) => setCardTopupMinUsd(parseFloat(e.target.value || '0'))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="bg-stone-50 dark:bg-stone-800 rounded-lg p-3 text-xs text-stone-600 dark:text-stone-300">
              {getText(
                'Frè total = frè fiks + (montan × pousantaj / 100).',
                'Frais total = frais fixe + (montant × pourcentage / 100).',
                'Total fee = fixed fee + (amount × percentage / 100).'
              )}
            </div>
            <div className="text-xs text-stone-500">
              {getText(
                'Klik sou bouton “Anrejistre” pou sove chanjman yo.',
                'Cliquez sur “Enregistrer” pour sauvegarder.',
                'Click “Save” to store changes.'
              )}
            </div>
          </CardContent>
        </Card>

        {/* Withdrawal Fees */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <ArrowUpCircle className="text-[#EA580C]" size={20} />
                </div>
                <div>
                  <CardTitle className="text-lg">{getText('Frè Retrè', 'Frais de Retrait', 'Withdrawal Fees')}</CardTitle>
                  <CardDescription>{getText('Frè pou chak metòd retrè', 'Frais pour chaque méthode de retrait', 'Fees for each withdrawal method')}</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw size={16} />
                </Button>
                <Button size="sm" onClick={() => setShowFeeModal(true)} className="bg-[#EA580C] hover:bg-[#C2410C]">
                  <Plus size={16} className="mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{getText('Ajoute', 'Ajouter', 'Add')}</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : fees.length === 0 ? (
              <div className="text-center py-8 text-stone-500">
                {getText('Okenn frè konfigire', 'Aucun frais configuré', 'No fees configured')}
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{getText('Metòd', 'Méthode', 'Method')}</th>
                        <th>{getText('Tip', 'Type', 'Type')}</th>
                        <th>{getText('Valè', 'Valeur', 'Value')}</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fees.map((fee) => (
                        <tr key={fee.fee_id}>
                          <td className="capitalize font-medium">{fee.method?.replace('_', ' ')}</td>
                          <td>
                            <Badge variant="outline" className="text-xs">
                              {fee.fee_type === 'percentage' ? <Percent size={12} className="mr-1" /> : <DollarSign size={12} className="mr-1" />}
                              {fee.fee_type === 'percentage' ? getText('Pousantaj', '%', '%') : getText('Fiks', 'Fixe', 'Fixed')}
                            </Badge>
                          </td>
                          <td className="font-bold text-[#EA580C]">
                            {fee.fee_type === 'percentage' ? `${fee.fee_value}%` : `$${fee.fee_value}`}
                          </td>
                          <td>${fee.min_amount}</td>
                          <td>${fee.max_amount}</td>
                          <td>
                            <Button size="sm" variant="destructive" onClick={() => deleteFee(fee.fee_id)}>
                              <Trash2 size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {fees.map((fee) => (
                    <div key={fee.fee_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold capitalize">{fee.method?.replace('_', ' ')}</span>
                        <Button size="sm" variant="destructive" onClick={() => deleteFee(fee.fee_id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-bold text-[#EA580C]">
                          {fee.fee_type === 'percentage' ? `${fee.fee_value}%` : `$${fee.fee_value}`}
                        </span>
                        <span className="text-stone-500">
                          ${fee.min_amount} - ${fee.max_amount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card Withdrawal Fees */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <CreditCard className="text-purple-600" size={20} />
                </div>
                <div>
                  <CardTitle className="text-lg">{getText('Frè Kat Vityèl', 'Frais Carte Virtuelle', 'Virtual Card Fees')}</CardTitle>
                  <CardDescription>{getText('Frè pou retrè kat selon limit', 'Frais retrait carte selon limite', 'Card withdrawal fees by limit')}</CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={seedDefaultCardFees} className="text-purple-600 border-purple-200 hover:bg-purple-50">
                  <Wand2 size={16} className="mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{getText('Default', 'Défaut', 'Default')}</span>
                </Button>
                <Button size="sm" onClick={() => setShowCardFeeModal(true)} className="bg-purple-500 hover:bg-purple-600">
                  <Plus size={16} className="mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{getText('Ajoute', 'Ajouter', 'Add')}</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cardFees.length === 0 ? (
              <div className="text-center py-8 text-stone-500">
                {getText(
                  'Okenn frè kat. Klike "Default" pou ajoute frè estanda.',
                  'Aucun frais carte. Cliquez "Défaut" pour ajouter les frais standards.',
                  'No card fees. Click "Default" to add standard fees.'
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{getText('Limit Min', 'Min', 'Min')}</th>
                        <th>{getText('Limit Max', 'Max', 'Max')}</th>
                        <th>{getText('Frè', 'Frais', 'Fee')}</th>
                        <th>{getText('Tip', 'Type', 'Type')}</th>
                        <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cardFees.map((fee) => (
                        <tr key={fee.fee_id}>
                          <td className="font-semibold">${fee.min_amount}</td>
                          <td className="font-semibold">{fee.max_amount >= 999999 ? '∞' : `$${fee.max_amount}`}</td>
                          <td className="font-bold text-purple-600">
                            {fee.is_percentage ? `${fee.fee}%` : `$${fee.fee}`}
                          </td>
                          <td>
                            <Badge variant="outline" className="text-xs">
                              {fee.is_percentage ? getText('Pousantaj', '%', '%') : getText('Fiks', 'Fixe', 'Fixed')}
                            </Badge>
                          </td>
                          <td>
                            <Button size="sm" variant="destructive" onClick={() => deleteCardFee(fee.fee_id)}>
                              <Trash2 size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {cardFees.map((fee) => (
                    <div key={fee.fee_id} className="border rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-stone-500">
                          ${fee.min_amount} - {fee.max_amount >= 999999 ? '∞' : `$${fee.max_amount}`}
                        </p>
                        <p className="font-bold text-purple-600">
                          {fee.is_percentage ? `${fee.fee}%` : `$${fee.fee}`}
                        </p>
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => deleteCardFee(fee.fee_id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Withdrawal Limits */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <DollarSign className="text-blue-600" size={20} />
                </div>
                <div>
                  <CardTitle className="text-lg">{getText('Limit Retrè', 'Limites Retrait', 'Withdrawal Limits')}</CardTitle>
                  <CardDescription>{getText('Min/Max pou chak metòd ak delè', 'Min/Max pour chaque méthode et délai', 'Min/Max for each method and delay')}</CardDescription>
                </div>
              </div>
              <Button size="sm" onClick={() => setShowLimitModal(true)} className="bg-[#EA580C] hover:bg-[#C2410C]">
                <Plus size={16} className="mr-1 sm:mr-2" />
                {getText('Konfigire', 'Configurer', 'Configure')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {limits.length === 0 ? (
              <div className="text-center py-8 text-stone-500">
                {getText('Okenn limit konfigire', 'Aucune limite configurée', 'No limits configured')}
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{getText('Metòd', 'Méthode', 'Method')}</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>{getText('Delè (èdtan)', 'Délai (h)', 'Delay (h)')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {limits.map((limit, i) => (
                        <tr key={i}>
                          <td className="capitalize font-medium">{limit.method?.replace('_', ' ')}</td>
                          <td>${limit.min_amount}</td>
                          <td>${limit.max_amount}</td>
                          <td>
                            <Badge variant="outline">{limit.waiting_hours}h</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {limits.map((limit, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <p className="font-semibold capitalize">{limit.method?.replace('_', ' ')}</p>
                      <div className="flex items-center gap-4 text-sm mt-1">
                        <span>${limit.min_amount} - ${limit.max_amount}</span>
                        <Badge variant="outline">{limit.waiting_hours}h</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Add Withdrawal Fee Modal */}
        <Dialog open={showFeeModal} onOpenChange={setShowFeeModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{getText('Ajoute Frè Retrè', 'Ajouter Frais Retrait', 'Add Withdrawal Fee')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{getText('Metòd', 'Méthode', 'Method')}</Label>
                <Select value={newFee.method} onValueChange={(v) => setNewFee({...newFee, method: v})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {methods.map(m => (
                      <SelectItem key={m} value={m} className="capitalize">{m.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{getText('Tip', 'Type', 'Type')}</Label>
                <Select value={newFee.fee_type} onValueChange={(v) => setNewFee({...newFee, fee_type: v})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">
                      <span className="flex items-center gap-2">
                        <DollarSign size={14} />
                        {getText('Fiks ($)', 'Fixe ($)', 'Fixed ($)')}
                      </span>
                    </SelectItem>
                    <SelectItem value="percentage">
                      <span className="flex items-center gap-2">
                        <Percent size={14} />
                        {getText('Pousantaj (%)', 'Pourcentage (%)', 'Percentage (%)')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{getText('Valè', 'Valeur', 'Value')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newFee.fee_value}
                  onChange={(e) => setNewFee({...newFee, fee_value: parseFloat(e.target.value)})}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Min ($)</Label>
                  <Input
                    type="number"
                    value={newFee.min_amount}
                    onChange={(e) => setNewFee({...newFee, min_amount: parseFloat(e.target.value)})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Max ($)</Label>
                  <Input
                    type="number"
                    value={newFee.max_amount}
                    onChange={(e) => setNewFee({...newFee, max_amount: parseFloat(e.target.value)})}
                    className="mt-1"
                  />
                </div>
              </div>
              <Button onClick={createFee} className="w-full btn-primary">{getText('Kreye', 'Créer', 'Create')}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Card Fee Modal */}
        <Dialog open={showCardFeeModal} onOpenChange={setShowCardFeeModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{getText('Ajoute Frè Kat', 'Ajouter Frais Carte', 'Add Card Fee')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg">
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  {getText(
                    'Egzanp: $5-$19 → $2.5 (fiks), $1500+ → 5% (pousantaj)',
                    'Ex: $5-$19 → $2.5 (fixe), $1500+ → 5% (pourcentage)',
                    'Ex: $5-$19 → $2.5 (fixed), $1500+ → 5% (percentage)'
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{getText('Limit Min ($)', 'Min ($)', 'Min ($)')}</Label>
                  <Input
                    type="number"
                    value={newCardFee.min_amount}
                    onChange={(e) => setNewCardFee({...newCardFee, min_amount: parseFloat(e.target.value)})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>{getText('Limit Max ($)', 'Max ($)', 'Max ($)')}</Label>
                  <Input
                    type="number"
                    value={newCardFee.max_amount}
                    onChange={(e) => setNewCardFee({...newCardFee, max_amount: parseFloat(e.target.value)})}
                    className="mt-1"
                  />
                  <p className="text-xs text-stone-500 mt-1">999999 = ∞</p>
                </div>
              </div>
              <div>
                <Label>{getText('Tip', 'Type', 'Type')}</Label>
                <Select 
                  value={newCardFee.is_percentage ? 'percentage' : 'fixed'} 
                  onValueChange={(v) => setNewCardFee({...newCardFee, is_percentage: v === 'percentage'})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{getText('Fiks ($)', 'Fixe ($)', 'Fixed ($)')}</SelectItem>
                    <SelectItem value="percentage">{getText('Pousantaj (%)', 'Pourcentage (%)', 'Percentage (%)')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{newCardFee.is_percentage ? '%' : '$'}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newCardFee.fee}
                  onChange={(e) => setNewCardFee({...newCardFee, fee: parseFloat(e.target.value)})}
                  className="mt-1"
                />
              </div>
              <Button onClick={createCardFee} className="w-full bg-purple-500 hover:bg-purple-600 text-white">
                {getText('Kreye', 'Créer', 'Create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Limit Modal */}
        <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{getText('Konfigire Limit', 'Configurer Limite', 'Configure Limit')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{getText('Metòd', 'Méthode', 'Method')}</Label>
                <Select value={newLimit.method} onValueChange={(v) => setNewLimit({...newLimit, method: v})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {methods.map(m => (
                      <SelectItem key={m} value={m} className="capitalize">{m.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Min ($)</Label>
                  <Input
                    type="number"
                    value={newLimit.min_amount}
                    onChange={(e) => setNewLimit({...newLimit, min_amount: parseFloat(e.target.value)})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Max ($)</Label>
                  <Input
                    type="number"
                    value={newLimit.max_amount}
                    onChange={(e) => setNewLimit({...newLimit, max_amount: parseFloat(e.target.value)})}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>{getText('Delè datant (èdtan)', 'Délai (heures)', 'Delay (hours)')}</Label>
                <Input
                  type="number"
                  value={newLimit.waiting_hours}
                  onChange={(e) => setNewLimit({...newLimit, waiting_hours: parseInt(e.target.value)})}
                  className="mt-1"
                />
              </div>
              <Button onClick={saveLimit} className="w-full btn-primary">{getText('Anrejistre', 'Enregistrer', 'Save')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
