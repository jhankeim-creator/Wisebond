import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { API_BASE as API } from '@/lib/utils';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, RefreshCw, Save, Trash2, Edit2, ArrowDownCircle, ArrowUpCircle, Wand2, Upload, X } from 'lucide-react';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'select', label: 'Select / Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'file', label: 'File Upload' },
];

const makeEmptyMethod = (paymentType) => ({
  payment_method_id: '',
  payment_method_name: '',
  payment_type: paymentType,
  status: 'inactive',
  supported_currencies: ['HTG'],
  minimum_amount: 0,
  maximum_amount: 0,
  fee_type: 'fixed',
  fee_value: 0,
  display: {
    instructions: '',
    recipient_details: '',
    qr_image: '',
  },
  custom_fields: [],
  withdrawal_config: paymentType === 'withdrawal'
    ? { processing_time: '1–24 hours', processing_mode: 'manual', admin_approval_required: true }
    : null,
  integration: null,
});

function slugifyKey(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'field';
}

export default function AdminPaymentGateway() {
  const { language } = useLanguage();
  const [paymentType, setPaymentType] = useState('deposit'); // 'deposit' | 'withdrawal'
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(makeEmptyMethod('deposit'));

  // Guided prompts
  const [needsAdditionalInfo, setNeedsAdditionalInfo] = useState(false);
  const [needsFileUpload, setNeedsFileUpload] = useState(false);

  const getText = useCallback((ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  }, [language]);

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/payment-gateway/methods?payment_type=${paymentType}`);
      setMethods(res.data.methods || []);
    } catch (e) {
      toast.error(getText('Erè pandan chajman', 'Erreur lors du chargement', 'Error loading'));
    } finally {
      setLoading(false);
    }
  }, [paymentType, getText]);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const visibleMethods = useMemo(() => methods.filter((m) => m.payment_type === paymentType), [methods, paymentType]);

  const openCreate = () => {
    setEditing(makeEmptyMethod(paymentType));
    setNeedsAdditionalInfo(false);
    setNeedsFileUpload(false);
    setShowModal(true);
  };

  const openEdit = (m) => {
    const normalized = {
      ...makeEmptyMethod(m.payment_type),
      ...m,
      display: { ...(makeEmptyMethod(m.payment_type).display), ...(m.display || {}) },
      custom_fields: Array.isArray(m.custom_fields) ? m.custom_fields : [],
      withdrawal_config: m.payment_type === 'withdrawal'
        ? { ...(makeEmptyMethod('withdrawal').withdrawal_config), ...(m.withdrawal_config || {}) }
        : null,
    };
    setEditing(normalized);
    setNeedsAdditionalInfo((normalized.custom_fields || []).length > 0);
    setNeedsFileUpload((normalized.custom_fields || []).some((f) => f.type === 'file'));
    setShowModal(true);
  };

  const deleteMethod = async (m) => {
    if (!window.confirm(getText('Siprime metòd sa?', 'Supprimer cette méthode?', 'Delete this method?'))) return;
    try {
      await axios.delete(`${API}/admin/payment-gateway/methods/${m.payment_method_id}`);
      toast.success(getText('Siprime', 'Supprimé', 'Deleted'));
      fetchMethods();
    } catch (e) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    }
  };

  const toggleStatus = async (m) => {
    try {
      const payload = { ...m, status: m.status === 'active' ? 'inactive' : 'active' };
      await axios.put(`${API}/admin/payment-gateway/methods/${m.payment_method_id}`, payload);
      toast.success(payload.status === 'active'
        ? getText('Aktive', 'Activé', 'Enabled')
        : getText('Dezaktive', 'Désactivé', 'Disabled'));
      fetchMethods();
    } catch (e) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    }
  };

  const addField = (preset) => {
    const next = [...(editing.custom_fields || [])];
    const base = preset || { label: '', key: '', type: 'text', required: false };
    next.push({
      ...base,
      key: base.key || slugifyKey(base.label),
      placeholder: base.placeholder || '',
      help_text: base.help_text || '',
      options: base.options || (base.type === 'select' ? ['Option 1', 'Option 2'] : undefined),
      accept: base.accept || (base.type === 'file' ? 'image/*' : undefined),
    });
    setEditing({ ...editing, custom_fields: next });
  };

  const removeField = (index) => {
    const next = [...(editing.custom_fields || [])].filter((_, i) => i !== index);
    setEditing({ ...editing, custom_fields: next });
  };

  const updateField = (index, key, value) => {
    const next = [...(editing.custom_fields || [])];
    next[index] = { ...next[index], [key]: value };
    if (key === 'label' && !next[index].key) {
      next[index].key = slugifyKey(value);
    }
    if (key === 'type') {
      if (value === 'select' && !next[index].options) next[index].options = ['Option 1'];
      if (value !== 'select') delete next[index].options;
      if (value === 'file' && !next[index].accept) next[index].accept = 'image/*';
      if (value !== 'file') delete next[index].accept;
    }
    setEditing({ ...editing, custom_fields: next });
  };

  const handleQrUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditing((prev) => ({
        ...prev,
        display: { ...(prev.display || {}), qr_image: String(reader.result || '') },
      }));
    };
    reader.readAsDataURL(file);
  };

  const saveMethod = async () => {
    if (!editing.payment_method_name?.trim()) {
      toast.error(getText('Non obligatwa', 'Nom requis', 'Name required'));
      return;
    }
    if (!editing.supported_currencies || editing.supported_currencies.length === 0) {
      toast.error(getText('Chwazi omwen yon deviz', 'Choisissez au moins une devise', 'Select at least one currency'));
      return;
    }
    if (editing.maximum_amount > 0 && editing.maximum_amount < editing.minimum_amount) {
      toast.error(getText('Maksimòm dwe >= minimòm', 'Maximum doit être >= minimum', 'Maximum must be >= minimum'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        payment_method_name: editing.payment_method_name.trim(),
        payment_type: editing.payment_type,
        status: editing.status,
        supported_currencies: editing.supported_currencies,
        minimum_amount: Number(editing.minimum_amount || 0),
        maximum_amount: Number(editing.maximum_amount || 0),
        fee_type: editing.fee_type,
        fee_value: Number(editing.fee_value || 0),
        display: editing.display || {},
        integration: editing.integration || null,
        custom_fields: (editing.custom_fields || []).map((f) => ({
          key: String(f.key || '').trim(),
          label: String(f.label || '').trim(),
          type: f.type,
          required: !!f.required,
          placeholder: f.placeholder || undefined,
          help_text: f.help_text || undefined,
          options: f.type === 'select' ? (Array.isArray(f.options) ? f.options.filter(Boolean) : []) : undefined,
          accept: f.type === 'file' ? (f.accept || 'image/*') : undefined,
        })),
        withdrawal_config: editing.payment_type === 'withdrawal' ? (editing.withdrawal_config || {}) : null,
      };

      if (editing.payment_method_id) {
        await axios.put(`${API}/admin/payment-gateway/methods/${editing.payment_method_id}`, payload);
      } else {
        await axios.post(`${API}/admin/payment-gateway/methods`, payload);
      }

      toast.success(getText('Anrejistre!', 'Enregistré!', 'Saved!'));
      setShowModal(false);
      fetchMethods();
    } catch (e) {
      toast.error(e?.response?.data?.detail || getText('Erè pandan anrejistreman', 'Erreur lors de la sauvegarde', 'Error saving'));
    } finally {
      setSaving(false);
    }
  };

  const addCommonFields = () => {
    addField({ label: 'Full Name', key: 'full_name', type: 'text', required: true, placeholder: 'Your full name' });
    addField({ label: 'Email', key: 'email', type: 'email', required: false, placeholder: 'you@example.com' });
    addField({ label: 'Phone', key: 'phone', type: 'phone', required: true, placeholder: '+509...' });
  };

  const addProofUpload = () => {
    addField({ label: 'Payment Proof', key: 'payment_proof', type: 'file', required: true, accept: 'image/*' });
  };

  const enablePlisio = (enabled) => {
    if (!enabled) {
      setEditing((prev) => ({ ...prev, integration: null }));
      return;
    }

    setEditing((prev) => {
      const existingFields = Array.isArray(prev.custom_fields) ? prev.custom_fields : [];
      const hasNetwork = existingFields.some((f) => f?.key === 'network');
      const nextFields = hasNetwork
        ? existingFields
        : [
            ...existingFields,
            {
              label: 'USDT Network',
              key: 'network',
              type: 'select',
              required: true,
              options: ['usdt_trc20', 'usdt_erc20', 'usdt_bep20', 'usdt_polygon', 'usdt_arbitrum'],
              help_text: 'Choose the USDT network for the payment invoice.',
            },
          ];

      return {
        ...prev,
        supported_currencies: Array.from(new Set([...(prev.supported_currencies || []), 'USD'])),
        integration: { provider: 'plisio', network_field_key: 'network' },
        custom_fields: nextFields,
      };
    });
  };

  return (
    <AdminLayout title={getText('Payment Gateway', 'Payment Gateway', 'Payment Gateway')}>
      <div className="space-y-6" data-testid="admin-payment-gateway">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{getText('Metòd yo', 'Méthodes', 'Methods')}</CardTitle>
                <CardDescription>
                  {getText(
                    'Jere metòd depo ak retrè (dinamik, san modifye kòd).',
                    'Gérez les méthodes de dépôt et de retrait (dynamiques, sans modifier le code).',
                    'Manage deposit & withdrawal methods dynamically (no code changes).'
                  )}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchMethods}>
                  <RefreshCw size={16} />
                </Button>
                <Button size="sm" onClick={openCreate} className="bg-[#EA580C] hover:bg-[#C2410C]">
                  <Plus size={16} className="mr-2" />
                  {getText('Ajoute', 'Ajouter', 'Add')}
                </Button>
              </div>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              <Button
                size="sm"
                variant={paymentType === 'deposit' ? 'default' : 'outline'}
                onClick={() => setPaymentType('deposit')}
                className={paymentType === 'deposit' ? 'bg-[#0047AB]' : ''}
              >
                <ArrowDownCircle size={14} className="mr-1" />
                {getText('Depo', 'Dépôt', 'Deposit Methods')}
              </Button>
              <Button
                size="sm"
                variant={paymentType === 'withdrawal' ? 'default' : 'outline'}
                onClick={() => setPaymentType('withdrawal')}
                className={paymentType === 'withdrawal' ? 'bg-[#0047AB]' : ''}
              >
                <ArrowUpCircle size={14} className="mr-1" />
                {getText('Retrè', 'Retrait', 'Withdrawal Methods')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : visibleMethods.length === 0 ? (
              <div className="text-center py-10 text-stone-500">
                <p>{getText('Pa gen metòd', 'Aucune méthode', 'No methods')}</p>
                <Button size="sm" onClick={openCreate} className="mt-4">
                  <Plus size={16} className="mr-2" />
                  {getText('Kreye premye metòd', 'Créer première méthode', 'Create first method')}
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{getText('Non', 'Nom', 'Name')}</th>
                        <th>{getText('Deviz', 'Devises', 'Currencies')}</th>
                        <th>{getText('Min/Max', 'Min/Max', 'Min/Max')}</th>
                        <th>{getText('Frè', 'Frais', 'Fee')}</th>
                        <th>{getText('Statis', 'Statut', 'Status')}</th>
                        <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMethods.map((m) => (
                        <tr key={m.payment_method_id}>
                          <td className="font-medium">{m.payment_method_name}</td>
                          <td>
                            <div className="flex gap-1">
                              {(m.supported_currencies || []).map((c) => (
                                <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="text-sm">
                            {Number(m.minimum_amount || 0)} – {Number(m.maximum_amount || 0) || '∞'}
                          </td>
                          <td className="text-sm">
                            {m.fee_type === 'percentage' ? `${Number(m.fee_value || 0)}%` : Number(m.fee_value || 0)}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <Switch checked={m.status === 'active'} onCheckedChange={() => toggleStatus(m)} />
                              <Badge className={m.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-700'}>
                                {m.status}
                              </Badge>
                            </div>
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

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {visibleMethods.map((m) => (
                    <div key={m.payment_method_id} className="border rounded-xl p-4 space-y-3 bg-white dark:bg-stone-900">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{m.payment_method_name}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(m.supported_currencies || []).map((c) => (
                              <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch checked={m.status === 'active'} onCheckedChange={() => toggleStatus(m)} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-stone-500">{getText('Min/Max', 'Min/Max', 'Min/Max')}</p>
                          <p className="font-medium">
                            {Number(m.minimum_amount || 0)} – {Number(m.maximum_amount || 0) || '∞'}
                          </p>
                        </div>
                        <div>
                          <p className="text-stone-500">{getText('Frè', 'Frais', 'Fee')}</p>
                          <p className="font-medium">
                            {m.fee_type === 'percentage' ? `${Number(m.fee_value || 0)}%` : Number(m.fee_value || 0)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Badge className={m.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-700'}>
                          {m.status}
                        </Badge>
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

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editing.payment_method_id
                  ? getText('Modifye Metòd', 'Modifier la méthode', 'Edit method')
                  : getText('Nouvo Metòd', 'Nouvelle méthode', 'New method')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Intelligent prompts */}
              <div className="border rounded-xl p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700">
                <p className="font-semibold mb-3 flex items-center gap-2">
                  <Wand2 size={18} />
                  {getText('Gid entèlijan', 'Guidage intelligent', 'Intelligent prompts')}
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      {getText(
                        'Èske metòd sa bezwen plis enfòmasyon itilizatè? Si wi, ajoute chan yo.',
                        'Cette méthode nécessite-t-elle des informations supplémentaires ? Si oui, ajoutez les champs requis.',
                        'Does this method require additional user information? If yes, add the required fields.'
                      )}
                    </p>
                    <Switch checked={needsAdditionalInfo} onCheckedChange={setNeedsAdditionalInfo} />
                  </div>

                  {needsAdditionalInfo && (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={addCommonFields}>
                        {getText('Ajoute chan komen', 'Ajouter champs communs', 'Add common fields')}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => addField({ label: 'Account Number', key: 'account_number', type: 'text', required: true })}>
                        {getText('Ajoute Kont #', 'Ajouter compte #', 'Add account #')}
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      {getText(
                        'Èske itilizatè yo dwe telechaje yon fichye (QR / prèv / dokiman)? Si wi, ajoute yon “File Upload” chan.',
                        'Les utilisateurs doivent-ils téléverser un fichier (QR / preuve / document) ? Si oui, ajoutez un champ “File Upload”.',
                        'Do users need to upload a file (QR / proof / document)? If yes, add a “File Upload” field.'
                      )}
                    </p>
                    <Switch checked={needsFileUpload} onCheckedChange={setNeedsFileUpload} />
                  </div>
                  {needsFileUpload && (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={addProofUpload}>
                        <Upload size={14} className="mr-2" />
                        {getText('Ajoute prèv', 'Ajouter preuve', 'Add proof upload')}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => addField({ label: 'Document', key: 'document', type: 'file', required: false, accept: '*/*' })}>
                        {getText('Ajoute dokiman', 'Ajouter document', 'Add document upload')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Base fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{getText('Non Metòd', 'Nom de la méthode', 'Payment Method Name')} <span className="text-red-500">*</span></Label>
                  <Input
                    value={editing.payment_method_name}
                    onChange={(e) => setEditing({ ...editing, payment_method_name: e.target.value })}
                    className="mt-1"
                    placeholder="ex: MonCash / Zelle / Bank Transfer"
                  />
                </div>
                <div>
                  <Label>{getText('Tip', 'Type', 'Payment Type')}</Label>
                  <div className="mt-2 flex gap-2">
                    <Badge className={editing.payment_type === 'deposit' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'}>
                      <ArrowDownCircle size={12} className="mr-1" />
                      {getText('Depo', 'Dépôt', 'Deposit')}
                    </Badge>
                    <Badge className={editing.payment_type === 'withdrawal' ? 'bg-orange-100 text-orange-700' : 'bg-stone-100 text-stone-600'}>
                      <ArrowUpCircle size={12} className="mr-1" />
                      {getText('Retrè', 'Retrait', 'Withdrawal')}
                    </Badge>
                  </div>
                  <p className="text-xs text-stone-500 mt-2">
                    {getText('Tip la soti nan onglet la.', 'Le type vient de l’onglet.', 'Type is determined by the current tab.')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{getText('Statis', 'Statut', 'Status')}</Label>
                  <div className="mt-2 flex items-center justify-between border rounded-lg p-3">
                    <span className="text-sm">{editing.status === 'active' ? getText('Aktif', 'Actif', 'Active') : getText('Inaktif', 'Inactif', 'Inactive')}</span>
                    <Switch
                      checked={editing.status === 'active'}
                      onCheckedChange={(v) => setEditing({ ...editing, status: v ? 'active' : 'inactive' })}
                    />
                  </div>
                </div>
                <div>
                  <Label>{getText('Deviz', 'Devises', 'Supported Currency')}</Label>
                  <div className="mt-2 flex gap-4">
                    {['HTG', 'USD'].map((c) => (
                      <label key={c} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(editing.supported_currencies || []).includes(c)}
                          onChange={(e) => {
                            const next = new Set(editing.supported_currencies || []);
                            if (e.target.checked) next.add(c);
                            else next.delete(c);
                            setEditing({ ...editing, supported_currencies: Array.from(next) });
                          }}
                          className="w-4 h-4 rounded border-stone-300"
                        />
                        <Badge variant="outline">{c}</Badge>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{getText('Montan Minimòm', 'Montant minimum', 'Minimum Amount')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.minimum_amount}
                    onChange={(e) => setEditing({ ...editing, minimum_amount: Number(e.target.value || 0) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>{getText('Montan Maksimòm', 'Montant maximum', 'Maximum Amount')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.maximum_amount}
                    onChange={(e) => setEditing({ ...editing, maximum_amount: Number(e.target.value || 0) })}
                    className="mt-1"
                  />
                  <p className="text-xs text-stone-500 mt-1">{getText('0 = san limit', '0 = illimité', '0 = unlimited')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{getText('Tip Frè', 'Type de frais', 'Fee Type')}</Label>
                  <select
                    value={editing.fee_type}
                    onChange={(e) => setEditing({ ...editing, fee_type: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="fixed">{getText('Fiks', 'Fixe', 'Fixed')}</option>
                    <option value="percentage">{getText('Pousantaj', 'Pourcentage', 'Percentage')}</option>
                  </select>
                </div>
                <div>
                  <Label>{getText('Valè Frè', 'Valeur du frais', 'Fee Value')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.fee_value}
                    onChange={(e) => setEditing({ ...editing, fee_value: Number(e.target.value || 0) })}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Display config */}
              <div className="border rounded-xl p-4 space-y-4">
                <p className="font-semibold">{getText('Afichaj pou itilizatè yo', 'Affichage utilisateur', 'User display')}</p>
                <div>
                  <Label>{getText('Enstriksyon', 'Instructions', 'Instructions')}</Label>
                  <Textarea
                    value={editing.display?.instructions || ''}
                    onChange={(e) => setEditing({ ...editing, display: { ...(editing.display || {}), instructions: e.target.value } })}
                    className="mt-1 min-h-[90px]"
                    placeholder={getText('Eg: Voye lajan an sou...', 'Ex: Envoyez l’argent sur...', 'E.g. Send funds to...')}
                  />
                </div>
                <div>
                  <Label>{getText('Detay reseptè', 'Détails du bénéficiaire', 'Recipient details')}</Label>
                  <Textarea
                    value={editing.display?.recipient_details || ''}
                    onChange={(e) => setEditing({ ...editing, display: { ...(editing.display || {}), recipient_details: e.target.value } })}
                    className="mt-1 min-h-[70px]"
                    placeholder={getText('Eg: Non, nimewo, kont...', 'Ex: Nom, numéro, compte...', 'E.g. Name, phone, account...')}
                  />
                </div>
                <div>
                  <Label>{getText('QR Code (opsyonèl)', 'QR Code (optionnel)', 'QR Code (optional)')}</Label>
                  <div className="mt-2 flex items-center gap-3">
                    <input type="file" accept="image/*" onChange={handleQrUpload} />
                    {editing.display?.qr_image ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing({ ...editing, display: { ...(editing.display || {}), qr_image: '' } })}
                      >
                        <X size={14} className="mr-2" />
                        {getText('Retire', 'Retirer', 'Remove')}
                      </Button>
                    ) : null}
                  </div>
                  {editing.display?.qr_image ? (
                    <img src={editing.display.qr_image} alt="QR" className="mt-3 max-h-40 border rounded-lg" />
                  ) : null}
                </div>
              </div>

              {/* Withdrawal-only config */}
              {editing.payment_type === 'withdrawal' && (
                <div className="border rounded-xl p-4 space-y-4">
                  <p className="font-semibold">{getText('Opsyon Retrè', 'Options Retrait', 'Withdrawal options')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>{getText('Tan pwosesis', 'Temps de traitement', 'Processing Time')}</Label>
                      <Input
                        value={editing.withdrawal_config?.processing_time || ''}
                        onChange={(e) => setEditing({
                          ...editing,
                          withdrawal_config: { ...(editing.withdrawal_config || {}), processing_time: e.target.value }
                        })}
                        className="mt-1"
                        placeholder="1–24 hours"
                      />
                    </div>
                    <div>
                      <Label>{getText('Mòd pwosesis', 'Mode de traitement', 'Processing Mode')}</Label>
                      <select
                        value={editing.withdrawal_config?.processing_mode || 'manual'}
                        onChange={(e) => setEditing({
                          ...editing,
                          withdrawal_config: { ...(editing.withdrawal_config || {}), processing_mode: e.target.value }
                        })}
                        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="manual">{getText('Manyèl', 'Manuel', 'Manual')}</option>
                        <option value="automatic">{getText('Otomatik', 'Automatique', 'Automatic')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border rounded-lg p-3">
                    <span className="text-sm">{getText('Apwobasyon Admin obligatwa', 'Approbation admin requise', 'Admin Approval Required')}</span>
                    <Switch
                      checked={!!editing.withdrawal_config?.admin_approval_required}
                      onCheckedChange={(v) => setEditing({
                        ...editing,
                        withdrawal_config: { ...(editing.withdrawal_config || {}), admin_approval_required: v }
                      })}
                    />
                  </div>
                </div>
              )}

              {/* Deposit-only: Integration */}
              {editing.payment_type === 'deposit' && (
                <div className="border rounded-xl p-4 space-y-3">
                  <p className="font-semibold">{getText('Entegrasyon', 'Intégration', 'Integration')}</p>
                  <div className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium">Plisio (Crypto invoice link)</p>
                      <p className="text-xs text-stone-500">
                        {getText(
                          'Sa ap kreye yon lyen peman otomatik (USDT) pou kliyan depo USD.',
                          'Génère un lien de paiement automatique (USDT) pour dépôts USD.',
                          'Generates an automatic crypto payment link (USDT) for USD deposits.'
                        )}
                      </p>
                    </div>
                    <Switch
                      checked={editing.integration?.provider === 'plisio'}
                      onCheckedChange={(v) => enablePlisio(v)}
                    />
                  </div>
                  {editing.integration?.provider === 'plisio' && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
                      {getText(
                        'Asire w Plisio aktive nan Admin Settings epi ou mete kle a.',
                        'Assurez-vous que Plisio est activé dans Admin Settings et que la clé est renseignée.',
                        'Make sure Plisio is enabled in Admin Settings and the key is set.'
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Custom fields */}
              <div className="border rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{getText('Chan dinamik (utilizatè)', 'Champs dynamiques (utilisateur)', 'Dynamic custom fields (user)')}</p>
                    <p className="text-xs text-stone-500 mt-1">
                      {getText(
                        'Admin ka ajoute / modifye / retire chan yo pou chak metòd.',
                        'L’admin peut ajouter / modifier / supprimer des champs par méthode.',
                        'Admin can add/edit/remove fields per method.'
                      )}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => addField()}>
                    <Plus size={14} className="mr-2" />
                    {getText('Ajoute chan', 'Ajouter champ', 'Add field')}
                  </Button>
                </div>

                {(editing.custom_fields || []).length === 0 ? (
                  <div className="text-center py-6 text-stone-500 text-sm border-2 border-dashed rounded-lg">
                    {getText('Pa gen chan', 'Aucun champ', 'No custom fields')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(editing.custom_fields || []).map((f, idx) => (
                      <div key={`${f.key || idx}`} className="border rounded-lg p-4 bg-stone-50 dark:bg-stone-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{getText('Chan', 'Champ', 'Field')} {idx + 1}</Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeField(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X size={14} />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">{getText('Etikèt', 'Libellé', 'Label')}</Label>
                            <Input
                              value={f.label || ''}
                              onChange={(e) => updateField(idx, 'label', e.target.value)}
                              className="mt-1"
                              placeholder="e.g. Phone number"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{getText('Kle (key)', 'Clé (key)', 'Key')}</Label>
                            <Input
                              value={f.key || ''}
                              onChange={(e) => updateField(idx, 'key', e.target.value)}
                              className="mt-1 font-mono"
                              placeholder="e.g. phone"
                            />
                            <p className="text-[11px] text-stone-500 mt-1">a-z, 0-9, _ (max 64)</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">{getText('Tip', 'Type', 'Type')}</Label>
                            <select
                              value={f.type || 'text'}
                              onChange={(e) => updateField(idx, 'type', e.target.value)}
                              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                            >
                              {FIELD_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-2 flex items-center justify-between border rounded-lg p-3 mt-6 sm:mt-0">
                            <span className="text-sm">{getText('Obligatwa', 'Obligatoire', 'Required')}</span>
                            <Switch checked={!!f.required} onCheckedChange={(v) => updateField(idx, 'required', v)} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">{getText('Placeholder', 'Placeholder', 'Placeholder')}</Label>
                            <Input
                              value={f.placeholder || ''}
                              onChange={(e) => updateField(idx, 'placeholder', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{getText('Èd', 'Aide', 'Help text')}</Label>
                            <Input
                              value={f.help_text || ''}
                              onChange={(e) => updateField(idx, 'help_text', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>

                        {f.type === 'select' && (
                          <div>
                            <Label className="text-xs">{getText('Opsyon (separe ak vigil)', 'Options (séparées par des virgules)', 'Options (comma-separated)')}</Label>
                            <Input
                              value={Array.isArray(f.options) ? f.options.join(', ') : ''}
                              onChange={(e) => updateField(idx, 'options', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))}
                              className="mt-1"
                              placeholder="Option 1, Option 2"
                            />
                          </div>
                        )}

                        {f.type === 'file' && (
                          <div>
                            <Label className="text-xs">{getText('Accept (MIME)', 'Accept (MIME)', 'Accept (MIME)')}</Label>
                            <Input
                              value={f.accept || 'image/*'}
                              onChange={(e) => updateField(idx, 'accept', e.target.value)}
                              className="mt-1 font-mono"
                              placeholder="image/*"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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

