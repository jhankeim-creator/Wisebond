import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, Trash2, RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminFees() {
  const [fees, setFees] = useState([]);
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [newFee, setNewFee] = useState({
    method: 'zelle',
    fee_type: 'fixed',
    fee_value: 0,
    min_amount: 0,
    max_amount: 10000
  });
  const [newLimit, setNewLimit] = useState({
    method: 'zelle',
    min_amount: 10,
    max_amount: 10000,
    waiting_hours: 24
  });

  const methods = ['zelle', 'paypal', 'usdt', 'bank_mexico', 'internal_transfer'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [feesRes, limitsRes] = await Promise.all([
        axios.get(`${API}/admin/fees`),
        axios.get(`${API}/admin/withdrawal-limits`)
      ]);
      setFees(feesRes.data.fees);
      setLimits(limitsRes.data.limits);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createFee = async () => {
    try {
      await axios.post(`${API}/admin/fees`, newFee);
      toast.success('Frais créé!');
      setShowFeeModal(false);
      fetchData();
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const deleteFee = async (feeId) => {
    if (!window.confirm('Supprimer ce frais?')) return;
    try {
      await axios.delete(`${API}/admin/fees/${feeId}`);
      toast.success('Frais supprimé');
      fetchData();
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const saveLimit = async () => {
    try {
      await axios.put(`${API}/admin/withdrawal-limits`, newLimit);
      toast.success('Limite mise à jour!');
      setShowLimitModal(false);
      fetchData();
    } catch (error) {
      toast.error('Erreur');
    }
  };

  return (
    <AdminLayout title="Frais et limites">
      <div className="space-y-6" data-testid="admin-fees">
        {/* Fees */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Frais de retrait</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw size={16} />
                </Button>
                <Button size="sm" onClick={() => setShowFeeModal(true)} className="bg-[#0047AB]">
                  <Plus size={16} className="mr-2" />
                  Ajouter
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : fees.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Aucun frais configuré
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Méthode</th>
                      <th>Type</th>
                      <th>Valeur</th>
                      <th>Montant min</th>
                      <th>Montant max</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fees.map((fee) => (
                      <tr key={fee.fee_id}>
                        <td className="capitalize">{fee.method?.replace('_', ' ')}</td>
                        <td>{fee.fee_type === 'percentage' ? 'Pourcentage' : 'Fixe'}</td>
                        <td>{fee.fee_type === 'percentage' ? `${fee.fee_value}%` : `$${fee.fee_value}`}</td>
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

        {/* Withdrawal Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Limites de retrait</span>
              <Button size="sm" onClick={() => setShowLimitModal(true)} className="bg-[#0047AB]">
                <Plus size={16} className="mr-2" />
                Configurer
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {limits.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Aucune limite configurée
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Méthode</th>
                      <th>Min</th>
                      <th>Max</th>
                      <th>Délai (heures)</th>
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
              <DialogTitle>Ajouter un frais</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Méthode</Label>
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
                <Label>Type</Label>
                <Select value={newFee.fee_type} onValueChange={(v) => setNewFee({...newFee, fee_type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixe ($)</SelectItem>
                    <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valeur</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newFee.fee_value}
                  onChange={(e) => setNewFee({...newFee, fee_value: parseFloat(e.target.value)})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Montant min ($)</Label>
                  <Input
                    type="number"
                    value={newFee.min_amount}
                    onChange={(e) => setNewFee({...newFee, min_amount: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <Label>Montant max ($)</Label>
                  <Input
                    type="number"
                    value={newFee.max_amount}
                    onChange={(e) => setNewFee({...newFee, max_amount: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              <Button onClick={createFee} className="w-full btn-primary">Créer</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Limit Modal */}
        <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurer une limite</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Méthode</Label>
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
                  <Label>Minimum ($)</Label>
                  <Input
                    type="number"
                    value={newLimit.min_amount}
                    onChange={(e) => setNewLimit({...newLimit, min_amount: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <Label>Maximum ($)</Label>
                  <Input
                    type="number"
                    value={newLimit.max_amount}
                    onChange={(e) => setNewLimit({...newLimit, max_amount: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <Label>Délai d'attente (heures)</Label>
                <Input
                  type="number"
                  value={newLimit.waiting_hours}
                  onChange={(e) => setNewLimit({...newLimit, waiting_hours: parseInt(e.target.value)})}
                />
              </div>
              <Button onClick={saveLimit} className="w-full btn-primary">Enregistrer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
