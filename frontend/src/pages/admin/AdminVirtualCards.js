import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_BASE as API } from '@/lib/utils';
import { toast } from 'sonner';
import axios from 'axios';
import { Check, X, Eye, RefreshCw, CreditCard, Upload, Wallet, Plus, Search, Trash2, Save } from 'lucide-react';

// Visa and Mastercard logos
const VISA_LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0ODAgMjAwIj48cGF0aCBmaWxsPSIjMUE1RjdBIiBkPSJNMTcxLjcgNjUuNmwtNDEuMyA2OS40aDI1LjdsNi4xLTE1LjRoMjkuNGw2LjEgMTUuNGgyNS43bC00MS4zLTY5LjRoLTEwLjR6bTMuNCAyMC4zbDkuNiAyMy4xaC0xOS4zbDkuNy0yMy4xem01Ni4yLTIwLjNsLTE1LjggNDEuNy03LTQxLjdoLTI0LjZsMjAuNiA2OS40aDI0LjZsMjkuOS02OS40aC0yNy43em02NS4yIDBsLTE1LjggNDEuNy03LTQxLjdoLTI0LjZsMjAuNiA2OS40aDI0LjZsMjkuOS02OS40aC0yNy43em03MS41IDBoLTQ0LjZ2NjkuNGgyNS43di0yMy45aDIwLjFjMTkuOCAwIDMyLjEtMTEgMzIuMS0yMi44IDAtMTEuNy0xMi4zLTIyLjctMzMuMy0yMi43em0tMi41IDE4LjdjNy44IDAgMTEuNiAzLjQgMTEuNiA3LjQgMCAzLjktMy44IDcuNS0xMS42IDcuNWgtMTYuNHYtMTUuMWgxNi40eiIvPjwvc3ZnPg==';
const MASTERCARD_LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMzEuMiAxNTAiPjxjaXJjbGUgZmlsbD0iI2ViMDAxYiIgY3g9IjY4IiBjeT0iNzUiIHI9IjUyIi8+PGNpcmNsZSBmaWxsPSIjZjc5ZTFiIiBjeD0iMTYzIiBjeT0iNzUiIHI9IjUyIi8+PHBhdGggZmlsbD0iI2ZmNWYwMCIgZD0iTTExNS41IDMzLjJjLTE2LjcgMTMuMS0yNy40IDMzLjMtMjcuNCA1NS44czEwLjcgNDIuNyAyNy40IDU1LjhjMTYuNy0xMy4xIDI3LjQtMzMuMyAyNy40LTU1LjhzLTEwLjctNDIuNy0yNy40LTU1Ljh6Ii8+PC9zdmc+';

export default function AdminVirtualCards() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('orders');
  const [strowalletEnabled, setStrowalletEnabled] = useState(false);
  const [autoIssueStrowallet, setAutoIssueStrowallet] = useState(true);
  const [cardSettings, setCardSettings] = useState(null);
  const [savingCardSettings, setSavingCardSettings] = useState(false);
  
  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  // Default to 'all' so admins immediately see existing cards.
  const [orderFilter, setOrderFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  
  // Top-ups state
  const [topups, setTopups] = useState([]);
  const [topupsLoading, setTopupsLoading] = useState(true);
  const [topupFilter, setTopupFilter] = useState('all');
  const [selectedTopup, setSelectedTopup] = useState(null);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState('');
  
  // Add Card Modal state
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [searchClientId, setSearchClientId] = useState('');
  const [foundClient, setFoundClient] = useState(null);
  const [searchingClient, setSearchingClient] = useState(false);
  
  // Card details for manual entry (SECURITY: do not store PAN/CVV)
  const [cardDetails, setCardDetails] = useState({
    card_email: '', // Email for the card
    card_brand: '',
    card_type: 'visa',
    card_holder_name: '',
    card_last4: '',
    card_expiry: '',
    billing_address: '',
    billing_city: '',
    billing_country: '',
    billing_zip: '',
    card_image: ''
  });

  const [defaultCardBg, setDefaultCardBg] = useState('');
  const [savingDefaultBg, setSavingDefaultBg] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeDays, setPurgeDays] = useState(30);
  const [purgeProvider, setPurgeProvider] = useState('all');
  const [stwDiag, setStwDiag] = useState(null);
  const [testingStrowallet, setTestingStrowallet] = useState(false);
  const [showDiagModal, setShowDiagModal] = useState(false);

  const getText = useCallback((ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  }, [language]);

  const getErrorMessage = (e) => {
    const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message;
    if (!detail) return getText('Erè', 'Erreur', 'Error');
    if (typeof detail === 'string') return detail;
    try {
      return JSON.stringify(detail, null, 2);
    } catch {
      return String(detail);
    }
  };

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      let url = `${API}/admin/virtual-card-orders`;
      if (orderFilter !== 'all') url += `?status=${orderFilter}`;
      const response = await axios.get(url);
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  }, [orderFilter]);

  // Fetch top-ups
  const fetchTopups = useCallback(async () => {
    setTopupsLoading(true);
    try {
      let url = `${API}/admin/card-topups`;
      if (topupFilter !== 'all') url += `?status=${topupFilter}`;
      const response = await axios.get(url);
      setTopups(response.data.deposits || []);
    } catch (error) {
      console.error('Error fetching top-ups:', error);
    } finally {
      setTopupsLoading(false);
    }
  }, [topupFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchTopups();
  }, [fetchTopups]);

  useEffect(() => {
    (async () => {
      try {
        const s = await axios.get(`${API}/admin/settings`);
        const settings = s.data?.settings || {};
        setStrowalletEnabled(!!settings.strowallet_enabled);
        setCardSettings({
          strowallet_enabled: !!settings.strowallet_enabled,
          strowallet_brand_name: settings.strowallet_brand_name || 'KAYICOM',
          strowallet_api_key: settings.strowallet_api_key || '',
          strowallet_api_secret: settings.strowallet_api_secret || '',
          strowallet_base_url: settings.strowallet_base_url || '',
          strowallet_create_user_path: settings.strowallet_create_user_path || '',
          strowallet_create_card_path: settings.strowallet_create_card_path || '',
          strowallet_fund_card_path: settings.strowallet_fund_card_path || '',
          strowallet_withdraw_card_path: settings.strowallet_withdraw_card_path || '',
          strowallet_fetch_card_detail_path: settings.strowallet_fetch_card_detail_path || '',
          strowallet_card_transactions_path: settings.strowallet_card_transactions_path || '',
          strowallet_mode: settings.strowallet_mode || 'live',
          strowallet_create_card_amount_usd: settings.strowallet_create_card_amount_usd ?? 5,
          strowallet_freeze_unfreeze_path: settings.strowallet_freeze_unfreeze_path || '',
          strowallet_full_card_history_path: settings.strowallet_full_card_history_path || '',
          strowallet_withdraw_status_path: settings.strowallet_withdraw_status_path || '',
          strowallet_upgrade_limit_path: settings.strowallet_upgrade_limit_path || '',
          card_order_fee_htg: typeof settings.card_order_fee_htg === 'number' ? settings.card_order_fee_htg : 500,
          card_background_image: settings.card_background_image || null,
        });
        if (settings.card_background_image) setDefaultCardBg(settings.card_background_image);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const saveDefaultBg = async () => {
    setSavingDefaultBg(true);
    try {
      await axios.put(`${API}/admin/settings`, { card_background_image: defaultCardBg || null });
      toast.success(getText('Imaj pa defo sove!', 'Image par défaut enregistrée!', 'Default image saved!'));
    } catch (e) {
      toast.error(e.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    } finally {
      setSavingDefaultBg(false);
    }
  };

  const saveCardSettings = async () => {
    if (!cardSettings) return;
    setSavingCardSettings(true);
    try {
      const payload = {
        strowallet_enabled: !!cardSettings.strowallet_enabled,
        strowallet_brand_name: cardSettings.strowallet_brand_name || 'KAYICOM',
        strowallet_api_key: cardSettings.strowallet_api_key || null,
        strowallet_api_secret: cardSettings.strowallet_api_secret || null,
        strowallet_base_url: cardSettings.strowallet_base_url || null,
        strowallet_create_user_path: cardSettings.strowallet_create_user_path || null,
        strowallet_create_card_path: cardSettings.strowallet_create_card_path || null,
        strowallet_fund_card_path: cardSettings.strowallet_fund_card_path || null,
        strowallet_withdraw_card_path: cardSettings.strowallet_withdraw_card_path || null,
        strowallet_fetch_card_detail_path: cardSettings.strowallet_fetch_card_detail_path || null,
        strowallet_card_transactions_path: cardSettings.strowallet_card_transactions_path || null,
        strowallet_mode: cardSettings.strowallet_mode || 'live',
        strowallet_create_card_amount_usd: Number.isFinite(Number(cardSettings.strowallet_create_card_amount_usd))
          ? Number(cardSettings.strowallet_create_card_amount_usd)
          : 5,
        strowallet_freeze_unfreeze_path: cardSettings.strowallet_freeze_unfreeze_path || null,
        strowallet_full_card_history_path: cardSettings.strowallet_full_card_history_path || null,
        strowallet_withdraw_status_path: cardSettings.strowallet_withdraw_status_path || null,
        strowallet_upgrade_limit_path: cardSettings.strowallet_upgrade_limit_path || null,
        card_order_fee_htg: Number.isFinite(Number(cardSettings.card_order_fee_htg)) ? Number(cardSettings.card_order_fee_htg) : 500,
        card_background_image: defaultCardBg || null,
      };
      await axios.put(`${API}/admin/settings`, payload);
      setStrowalletEnabled(!!cardSettings.strowallet_enabled);
      toast.success(getText('Paramèt kat yo sove!', 'Paramètres cartes enregistrés!', 'Card settings saved!'));
    } catch (e) {
      toast.error(e.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    } finally {
      setSavingCardSettings(false);
    }
  };

  const applyDefaultEndpoints = async () => {
    setSavingCardSettings(true);
    try {
      const res = await axios.post(`${API}/admin/strowallet/apply-default-endpoints`);
      const s = res.data?.settings || {};
      setCardSettings((prev) => ({
        ...(prev || {}),
        strowallet_base_url: s.strowallet_base_url || 'https://strowallet.com',
        strowallet_create_user_path: s.strowallet_create_user_path || '/api/bitvcard/card-user',
        strowallet_create_card_path: s.strowallet_create_card_path || '/api/bitvcard/create-card/',
        strowallet_fund_card_path: s.strowallet_fund_card_path || '/api/bitvcard/fund-card/',
        strowallet_fetch_card_detail_path: s.strowallet_fetch_card_detail_path || '/api/bitvcard/fetch-card-detail/',
        strowallet_card_transactions_path: s.strowallet_card_transactions_path || '/api/bitvcard/card-transactions/',
        strowallet_mode: s.strowallet_mode || 'live',
        strowallet_create_card_amount_usd: s.strowallet_create_card_amount_usd ?? 5,
        strowallet_freeze_unfreeze_path: s.strowallet_freeze_unfreeze_path || '',
        strowallet_full_card_history_path: s.strowallet_full_card_history_path || '',
        strowallet_withdraw_status_path: s.strowallet_withdraw_status_path || '',
        strowallet_upgrade_limit_path: s.strowallet_upgrade_limit_path || '',
      }));
      toast.success(getText('Default endpoints mete!', 'Endpoints par défaut appliqués!', 'Default endpoints applied!'));
    } catch (e) {
      toast.error(e.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    } finally {
      setSavingCardSettings(false);
    }
  };

  const testStrowallet = async () => {
    setTestingStrowallet(true);
    try {
      const res = await axios.get(`${API}/admin/strowallet/diagnostics`);
      setStwDiag(res.data);
      setShowDiagModal(true);
      const p0 = res.data?.probes?.[0];
      const cls = p0?.classification;
      if (cls === 'auth_error') {
        toast.error(getText('Kle Strowallet yo pa bon (401/403).', 'Clés Strowallet invalides (401/403).', 'Strowallet keys invalid (401/403).'));
      } else if (cls === 'wrong_path_or_base_url') {
        toast.error(getText('Base URL oswa path la pa bon (404).', 'Base URL ou endpoint incorrect (404).', 'Base URL or endpoint incorrect (404).'));
      } else if (cls) {
        toast.success(getText('Dyagnostik pare.', 'Diagnostic prêt.', 'Diagnostics ready.'));
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || getText('Erè dyagnostik', 'Erreur diagnostic', 'Diagnostics error'));
    } finally {
      setTestingStrowallet(false);
    }
  };

  const purgeOldOrders = async () => {
    const ok = window.confirm(getText(
      `Ou prè pou efase kat ki pi ansyen pase ${purgeDays} jou? Sa PA ka retounen.`,
      `Supprimer les cartes plus anciennes que ${purgeDays} jours ? Action irréversible.`,
      `Delete cards older than ${purgeDays} days? This cannot be undone.`
    ));
    if (!ok) return;

    setPurging(true);
    try {
      const providerParam = purgeProvider !== 'all' ? `&provider=${encodeURIComponent(purgeProvider)}` : '';
      const res = await axios.post(`${API}/admin/virtual-card-orders/purge?days=${encodeURIComponent(purgeDays)}&status=approved${providerParam}`);
      toast.success(getText(
        `${res.data?.deleted || 0} kat efase.`,
        `${res.data?.deleted || 0} cartes supprimées.`,
        `Deleted ${res.data?.deleted || 0} cards.`
      ));
      fetchOrders();
    } catch (e) {
      toast.error(e.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    } finally {
      setPurging(false);
    }
  };

  const purgeAllManualApproved = async () => {
    // Convenience: old manual cards may be "recent", so 30-day purge won't remove them.
    // 3650 days is the backend max and effectively means "all history".
    setPurgeProvider('manual');
    setPurgeDays(3650);
    const ok = window.confirm(getText(
      'Ou prè pou efase TOUT kat MANYÈL apwouve yo (tout dat)? Sa PA ka retounen.',
      'Supprimer TOUTES les cartes MANUELLES approuvées (toutes dates) ? Action irréversible.',
      'Delete ALL approved MANUAL cards (all dates)? This cannot be undone.'
    ));
    if (!ok) return;

    setPurging(true);
    try {
      const res = await axios.post(`${API}/admin/virtual-card-orders/purge?days=3650&status=approved&provider=manual`);
      toast.success(getText(
        `${res.data?.deleted || 0} kat manyèl efase.`,
        `${res.data?.deleted || 0} cartes manuelles supprimées.`,
        `Deleted ${res.data?.deleted || 0} manual cards.`
      ));
      fetchOrders();
    } catch (e) {
      toast.error(e.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    } finally {
      setPurging(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCardDetails(prev => ({...prev, card_image: reader.result}));
      };
      reader.readAsDataURL(file);
    }
  };

  // Search for client by ID
  const searchClient = async () => {
    if (!searchClientId.trim()) return;
    setSearchingClient(true);
    setFoundClient(null);
    try {
      const response = await axios.get(`${API}/admin/users?search=${searchClientId}&limit=1`);
      if (response.data.users && response.data.users.length > 0) {
        setFoundClient(response.data.users[0]);
      } else {
        toast.error(getText('Kliyan pa jwenn', 'Client non trouvé', 'Client not found'));
      }
    } catch (error) {
      toast.error(getText('Erè nan rechèch', 'Erreur de recherche', 'Search error'));
    } finally {
      setSearchingClient(false);
    }
  };

  // Create card manually for client
  const createCardManually = async () => {
    if (!foundClient) {
      toast.error(getText('Chwazi yon kliyan', 'Choisissez un client', 'Choose a client'));
      return;
    }
    if (!cardDetails.card_email) {
      toast.error(getText('Antre email kat la', 'Entrez l\'email de la carte', 'Enter card email'));
      return;
    }
    
    setProcessing(true);
    try {
      const payload = {
        user_id: foundClient.user_id,
        client_id: foundClient.client_id,
        card_email: cardDetails.card_email,
        ...cardDetails,
        card_last4: cardDetails.card_last4
      };
      
      await axios.post(`${API}/admin/virtual-card-orders/create-manual`, payload);
      toast.success(getText('Kat kreye avèk siksè!', 'Carte créée avec succès!', 'Card created successfully!'));
      setShowAddCardModal(false);
      resetAddCardForm();
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || getText('Erè nan kreyasyon', 'Erreur de création', 'Creation error'));
    } finally {
      setProcessing(false);
    }
  };

  const resetAddCardForm = () => {
    setSearchClientId('');
    setFoundClient(null);
    setCardDetails({
      card_email: '',
      card_brand: '',
      card_type: 'visa',
      card_holder_name: '',
      card_last4: '',
      card_expiry: '',
      billing_address: '',
      billing_city: '',
      billing_country: '',
      billing_zip: '',
      card_image: defaultCardBg || ''
    });
  };

  // Process order (approve/reject)
  const handleProcessOrder = async (action) => {
    setProcessing(true);
    try {
      const shouldAutoIssue =
        action === 'approve' &&
        !!strowalletEnabled &&
        !!autoIssueStrowallet;

      // If auto-issuing via Strowallet, do NOT send manual card details.
      // Backend will create the card via Strowallet and populate details automatically.
      const payload = shouldAutoIssue
        ? { action, admin_notes: adminNotes }
        : {
          action,
          admin_notes: adminNotes,
          ...cardDetails,
          card_last4: cardDetails.card_last4,
        };
      
      await axios.patch(`${API}/admin/virtual-card-orders/${selectedOrder.order_id}`, payload);
      toast.success(action === 'approve' 
        ? getText('Komand kat apwouve!', 'Commande carte approuvée!', 'Card order approved!') 
        : getText('Komand kat rejte.', 'Commande carte rejetée.', 'Card order rejected.'));
      setShowOrderModal(false);
      resetOrderForm();
      fetchOrders();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProcessing(false);
    }
  };

  // Process top-up (approve/reject)
  const handleProcessTopup = async (action) => {
    setProcessing(true);
    try {
      const payload = {
        action,
        admin_notes: adminNotes,
        delivery_info: deliveryInfo
      };
      
      await axios.patch(`${API}/admin/card-topups/${selectedTopup.deposit_id}`, payload);
      toast.success(action === 'approve' 
        ? getText('Top-up livere sou kat!', 'Recharge livrée sur carte!', 'Top-up delivered to card!') 
        : getText('Top-up rejte. Kob ranbouse.', 'Recharge rejetée. Montant remboursé.', 'Top-up rejected. Amount refunded.'));
      setShowTopupModal(false);
      setAdminNotes('');
      setDeliveryInfo('');
      fetchTopups();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProcessing(false);
    }
  };

  const resetOrderForm = () => {
    setAdminNotes('');
    setCardDetails({
      card_email: '',
      card_brand: '',
      card_type: 'visa',
      card_holder_name: '',
      card_last4: '',
      card_expiry: '',
      billing_address: '',
      billing_city: '',
      billing_country: '',
      billing_zip: '',
      card_image: defaultCardBg || ''
    });
  };

  const openOrderModal = (order) => {
    setSelectedOrder(order);
    setAdminNotes(order.admin_notes || '');
    // Default to auto-issue if Strowallet is enabled and the order isn't already a provider card.
    setAutoIssueStrowallet(!!strowalletEnabled && (order?.provider !== 'strowallet'));
    setCardDetails({
      card_email: order.card_email || '',
      card_brand: order.card_brand || '',
      card_type: order.card_type || 'visa',
      card_holder_name: order.card_holder_name || '',
      card_last4: order.card_last4 || '',
      card_expiry: order.card_expiry || '',
      billing_address: order.billing_address || '',
      billing_city: order.billing_city || '',
      billing_country: order.billing_country || '',
      billing_zip: order.billing_zip || '',
      card_image: order.card_image || defaultCardBg || ''
    });
    setShowOrderModal(true);
  };

  const openTopupModal = (topup) => {
    setSelectedTopup(topup);
    setAdminNotes(topup.admin_notes || '');
    setDeliveryInfo(topup.delivery_info || '');
    setShowTopupModal(true);
  };

  const updateApprovedOrderDetails = async () => {
    if (!selectedOrder) return;
    setProcessing(true);
    try {
      await axios.patch(`${API}/admin/virtual-card-orders/${selectedOrder.order_id}/details`, {
        ...cardDetails,
        admin_notes: adminNotes
      });
      toast.success(getText('Kat mete ajou', 'Carte mise à jour', 'Card updated'));
      setShowOrderModal(false);
      fetchOrders();
    } catch (e) {
      toast.error(e.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    } finally {
      setProcessing(false);
    }
  };

  const deleteOrder = async () => {
    if (!selectedOrder) return;
    const ok = window.confirm(getText(
      'Ou prè pou efase kat sa a? Sa PA ka retounen.',
      'Supprimer cette carte ? Action irréversible.',
      'Delete this card? This cannot be undone.'
    ));
    if (!ok) return;
    setProcessing(true);
    try {
      await axios.delete(`${API}/admin/virtual-card-orders/${selectedOrder.order_id}`);
      toast.success(getText('Kat efase', 'Carte supprimée', 'Card deleted'));
      setShowOrderModal(false);
      fetchOrders();
    } catch (e) {
      toast.error(e.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    } finally {
      setProcessing(false);
    }
  };

  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const pendingTopupsCount = topups.filter(t => t.status === 'pending').length;

  return (
    <AdminLayout title={getText('Jesyon Kat Vityèl', 'Gestion Cartes Virtuelles', 'Virtual Card Management')}>
      <div className="space-y-6" data-testid="admin-virtual-cards">
        {/* Quick Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard size={20} className="text-[#EA580C]" />
                {getText('Paramèt Kat', 'Paramètres Carte', 'Card Settings')}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Strowallet configuration (moved here for clarity) */}
            <div className="border rounded-xl p-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-purple-800 dark:text-purple-200">
                    {getText('Kat Vityèl (Strowallet)', 'Cartes Virtuelles (Strowallet)', 'Virtual Cards (Strowallet)')}
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                    {getText(
                      'Se isit la ou mete kle yo ak aktive otomatik kreyasyon kat la.',
                      'Configurez ici les clés et l’activation auto-émission.',
                      'Configure keys here and enable auto-issuing.'
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={cardSettings?.strowallet_enabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCardSettings((s) => (s ? { ...s, strowallet_enabled: !s.strowallet_enabled } : s))}
                  className={cardSettings?.strowallet_enabled ? 'bg-purple-600 hover:bg-purple-700' : ''}
                >
                  {cardSettings?.strowallet_enabled ? getText('Aktive', 'Activé', 'Enabled') : getText('Dezaktive', 'Désactivé', 'Disabled')}
                </Button>
              </div>

              {cardSettings?.strowallet_enabled ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <Label>{getText('Non mak (branding)', 'Nom de marque (branding)', 'Brand name (branding)')}</Label>
                    <Input
                      value={cardSettings.strowallet_brand_name || ''}
                      onChange={(e) => setCardSettings({ ...cardSettings, strowallet_brand_name: e.target.value })}
                      className="mt-1"
                      placeholder="KAYICOM"
                    />
                    <p className="text-xs text-stone-500 mt-1">
                      {getText(
                        'Sa se non ki ap parèt sou kat la nan app la.',
                        'Nom affiché sur la carte dans l’app.',
                        'Name shown on the card in the app.'
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        value={cardSettings.strowallet_api_key || ''}
                        onChange={(e) => setCardSettings({ ...cardSettings, strowallet_api_key: e.target.value })}
                        className="mt-1 font-mono text-sm"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <Label>API Secret</Label>
                      <Input
                        type="password"
                        value={cardSettings.strowallet_api_secret || ''}
                        onChange={(e) => setCardSettings({ ...cardSettings, strowallet_api_secret: e.target.value })}
                        className="mt-1 font-mono text-sm"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <details className="rounded-lg border border-purple-200 dark:border-purple-800 p-3 bg-white/60 dark:bg-stone-900/20">
                    <summary className="cursor-pointer text-sm font-medium">
                      {getText('Avanse (Base URL & endpoints)', 'Avancé (Base URL & endpoints)', 'Advanced (Base URL & endpoints)')}
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={applyDefaultEndpoints}
                          disabled={savingCardSettings}
                          className="border-purple-300 text-purple-700 hover:bg-purple-50"
                        >
                          {getText('Default endpoints', 'Endpoints par défaut', 'Default endpoints')}
                        </Button>
                        <span className="text-xs text-stone-500 self-center">
                          {getText(
                            'Sa ap ranplase endpoints yo otomatikman (bitvcard).',
                            'Remplace automatiquement les endpoints (bitvcard).',
                            'Automatically sets the correct bitvcard endpoints.'
                          )}
                        </span>
                      </div>
                      <div>
                        <Label>Base URL</Label>
                        <Input
                          value={cardSettings.strowallet_base_url || ''}
                          onChange={(e) => setCardSettings({ ...cardSettings, strowallet_base_url: e.target.value })}
                          className="mt-1 font-mono text-sm"
                          placeholder="https://strowallet.com"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                          <Label>{getText('Mode', 'Mode', 'Mode')}</Label>
                          <Select
                            value={cardSettings.strowallet_mode || 'live'}
                            onValueChange={(v) => setCardSettings({ ...cardSettings, strowallet_mode: v })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="live">live</SelectItem>
                              <SelectItem value="sandbox">sandbox</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-stone-500 mt-1">
                            {getText(
                              'Si Strowallet kont ou se sandbox, mete sandbox isit la.',
                              'Si votre compte Strowallet est sandbox, choisissez sandbox.',
                              'If your Strowallet account is sandbox, choose sandbox.'
                            )}
                          </p>
                        </div>
                        <div>
                          <Label>{getText('Default amount (USD)', 'Montant par défaut (USD)', 'Default amount (USD)')}</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={cardSettings.strowallet_create_card_amount_usd ?? 5}
                            onChange={(e) => setCardSettings({ ...cardSettings, strowallet_create_card_amount_usd: e.target.value })}
                            className="mt-1"
                          />
                          <p className="text-xs text-stone-500 mt-1">
                            {getText(
                              'Strowallet create-card mande amount. Mete valè default la isit la (egzanp 5).',
                              'Le create-card demande amount. Mettez une valeur par défaut ici (ex: 5).',
                              'create-card requires amount. Set a default here (e.g., 5).'
                            )}
                          </p>
                        </div>
                        <div>
                          <Label>Create card customer</Label>
                          <Input
                            value={cardSettings.strowallet_create_user_path || ''}
                            onChange={(e) => setCardSettings({ ...cardSettings, strowallet_create_user_path: e.target.value })}
                            className="mt-1 font-mono text-sm"
                            placeholder="/api/bitvcard/card-user"
                          />
                        </div>
                        <div>
                          <Label>Create card</Label>
                          <Input
                            value={cardSettings.strowallet_create_card_path || ''}
                            onChange={(e) => setCardSettings({ ...cardSettings, strowallet_create_card_path: e.target.value })}
                            className="mt-1 font-mono text-sm"
                            placeholder="/api/bitvcard/create-card/"
                          />
                        </div>
                        <div>
                          <Label>Fund card</Label>
                          <Input
                            value={cardSettings.strowallet_fund_card_path || ''}
                            onChange={(e) => setCardSettings({ ...cardSettings, strowallet_fund_card_path: e.target.value })}
                            className="mt-1 font-mono text-sm"
                            placeholder="/api/bitvcard/fund-card/"
                          />
                        </div>
                        <div>
                          <Label>Withdraw (optional)</Label>
                          <Input
                            value={cardSettings.strowallet_withdraw_card_path || ''}
                            onChange={(e) => setCardSettings({ ...cardSettings, strowallet_withdraw_card_path: e.target.value })}
                            className="mt-1 font-mono text-sm"
                            placeholder="/api/bitvcard/withdraw-card/"
                          />
                        </div>
                        <div>
                          <Label>Fetch card detail</Label>
                          <Input
                            value={cardSettings.strowallet_fetch_card_detail_path || ''}
                            onChange={(e) => setCardSettings({ ...cardSettings, strowallet_fetch_card_detail_path: e.target.value })}
                            className="mt-1 font-mono text-sm"
                            placeholder="/api/bitvcard/fetch-card-detail/"
                          />
                        </div>
                        <div>
                          <Label>Card transactions</Label>
                          <Input
                            value={cardSettings.strowallet_card_transactions_path || ''}
                            onChange={(e) => setCardSettings({ ...cardSettings, strowallet_card_transactions_path: e.target.value })}
                            className="mt-1 font-mono text-sm"
                            placeholder="/api/bitvcard/card-transactions/"
                          />
                        </div>
                        <div>
                          <Label>Freeze/Unfreeze (single endpoint)</Label>
                          <Input
                            value={cardSettings.strowallet_freeze_unfreeze_path || ''}
                            onChange={(e) => setCardSettings({ ...cardSettings, strowallet_freeze_unfreeze_path: e.target.value })}
                            className="mt-1 font-mono text-sm"
                            placeholder="/api/bitvcard/freezeunfreeze/ (if provided)"
                          />
                        </div>
                        <div>
                          <Label>Full card history</Label>
                          <Input
                            value={cardSettings.strowallet_full_card_history_path || ''}
                            onChange={(e) => setCardSettings({ ...cardSettings, strowallet_full_card_history_path: e.target.value })}
                            className="mt-1 font-mono text-sm"
                            placeholder="/api/bitvcard/full-card-history/ (if provided)"
                          />
                        </div>
                        <div>
                          <Label>Withdraw status</Label>
                          <Input
                            value={cardSettings.strowallet_withdraw_status_path || ''}
                            onChange={(e) => setCardSettings({ ...cardSettings, strowallet_withdraw_status_path: e.target.value })}
                            className="mt-1 font-mono text-sm"
                            placeholder="/api/bitvcard/withdraw-status/ (if provided)"
                          />
                        </div>
                        <div>
                          <Label>Upgrade card limit</Label>
                          <Input
                            value={cardSettings.strowallet_upgrade_limit_path || ''}
                            onChange={(e) => setCardSettings({ ...cardSettings, strowallet_upgrade_limit_path: e.target.value })}
                            className="mt-1 font-mono text-sm"
                            placeholder="/api/bitvcard/upgrade-card-limit/ (if provided)"
                          />
                        </div>
                      </div>
                    </div>
                  </details>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={testStrowallet}
                      disabled={testingStrowallet}
                      className="border-purple-300 text-purple-700 hover:bg-purple-50"
                    >
                      {testingStrowallet ? getText('Ap teste...', 'Test...', 'Testing...') : getText('Teste Strowallet', 'Tester Strowallet', 'Test Strowallet')}
                    </Button>
                    <p className="text-xs text-stone-500 self-center">
                      {getText(
                        'Sa ap montre si kle yo ok (401/403), path/base ok (404), oswa payload manke (400/422).',
                        'Indique si clés OK (401/403), endpoint OK (404), ou payload manquant (400/422).',
                        'Shows if keys are OK (401/403), endpoint OK (404), or payload missing (400/422).'
                      )}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{getText('Frè komand kat (HTG)', 'Frais commande carte (HTG)', 'Card order fee (HTG)')}</Label>
                <Input
                  type="number"
                  value={cardSettings?.card_order_fee_htg ?? 500}
                  onChange={(e) => setCardSettings((s) => (s ? { ...s, card_order_fee_htg: parseInt(e.target.value || '500') } : s))}
                  className="w-48"
                  min="0"
                />
                <p className="text-xs text-stone-500">
                  {getText(
                    'Sa se frè kliyan an peye lè li komande yon kat.',
                    'Frais payé par le client lors de la commande.',
                    'Fee paid by the client when ordering a card.'
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{getText('Imaj fon kat pa defo', 'Image de fond par défaut', 'Default card background')}</Label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onloadend = () => setDefaultCardBg(reader.result);
                    reader.readAsDataURL(f);
                  }}
                />
                {defaultCardBg && (
                  <div className="border rounded-xl p-3 bg-stone-50 dark:bg-stone-800">
                    <img src={defaultCardBg} alt="Default" className="max-h-40 rounded-lg mx-auto" />
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={saveDefaultBg} disabled={savingDefaultBg} className="bg-[#EA580C]">
                    <Save size={16} className="mr-2" />
                    {savingDefaultBg ? getText('Ap sove...', 'Sauvegarde...', 'Saving...') : getText('Sove', 'Enregistrer', 'Save')}
                  </Button>
                  <Button variant="outline" onClick={() => setDefaultCardBg('')}>
                    {getText('Retire', 'Retirer', 'Remove')}
                  </Button>
                </div>
                <p className="text-xs text-stone-500">
                  {getText(
                    'Sa se yon sèl imaj pa defo pou tout kat. Si ou pa mete imaj pou yon kat, li pran sa a.',
                    'Image par défaut pour toutes les cartes. Si vous ne mettez pas d’image, elle sera utilisée.',
                    'Default image for all cards. If you don’t set a card image, this one is used.'
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{getText('Efase ansyen kat apwouve yo', 'Supprimer anciennes cartes approuvées', 'Delete old approved cards')}</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    value={purgeDays}
                    onChange={(e) => setPurgeDays(parseInt(e.target.value || '30'))}
                    className="w-32"
                    min="1"
                  />
                  <span className="text-sm text-stone-500">{getText('jou', 'jours', 'days')}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <Label className="text-xs text-stone-500">{getText('Provider', 'Provider', 'Provider')}</Label>
                  <Select value={purgeProvider} onValueChange={setPurgeProvider}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{getText('Tout', 'Tous', 'All')}</SelectItem>
                      <SelectItem value="manual">{getText('Manyèl', 'Manuel', 'Manual')}</SelectItem>
                      <SelectItem value="strowallet">Strowallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-stone-500">
                  {getText(
                    'Sa ap efase kat apwouve ki pi ansyen pase kantite jou a. Ou ka limite sou Manyèl oswa Strowallet. Ireversib.',
                    'Supprime les cartes approuvées plus anciennes que ce nombre de jours. Filtrable (Manuel/Strowallet). Irréversible.',
                    'Deletes approved cards older than this many days. You can filter (Manual/Strowallet). Irreversible.'
                  )}
                </p>
                <Button variant="destructive" onClick={purgeOldOrders} disabled={purging}>
                  <Trash2 size={16} className="mr-2" />
                  {purging ? getText('Ap efase...', 'Suppression...', 'Deleting...') : getText('Efase ansyen kat yo', 'Supprimer', 'Delete old cards')}
                </Button>

                <Button variant="outline" onClick={purgeAllManualApproved} disabled={purging} className="border-red-200 text-red-700 hover:bg-red-50">
                  <Trash2 size={16} className="mr-2" />
                  {getText('Netwaye TOUT kat manyèl', 'Nettoyer TOUTES cartes manuelles', 'Clean ALL manual cards')}
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={saveCardSettings} disabled={savingCardSettings} className="bg-purple-600 hover:bg-purple-700 text-white">
                <Save size={16} className="mr-2" />
                {savingCardSettings ? getText('Ap sove...', 'Sauvegarde...', 'Saving...') : getText('Sove paramèt kat yo', 'Enregistrer paramètres', 'Save card settings')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Diagnostics modal */}
        <Dialog open={showDiagModal} onOpenChange={setShowDiagModal}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{getText('Dyagnostik Strowallet', 'Diagnostic Strowallet', 'Strowallet Diagnostics')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-stone-500">
                {getText(
                  'Nòt: rapò sa a pa montre kle yo; li montre sèlman status code + repons Strowallet la.',
                  'Note: ce rapport ne montre pas les clés; seulement status code + réponse.',
                  'Note: this report does not show keys; only status codes + responses.'
                )}
              </p>
              <pre className="text-xs whitespace-pre-wrap bg-stone-50 dark:bg-stone-900 border rounded-lg p-3 overflow-x-auto">
                {stwDiag ? JSON.stringify(stwDiag, null, 2) : ''}
              </pre>
              <Button variant="outline" onClick={() => setShowDiagModal(false)}>
                {getText('Fèmen', 'Fermer', 'Close')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-amber-50 dark:bg-amber-900/30">
            <CardContent className="p-4 text-center">
              <p className="text-amber-800 dark:text-amber-300 font-bold text-2xl">{pendingOrdersCount}</p>
              <p className="text-amber-600 dark:text-amber-400 text-sm">{getText('Komand an atant', 'Commandes en attente', 'Pending Orders')}</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 dark:bg-blue-900/30">
            <CardContent className="p-4 text-center">
              <p className="text-blue-800 dark:text-blue-300 font-bold text-2xl">{pendingTopupsCount}</p>
              <p className="text-blue-600 dark:text-blue-400 text-sm">{getText('Top-up an atant', 'Recharges en attente', 'Pending Top-ups')}</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 dark:bg-emerald-900/30">
            <CardContent className="p-4 text-center">
              <p className="text-emerald-800 dark:text-emerald-300 font-bold text-2xl">{orders.filter(o => o.status === 'approved').length}</p>
              <p className="text-emerald-600 dark:text-emerald-400 text-sm">{getText('Kat Aktif', 'Cartes Actives', 'Active Cards')}</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 dark:bg-purple-900/30">
            <CardContent className="p-4 text-center">
              <p className="text-purple-800 dark:text-purple-300 font-bold text-2xl">${topups.filter(t => t.status === 'approved').reduce((sum, t) => sum + (t.net_amount ?? t.amount ?? 0), 0).toFixed(0)}</p>
              <p className="text-purple-600 dark:text-purple-400 text-sm">{getText('Total Livere', 'Total Livré', 'Total Delivered')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Add Card Button (manual-only, hidden when Strowallet automation is enabled) */}
        {!strowalletEnabled && (
          <div className="flex justify-end">
            <Button onClick={() => setShowAddCardModal(true)} className="bg-emerald-500 hover:bg-emerald-600">
              <Plus size={18} className="mr-2" />
              {getText('Ajoute Kat Manyèl', 'Ajouter Carte Manuellement', 'Add Card Manually')}
            </Button>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <CreditCard size={16} />
              {getText('Komand Kat', 'Commandes', 'Card Orders')}
              {pendingOrdersCount > 0 && (
                <Badge className="bg-amber-500 text-white ml-1">{pendingOrdersCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="topups" className="flex items-center gap-2">
              <Wallet size={16} />
              {getText('Top-up Kat', 'Recharges', 'Card Top-ups')}
              {pendingTopupsCount > 0 && (
                <Badge className="bg-blue-500 text-white ml-1">{pendingTopupsCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CreditCard size={20} className="text-[#EA580C]" />
                    {getText('Komand Kat', 'Commandes de cartes', 'Card Orders')}
                  </span>
                  <div className="flex gap-2">
                    {['pending', 'approved', 'rejected', 'all'].map((f) => (
                      <Button
                        key={f}
                        variant={orderFilter === f ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setOrderFilter(f)}
                        className={orderFilter === f ? 'bg-[#EA580C]' : ''}
                      >
                        {f === 'pending' ? getText('An atant', 'En attente', 'Pending') : 
                         f === 'approved' ? getText('Apwouve', 'Approuvé', 'Approved') : 
                         f === 'rejected' ? getText('Rejte', 'Rejeté', 'Rejected') : 
                         getText('Tout', 'Tous', 'All')}
                      </Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={fetchOrders}>
                      <RefreshCw size={16} />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Email Kat</th>
                        <th>{getText('Provider', 'Provider', 'Provider')}</th>
                        <th>{getText('Mak', 'Marque', 'Brand')}</th>
                        <th>{getText('Frè', 'Frais', 'Fee')}</th>
                        <th>Date</th>
                        <th>{getText('Statis', 'Statut', 'Status')}</th>
                        <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersLoading ? (
                        <tr><td colSpan="8" className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</td></tr>
                      ) : orders.length === 0 ? (
                        <tr><td colSpan="8" className="text-center py-8">{getText('Pa gen komand', 'Aucune commande', 'No orders')}</td></tr>
                      ) : (
                        orders.map((order) => (
                          <tr key={order.order_id}>
                            <td>
                              <div className="min-w-[180px]">
                                <div className="font-semibold text-stone-900 dark:text-white">
                                  {order.user_full_name || order.client_id}
                                </div>
                                {order.user_email ? (
                                  <div className="text-xs text-stone-500 break-all">{order.user_email}</div>
                                ) : null}
                                <div className="text-xs font-mono text-stone-500">{order.client_id}</div>
                              </div>
                            </td>
                            <td>{order.card_email}</td>
                            <td>
                              {order.provider === 'strowallet' ? (
                                <Badge className="bg-purple-100 text-purple-700">Strowallet</Badge>
                              ) : (
                                <Badge className="bg-stone-100 text-stone-700">{getText('Manyèl', 'Manuel', 'Manual')}</Badge>
                              )}
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                {order.card_type && (
                                  <img src={order.card_type === 'mastercard' ? MASTERCARD_LOGO : VISA_LOGO} alt="" className="h-5 w-auto" />
                                )}
                                {order.card_brand || '-'}
                              </div>
                            </td>
                            <td className="font-semibold">G {order.fee?.toLocaleString()}</td>
                            <td>{new Date(order.created_at).toLocaleDateString()}</td>
                            <td>
                              <Badge className={
                                order.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                order.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }>
                                {order.status === 'pending' ? getText('An atant', 'En attente', 'Pending') : 
                                 order.status === 'approved' ? getText('Apwouve', 'Approuvé', 'Approved') : 
                                 getText('Rejte', 'Rejeté', 'Rejected')}
                              </Badge>
                            </td>
                            <td>
                              <Button size="sm" variant="outline" onClick={() => openOrderModal(order)}>
                                <Eye size={16} className="mr-1" />
                                {getText('Wè', 'Voir', 'View')}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top-ups Tab */}
          <TabsContent value="topups">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Wallet size={20} className="text-blue-500" />
                    {getText('Top-up Kat', 'Recharges de cartes', 'Card Top-ups')}
                  </span>
                  <div className="flex gap-2">
                    {['pending', 'approved', 'rejected', 'all'].map((f) => (
                      <Button
                        key={f}
                        variant={topupFilter === f ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTopupFilter(f)}
                        className={topupFilter === f ? 'bg-blue-500' : ''}
                      >
                        {f === 'pending' ? getText('An atant', 'En attente', 'Pending') : 
                         f === 'approved' ? getText('Apwouve', 'Approuvé', 'Approved') : 
                         f === 'rejected' ? getText('Rejte', 'Rejeté', 'Rejected') : 
                         getText('Tout', 'Tous', 'All')}
                      </Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={fetchTopups}>
                      <RefreshCw size={16} />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>{getText('Kat', 'Carte', 'Card')}</th>
                        <th>{getText('Montan', 'Montant', 'Amount')}</th>
                        <th>{getText('Frè', 'Frais', 'Fee')}</th>
                        <th>{getText('Total debite', 'Total débité', 'Total deducted')}</th>
                        <th>Date</th>
                        <th>{getText('Statis', 'Statut', 'Status')}</th>
                        <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topupsLoading ? (
                        <tr><td colSpan="8" className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</td></tr>
                      ) : topups.length === 0 ? (
                        <tr><td colSpan="8" className="text-center py-8">{getText('Pa gen top-up', 'Aucune recharge', 'No top-ups')}</td></tr>
                      ) : (
                        topups.map((topup) => (
                          <tr key={topup.deposit_id}>
                            <td className="font-mono text-sm">{topup.client_id}</td>
                            <td>
                              <div>
                                <p className="font-medium">{topup.card_brand || 'Card'} •••• {topup.card_last4 || '****'}</p>
                                <p className="text-xs text-stone-500">{topup.card_email}</p>
                              </div>
                            </td>
                            <td className="font-semibold">${topup.amount?.toFixed(2)}</td>
                            <td className="text-amber-700">${topup.fee?.toFixed(2)}</td>
                            <td className="font-semibold text-[#EA580C]">${(topup.total_amount ?? ((topup.amount || 0) + (topup.fee || 0))).toFixed(2)}</td>
                            <td>{new Date(topup.created_at).toLocaleDateString()}</td>
                            <td>
                              <Badge className={
                                topup.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                topup.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }>
                                {topup.status === 'pending' ? getText('An atant', 'En attente', 'Pending') : 
                                 topup.status === 'approved' ? getText('Livere', 'Livré', 'Delivered') : 
                                 getText('Rejte', 'Rejeté', 'Rejected')}
                              </Badge>
                            </td>
                            <td>
                              <Button size="sm" variant="outline" onClick={() => openTopupModal(topup)}>
                                <Eye size={16} className="mr-1" />
                                {getText('Wè', 'Voir', 'View')}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Order Modal */}
        <Dialog open={showOrderModal} onOpenChange={setShowOrderModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="text-[#EA580C]" />
                {getText('Detay Komand Kat', 'Détails Commande Carte', 'Card Order Details')}
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                {/* Order Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-stone-50 dark:bg-stone-800 rounded-xl">
                  <div>
                    <p className="text-sm text-stone-500">{getText('ID Kliyan', 'ID Client', 'Client ID')}</p>
                    <p className="font-mono">{selectedOrder.client_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">{getText('Frè', 'Frais', 'Fee')}</p>
                    <p className="font-semibold">G {selectedOrder.fee?.toLocaleString()}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-stone-500">{getText('Email pou kat la', 'Email pour la carte', 'Email for card')}</p>
                    <p className="font-medium text-[#EA580C]">{selectedOrder.card_email}</p>
                  </div>
                </div>

                {selectedOrder.status === 'pending' && (
                  <>
                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>{getText('Nòt:', 'Note:', 'Note:')}</strong> {getText(
                          'Lè ou apwouve, kliyan an ap resevwa kat la. Lè ou rejte, lajan frè a ap ranbouse.',
                          'Lors de l\'approbation, le client recevra la carte. En cas de rejet, les frais seront remboursés.',
                          'When approved, the client will receive the card. If rejected, the fees will be refunded.'
                        )}
                      </p>
                    </div>

                    {/* Strowallet auto-issue option */}
                    {strowalletEnabled && (
                      <div className="border rounded-xl p-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-purple-800 dark:text-purple-200">
                              {getText('Auto-issue via Strowallet', 'Auto-émission via Strowallet', 'Auto-issue via Strowallet')}
                            </p>
                            <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                              {getText(
                                'Si ou aktive sa, ou PA bezwen antre nimewo kat/CVV; sistèm nan ap kreye kat la otomatikman.',
                                'Si activé, vous n’avez PAS besoin de saisir le numéro/CVV; le système créera la carte automatiquement.',
                                'If enabled, you do NOT need to enter card number/CVV; the system will create the card automatically.'
                              )}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant={autoIssueStrowallet ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setAutoIssueStrowallet((v) => !v)}
                            className={autoIssueStrowallet ? 'bg-purple-600 hover:bg-purple-700' : ''}
                          >
                            {autoIssueStrowallet ? getText('Aktive', 'Activé', 'Enabled') : getText('Dezaktive', 'Désactivé', 'Disabled')}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Card Details Form */}
                    <div className={`border rounded-xl p-4 space-y-4 ${strowalletEnabled && autoIssueStrowallet ? 'opacity-50 pointer-events-none' : ''}`}>
                      <h4 className="font-semibold flex items-center gap-2">
                        <CreditCard size={18} />
                        {getText('Enfòmasyon Kat la', 'Informations de la Carte', 'Card Information')}
                      </h4>

                      {/* Card Email */}
                      <div>
                        <Label className="text-[#EA580C]">{getText('Email Kat la', 'Email de la Carte', 'Card Email')}</Label>
                        <Input 
                          placeholder="card@email.com" 
                          value={cardDetails.card_email || selectedOrder?.card_email || ''} 
                          onChange={(e) => setCardDetails({...cardDetails, card_email: e.target.value})} 
                          className="mt-1" 
                          type="email"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>{getText('Mak Kat', 'Marque', 'Brand')}</Label>
                          <Input placeholder="Wise, Payoneer" value={cardDetails.card_brand} onChange={(e) => setCardDetails({...cardDetails, card_brand: e.target.value})} className="mt-1" />
                        </div>
                        <div>
                          <Label>{getText('Tip Kat', 'Type', 'Type')}</Label>
                          <Select value={cardDetails.card_type} onValueChange={(v) => setCardDetails({...cardDetails, card_type: v})}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="visa">Visa</SelectItem>
                              <SelectItem value="mastercard">Mastercard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label>{getText('Non sou Kat', 'Nom sur Carte', 'Name on Card')}</Label>
                        <Input value={cardDetails.card_holder_name} onChange={(e) => setCardDetails({...cardDetails, card_holder_name: e.target.value.toUpperCase()})} className="mt-1 uppercase" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>{getText('Dènye 4 chif', '4 derniers chiffres', 'Last 4 digits')}</Label>
                          <Input
                            value={cardDetails.card_last4}
                            onChange={(e) => setCardDetails({ ...cardDetails, card_last4: e.target.value })}
                            className="mt-1 font-mono"
                            maxLength={4}
                            placeholder="1234"
                          />
                        </div>
                        <div>
                          <Label>{getText('Ekspire', 'Expire', 'Expiry')}</Label>
                          <Input
                            placeholder="MM/YY"
                            value={cardDetails.card_expiry}
                            onChange={(e) => setCardDetails({ ...cardDetails, card_expiry: e.target.value })}
                            className="mt-1"
                            maxLength={5}
                          />
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h5 className="font-medium mb-3">{getText('Adrès Faktirasyon', 'Adresse Facturation', 'Billing Address')}</h5>
                        <div className="space-y-3">
                          <Input placeholder={getText('Adrès', 'Adresse', 'Address')} value={cardDetails.billing_address} onChange={(e) => setCardDetails({...cardDetails, billing_address: e.target.value})} />
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Input placeholder={getText('Vil', 'Ville', 'City')} value={cardDetails.billing_city} onChange={(e) => setCardDetails({...cardDetails, billing_city: e.target.value})} />
                            <Input placeholder={getText('Peyi', 'Pays', 'Country')} value={cardDetails.billing_country} onChange={(e) => setCardDetails({...cardDetails, billing_country: e.target.value})} />
                            <Input placeholder="ZIP" value={cardDetails.billing_zip} onChange={(e) => setCardDetails({...cardDetails, billing_zip: e.target.value})} />
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <Label>{getText('Imaj Kat', 'Image Carte', 'Card Image')}</Label>
                        <div className="mt-2 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer" onClick={() => document.getElementById('card-image-upload').click()}>
                          {cardDetails.card_image ? (
                            <img src={cardDetails.card_image} alt="Card" className="max-h-32 mx-auto rounded-lg" />
                          ) : (
                            <><Upload className="mx-auto text-stone-400 mb-2" size={32} /><p className="text-stone-500">{getText('Klike pou telechaje', 'Cliquez pour télécharger', 'Click to upload')}</p></>
                          )}
                        </div>
                        <input id="card-image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </div>
                    </div>

                    <div>
                      <Label>{getText('Nòt Admin', 'Notes Admin', 'Admin Notes')}</Label>
                      <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} className="mt-1" />
                    </div>

                    <div className="flex gap-4 pt-4 border-t">
                      <Button onClick={() => handleProcessOrder('approve')} disabled={processing} className="flex-1 bg-emerald-500 hover:bg-emerald-600">
                        <Check size={18} className="mr-2" />{getText('Apwouve', 'Approuver', 'Approve')}
                      </Button>
                      <Button onClick={() => handleProcessOrder('reject')} disabled={processing} variant="destructive" className="flex-1">
                        <X size={18} className="mr-2" />{getText('Rejte', 'Rejeter', 'Reject')}
                      </Button>
                    </div>
                  </>
                )}

                {selectedOrder.status !== 'pending' && selectedOrder.admin_notes && (
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-lg p-3">
                    <p className="text-sm text-stone-500 mb-1">{getText('Nòt Admin', 'Notes Admin', 'Admin Notes')}</p>
                    <p>{selectedOrder.admin_notes}</p>
                  </div>
                )}

                {selectedOrder.status !== 'pending' && (
                  <>
                    {/* Edit / Update */}
                    <div className="border rounded-xl p-4 space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <CreditCard size={18} />
                        {getText('Modifye kat la', 'Modifier la carte', 'Edit card')}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>{getText('Mak Kat', 'Marque', 'Brand')}</Label>
                          <Input value={cardDetails.card_brand} onChange={(e) => setCardDetails({ ...cardDetails, card_brand: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                          <Label>{getText('Tip Kat', 'Type', 'Type')}</Label>
                          <Select value={cardDetails.card_type} onValueChange={(v) => setCardDetails({ ...cardDetails, card_type: v })}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="visa">Visa</SelectItem>
                              <SelectItem value="mastercard">Mastercard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label>{getText('Non sou Kat', 'Nom sur Carte', 'Name on Card')}</Label>
                        <Input value={cardDetails.card_holder_name} onChange={(e) => setCardDetails({ ...cardDetails, card_holder_name: e.target.value.toUpperCase() })} className="mt-1 uppercase" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>{getText('Dènye 4 chif', '4 derniers chiffres', 'Last 4 digits')}</Label>
                          <Input
                            value={cardDetails.card_last4}
                            onChange={(e) => setCardDetails({ ...cardDetails, card_last4: e.target.value })}
                            className="mt-1 font-mono"
                            maxLength={4}
                            placeholder="1234"
                          />
                        </div>
                        <div>
                          <Label>{getText('Ekspire', 'Expire', 'Expiry')}</Label>
                          <Input
                            placeholder="MM/YY"
                            value={cardDetails.card_expiry}
                            onChange={(e) => setCardDetails({ ...cardDetails, card_expiry: e.target.value })}
                            className="mt-1"
                            maxLength={5}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>{getText('Nòt Admin', 'Notes Admin', 'Admin Notes')}</Label>
                        <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} className="mt-1" />
                      </div>

                      <div className="border-t pt-4">
                        <Label>{getText('Imaj Kat', 'Image Carte', 'Card Image')}</Label>
                        <div className="mt-2 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer" onClick={() => document.getElementById('card-image-upload-edit').click()}>
                          {cardDetails.card_image ? (
                            <img src={cardDetails.card_image} alt="Card" className="max-h-32 mx-auto rounded-lg" />
                          ) : (
                            <><Upload className="mx-auto text-stone-400 mb-2" size={32} /><p className="text-stone-500">{getText('Klike pou telechaje', 'Cliquez pour télécharger', 'Click to upload')}</p></>
                          )}
                        </div>
                        <input id="card-image-upload-edit" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </div>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      <Button onClick={updateApprovedOrderDetails} disabled={processing} className="bg-[#EA580C]">
                        <Save size={16} className="mr-2" />
                        {getText('Sove chanjman', 'Enregistrer', 'Save changes')}
                      </Button>
                      <Button variant="destructive" onClick={deleteOrder} disabled={processing}>
                        <Trash2 size={16} className="mr-2" />
                        {getText('Efase kat la', 'Supprimer', 'Delete card')}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Top-up Modal */}
        <Dialog open={showTopupModal} onOpenChange={setShowTopupModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="text-blue-500" />
                {getText('Detay Top-up Kat', 'Détails Recharge Carte', 'Card Top-up Details')}
              </DialogTitle>
            </DialogHeader>
            {selectedTopup && (
              <div className="space-y-4">
                {/* Top-up Info */}
                <div className="p-4 bg-stone-50 dark:bg-stone-800 rounded-xl space-y-3">
                  <div className="flex justify-between">
                    <span className="text-stone-500">{getText('ID Kliyan', 'ID Client', 'Client ID')}</span>
                    <span className="font-mono">{selectedTopup.client_id}</span>
                  </div>
                  <div className="border-t pt-3">
                    <p className="text-stone-500 text-sm mb-2">{getText('Enfòmasyon Kat', 'Info Carte', 'Card Info')}</p>
                    <div className="flex items-center gap-3">
                      <CreditCard className="text-emerald-600" size={24} />
                      <div>
                        <p className="font-medium">{selectedTopup.card_brand || 'Card'} •••• {selectedTopup.card_last4}</p>
                        <p className="text-sm text-[#EA580C]">{selectedTopup.card_email}</p>
                        {selectedTopup.card_holder_name && <p className="text-xs text-stone-500">{selectedTopup.card_holder_name}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Amount breakdown */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between">
                    <span>{getText('Montan', 'Montant', 'Amount')}</span>
                    <span className="font-semibold">${selectedTopup.amount?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-amber-700">
                    <span>{getText('Frè', 'Frais', 'Fee')}</span>
                    <span>${selectedTopup.fee?.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-lg">
                    <span>{getText('Total debite', 'Total débité', 'Total deducted')}</span>
                    <span className="text-[#EA580C]">${(selectedTopup.total_amount ?? ((selectedTopup.amount || 0) + (selectedTopup.fee || 0))).toFixed(2)}</span>
                  </div>
                </div>

                {selectedTopup.status === 'pending' && (
                  <>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        {getText(
                          `Mete $${(selectedTopup.amount ?? selectedTopup.net_amount ?? 0).toFixed(2)} sou kat kliyan an, epi konfime livrezon an.`,
                          `Mettez $${(selectedTopup.amount ?? selectedTopup.net_amount ?? 0).toFixed(2)} sur la carte du client, puis confirmez la livraison.`,
                          `Put $${(selectedTopup.amount ?? selectedTopup.net_amount ?? 0).toFixed(2)} on client's card, then confirm delivery.`
                        )}
                      </p>
                    </div>

                    <div>
                      <Label>{getText('Enfòmasyon livrezon', 'Info livraison', 'Delivery info')}</Label>
                      <Textarea 
                        placeholder={getText('Egzanp: Kob ajoute nan kat Wise...', 'Ex: Fonds ajoutés sur carte Wise...', 'Ex: Funds added to Wise card...')}
                        value={deliveryInfo} 
                        onChange={(e) => setDeliveryInfo(e.target.value)} 
                        rows={2} 
                        className="mt-1" 
                      />
                    </div>

                    <div>
                      <Label>{getText('Nòt Admin', 'Notes Admin', 'Admin Notes')}</Label>
                      <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} className="mt-1" />
                    </div>

                    <div className="flex gap-4 pt-4 border-t">
                      <Button onClick={() => handleProcessTopup('approve')} disabled={processing} className="flex-1 bg-emerald-500 hover:bg-emerald-600">
                        <Check size={18} className="mr-2" />{getText('Konfime Livrezon', 'Confirmer Livraison', 'Confirm Delivery')}
                      </Button>
                      <Button onClick={() => handleProcessTopup('reject')} disabled={processing} variant="destructive" className="flex-1">
                        <X size={18} className="mr-2" />{getText('Rejte & Ranbouse', 'Rejeter & Rembourser', 'Reject & Refund')}
                      </Button>
                    </div>
                  </>
                )}

                {selectedTopup.status !== 'pending' && (
                  <div className="space-y-3">
                    {selectedTopup.delivery_info && (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
                        <p className="text-sm text-emerald-700 dark:text-emerald-400">
                          <strong>{getText('Livrezon:', 'Livraison:', 'Delivery:')}</strong> {selectedTopup.delivery_info}
                        </p>
                      </div>
                    )}
                    {selectedTopup.admin_notes && (
                      <div className="bg-stone-50 dark:bg-stone-800 rounded-lg p-3">
                        <p className="text-sm"><strong>{getText('Nòt:', 'Notes:', 'Notes:')}</strong> {selectedTopup.admin_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Card Manually Modal */}
        <Dialog open={showAddCardModal} onOpenChange={setShowAddCardModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="text-emerald-500" />
                {getText('Ajoute Kat Manyèl pou Kliyan', 'Ajouter Carte Manuellement', 'Add Card Manually for Client')}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Client Search */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800 rounded-xl">
                <Label>{getText('Rechèch Kliyan (ID oswa Email)', 'Rechercher Client (ID ou Email)', 'Search Client (ID or Email)')}</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="KYC-XXXXXX ou email@example.com"
                    value={searchClientId}
                    onChange={(e) => setSearchClientId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchClient()}
                  />
                  <Button onClick={searchClient} disabled={searchingClient} variant="outline">
                    <Search size={18} />
                  </Button>
                </div>
                
                {foundClient && (
                  <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-emerald-800 dark:text-emerald-300">{foundClient.full_name}</p>
                        <p className="text-sm text-emerald-600">{foundClient.email}</p>
                        <p className="text-xs font-mono text-stone-500">{foundClient.client_id}</p>
                      </div>
                      <Badge className="bg-emerald-500">
                        <Check size={14} className="mr-1" />
                        {getText('Jwenn', 'Trouvé', 'Found')}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Email */}
              <div className="border rounded-xl p-4 space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <CreditCard size={18} />
                  {getText('Enfòmasyon Kat la', 'Informations de la Carte', 'Card Information')}
                </h4>

                <div>
                  <Label className="text-[#EA580C]">{getText('Email Kat la *', 'Email de la Carte *', 'Card Email *')}</Label>
                  <Input 
                    placeholder="card@email.com" 
                    value={cardDetails.card_email} 
                    onChange={(e) => setCardDetails({...cardDetails, card_email: e.target.value})} 
                    className="mt-1 border-[#EA580C]" 
                    type="email"
                  />
                  <p className="text-xs text-stone-500 mt-1">{getText('Email asosye ak kat la', 'Email associé à la carte', 'Email associated with the card')}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{getText('Mak Kat', 'Marque', 'Brand')}</Label>
                    <Input placeholder="Wise, Payoneer" value={cardDetails.card_brand} onChange={(e) => setCardDetails({...cardDetails, card_brand: e.target.value})} className="mt-1" />
                  </div>
                  <div>
                    <Label>{getText('Tip Kat', 'Type', 'Type')}</Label>
                    <Select value={cardDetails.card_type} onValueChange={(v) => setCardDetails({...cardDetails, card_type: v})}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visa">Visa</SelectItem>
                        <SelectItem value="mastercard">Mastercard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>{getText('Non sou Kat', 'Nom sur Carte', 'Name on Card')}</Label>
                  <Input value={cardDetails.card_holder_name} onChange={(e) => setCardDetails({...cardDetails, card_holder_name: e.target.value.toUpperCase()})} className="mt-1 uppercase" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{getText('Dènye 4 chif', '4 derniers chiffres', 'Last 4 digits')}</Label>
                    <Input
                      value={cardDetails.card_last4}
                      onChange={(e) => setCardDetails({ ...cardDetails, card_last4: e.target.value })}
                      className="mt-1 font-mono"
                      maxLength={4}
                      placeholder="1234"
                    />
                  </div>
                  <div>
                    <Label>{getText('Ekspire', 'Expire', 'Expiry')}</Label>
                    <Input
                      placeholder="MM/YY"
                      value={cardDetails.card_expiry}
                      onChange={(e) => setCardDetails({ ...cardDetails, card_expiry: e.target.value })}
                      className="mt-1"
                      maxLength={5}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h5 className="font-medium mb-3">{getText('Adrès Faktirasyon', 'Adresse Facturation', 'Billing Address')}</h5>
                  <div className="space-y-3">
                    <Input placeholder={getText('Adrès', 'Adresse', 'Address')} value={cardDetails.billing_address} onChange={(e) => setCardDetails({...cardDetails, billing_address: e.target.value})} />
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder={getText('Vil', 'Ville', 'City')} value={cardDetails.billing_city} onChange={(e) => setCardDetails({...cardDetails, billing_city: e.target.value})} />
                      <Input placeholder={getText('Peyi', 'Pays', 'Country')} value={cardDetails.billing_country} onChange={(e) => setCardDetails({...cardDetails, billing_country: e.target.value})} />
                      <Input placeholder="ZIP" value={cardDetails.billing_zip} onChange={(e) => setCardDetails({...cardDetails, billing_zip: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label>{getText('Imaj Kat', 'Image Carte', 'Card Image')}</Label>
                  <div className="mt-2 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer" onClick={() => document.getElementById('add-card-image-upload').click()}>
                    {cardDetails.card_image ? (
                      <img src={cardDetails.card_image} alt="Card" className="max-h-32 mx-auto rounded-lg" />
                    ) : (
                      <><Upload className="mx-auto text-stone-400 mb-2" size={32} /><p className="text-stone-500">{getText('Klike pou telechaje', 'Cliquez pour télécharger', 'Click to upload')}</p></>
                    )}
                  </div>
                  <input id="add-card-image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t">
                <Button variant="outline" onClick={() => { setShowAddCardModal(false); resetAddCardForm(); }} className="flex-1">
                  {getText('Anile', 'Annuler', 'Cancel')}
                </Button>
                <Button 
                  onClick={createCardManually} 
                  disabled={processing || !foundClient || !cardDetails.card_email} 
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                >
                  <Plus size={18} className="mr-2" />
                  {processing ? getText('Kreyasyon...', 'Création...', 'Creating...') : getText('Kreye Kat', 'Créer Carte', 'Create Card')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
