import React, { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, RefreshCw, Save, Trash2, Wand2, ArrowDownCircle, ArrowUpCircle, Edit2, AlertCircle } from 'lucide-react';

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
  const [jsonError, setJsonError] = useState({ public: null, private: null });

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
    setPublicJson('{\n  "recipient": "",\n  "instructions": ""\n}');
    setPrivateJson('{}');
    setJsonError({ public: null, private: null });
    setShowModal(true);
  };

  const openEdit = (m) => {
    setEditing({ ...m });
    setPublicJson(JSON.stringify(m.public || {}, null, 2));
    setPrivateJson(JSON.stringify(m.private || {}, null, 2));
    setJsonError({ public: null, private: null });
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

  const validateJson = (str, field) => {
    try {
      JSON.parse(str || '{}');
      setJsonError(prev => ({ ...prev, [field]: null }));
      return true;
    } catch (e) {
      setJsonError(prev => ({ ...prev, [field]: e.message }));
      return false;
    }
  };

  const saveMethod = async () => {
    setSaving(true);
    try {
      // Validate JSON
      if (!validateJson(publicJson, 'public') || !validateJson(privateJson, 'private')) {
        toast.error(getText('JSON pa valid', 'JSON invalide', 'Invalid JSON'));
        setSaving(false);
        return;
      }

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

  const toggleEnabled = async (m) => {
    try {
      const payload = { ...m, enabled: !m.enabled };
      await axios.put(`${API}/admin/payment-methods`, payload);
      toast.success(m.enabled 
        ? getText('Dezaktive', 'Désactivé', 'Disabled') 
        : getText('Aktive', 'Activé', 'Enabled'));
      fetchMethods();
    } catch (e) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    }
  };

  // Stats
  const depositMethods = methods.filter(m => m.flow === 'deposit');
  const withdrawalMethods = methods.filter(m => m.flow === 'withdrawal');
  const enabledCount = methods.filter(m => m.enabled).length;

  return (
    <AdminLayout title={getText('Mwayen Peman', 'Moyens de paiement', 'Payment Methods')}>
      <div className="space-y-6" data-testid="admin-payment-methods">
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <ArrowDownCircle className="text-emerald-600" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{depositMethods.length}</p>
                  <p className="text-xs text-stone-500">{getText('Depo', 'Dépôt', 'Deposit')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <ArrowUpCircle className="text-orange-600" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{withdrawalMethods.length}</p>
                  <p className="text-xs text-stone-500">{getText('Retrè', 'Retrait', 'Withdrawal')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-blue-600 font-bold">{enabledCount}</span>
                </div>
                <div>
                  <p className="text-2xl font-bold">{methods.length}</p>
                  <p className="text-xs text-stone-500">{getText('Total', 'Total', 'Total')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700">
            <CardContent className="p-4">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                {getText(
                  'Chak metòd dwe gen flow: depo OSWA retrè.',
                  'Chaque méthode doit avoir un flow: dépôt OU retrait.',
                  'Each method must have flow: deposit OR withdrawal.'
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{getText('Lis Metòd yo', 'Liste des Méthodes', 'Methods List')}</CardTitle>
                <CardDescription>{getText('Jere metòd peman pou depo ak retrè', 'Gérer les méthodes de paiement pour dépôts et retraits', 'Manage payment methods for deposits and withdrawals')}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={fetchMethods}>
                  <RefreshCw size={16} />
                </Button>
                <Button variant="outline" size="sm" onClick={seedDemo}>
                  <Wand2 size={16} className="mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Seed</span>
                </Button>
                <Button size="sm" onClick={openCreate} className="bg-[#EA580C] hover:bg-[#C2410C]">
                  <Plus size={16} className="mr-1 sm:mr-2" />
                  {getText('Ajoute', 'Ajouter', 'Add')}
                </Button>
              </div>
            </div>
            
            {/* Flow Filter */}
            <div className="flex gap-2 mt-4 flex-wrap">
              {['all', 'deposit', 'withdrawal'].map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filterFlow === f ? 'default' : 'outline'}
                  onClick={() => setFilterFlow(f)}
                  className={filterFlow === f ? 'bg-[#0047AB]' : ''}
                >
                  {f === 'deposit' && <ArrowDownCircle size={14} className="mr-1" />}
                  {f === 'withdrawal' && <ArrowUpCircle size={14} className="mr-1" />}
                  {f === 'all' ? getText('Tout', 'Tous', 'All') : f === 'deposit' ? getText('Depo', 'Dépôt', 'Deposit') : getText('Retrè', 'Retrait', 'Withdrawal')}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : visibleMethods.length === 0 ? (
              <div className="text-center py-8 text-stone-500">
                <AlertCircle className="mx-auto mb-3 text-stone-400" size={40} />
                <p>{getText('Pa gen metòd', 'Aucune méthode', 'No methods')}</p>
                <Button size="sm" onClick={openCreate} className="mt-4">
                  <Plus size={16} className="mr-2" />
                  {getText('Kreye premye metòd', 'Créer première méthode', 'Create first method')}
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
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
                          <td>
                            <Badge className={m.flow === 'deposit' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}>
                              {m.flow === 'deposit' ? (
                                <><ArrowDownCircle size={12} className="mr-1" /> {getText('Depo', 'Dépôt', 'Deposit')}</>
                              ) : (
                                <><ArrowUpCircle size={12} className="mr-1" /> {getText('Retrè', 'Retrait', 'Withdrawal')}</>
                              )}
                            </Badge>
                          </td>
                          <td className="font-mono text-sm">{m.method_id}</td>
                          <td className="font-medium">{m.display_name}</td>
                          <td>
                            <div className="flex gap-1">
                              {(m.currencies || []).map(c => (
                                <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                              ))}
                            </div>
                          </td>
                          <td>
                            <Switch 
                              checked={m.enabled} 
                              onCheckedChange={() => toggleEnabled(m)}
                            />
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                                <Edit2 size={14} className="mr-1" />
                                {getText('Modifye', 'Modifier', 'Edit')}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteMethod(m)}>
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {visibleMethods.map((m) => (
                    <div key={`${m.flow}:${m.method_id}`} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={m.flow === 'deposit' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}>
                            {m.flow === 'deposit' ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
                          </Badge>
                          <span className="font-semibold">{m.display_name}</span>
                        </div>
                        <Switch 
                          checked={m.enabled} 
                          onCheckedChange={() => toggleEnabled(m)}
                        />
                      </div>
                      <div className="text-sm text-stone-500 font-mono">{m.method_id}</div>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          {(m.currencies || []).map(c => (
                            <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                            <Edit2 size={14} />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteMethod(m)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{getText('Konfigire Metòd Peman', 'Configurer Méthode de Paiement', 'Configure Payment Method')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Flow Selection - Important! */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                <Label className="font-semibold text-amber-800 dark:text-amber-300 mb-3 block">
                  {getText('Tip Metòd (ENPÒTAN!)', 'Type de Méthode (IMPORTANT!)', 'Method Type (IMPORTANT!)')}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, flow: 'deposit' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      editing.flow === 'deposit' 
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' 
                        : 'border-stone-200 dark:border-stone-700 hover:border-stone-300'
                    }`}
                  >
                    <ArrowDownCircle className={`mx-auto mb-2 ${editing.flow === 'deposit' ? 'text-emerald-600' : 'text-stone-400'}`} size={32} />
                    <p className={`font-semibold ${editing.flow === 'deposit' ? 'text-emerald-700' : 'text-stone-600'}`}>
                      {getText('Depo', 'Dépôt', 'Deposit')}
                    </p>
                    <p className="text-xs text-stone-500 mt-1">
                      {getText('Kliyan voye lajan', 'Client envoie argent', 'Client sends money')}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, flow: 'withdrawal' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      editing.flow === 'withdrawal' 
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30' 
                        : 'border-stone-200 dark:border-stone-700 hover:border-stone-300'
                    }`}
                  >
                    <ArrowUpCircle className={`mx-auto mb-2 ${editing.flow === 'withdrawal' ? 'text-orange-600' : 'text-stone-400'}`} size={32} />
                    <p className={`font-semibold ${editing.flow === 'withdrawal' ? 'text-orange-700' : 'text-stone-600'}`}>
                      {getText('Retrè', 'Retrait', 'Withdrawal')}
                    </p>
                    <p className="text-xs text-stone-500 mt-1">
                      {getText('Kliyan retire lajan', 'Client retire argent', 'Client withdraws money')}
                    </p>
                  </button>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>method_id <span className="text-red-500">*</span></Label>
                  <Input
                    value={editing.method_id}
                    onChange={(e) => setEditing({ ...editing, method_id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    className="mt-1 font-mono"
                    placeholder="ex: moncash, zelle, bank_usa"
                  />
                  <p className="text-xs text-stone-500 mt-1">{getText('Miniskil, san espas', 'Minuscules, sans espaces', 'Lowercase, no spaces')}</p>
                </div>
                <div>
                  <Label>{getText('Non afiche', 'Nom affiché', 'Display Name')} <span className="text-red-500">*</span></Label>
                  <Input
                    value={editing.display_name}
                    onChange={(e) => setEditing({ ...editing, display_name: e.target.value })}
                    className="mt-1"
                    placeholder="ex: MonCash, Zelle, Bank USA"
                  />
                </div>
              </div>

              {/* Currencies & Sort */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{getText('Deviz aksepte', 'Devises acceptées', 'Accepted Currencies')}</Label>
                  <div className="mt-2 flex gap-4">
                    {['HTG', 'USD'].map((c) => (
                      <label key={c} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(editing.currencies || []).includes(c)}
                          onChange={(e) => {
                            const next = new Set(editing.currencies || []);
                            if (e.target.checked) next.add(c);
                            else next.delete(c);
                            setEditing({ ...editing, currencies: Array.from(next) });
                          }}
                          className="w-4 h-4 rounded border-stone-300"
                        />
                        <Badge variant="outline">{c}</Badge>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>{getText('Lòd afichaj', 'Ordre affichage', 'Sort Order')}</Label>
                  <Input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value || '0', 10) })}
                    className="mt-1"
                  />
                  <p className="text-xs text-stone-500 mt-1">{getText('Pi piti = premye', 'Plus petit = premier', 'Lower = first')}</p>
                </div>
              </div>

              {/* Enable/Disable */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{getText('Aktive metòd sa', 'Activer cette méthode', 'Enable this method')}</p>
                  <p className="text-xs text-stone-500">{getText('Itilizatè yo ap wè li', 'Les utilisateurs le verront', 'Users will see it')}</p>
                </div>
                <Switch checked={!!editing.enabled} onCheckedChange={(v) => setEditing({ ...editing, enabled: v })} />
              </div>

              {/* JSON Fields */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-2">
                    Public (JSON)
                    {jsonError.public && <Badge variant="destructive" className="text-xs">Error</Badge>}
                  </Label>
                  <Textarea
                    value={publicJson}
                    onChange={(e) => {
                      setPublicJson(e.target.value);
                      validateJson(e.target.value, 'public');
                    }}
                    className={`mt-1 font-mono text-xs min-h-[150px] ${jsonError.public ? 'border-red-500' : ''}`}
                    placeholder={'{\n  "recipient": "+509...",\n  "instructions": "Voye nan..." \n}'}
                  />
                  {jsonError.public && <p className="text-xs text-red-500 mt-1">{jsonError.public}</p>}
                  <p className="text-xs text-stone-500 mt-1">{getText('Done itilizatè yo wè', 'Données que les utilisateurs voient', 'Data users see')}</p>
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    Private (JSON)
                    {jsonError.private && <Badge variant="destructive" className="text-xs">Error</Badge>}
                  </Label>
                  <Textarea
                    value={privateJson}
                    onChange={(e) => {
                      setPrivateJson(e.target.value);
                      validateJson(e.target.value, 'private');
                    }}
                    className={`mt-1 font-mono text-xs min-h-[150px] ${jsonError.private ? 'border-red-500' : ''}`}
                    placeholder={'{\n  "api_key": "****",\n  "secret": "****"\n}'}
                  />
                  {jsonError.private && <p className="text-xs text-red-500 mt-1">{jsonError.private}</p>}
                  <p className="text-xs text-stone-500 mt-1">{getText('Kle API sekrè (pa pataje)', 'Clés API secrètes (ne pas partager)', 'Secret API keys (do not share)')}</p>
                </div>
              </div>

              <Button onClick={saveMethod} disabled={saving || jsonError.public || jsonError.private} className="w-full btn-primary">
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
