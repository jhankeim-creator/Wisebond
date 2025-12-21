import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { RefreshCw, Save } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminRates() {
  const [rates, setRates] = useState({ htg_to_usd: 0, usd_to_htg: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const response = await axios.get(`${API}/exchange-rates`);
      setRates(response.data);
    } catch (error) {
      console.error('Error fetching rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveRates = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/exchange-rates`, rates);
      toast.success('Taux de change mis à jour!');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Taux de change">
      <div className="max-w-2xl mx-auto space-y-6" data-testid="admin-rates">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Configuration des taux</span>
              <Button variant="outline" size="sm" onClick={fetchRates}>
                <RefreshCw size={16} className="mr-2" />
                Actualiser
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : (
              <>
                <div className="bg-blue-50 rounded-xl p-6">
                  <Label className="text-blue-800 font-semibold">HTG → USD</Label>
                  <p className="text-sm text-blue-600 mb-3">Combien de USD pour 1 HTG</p>
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold">1 HTG =</span>
                    <Input
                      type="number"
                      step="0.0001"
                      value={rates.htg_to_usd}
                      onChange={(e) => setRates({...rates, htg_to_usd: parseFloat(e.target.value)})}
                      className="w-40 text-xl font-semibold"
                    />
                    <span className="text-2xl font-bold">USD</span>
                  </div>
                </div>

                <div className="bg-emerald-50 rounded-xl p-6">
                  <Label className="text-emerald-800 font-semibold">USD → HTG</Label>
                  <p className="text-sm text-emerald-600 mb-3">Combien de HTG pour 1 USD</p>
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold">1 USD =</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={rates.usd_to_htg}
                      onChange={(e) => setRates({...rates, usd_to_htg: parseFloat(e.target.value)})}
                      className="w-40 text-xl font-semibold"
                    />
                    <span className="text-2xl font-bold">HTG</span>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-amber-800 font-medium">Note importante</p>
                  <p className="text-sm text-amber-700">
                    Ces taux sont utilisés pour la conversion lors des dépôts et retraits. 
                    Les taux sont manuels et doivent être mis à jour régulièrement.
                  </p>
                </div>

                <Button onClick={saveRates} disabled={saving} className="w-full btn-primary">
                  <Save size={18} className="mr-2" />
                  {saving ? 'Enregistrement...' : 'Enregistrer les taux'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
