import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  User, 
  Lock, 
  Globe,
  Shield,
  Bell,
  CreditCard,
  Plus,
  Trash2,
  Smartphone,
  DollarSign,
  Wallet,
  Building,
  Save
} from 'lucide-react';

import { API_BASE } from '@/lib/utils';
const API = API_BASE;

// Payment method types with icons and labels
const paymentMethodTypes = [
  { id: 'moncash', name: 'MonCash', icon: Smartphone, placeholder: 'Nimewo telefòn MonCash', currency: 'HTG' },
  { id: 'natcash', name: 'NatCash', icon: Smartphone, placeholder: 'Nimewo telefòn NatCash', currency: 'HTG' },
  { id: 'zelle', name: 'Zelle', icon: DollarSign, placeholder: 'Email oswa telefòn Zelle', currency: 'USD' },
  { id: 'paypal', name: 'PayPal', icon: DollarSign, placeholder: 'Email PayPal', currency: 'USD' },
  { id: 'usdt', name: 'USDT (TRC-20)', icon: Wallet, placeholder: 'Adrès USDT TRC-20', currency: 'USD' },
  { id: 'bank_usa', name: 'Bank USA 🇺🇸', icon: Building, placeholder: 'Routing + Account Number', currency: 'USD' },
  { id: 'bank_mexico', name: 'Bank Mexico 🇲🇽', icon: Building, placeholder: 'CLABE (18 chif)', currency: 'USD' },
  { id: 'bank_brazil', name: 'Bank Brazil 🇧🇷', icon: Building, placeholder: 'CPF/CNPJ + Chave PIX', currency: 'USD' },
  { id: 'bank_chile', name: 'Bank Chile 🇨🇱', icon: Building, placeholder: 'RUT + Nimewo kont', currency: 'USD' }
];

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const { user } = useAuth();
  
  const [notifications, setNotifications] = useState(true);
  const [twoFactor, setTwoFactor] = useState(user?.two_factor_enabled || false);
  
  // Payment methods state
  const [savedMethods, setSavedMethods] = useState([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingMethod, setSavingMethod] = useState(false);
  const [newMethod, setNewMethod] = useState({
    method_type: '',
    label: '',
    account_info: ''
  });

  const getText = useCallback((ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  }, [language]);

  // Fetch saved payment methods
  const fetchSavedMethods = useCallback(async () => {
    setLoadingMethods(true);
    try {
      const res = await axios.get(`${API}/user/payment-methods`);
      setSavedMethods(res.data.methods || []);
    } catch (e) {
      // Silent fail - methods might not exist yet
      setSavedMethods([]);
    } finally {
      setLoadingMethods(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedMethods();
  }, [fetchSavedMethods]);

  // Add new payment method
  const handleAddMethod = async () => {
    if (!newMethod.method_type || !newMethod.account_info.trim()) {
      toast.error(getText('Ranpli tout chan yo', 'Remplissez tous les champs', 'Fill all fields'));
      return;
    }
    
    setSavingMethod(true);
    try {
      await axios.post(`${API}/user/payment-methods`, {
        method_type: newMethod.method_type,
        label: newMethod.label.trim() || paymentMethodTypes.find(m => m.id === newMethod.method_type)?.name,
        account_info: newMethod.account_info.trim()
      });
      toast.success(getText('Mwayen peman ajoute!', 'Moyen de paiement ajouté!', 'Payment method added!'));
      setShowAddModal(false);
      setNewMethod({ method_type: '', label: '', account_info: '' });
      fetchSavedMethods();
    } catch (e) {
      toast.error(e.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    } finally {
      setSavingMethod(false);
    }
  };

  // Delete payment method
  const handleDeleteMethod = async (methodId) => {
    if (!window.confirm(getText('Siprime mwayen peman sa?', 'Supprimer ce moyen de paiement?', 'Delete this payment method?'))) {
      return;
    }
    try {
      await axios.delete(`${API}/user/payment-methods/${methodId}`);
      toast.success(getText('Siprime!', 'Supprimé!', 'Deleted!'));
      fetchSavedMethods();
    } catch (e) {
      toast.error(getText('Erè pandan sipresyon', 'Erreur lors de la suppression', 'Error deleting'));
    }
  };

  const getMethodIcon = (methodType) => {
    const method = paymentMethodTypes.find(m => m.id === methodType);
    return method?.icon || CreditCard;
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    toast.success(lang === 'fr' ? 'Langue changée en français' : 'Language changed to English');
  };

  return (
    <DashboardLayout title={t('settings')}>
      <div className="max-w-2xl mx-auto space-y-6" data-testid="settings-page">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User size={20} />
              Profil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-[#0047AB] rounded-full flex items-center justify-center">
                <span className="text-white text-2xl font-bold">
                  {user?.full_name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold text-slate-900">{user?.full_name}</p>
                <p className="text-slate-500">{user?.email}</p>
                <p className="text-sm text-slate-400 font-mono">{user?.client_id}</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div>
                <Label>{t('fullName')}</Label>
                <Input value={user?.full_name} disabled className="mt-1 bg-slate-50" />
              </div>
              <div>
                <Label>{t('email')}</Label>
                <Input value={user?.email} disabled className="mt-1 bg-slate-50" />
              </div>
              <div>
                <Label>{t('phone')}</Label>
                <Input value={user?.phone} disabled className="mt-1 bg-slate-50" />
              </div>
              <div>
                <Label>Client ID</Label>
                <Input value={user?.client_id} disabled className="mt-1 bg-slate-50 font-mono" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard size={20} />
                {getText('Mwayen Peman', 'Moyens de paiement', 'Payment Methods')}
              </div>
              <Button 
                size="sm" 
                onClick={() => setShowAddModal(true)}
                className="bg-[#EA580C] hover:bg-[#c34d0a]"
              >
                <Plus size={16} className="mr-1" />
                {getText('Ajoute', 'Ajouter', 'Add')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {getText(
                'Anrejistre mwayen peman ou yo pou fè retrè pi rapid.',
                'Enregistrez vos moyens de paiement pour des retraits plus rapides.',
                'Save your payment methods for faster withdrawals.'
              )}
            </p>
            
            {loadingMethods ? (
              <div className="text-center py-8 text-slate-500">
                {getText('Chajman...', 'Chargement...', 'Loading...')}
              </div>
            ) : savedMethods.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <CreditCard size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">
                  {getText('Ou poko gen mwayen peman anrejistre', 'Aucun moyen de paiement enregistré', 'No saved payment methods')}
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus size={16} className="mr-2" />
                  {getText('Ajoute premye a', 'Ajouter le premier', 'Add your first')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {savedMethods.map((m) => {
                  const Icon = getMethodIcon(m.method_type);
                  const methodInfo = paymentMethodTypes.find(t => t.id === m.method_type);
                  return (
                    <div 
                      key={m.id} 
                      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-600">
                          <Icon size={20} className="text-slate-600 dark:text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{m.label}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">{m.account_info}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            methodInfo?.currency === 'HTG' 
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          }`}>
                            {methodInfo?.currency || 'USD'}
                          </span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteMethod(m.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Payment Method Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{getText('Ajoute Mwayen Peman', 'Ajouter un moyen de paiement', 'Add Payment Method')}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div>
                <Label>{getText('Tip mwayen peman', 'Type de moyen de paiement', 'Payment method type')}</Label>
                <Select 
                  value={newMethod.method_type} 
                  onValueChange={(v) => setNewMethod({ ...newMethod, method_type: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={getText('Chwazi tip la', 'Choisir le type', 'Select type')} />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">HTG</div>
                    {paymentMethodTypes.filter(m => m.currency === 'HTG').map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          {m.name}
                        </span>
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 border-t mt-1 pt-2">USD</div>
                    {paymentMethodTypes.filter(m => m.currency === 'USD').map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          {m.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>{getText('Non/Etikèt (opsyonèl)', 'Nom/Étiquette (optionnel)', 'Name/Label (optional)')}</Label>
                <Input
                  value={newMethod.label}
                  onChange={(e) => setNewMethod({ ...newMethod, label: e.target.value })}
                  placeholder={getText('Ex: MonCash pèsonèl', 'Ex: MonCash personnel', 'Ex: Personal MonCash')}
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label>{getText('Enfòmasyon kont', 'Informations du compte', 'Account information')}</Label>
                <Input
                  value={newMethod.account_info}
                  onChange={(e) => setNewMethod({ ...newMethod, account_info: e.target.value })}
                  placeholder={paymentMethodTypes.find(m => m.id === newMethod.method_type)?.placeholder || getText('Antre enfòmasyon yo', 'Entrez les informations', 'Enter account info')}
                  className="mt-2"
                />
                {newMethod.method_type && (
                  <p className="text-xs text-slate-500 mt-1">
                    {paymentMethodTypes.find(m => m.id === newMethod.method_type)?.placeholder}
                  </p>
                )}
              </div>
              
              <Button 
                onClick={handleAddMethod} 
                disabled={savingMethod}
                className="w-full bg-[#EA580C] hover:bg-[#c34d0a]"
              >
                <Save size={18} className="mr-2" />
                {savingMethod 
                  ? getText('Anrejistreman...', 'Enregistrement...', 'Saving...') 
                  : getText('Anrejistre', 'Enregistrer', 'Save')
                }
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe size={20} />
              Langue / Language
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <button
                onClick={() => handleLanguageChange('fr')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  language === 'fr' 
                    ? 'border-[#0047AB] bg-blue-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-2xl">🇫🇷</span>
                <p className="font-medium mt-2">Français</p>
              </button>
              <button
                onClick={() => handleLanguageChange('en')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  language === 'en' 
                    ? 'border-[#0047AB] bg-blue-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-2xl">🇬🇧</span>
                <p className="font-medium mt-2">English</p>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={20} />
              Sécurité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Lock size={20} className="text-slate-500" />
                <div>
                  <p className="font-medium text-slate-900">Authentification à deux facteurs (2FA)</p>
                  <p className="text-sm text-slate-500">Ajoutez une couche de sécurité supplémentaire</p>
                </div>
              </div>
              <Switch 
                checked={twoFactor} 
                onCheckedChange={setTwoFactor}
                disabled
              />
            </div>
            <p className="text-sm text-slate-500">
              * La fonctionnalité 2FA sera disponible prochainement
            </p>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell size={20} />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-slate-500" />
                <div>
                  <p className="font-medium text-slate-900">Notifications email</p>
                  <p className="text-sm text-slate-500">Recevez des alertes pour vos transactions</p>
                </div>
              </div>
              <Switch 
                checked={notifications} 
                onCheckedChange={setNotifications}
              />
            </div>
          </CardContent>
        </Card>

        {/* KYC Status */}
        <Card>
          <CardHeader>
            <CardTitle>Statut de vérification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`p-4 rounded-xl ${
              user?.kyc_status === 'approved' 
                ? 'bg-emerald-50 border border-emerald-200' 
                : user?.kyc_status === 'pending'
                  ? 'bg-amber-50 border border-amber-200'
                  : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  user?.kyc_status === 'approved' 
                    ? 'bg-emerald-500' 
                    : user?.kyc_status === 'pending'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-red-500'
                }`} />
                <span className={`font-medium capitalize ${
                  user?.kyc_status === 'approved' 
                    ? 'text-emerald-700' 
                    : user?.kyc_status === 'pending'
                      ? 'text-amber-700'
                      : 'text-red-700'
                }`}>
                  KYC: {t(user?.kyc_status === 'approved' ? 'kycApproved' : user?.kyc_status === 'pending' ? 'kycPending' : 'kycRejected')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
