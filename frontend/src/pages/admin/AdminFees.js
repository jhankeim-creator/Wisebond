import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, Trash2, RefreshCw, CreditCard, ArrowUpCircle } from 'lucide-react';

import { API_BASE } from '@/lib/utils';
const API = API_BASE;

export default function AdminFees() {
  const { getText } = useLanguage();
  const [fees, setFees] = useState([]);
  const [cardFees, setCardFees] = useState([]);
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(true);
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
    fee: 5
  });
  const [newLimit, setNewLimit] = useState({
    method: 'zelle',
    min_amount: 10,
    max_amount: 10000,
    waiting_hours: 24
  });

  const methods = ['zelle', 'paypal', 'usdt', 'bank_mexico', 'bank_usa', 'moncash', 'natcash', 'internal_transfer'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [feesRes, limitsRes, cardFeesRes] = await Promise.all([
        axios.get(`${API}/admin/fees`),
        axios.get(`${API}/admin/withdrawal-limits`),
        axios.get(`${API}/admin/card-fees`).catch(() => ({ data: { fees: [] } }))
      ]);
      setFees(feesRes.data.fees);
      setLimits(limitsRes.data.limits);
      setCardFees(cardFeesRes.data.fees || []);
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

  return (
    <AdminLayout title={getText('Frè ak Limit', 'Frais et limites', 'Fees & Limits')}>
      <div className="space-y-6" data-testid="admin-fees">
        {/* Info Note */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
          <p className="text-blue-800 dark:text-blue-300 font-medium">
            {getText('Nòt Enpòtan', 'Note importante', 'Important Note')}
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-400">
            {getText(
              'Tout depo gratis. Sèlman retrè gen frè. Frè kat depann de montan retrè a.',
              'Tous les dépôts sont gratuits. Seuls les retraits ont des frais. Les frais de carte dépendent du montant.',
              'All deposits are free. Only withdrawals have fees. Card fees depend on the withdrawal amount.'
            )}
          </p>
        </div>

        {/* Withdrawal Fees */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ArrowUpCircle className="text-[#EA580C]" size={20} />
                {getText('Frè Retrè', 'Frais de retrait', 'Withdrawal Fees')}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw size={16} />
                </Button>
                <Button size="sm" onClick={() => setShowFeeModal(true)} className="bg-[#EA580C]">
                  <Plus size={16} className="mr-2" />
                  {getText('Ajoute', 'Ajouter', 'Add')}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : fees.length === 0 ? (
              <div className="text-center py-8 text-stone-500">
                {getText('Okenn frè konfigire', 'Aucun frais configuré', 'No fees configured')}
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                        <td className="capitalize">{fee.method?.replace('_', ' ')}</td>
                        <td>{fee.fee_type === 'percentage' ? getText('Pousantaj', 'Pourcentage', 'Percentage') : getText('Fiks', 'Fixe', 'Fixed')}</td>
                        <td className="font-semibold">{fee.fee_type === 'percentage' ? `${fee.fee_value}%` : `$${fee.fee_value}`}</td>
                        <td>${fee.min_amount}</td>
                        <td>${fee.max_amount}</td>
                        <td>
                          <Button size="sm" variant="destructive" onClick={() => deleteFee(fee.fee_id)}>
                            <Trash2 size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card Withdrawal Fees */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="text-purple-500" size={20} />
                {getText('Frè Retrè pa Kat Vityèl (pa limit)', 'Frais de retrait par carte virtuelle (par limite)', 'Virtual Card Withdrawal Fees (by limit)')}
              </span>
              <Button size="sm" onClick={() => setShowCardFeeModal(true)} className="bg-purple-500">
                <Plus size={16} className="mr-2" />
                {getText('Ajoute', 'Ajouter', 'Add')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cardFees.length === 0 ? (
              <div className="text-center py-8 text-stone-500">
                {getText(
                  'Okenn frè kat konfigire. Ajoute frè pou chak limit retrè.',
                  'Aucun frais carte configuré. Ajoutez des frais pour chaque limite de retrait.',
                  'No card fees configured. Add fees for each withdrawal limit.'
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{getText('Limit Min', 'Limite Min', 'Min Limit')}</th>
                      <th>{getText('Limit Max', 'Limite Max', 'Max Limit')}</th>
                      <th>{getText('Frè', 'Frais', 'Fee')}</th>
                      <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardFees.map((fee) => (
                      <tr key={fee.fee_id}>
                        <td className="font-semibold">${fee.min_amount}</td>
                        <td className="font-semibold">${fee.max_amount}</td>
                        <td className="font-bold text-purple-600">${fee.fee}</td>
                        <td>
                          <Button size="sm" variant="destructive" onClick={() => deleteCardFee(fee.fee_id)}>
                            <Trash2 size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Withdrawal Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{getText('Limit Retrè', 'Limites de retrait', 'Withdrawal Limits')}</span>
              <Button size="sm" onClick={() => setShowLimitModal(true)} className="bg-[#EA580C]">
                <Plus size={16} className="mr-2" />
                {getText('Konfigire', 'Configurer', 'Configure')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {limits.length === 0 ? (
              <div className="text-center py-8 text-stone-500">
                {getText('Okenn limit konfigire', 'Aucune limite configurée', 'No limits configured')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{getText('Metòd', 'Méthode', 'Method')}</th>
                      <th>Min</th>
                      <th>Max</th>
                      <th>{getText('Delè (èdtan)', 'Délai (heures)', 'Delay (hours)')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {limits.map((limit, i) => (
                      <tr key={i}>
                        <td className="capitalize">{limit.method?.replace('_', ' ')}</td>
                        <td>${limit.min_amount}</td>
                        <td>${limit.max_amount}</td>
                        <td>{limit.waiting_hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Fee Modal */}
        <Dialog open={showFeeModal} onOpenChange={setShowFeeModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{getText('Ajoute yon frè retrè', 'Ajouter un frais de retrait', 'Add withdrawal fee')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{getText('Metòd', 'Méthode', 'Method')}</Label>
                <Select value={newFee.method} onValueChange={(v) => setNewFee({...newFee, method: v})}>
                  <SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{getText('Fiks ($)', 'Fixe ($)', 'Fixed ($)')}</SelectItem>
                    <SelectItem value="percentage">{getText('Pousantaj (%)', 'Pourcentage (%)', 'Percentage (%)')}</SelectItem>
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
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Min ($)</Label>
                  <Input
                    type="number"
                    value={newFee.min_amount}
                    onChange={(e) => setNewFee({...newFee, min_amount: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <Label>Max ($)</Label>
                  <Input
                    type="number"
                    value={newFee.max_amount}
                    onChange={(e) => setNewFee({...newFee, max_amount: parseFloat(e.target.value)})}
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
              <DialogTitle>{getText('Ajoute frè kat pa limit', 'Ajouter frais carte par limite', 'Add card fee by limit')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg">
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  {getText(
                    'Egzanp: Si retrè a ant $0 ak $100, frè a ap $5. Si li ant $101 ak $500, frè a ap $10.',
                    'Exemple: Si le retrait est entre $0 et $100, les frais seront de $5. Entre $101 et $500, $10.',
                    'Example: If withdrawal is between $0 and $100, fee is $5. Between $101 and $500, fee is $10.'
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{getText('Limit Min ($)', 'Limite Min ($)', 'Min Limit ($)')}</Label>
                  <Input
                    type="number"
                    value={newCardFee.min_amount}
                    onChange={(e) => setNewCardFee({...newCardFee, min_amount: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <Label>{getText('Limit Max ($)', 'Limite Max ($)', 'Max Limit ($)')}</Label>
                  <Input
                    type="number"
                    value={newCardFee.max_amount}
                    onChange={(e) => setNewCardFee({...newCardFee, max_amount: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <Label>{getText('Frè ($)', 'Frais ($)', 'Fee ($)')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newCardFee.fee}
                  onChange={(e) => setNewCardFee({...newCardFee, fee: parseFloat(e.target.value)})}
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
              <DialogTitle>{getText('Konfigire yon limit', 'Configurer une limite', 'Configure a limit')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{getText('Metòd', 'Méthode', 'Method')}</Label>
                <Select value={newLimit.method} onValueChange={(v) => setNewLimit({...newLimit, method: v})}>
                  <SelectTrigger>
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
                  />
                </div>
                <div>
                  <Label>Max ($)</Label>
                  <Input
                    type="number"
                    value={newLimit.max_amount}
                    onChange={(e) => setNewLimit({...newLimit, max_amount: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <Label>{getText('Delè datant (èdtan)', "Délai d'attente (heures)", 'Waiting time (hours)')}</Label>
                <Input
                  type="number"
                  value={newLimit.waiting_hours}
                  onChange={(e) => setNewLimit({...newLimit, waiting_hours: parseInt(e.target.value)})}
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
