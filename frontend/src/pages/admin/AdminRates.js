import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { RefreshCw, Save, ArrowLeftRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export default function AdminRates() {
  const { getText } = useLanguage();
  const [rates, setRates] = useState({ 
    htg_to_usd: 0, 
    usd_to_htg: 0,
    swap_htg_to_usd: 0,
    swap_usd_to_htg: 0 
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const response = await axios.get(`${API}/exchange-rates`);
      setRates({
        htg_to_usd: response.data.htg_to_usd || 0,
        usd_to_htg: response.data.usd_to_htg || 0,
        swap_htg_to_usd: response.data.swap_htg_to_usd || response.data.htg_to_usd || 0,
        swap_usd_to_htg: response.data.swap_usd_to_htg || response.data.usd_to_htg || 0
      });
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
      toast.success(getText('To chanj mete ajou!', 'Taux de change mis à jour!', 'Exchange rates updated!'));
    } catch (error) {
      toast.error(getText('Erè pandan mizajou', 'Erreur lors de la mise à jour', 'Error updating rates'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title={getText('To Chanj', 'Taux de change', 'Exchange Rates')}>
      <div className="max-w-3xl mx-auto space-y-6" data-testid="admin-rates">
        {/* Conversion Rates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{getText('To Konvèsyon Jeneral', 'Taux de conversion général', 'General Conversion Rates')}</span>
              <Button variant="outline" size="sm" onClick={fetchRates}>
                <RefreshCw size={16} className="mr-2" />
                {getText('Aktyalize', 'Actualiser', 'Refresh')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-6">
                    <Label className="text-blue-800 dark:text-blue-300 font-semibold">HTG → USD</Label>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                      {getText('Konbyen USD pou 1 HTG', 'Combien de USD pour 1 HTG', 'How much USD for 1 HTG')}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">1 HTG =</span>
                      <Input
                        type="number"
                        step="0.0001"
                        value={rates.htg_to_usd}
                        onChange={(e) => setRates({...rates, htg_to_usd: parseFloat(e.target.value)})}
                        className="w-32 text-lg font-semibold"
                      />
                      <span className="text-xl font-bold">USD</span>
                    </div>
                  </div>

                  <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-6">
                    <Label className="text-emerald-800 dark:text-emerald-300 font-semibold">USD → HTG</Label>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-3">
                      {getText('Konbyen HTG pou 1 USD', 'Combien de HTG pour 1 USD', 'How much HTG for 1 USD')}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">1 USD =</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={rates.usd_to_htg}
                        onChange={(e) => setRates({...rates, usd_to_htg: parseFloat(e.target.value)})}
                        className="w-32 text-lg font-semibold"
                      />
                      <span className="text-xl font-bold">HTG</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Swap Rates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="text-purple-500" size={20} />
              {getText('To Swap (Diferan de to jeneral)', 'Taux de swap (Différent du taux général)', 'Swap Rates (Different from general rate)')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!loading && (
              <>
                <div className="bg-amber-50 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-700 rounded-xl p-4 mb-4">
                  <p className="text-amber-800 dark:text-amber-300 font-medium">
                    {getText('Enpòtan', 'Important', 'Important')}
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    {getText(
                      'To swap yo kapab diferan de to jeneral yo. Sa pèmèt ou fè benefis sou swap.',
                      'Les taux de swap peuvent être différents des taux généraux. Cela vous permet de faire des bénéfices sur les swaps.',
                      'Swap rates can be different from general rates. This allows you to profit from swaps.'
                    )}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-6">
                    <Label className="text-purple-800 dark:text-purple-300 font-semibold">
                      {getText('Swap HTG → USD', 'Swap HTG → USD', 'Swap HTG → USD')}
                    </Label>
                    <p className="text-sm text-purple-600 dark:text-purple-400 mb-3">
                      {getText('To lè kliyan chanje HTG an USD', 'Taux quand le client change HTG en USD', 'Rate when client swaps HTG to USD')}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">1 HTG =</span>
                      <Input
                        type="number"
                        step="0.0001"
                        value={rates.swap_htg_to_usd}
                        onChange={(e) => setRates({...rates, swap_htg_to_usd: parseFloat(e.target.value)})}
                        className="w-32 text-lg font-semibold"
                      />
                      <span className="text-lg font-bold">USD</span>
                    </div>
                  </div>

                  <div className="bg-pink-50 dark:bg-pink-900/30 rounded-xl p-6">
                    <Label className="text-pink-800 dark:text-pink-300 font-semibold">
                      {getText('Swap USD → HTG', 'Swap USD → HTG', 'Swap USD → HTG')}
                    </Label>
                    <p className="text-sm text-pink-600 dark:text-pink-400 mb-3">
                      {getText('To lè kliyan chanje USD an HTG', 'Taux quand le client change USD en HTG', 'Rate when client swaps USD to HTG')}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">1 USD =</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={rates.swap_usd_to_htg}
                        onChange={(e) => setRates({...rates, swap_usd_to_htg: parseFloat(e.target.value)})}
                        className="w-32 text-lg font-semibold"
                      />
                      <span className="text-lg font-bold">HTG</span>
                    </div>
                  </div>
                </div>

                <Button onClick={saveRates} disabled={saving} className="w-full btn-primary">
                  <Save size={18} className="mr-2" />
                  {saving ? getText('Anrejistre...', 'Enregistrement...', 'Saving...') : getText('Anrejistre to yo', 'Enregistrer les taux', 'Save rates')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
