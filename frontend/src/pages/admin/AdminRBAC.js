import React, { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_BASE as API } from '@/lib/utils';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Shield, 
  Save, 
  RefreshCw, 
  ArrowDownCircle, 
  ArrowUpCircle,
  Users,
  CheckCircle,
  XCircle
} from 'lucide-react';

const ROLES = ['support', 'finance', 'manager', 'admin'];

const DEFAULT_PERMISSIONS = {
  support: { deposit_methods: [], withdrawal_methods: [] },
  finance: { deposit_methods: [], withdrawal_methods: [] },
  manager: { deposit_methods: [], withdrawal_methods: [] },
  admin: { deposit_methods: [], withdrawal_methods: [] },
};

export default function AdminRBAC() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [depositMethods, setDepositMethods] = useState([]);
  const [withdrawalMethods, setWithdrawalMethods] = useState([]);
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [activeRole, setActiveRole] = useState('finance');

  const getText = useCallback((ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  }, [language]);

  const roleLabels = {
    support: getText('Sipò', 'Support', 'Support'),
    finance: getText('Finans', 'Finance', 'Finance'),
    manager: getText('Manadjè', 'Manager', 'Manager'),
    admin: getText('Admin', 'Admin', 'Admin'),
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [depositRes, withdrawalRes, permRes] = await Promise.all([
        axios.get(`${API}/admin/payment-gateway/methods?payment_type=deposit`).catch((e) => {
          console.error('Error fetching deposit methods:', e);
          return { data: { methods: [] } };
        }),
        axios.get(`${API}/admin/payment-gateway/methods?payment_type=withdrawal`).catch((e) => {
          console.error('Error fetching withdrawal methods:', e);
          return { data: { methods: [] } };
        }),
        axios.get(`${API}/admin/rbac-permissions`).catch((e) => {
          console.error('Error fetching RBAC permissions:', e);
          return { data: { permissions: DEFAULT_PERMISSIONS } };
        }),
      ]);
      
      console.log('Deposit methods:', depositRes.data?.methods);
      console.log('Withdrawal methods:', withdrawalRes.data?.methods);
      
      setDepositMethods(depositRes.data?.methods || []);
      setWithdrawalMethods(withdrawalRes.data?.methods || []);
      
      // Merge fetched permissions with defaults
      const fetchedPerms = permRes.data?.permissions || {};
      setPermissions({
        ...DEFAULT_PERMISSIONS,
        ...fetchedPerms,
      });
    } catch (e) {
      console.error('Error in fetchData:', e);
      toast.error(getText('Erè pandan chajman', 'Erreur lors du chargement', 'Error loading'));
    } finally {
      setLoading(false);
    }
  }, [getText]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const togglePermission = (role, type, methodId) => {
    setPermissions(prev => {
      const rolePerms = prev[role] || { deposit_methods: [], withdrawal_methods: [] };
      const key = type === 'deposit' ? 'deposit_methods' : 'withdrawal_methods';
      const current = rolePerms[key] || [];
      
      const updated = current.includes(methodId)
        ? current.filter(id => id !== methodId)
        : [...current, methodId];
      
      return {
        ...prev,
        [role]: {
          ...rolePerms,
          [key]: updated,
        },
      };
    });
  };

  const toggleAllForRole = (role, type, enable) => {
    const methods = type === 'deposit' ? depositMethods : withdrawalMethods;
    const methodIds = enable ? methods.map(m => m.payment_method_id) : [];
    
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [type === 'deposit' ? 'deposit_methods' : 'withdrawal_methods']: methodIds,
      },
    }));
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/rbac-permissions`, { permissions });
      toast.success(getText('Pèmisyon yo anrejistre!', 'Permissions enregistrées!', 'Permissions saved!'));
    } catch (e) {
      toast.error(e.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const isMethodEnabled = (role, type, methodId) => {
    const rolePerms = permissions[role] || {};
    const key = type === 'deposit' ? 'deposit_methods' : 'withdrawal_methods';
    return (rolePerms[key] || []).includes(methodId);
  };

  const countEnabled = (role, type) => {
    const rolePerms = permissions[role] || {};
    const key = type === 'deposit' ? 'deposit_methods' : 'withdrawal_methods';
    return (rolePerms[key] || []).length;
  };

  if (loading) {
    return (
      <AdminLayout title={getText('Pèmisyon Wòl', 'Permissions des Rôles', 'Role Permissions')}>
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="animate-spin text-[#EA580C]" size={32} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={getText('Pèmisyon Wòl', 'Permissions des Rôles', 'Role Permissions')}>
      <div className="space-y-6" data-testid="admin-rbac">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Shield className="text-[#EA580C]" size={24} />
              {getText('Kontwòl Aksè pa Wòl', 'Contrôle d\'Accès par Rôle', 'Role-Based Access Control')}
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              {getText(
                'Chwazi ki metòd depo ak retrè chak wòl ka jere.',
                'Choisissez quelles méthodes de dépôt et retrait chaque rôle peut gérer.',
                'Choose which deposit and withdrawal methods each role can manage.'
              )}
            </p>
          </div>
          <Button onClick={savePermissions} disabled={saving} className="bg-[#EA580C] hover:bg-[#C2410C]">
            {saving ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
            {getText('Anrejistre', 'Enregistrer', 'Save')}
          </Button>
        </div>

        {/* Role Tabs */}
        <Tabs value={activeRole} onValueChange={setActiveRole}>
          <TabsList className="grid grid-cols-4 w-full max-w-md">
            {ROLES.map(role => (
              <TabsTrigger key={role} value={role} className="text-xs sm:text-sm">
                {roleLabels[role]}
              </TabsTrigger>
            ))}
          </TabsList>

          {ROLES.map(role => (
            <TabsContent key={role} value={role} className="space-y-6 mt-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <ArrowDownCircle className="text-emerald-600" size={24} />
                      <div>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                          {countEnabled(role, 'deposit')} / {depositMethods.length}
                        </p>
                        <p className="text-sm text-emerald-600 dark:text-emerald-500">
                          {getText('Metòd Depo', 'Méthodes Dépôt', 'Deposit Methods')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <ArrowUpCircle className="text-orange-600" size={24} />
                      <div>
                        <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                          {countEnabled(role, 'withdrawal')} / {withdrawalMethods.length}
                        </p>
                        <p className="text-sm text-orange-600 dark:text-orange-500">
                          {getText('Metòd Retrè', 'Méthodes Retrait', 'Withdrawal Methods')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Deposit Methods */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ArrowDownCircle className="text-emerald-500" size={20} />
                        {getText('Metòd Depo', 'Méthodes de Dépôt', 'Deposit Methods')}
                      </CardTitle>
                      <CardDescription>
                        {getText(
                          `Chwazi ki metòd depo ${roleLabels[role]} ka wè ak apwouve.`,
                          `Choisissez quelles méthodes de dépôt ${roleLabels[role]} peut voir et approuver.`,
                          `Choose which deposit methods ${roleLabels[role]} can view and approve.`
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleAllForRole(role, 'deposit', true)}
                      >
                        <CheckCircle size={14} className="mr-1" />
                        {getText('Tout', 'Tous', 'All')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleAllForRole(role, 'deposit', false)}
                      >
                        <XCircle size={14} className="mr-1" />
                        {getText('Okenn', 'Aucun', 'None')}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {depositMethods.length === 0 ? (
                    <p className="text-stone-500 text-center py-4">
                      {getText('Pa gen metòd depo konfigire', 'Aucune méthode de dépôt configurée', 'No deposit methods configured')}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {depositMethods.map(method => (
                        <label
                          key={method.payment_method_id}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            isMethodEnabled(role, 'deposit', method.payment_method_id)
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                              : 'border-stone-200 dark:border-stone-700 hover:border-stone-300'
                          }`}
                        >
                          <Checkbox
                            checked={isMethodEnabled(role, 'deposit', method.payment_method_id)}
                            onCheckedChange={() => togglePermission(role, 'deposit', method.payment_method_id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-stone-900 dark:text-white truncate">
                              {method.payment_method_name || method.name}
                            </p>
                            <p className="text-xs text-stone-500">
                              {(method.supported_currencies || []).join(', ') || method.currency} • {(method.status === 'active' || method.is_enabled) ? getText('Aktif', 'Actif', 'Active') : getText('Inaktif', 'Inactif', 'Inactive')}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Withdrawal Methods */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ArrowUpCircle className="text-orange-500" size={20} />
                        {getText('Metòd Retrè', 'Méthodes de Retrait', 'Withdrawal Methods')}
                      </CardTitle>
                      <CardDescription>
                        {getText(
                          `Chwazi ki metòd retrè ${roleLabels[role]} ka wè ak apwouve.`,
                          `Choisissez quelles méthodes de retrait ${roleLabels[role]} peut voir et approuver.`,
                          `Choose which withdrawal methods ${roleLabels[role]} can view and approve.`
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleAllForRole(role, 'withdrawal', true)}
                      >
                        <CheckCircle size={14} className="mr-1" />
                        {getText('Tout', 'Tous', 'All')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleAllForRole(role, 'withdrawal', false)}
                      >
                        <XCircle size={14} className="mr-1" />
                        {getText('Okenn', 'Aucun', 'None')}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {withdrawalMethods.length === 0 ? (
                    <p className="text-stone-500 text-center py-4">
                      {getText('Pa gen metòd retrè konfigire', 'Aucune méthode de retrait configurée', 'No withdrawal methods configured')}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {withdrawalMethods.map(method => (
                        <label
                          key={method.payment_method_id}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            isMethodEnabled(role, 'withdrawal', method.payment_method_id)
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                              : 'border-stone-200 dark:border-stone-700 hover:border-stone-300'
                          }`}
                        >
                          <Checkbox
                            checked={isMethodEnabled(role, 'withdrawal', method.payment_method_id)}
                            onCheckedChange={() => togglePermission(role, 'withdrawal', method.payment_method_id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-stone-900 dark:text-white truncate">
                              {method.payment_method_name || method.name}
                            </p>
                            <p className="text-xs text-stone-500">
                              {(method.supported_currencies || []).join(', ') || method.currency} • {(method.status === 'active' || method.is_enabled) ? getText('Aktif', 'Actif', 'Active') : getText('Inaktif', 'Inactif', 'Inactive')}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Info Card */}
        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Users className="text-blue-600 mt-0.5" size={20} />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-semibold mb-1">
                  {getText('Nòt Enpòtan', 'Note Importante', 'Important Note')}
                </p>
                <p>
                  {getText(
                    'Superadmin toujou gen aksè a tout metòd. Chanjman yo ap aplike imedyatman apre ou anrejistre.',
                    'Les superadmins ont toujours accès à toutes les méthodes. Les changements s\'appliquent immédiatement après l\'enregistrement.',
                    'Superadmins always have access to all methods. Changes apply immediately after saving.'
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
