import React, { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, RefreshCw, Save, Trash2, Wand2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const emptyMethod = {
  method_id: '',
  flow: 'deposit',
  currencies: ['HTG'],
  display_name: '',
  enabled: true,
  sort_order: 0,
  public: {},
  private: {}
};

export default function AdminPaymentMethods() {
  const { language } = useLanguage();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterFlow, setFilterFlow] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(emptyMethod);
  const [publicJson, setPublicJson] = useState('{}');
  const [privateJson, setPrivateJson] = useState('{}');

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  const visibleMethods = useMemo(() => {
    if (filterFlow === 'all') return methods;
    return methods.filter((m) => m.flow === filterFlow);
  }, [methods, filterFlow]);

  const fetchMethods = async () => {
    setLoading(true);
    try {
      const url = filterFlow === 'all' ? `${API}/admin/payment-methods` : `${API}/admin/payment-methods?flow=${filterFlow}`;
      const res = await axios.get(url);
      setMethods(res.data.methods || []);
    } catch (e) {
      toast.error(getText('Erè pandan chajman', 'Erreur lors du chargement', 'Error loading'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFlow]);

  const openCreate = () => {
    setEditing({ ...emptyMethod });
    setPublicJson('{}');
    setPrivateJson('{}');
    setShowModal(true);
  };

  const openEdit = (m) => {
    setEditing({ ...m });
    setPublicJson(JSON.stringify(m.public || {}, null, 2));
    setPrivateJson(JSON.stringify(m.private || {}, null, 2));
    setShowModal(true);
  };

  const seedDemo = async () => {
    try {
      await axios.post(`${API}/admin/payment-methods/seed`);
      toast.success(getText('Metòd demo yo kreye/mizajou', 'Méthodes démo créées/mises à jour', 'Demo methods seeded/updated'));
      fetchMethods();
    } catch (e) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    }
  };

  const saveMethod = async () => {
    setSaving(true);
    try {
      const parsedPublic = JSON.parse(publicJson || '{}');
      const parsedPrivate = JSON.parse(privateJson || '{}');

      if (!editing.method_id?.trim() || !editing.display_name?.trim()) {
        toast.error(getText('method_id ak non obligatwa', 'method_id et nom requis', 'method_id and name required'));
        setSaving(false);
        return;
      }

      const payload = {
        ...editing,
        method_id: editing.method_id.trim(),
        display_name: editing.display_name.trim(),
        public: parsedPublic,
        private: parsedPrivate,
      };

      await axios.put(`${API}/admin/payment-methods`, payload);
      toast.success(getText('Anrejistre!', 'Enregistré!', 'Saved!'));
      setShowModal(false);
      fetchMethods();
    } catch (e) {
      if (String(e?.message || '').includes('JSON')) {
        toast.error(getText('JSON pa valid', 'JSON invalide', 'Invalid JSON'));
      } else {
        toast.error(getText('Erè pandan anrejistreman', 'Erreur lors de la sauvegarde', 'Error saving'));
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteMethod = async (m) => {
    if (!window.confirm(getText('Siprime metòd sa?', 'Supprimer cette méthode?', 'Delete this method?'))) return;
    try {
      await axios.delete(`${API}/admin/payment-methods/${m.flow}/${m.method_id}`);
      toast.success(getText('Siprime', 'Supprimé', 'Deleted'));
      fetchMethods();
    } catch (e) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    }
  };

  return (
    <AdminLayout title={getText('Mwayen Peman', 'Moyens de paiement', 'Payment Methods')}>
      <div className="space-y-6" data-testid="admin-payment-methods">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{getText('Lis metòd yo', 'Liste des méthodes', 'Methods list')}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchMethods}>
                  <RefreshCw size={16} />
                </Button>
                <Button variant="outline" size="sm" onClick={seedDemo}>
                  <Wand2 size={16} className="mr-2" />
                  {getText('Seed demo', 'Seed démo', 'Seed demo')}
                </Button>
                <Button size="sm" onClick={openCreate} className="bg-[#EA580C]">
                  <Plus size={16} className="mr-2" />
                  {getText('Ajoute', 'Ajouter', 'Add')}
                </Button>
              </div>
            </CardTitle>
            <div className="flex gap-2 mt-3">
              {['all', 'deposit', 'withdrawal'].map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filterFlow === f ? 'default' : 'outline'}
                  onClick={() => setFilterFlow(f)}
                  className={filterFlow === f ? 'bg-[#0047AB]' : ''}
                >
                  {f === 'all' ? getText('Tout', 'Tous', 'All') : f === 'deposit' ? getText('Depo', 'Dépôt', 'Deposit') : getText('Retrè', 'Retrait', 'Withdrawal')}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : visibleMethods.length === 0 ? (
              <div className="text-center py-8 text-stone-500">{getText('Pa gen metòd', 'Aucune méthode', 'No methods')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Flow</th>
                      <th>method_id</th>
                      <th>{getText('Non', 'Nom', 'Name')}</th>
                      <th>{getText('Deviz', 'Devises', 'Currencies')}</th>
                      <th>{getText('Aktif', 'Actif', 'Enabled')}</th>
                      <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMethods.map((m) => (
                      <tr key={`${m.flow}:${m.method_id}`}>
                        <td className="capitalize">{m.flow}</td>
                        <td className="font-mono text-sm">{m.method_id}</td>
                        <td className="font-medium">{m.display_name}</td>
                        <td>{(m.currencies || []).join(', ')}</td>
                        <td>{m.enabled ? getText('Wi', 'Oui', 'Yes') : getText('Non', 'Non', 'No')}</td>
                        <td>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                              {getText('Modifye', 'Modifier', 'Edit')}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteMethod(m)}>
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{getText('Konfigire metòd', 'Configurer une méthode', 'Configure method')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Flow</Label>
                  <select
                    className="mt-1 w-full border rounded-md px-3 py-2 bg-white dark:bg-stone-900"
                    value={editing.flow}
                    onChange={(e) => setEditing({ ...editing, flow: e.target.value })}
                  >
                    <option value="deposit">{getText('Depo', 'Dépôt', 'Deposit')}</option>
                    <option value="withdrawal">{getText('Retrè', 'Retrait', 'Withdrawal')}</option>
                  </select>
                </div>
                <div>
                  <Label>Sort order</Label>
                  <Input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value || '0', 10) })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>method_id</Label>
                  <Input
                    value={editing.method_id}
                    onChange={(e) => setEditing({ ...editing, method_id: e.target.value })}
                    className="mt-1 font-mono"
                    placeholder="ex: moncash / usdt_trc20"
                  />
                </div>
                <div>
                  <Label>{getText('Non', 'Nom', 'Name')}</Label>
                  <Input
                    value={editing.display_name}
                    onChange={(e) => setEditing({ ...editing, display_name: e.target.value })}
                    className="mt-1"
                    placeholder="ex: MonCash"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{getText('Deviz', 'Devises', 'Currencies')}</Label>
                  <div className="mt-2 flex gap-3">
                    {['HTG', 'USD'].map((c) => (
                      <label key={c} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(editing.currencies || []).includes(c)}
                          onChange={(e) => {
                            const next = new Set(editing.currencies || []);
                            if (e.target.checked) next.add(c);
                            else next.delete(c);
                            setEditing({ ...editing, currencies: Array.from(next) });
                          }}
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between border rounded-lg p-3 mt-6">
                  <div>
                    <p className="font-medium">{getText('Aktive', 'Activer', 'Enable')}</p>
                    <p className="text-xs text-stone-500">{getText('Afekte sa itilizatè yo wè', 'Affecte ce que voient les utilisateurs', 'Affects what users see')}</p>
                  </div>
                  <Switch checked={!!editing.enabled} onCheckedChange={(v) => setEditing({ ...editing, enabled: v })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{getText('Public (JSON)', 'Public (JSON)', 'Public (JSON)')}</Label>
                  <Textarea
                    value={publicJson}
                    onChange={(e) => setPublicJson(e.target.value)}
                    className="mt-1 font-mono text-xs min-h-[180px]"
                    placeholder={'{\n  "recipient": "+509...",\n  "instructions": "..." \n}'}
                  />
                </div>
                <div>
                  <Label>{getText('Private/Credentials (JSON)', 'Privé/Identifiants (JSON)', 'Private/Credentials (JSON)')}</Label>
                  <Textarea
                    value={privateJson}
                    onChange={(e) => setPrivateJson(e.target.value)}
                    className="mt-1 font-mono text-xs min-h-[180px]"
                    placeholder={'{\n  "api_key": "****"\n}'}
                  />
                </div>
              </div>

              <Button onClick={saveMethod} disabled={saving} className="w-full btn-primary">
                <Save size={18} className="mr-2" />
                {saving ? getText('Anrejistreman...', 'Enregistrement...', 'Saving...') : getText('Anrejistre', 'Enregistrer', 'Save')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

