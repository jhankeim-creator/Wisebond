import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { API_BASE as API } from '@/lib/utils';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  CreditCard, 
  Check, 
  AlertCircle,
  ShoppingCart,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  History,
  Wallet,
  Eye,
  EyeOff,
  Copy,
  MapPin,
  Plus,
  ArrowRight,
  ArrowDown,
  RefreshCw,
  MoreVertical
} from 'lucide-react';

// Card logos
const VISA_LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0ODAgMjAwIj48cGF0aCBmaWxsPSIjMUE1RjdBIiBkPSJNMTcxLjcgNjUuNmwtNDEuMyA2OS40aDI1LjdsNi4xLTE1LjRoMjkuNGw2LjEgMTUuNGgyNS43bC00MS4zLTY5LjRoLTEwLjR6bTMuNCAyMC4zbDkuNiAyMy4xaC0xOS4zbDkuNy0yMy4xem01Ni4yLTIwLjNsLTE1LjggNDEuNy03LTQxLjdoLTI0LjZsMjAuNiA2OS40aDI0LjZsMjkuOS02OS40aC0yNy43em02NS4yIDBsLTE1LjggNDEuNy03LTQxLjdoLTI0LjZsMjAuNiA2OS40aDI0LjZsMjkuOS02OS40aC0yNy43em03MS41IDBoLTQ0LjZ2NjkuNGgyNS43di0yMy45aDIwLjFjMTkuOCAwIDMyLjEtMTEgMzIuMS0yMi44IDAtMTEuNy0xMi4zLTIyLjctMzMuMy0yMi43em0tMi41IDE4LjdjNy44IDAgMTEuNiAzLjQgMTEuNiA3LjQgMCAzLjktMy44IDcuNS0xMS42IDcuNWgtMTYuNHYtMTUuMWgxNi40eiIvPjwvc3ZnPg==';
const MASTERCARD_LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMzEuMiAxNTAiPjxjaXJjbGUgZmlsbD0iI2ViMDAxYiIgY3g9IjY4IiBjeT0iNzUiIHI9IjUyIi8+PGNpcmNsZSBmaWxsPSIjZjc5ZTFiIiBjeD0iMTYzIiBjeT0iNzUiIHI9IjUyIi8+PHBhdGggZmlsbD0iI2ZmNWYwMCIgZD0iTTExNS41IDMzLjJjLTE2LjcgMTMuMS0yNy40IDMzLjMtMjcuNCA1NS44czEwLjcgNDIuNyAyNy40IDU1LjhjMTYuNy0xMy4xIDI3LjQtMzMuMyAyNy40LTU1LjhzLTEwLjctNDIuNy0yNy40LTU1Ljh6Ii8+PC9zdmc+';

export default function VirtualCard() {
  const { language } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [cardOrders, setCardOrders] = useState([]);
  const [cardDeposits, setCardDeposits] = useState([]);
  const [cardWithdrawals, setCardWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [virtualCardsEnabled, setVirtualCardsEnabled] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [txData, setTxData] = useState(null);
  const [refreshingDetails, setRefreshingDetails] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [cardFee, setCardFee] = useState(500);
  const [defaultCardBg, setDefaultCardBg] = useState(null);
  
  // Top up state
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpCardId, setTopUpCardId] = useState('');
  const [cardFees, setCardFees] = useState([]);
  const [submittingTopUp, setSubmittingTopUp] = useState(false);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawCardId, setWithdrawCardId] = useState('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [updatingControls, setUpdatingControls] = useState(false);
  const [spendingLimit, setSpendingLimit] = useState('');
  const [spendingPeriod, setSpendingPeriod] = useState('monthly');

  const getText = useCallback((ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  }, [language]);

  const approvedCards = cardOrders.filter(o => o.status === 'approved');

  const fetchConfig = useCallback(async () => {
    try {
      const [configResp, feesResp] = await Promise.all([
        axios.get(`${API}/public/app-config`),
        axios.get(`${API}/withdrawals/fees`)
      ]);
      if (typeof configResp.data?.virtual_cards_enabled === 'boolean') {
        setVirtualCardsEnabled(configResp.data.virtual_cards_enabled);
      }
      if (configResp.data?.card_order_fee_htg) {
        setCardFee(configResp.data.card_order_fee_htg);
      }
      if (configResp.data?.card_background_image) {
        setDefaultCardBg(configResp.data.card_background_image);
      }
      if (feesResp.data?.card_fees) {
        setCardFees(feesResp.data.card_fees);
      }
    } catch (e) {
      // keep default
      setVirtualCardsEnabled((prev) => (prev === null ? true : prev));
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoadError(null);
      const [ordersRes, depositsRes, withdrawalsRes] = await Promise.all([
        axios.get(`${API}/virtual-cards/orders`),
        axios.get(`${API}/virtual-cards/deposits`),
        axios.get(`${API}/virtual-cards/withdrawals`)
      ]);
      setCardOrders(ordersRes.data.orders || []);
      setCardDeposits(depositsRes.data.deposits || []);
      setCardWithdrawals(withdrawalsRes.data.withdrawals || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        'Error fetching virtual card data';
      setLoadError(String(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchConfig();
  }, [fetchData, fetchConfig]);

  const orderCard = async () => {
    const email = String(user?.email || '').trim();
    if (!email) {
      toast.error(getText(
        'Imèl ou pa disponib. Tanpri mete yon imèl nan pwofil ou.',
        'Votre email est indisponible. Veuillez ajouter un email à votre profil.',
        'Your email is missing. Please add an email to your profile.'
      ));
      return;
    }

    setOrdering(true);
    try {
      // Card email is taken from the user's account email automatically.
      await axios.post(`${API}/virtual-cards/order`, {});
      toast.success(getText('Komand kat soumèt siksè!', 'Commande de carte soumise avec succès!', 'Card order submitted successfully!'));
      setShowOrderModal(false);
      fetchData();
      refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    } finally {
      setOrdering(false);
    }
  };

  const calculateTopUpFee = () => {
    const amt = parseFloat(topUpAmount);
    if (!amt || cardFees.length === 0) return 0;
    
    const range = cardFees.find(f => amt >= f.min_amount && amt <= f.max_amount);
    if (!range) return 0;
    
    if (range.is_percentage) {
      return amt * (range.fee / 100);
    }
    return Number(range.fee || 0);
  };

  const submitTopUp = async () => {
    const amt = parseFloat(topUpAmount);
    const fee = calculateTopUpFee();
    const total = Math.max(0, (amt || 0) + (fee || 0));
    
    if (!topUpCardId) {
      toast.error(getText('Chwazi yon kat', 'Choisissez une carte', 'Choose a card'));
      return;
    }
    
    if (!amt || amt < 5) {
      toast.error(getText('Montan minimòm: $5', 'Montant minimum: $5', 'Minimum amount: $5'));
      return;
    }
    
    if (total > (user?.wallet_usd || 0)) {
      toast.error(getText('Balans USD ensifizan', 'Solde USD insuffisant', 'Insufficient USD balance'));
      return;
    }

    setSubmittingTopUp(true);
    try {
      await axios.post(`${API}/virtual-cards/top-up`, {
        order_id: topUpCardId,
        amount: amt
      });
      
      toast.success(getText(
        'Demann top-up soumèt! Admin ap trete li.',
        'Demande de recharge soumise! L\'admin va la traiter.',
        'Top-up request submitted! Admin will process it.'
      ));
      setShowTopUpModal(false);
      setTopUpAmount('');
      setTopUpCardId('');
      refreshUser();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    } finally {
      setSubmittingTopUp(false);
    }
  };

  const openTopUpModal = () => {
    // Auto-select card if only one
    if (approvedCards.length === 1) {
      setTopUpCardId(approvedCards[0].order_id);
    }
    setShowTopUpModal(true);
  };

  const openTopUpModalForCard = (order) => {
    if (!order?.order_id) return;
    setTopUpCardId(order.order_id);
    setShowTopUpModal(true);
  };

  const openWithdrawModal = () => {
    // Auto-select card if only one
    if (approvedCards.length === 1) {
      setWithdrawCardId(approvedCards[0].order_id);
    }
    setShowWithdrawModal(true);
  };

  const openWithdrawModalForCard = (order) => {
    if (!order?.order_id) return;
    setWithdrawCardId(order.order_id);
    setShowWithdrawModal(true);
  };

  const submitWithdraw = async () => {
    const amt = parseFloat(withdrawAmount);
    if (!withdrawCardId) {
      toast.error(getText('Chwazi yon kat', 'Choisissez une carte', 'Choose a card'));
      return;
    }
    if (!amt || amt < 5) {
      toast.error(getText('Montan minimòm: $5', 'Montant minimum: $5', 'Minimum amount: $5'));
      return;
    }

    setSubmittingWithdraw(true);
    try {
      await axios.post(`${API}/virtual-cards/withdraw`, {
        order_id: withdrawCardId,
        amount: amt
      });
      toast.success(getText(
        'Retrè soumèt! Si kat la sipòte li, li ap trete otomatik.',
        'Retrait soumis! Si la carte le supporte, il sera traité automatiquement.',
        'Withdrawal submitted! If supported, it will be processed automatically.'
      ));
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawCardId('');
      refreshUser();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const viewCardDetails = (order) => {
    setSelectedCard(order);
    setTxData(null);
    setSpendingLimit(order?.spending_limit_usd != null ? String(order.spending_limit_usd) : '');
    setSpendingPeriod(order?.spending_limit_period || 'monthly');
    setShowCardDetails(true);
  };

  const openTransactions = async (order) => {
    if (!order?.order_id) return;
    setTxLoading(true);
    setTxData(null);
    setShowTxModal(true);
    try {
      const resp = await axios.get(`${API}/virtual-cards/${order.order_id}/transactions?page=1&take=50`);
      setTxData(resp.data);
    } catch (e) {
      setTxData({ error: e.response?.data?.detail || e.message || 'Error' });
    } finally {
      setTxLoading(false);
    }
  };

  const refreshCardDetails = async (order) => {
    if (!order?.order_id) return;
    setRefreshingDetails(true);
    try {
      const resp = await axios.get(`${API}/virtual-cards/${order.order_id}/detail`);
      const updated = resp.data?.card;
      if (updated) {
        setSelectedCard(updated);
      }
      // Refresh the list too.
      fetchData();
      toast.success(getText('Detay mete ajou!', 'Détails mis à jour!', 'Details refreshed!'));
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || 'Error');
    } finally {
      setRefreshingDetails(false);
    }
  };

  const extractTxRows = (data) => {
    // Best-effort extractor for varying provider schemas.
    const resp = data?.response || data;
    const rows =
      resp?.data ||
      resp?.transactions ||
      resp?.message?.transactions ||
      resp?.result?.transactions ||
      resp?.result ||
      [];
    return Array.isArray(rows) ? rows : [];
  };

  const updateControls = async (updates) => {
    if (!selectedCard?.order_id) return;
    setUpdatingControls(true);
    try {
      const res = await axios.patch(`${API}/virtual-cards/${selectedCard.order_id}/controls`, updates);
      const updated = res.data?.card;
      if (updated) {
        setSelectedCard(updated);
      }
      toast.success(getText('Mete ajou!', 'Mis à jour!', 'Updated!'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    } finally {
      setUpdatingControls(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(getText(`${label} kopye!`, `${label} copié!`, `${label} copied!`));
  };

  const formatCardNumber = (last4) => {
    if (!last4) return '•••• •••• •••• ••••';
    return `•••• •••• •••• ${String(last4).slice(-4)}`;
  };

  const topUpFee = calculateTopUpFee();
  const totalTopUpAmount = Math.max(0, parseFloat(topUpAmount || 0) + (topUpFee || 0));

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle size={12} />
            {getText('Apwouve', 'Approuvé', 'Approved')}
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <XCircle size={12} />
            {getText('Rejte', 'Rejeté', 'Rejected')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <Clock size={12} />
            {getText('Ap tann', 'En attente', 'Pending')}
          </span>
        );
    }
  };

  return (
    <DashboardLayout title={getText('Kat Vityèl', 'Carte Virtuelle', 'Virtual Card')}>
      <div className="space-y-6" data-testid="virtual-card-page">
        {loadError ? (
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-semibold text-red-700 dark:text-red-300">
                    {getText('Gen yon erè pandan chajman kat vityèl yo', 'Erreur lors du chargement des cartes', 'Error loading virtual cards')}
                  </p>
                  <p className="text-xs text-red-700/80 dark:text-red-300/80 break-words mt-1">
                    {loadError}
                  </p>
                </div>
                <Button variant="outline" onClick={() => { setLoading(true); fetchData(); fetchConfig(); }}>
                  {getText('Re-try', 'Réessayer', 'Retry')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
        {/* Feature flag (read-only mode when disabled) */}
        {virtualCardsEnabled === false ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
              <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-2">
                {getText('Kat vityèl pa disponib kounye a', 'Cartes virtuelles indisponibles', 'Virtual cards unavailable')}
              </h3>
              <p className="text-stone-600 dark:text-stone-400">
                {getText(
                  'Ou ka toujou wè kat/ou istorik ki deja egziste yo, men ou pa ka fè nouvo demann kounye a.',
                  'Vous pouvez toujours voir vos cartes/historiques existants, mais vous ne pouvez pas faire de nouvelles demandes pour le moment.',
                  'You can still view existing cards/history, but new requests are temporarily disabled.'
                )}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* KYC Check */}
        {virtualCardsEnabled === null ? (
          <Card>
            <CardContent className="p-8 text-center text-stone-500">
              {getText('Chajman...', 'Chargement...', 'Loading...')}
            </CardContent>
          </Card>
        ) : user?.kyc_status !== 'approved' ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
              <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-2">
                {getText('Verifikasyon KYC obligatwa', 'Vérification KYC requise', 'KYC verification required')}
              </h3>
              <p className="text-stone-600 dark:text-stone-400 mb-6">
                {getText(
                  'Ou dwe konplete verifikasyon KYC ou pou komande yon kat.',
                  'Vous devez compléter votre vérification KYC pour commander une carte.',
                  'You must complete KYC verification to order a card.'
                )}
              </p>
              <Button className="btn-primary" onClick={() => window.location.href = '/kyc'}>
                {getText('Konplete KYC', 'Compléter KYC', 'Complete KYC')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Header / hero */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-6 text-white">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CreditCard size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold">
                        {getText('Kat Vityèl', 'Carte Virtuelle', 'Virtual Card')}
                      </h2>
                      <p className="text-purple-100 text-sm mt-1">
                        {getText(
                          'Pou acha an liy (Netflix, Amazon, elatriye).',
                          'Pour achats en ligne (Netflix, Amazon, etc.).',
                          'For online purchases (Netflix, Amazon, etc.).'
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => setShowOrderModal(true)} disabled={virtualCardsEnabled === false} className="bg-white text-purple-700 hover:bg-purple-50">
                        <ShoppingCart className="mr-2" size={18} />
                        {getText('Komande', 'Commander', 'Order')}
                      </Button>
                      <Button variant="outline" onClick={() => { setLoading(true); fetchData(); fetchConfig(); }} className="border-white/40 text-white hover:bg-white/10">
                        <RefreshCw className="mr-2" size={18} />
                        {getText('Rechaje', 'Recharger', 'Refresh')}
                      </Button>
                    </div>
                  </div>

                  <div className="bg-red-500/20 border border-red-300/30 rounded-lg p-3 mt-4">
                    <p className="text-red-100 text-xs font-medium flex items-center gap-2">
                      ⚠️ {getText(
                        'ENPÒTAN: Kat la PA pou peye sit paryaj oswa sit pònografik. Vyolasyon ap lakoz bloke kont ou.',
                        'IMPORTANT: La carte n\'est PAS pour payer des sites de paris ou des sites pornographiques. Toute violation entraînera le blocage de votre compte.',
                        'IMPORTANT: The card is NOT for paying gambling or pornographic sites. Violations will result in account blocking.'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-stone-500">{getText('Kat aktif', 'Cartes actives', 'Active cards')}</p>
                  <p className="text-2xl font-bold text-stone-900 dark:text-white">{approvedCards.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-stone-500">{getText('Balans USD', 'Solde USD', 'USD balance')}</p>
                  <p className="text-2xl font-bold text-stone-900 dark:text-white">${(user?.wallet_usd || 0).toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-stone-500">{getText('Demann an atant', 'Demandes en attente', 'Pending requests')}</p>
                  <p className="text-2xl font-bold text-stone-900 dark:text-white">{cardOrders.filter(o => o.status === 'pending').length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Pending order notice */}
            {!loading && cardOrders.some(o => o.status === 'pending') ? (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10">
                <CardContent className="p-4">
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    {getText(
                      'Gen demann kat an atant apwobasyon admin lan.',
                      'Des demandes de carte sont en attente d’approbation.',
                      'Some card requests are pending admin approval.'
                    )}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    {getText(
                      'Si ou bezwen li pi vit, kontakte sipò a.',
                      'Si besoin, contactez le support.',
                      'If needed, contact support.'
                    )}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {/* Cards grid */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard size={20} className="text-[#EA580C]" />
                  {getText('Kat Mwen Yo', 'Mes Cartes', 'My Cards')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="skeleton h-44 rounded-xl" />
                    ))}
                  </div>
                ) : approvedCards.length === 0 ? (
                  <div className="text-center py-8 text-stone-500">
                    <CreditCard className="mx-auto mb-3 text-stone-400" size={48} />
                    <p>{getText('Ou poko gen kat aktif', 'Vous n\'avez pas de carte active', 'You have no active cards')}</p>
                    <Button onClick={() => setShowOrderModal(true)} disabled={virtualCardsEnabled === false} className="btn-gold mt-4">
                      <ShoppingCart className="mr-2" size={18} />
                      {getText('Komande premye kat ou', 'Commander votre première carte', 'Order your first card')}
                    </Button>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {approvedCards.map((c) => (
                      <div key={c.order_id} className="rounded-2xl overflow-hidden border border-stone-200 bg-white dark:bg-stone-900 dark:border-stone-700">
                        {/* Card visual (no actions on the card face) */}
                        <div
                          className={`relative overflow-hidden text-white p-4 min-h-[176px] ${
                            c.card_type === 'mastercard'
                              ? 'bg-gradient-to-br from-orange-500 via-red-500 to-pink-600'
                              : 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800'
                          }`}
                        >
                          {(c.card_image || defaultCardBg) ? (
                            <img
                              src={c.card_image || defaultCardBg}
                              alt="Card"
                              className="absolute inset-0 w-full h-full object-cover opacity-80"
                            />
                          ) : null}

                          <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs text-white/80">{c.card_brand || getText('Kat', 'Carte', 'Card')}</p>
                                <p className="font-mono text-lg tracking-wider mt-1">{formatCardNumber(c.card_last4)}</p>
                              </div>
                              <img
                                src={c.card_type === 'mastercard' ? MASTERCARD_LOGO : VISA_LOGO}
                                alt={c.card_type}
                                className="h-10 w-auto"
                              />
                            </div>

                            <div className="flex items-end justify-between mt-auto pt-4">
                              <div className="min-w-0">
                                <p className="text-[11px] text-white/70 uppercase">{getText('Ekspire', 'Expire', 'Expires')}</p>
                                <p className="font-mono">{c.card_expiry || 'MM/YY'}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] text-white/70 uppercase">{getText('Balans', 'Solde', 'Balance')}</p>
                                <p className="font-semibold">
                                  {c.card_balance != null ? `${Number(c.card_balance).toFixed(2)} ${c.card_currency || 'USD'}` : '—'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action bar (standard pattern: actions below, not on the card) */}
                        <div className="p-3 flex items-center justify-between gap-2">
                          <Button size="sm" onClick={() => viewCardDetails(c)} className="btn-primary">
                            <Eye size={16} className="mr-2" />
                            {getText('Detay', 'Détails', 'Details')}
                          </Button>

                          <div className="flex items-center gap-2">
                            {getStatusBadge(c.status)}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="px-2" aria-label={getText('Plis', 'Plus', 'More')}>
                                  <MoreVertical size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {c.provider === 'strowallet' ? (
                                  <DropdownMenuItem onSelect={() => openTransactions(c)}>
                                    <History />
                                    {getText('Tranzaksyon', 'Transactions', 'Transactions')}
                                  </DropdownMenuItem>
                                ) : null}

                                <DropdownMenuItem onSelect={() => refreshCardDetails(c)} disabled={refreshingDetails || virtualCardsEnabled === false}>
                                  <RefreshCw className={refreshingDetails ? 'animate-spin' : ''} />
                                  {getText('Ajou detay', 'Rafraîchir', 'Refresh')}
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem onSelect={() => openTopUpModalForCard(c)} disabled={virtualCardsEnabled === false}>
                                  <Plus />
                                  {getText('Top-up', 'Recharger', 'Top up')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => openWithdrawModalForCard(c)} disabled={virtualCardsEnabled === false}>
                                  <ArrowDown />
                                  {getText('Retrè', 'Retrait', 'Withdraw')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activity tabs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History size={20} className="text-stone-600" />
                  {getText('Aktivite', 'Activité', 'Activity')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="orders">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="orders">{getText('Komand', 'Commandes', 'Orders')}</TabsTrigger>
                    <TabsTrigger value="topups">{getText('Top-up', 'Recharges', 'Top-ups')}</TabsTrigger>
                    <TabsTrigger value="withdrawals">{getText('Retrè', 'Retraits', 'Withdrawals')}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="orders" className="mt-4">
                    {loading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => (<div key={i} className="skeleton h-16 rounded-lg" />))}
                      </div>
                    ) : cardOrders.length === 0 ? (
                      <div className="text-center py-8 text-stone-500">
                        <p>{getText('Pa gen komand', 'Aucune commande', 'No orders')}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-stone-100 dark:divide-stone-700">
                        {cardOrders.map((order) => (
                          <div key={order.order_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                order.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-stone-100 dark:bg-stone-800'
                              }`}>
                                {order.card_type && order.status === 'approved' ? (
                                  <img
                                    src={order.card_type === 'mastercard' ? MASTERCARD_LOGO : VISA_LOGO}
                                    alt={order.card_type}
                                    className="h-8 w-auto"
                                  />
                                ) : (
                                  <CreditCard className={order.status === 'approved' ? 'text-emerald-600' : 'text-stone-600 dark:text-stone-400'} size={24} />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-stone-900 dark:text-white truncate">{order.card_email}</p>
                                <p className="text-xs text-stone-500">{new Date(order.created_at).toLocaleDateString()}</p>
                                {order.status === 'approved' && order.card_last4 ? (
                                  <p className="text-sm font-mono text-emerald-600 dark:text-emerald-400">•••• •••• •••• {order.card_last4}</p>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                              {order.status === 'approved' ? (
                                <Button variant="outline" size="sm" onClick={() => viewCardDetails(order)} className="text-emerald-600 border-emerald-300 hover:bg-emerald-50">
                                  <Eye size={16} className="mr-1" />
                                  {getText('Detay', 'Détails', 'Details')}
                                </Button>
                              ) : null}
                              {order.status === 'approved' && order.provider === 'strowallet' ? (
                                <Button variant="outline" size="sm" onClick={() => openTransactions(order)} className="text-purple-700 border-purple-300 hover:bg-purple-50">
                                  <History size={16} className="mr-1" />
                                  {getText('Tranzaksyon', 'Transactions', 'Transactions')}
                                </Button>
                              ) : null}
                              {getStatusBadge(order.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="topups" className="mt-4">
                    {loading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => (<div key={i} className="skeleton h-16 rounded-lg" />))}
                      </div>
                    ) : cardDeposits.length === 0 ? (
                      <div className="text-center py-8 text-stone-500">
                        <p>{getText('Pa gen istorik top-up', 'Pas d\'historique de recharge', 'No top-up history')}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-stone-100 dark:divide-stone-700">
                        {cardDeposits.map((deposit) => (
                          <div key={deposit.deposit_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                deposit.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                                deposit.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                              }`}>
                                <Wallet className={
                                  deposit.status === 'approved' ? 'text-emerald-600' :
                                  deposit.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                                } size={20} />
                              </div>
                              <div>
                                <p className="font-medium text-stone-900 dark:text-white">${Number(deposit.amount || 0).toFixed(2)} USD</p>
                                <p className="text-xs text-stone-500">{new Date(deposit.created_at).toLocaleDateString()} • {deposit.card_email}</p>
                              </div>
                            </div>
                            {getStatusBadge(deposit.status)}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="withdrawals" className="mt-4">
                    {loading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => (<div key={i} className="skeleton h-16 rounded-lg" />))}
                      </div>
                    ) : cardWithdrawals.length === 0 ? (
                      <div className="text-center py-8 text-stone-500">
                        <p>{getText('Pa gen istorik retrè', 'Pas d\'historique de retrait', 'No withdrawal history')}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-stone-100 dark:divide-stone-700">
                        {cardWithdrawals.map((w) => (
                          <div key={w.withdrawal_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-stone-100 dark:bg-stone-800">
                                <ArrowDown className="text-stone-600 dark:text-stone-300" size={20} />
                              </div>
                              <div>
                                <p className="font-medium text-stone-900 dark:text-white">${Number(w.amount || 0).toFixed(2)} USD</p>
                                <p className="text-xs text-stone-500">{new Date(w.created_at).toLocaleDateString()} • {w.card_email}</p>
                              </div>
                            </div>
                            {getStatusBadge(w.status)}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Card Features */}
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { 
                  icon: Shield, 
                  title: getText('Sekirize', 'Sécurisé', 'Secure'),
                  desc: getText('Pwoteksyon kont fwod', 'Protection contre la fraude', 'Fraud protection')
                },
                { 
                  icon: CreditCard, 
                  title: getText('Sèl USD', 'USD Uniquement', 'USD Only'),
                  desc: getText('Rechaje ak USD sèlman', 'Recharge en USD uniquement', 'Top-up in USD only')
                },
                { 
                  icon: Check, 
                  title: getText('Aksepte toupatou', 'Accepté partout', 'Accepted everywhere'),
                  desc: getText('Visa/Mastercard', 'Visa/Mastercard', 'Visa/Mastercard')
                }
              ].map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <div key={i} className="bg-stone-50 dark:bg-stone-800 rounded-xl p-6 text-center">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Icon className="text-[#EA580C]" size={24} />
                    </div>
                    <h3 className="font-semibold text-stone-900 dark:text-white mb-1">{feature.title}</h3>
                    <p className="text-sm text-stone-500 dark:text-stone-400">{feature.desc}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Order Modal */}
        <Dialog open={showOrderModal} onOpenChange={setShowOrderModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="text-[#EA580C]" size={24} />
                {getText('Komande Kat Vityèl', 'Commander une Carte Virtuelle', 'Order Virtual Card')}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-amber-500 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-400">
                      {getText('Kat Tyè Pati', 'Carte Tiers', 'Third Party Card')}
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">
                      {getText(
                        'Kat vityèl la jere pa yon konpayi tyè. Nou ap voye email konfirmasyon lè kat la pare.',
                        'La carte virtuelle est gérée par une société tierce. Nous vous enverrons un email de confirmation quand la carte sera prête.',
                        'The virtual card is managed by a third party company. We will send you a confirmation email when the card is ready.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Label>{getText('Email pou kat la', 'Email pour la carte', 'Email for the card')}</Label>
                <div className="mt-2 rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm">
                  <span className="font-medium text-stone-900 dark:text-stone-100">{user?.email || '—'}</span>
                </div>
                <p className="text-sm text-stone-500 mt-2">
                  {getText(
                    'Nou pral itilize imèl kont ou pou voye detay kat la.',
                    'Nous utiliserons l’email de votre compte pour envoyer les détails de la carte.',
                    'We will use your account email to send card details.'
                  )}
                </p>
              </div>

              <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-stone-600 dark:text-stone-400">{getText('Frè komand', 'Frais de commande', 'Order fee')}</span>
                  <span className="font-bold text-stone-900 dark:text-white">G {cardFee}</span>
                </div>
              </div>

              <Button 
                onClick={orderCard}
                disabled={ordering || !String(user?.email || '').trim()}
                className="w-full btn-primary"
                data-testid="order-card-submit"
              >
                {ordering 
                  ? getText('Komand ap fèt...', 'Commande en cours...', 'Ordering...')
                  : getText('Konfime komand', 'Confirmer la commande', 'Confirm order')
                }
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Top-up Modal */}
        <Dialog open={showTopUpModal} onOpenChange={setShowTopUpModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="text-emerald-500" size={24} />
                {getText('Ajoute kòb sou kat', 'Recharger la carte', 'Add funds to card')}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Balance info */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {getText('Balans USD disponib', 'Solde USD disponible', 'Available USD balance')}
                </p>
                <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">${(user?.wallet_usd || 0).toFixed(2)}</p>
              </div>

              {/* Card selection */}
              {approvedCards.length > 1 ? (
                <div>
                  <Label>{getText('Chwazi kat la', 'Choisir la carte', 'Choose the card')}</Label>
                  <Select value={topUpCardId} onValueChange={setTopUpCardId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder={getText('Chwazi yon kat', 'Choisir une carte', 'Choose a card')} />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedCards.map(card => (
                        <SelectItem key={card.order_id} value={card.order_id}>
                          <div className="flex items-center gap-2">
                            <CreditCard size={16} />
                            <span>{card.card_brand || 'Card'}</span>
                            <span className="text-stone-500">•••• {card.card_last4 || '****'}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : approvedCards.length === 1 ? (
                <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4">
                  <p className="text-sm text-stone-500 mb-1">{getText('Kat chwazi', 'Carte sélectionnée', 'Selected card')}</p>
                  <div className="flex items-center gap-2">
                    <CreditCard size={20} className="text-emerald-600" />
                    <span className="font-medium">{approvedCards[0].card_brand || 'Card'}</span>
                    <span className="text-stone-500 font-mono">•••• {approvedCards[0].card_last4 || '****'}</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-1">{approvedCards[0].card_email}</p>
                </div>
              ) : null}

              {/* Amount input */}
              <div>
                <Label>{getText('Montan (USD)', 'Montant (USD)', 'Amount (USD)')}</Label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-stone-400">$</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="pl-10 text-xl font-bold"
                    min="5"
                  />
                </div>
                <p className="text-xs text-stone-500 mt-1">{getText('Minimòm: $5', 'Minimum: $5', 'Minimum: $5')}</p>
              </div>

              {/* Fee breakdown */}
              {topUpAmount && parseFloat(topUpAmount) > 0 && (
                <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-stone-600 dark:text-stone-400">
                    <span>{getText('Montan', 'Montant', 'Amount')}</span>
                    <span>${parseFloat(topUpAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600 dark:text-stone-400">
                    <span>{getText('Frè', 'Frais', 'Fee')}</span>
                    <span className="text-amber-700">${topUpFee.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-stone-200 dark:border-stone-700 pt-2 flex justify-between font-semibold">
                    <span>{getText('Total ap sòti nan bous ou', 'Total débité', 'Total deducted')}</span>
                    <span className="text-[#EA580C]">${totalTopUpAmount.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">
                    {getText(
                      'Nòt: frè a ajoute sou montan an. Montan sou kat la se montan ou antre a.',
                      'Note: les frais sont ajoutés au montant. Le montant sur la carte est celui saisi.',
                      'Note: fee is added on top. The amount on the card is what you entered.'
                    )}
                  </div>
                </div>
              )}

              <Button 
                onClick={submitTopUp}
                disabled={submittingTopUp || !topUpAmount || parseFloat(topUpAmount) < 5 || !topUpCardId}
                className="w-full bg-emerald-500 hover:bg-emerald-600"
              >
                {submittingTopUp 
                  ? getText('Soumisyon...', 'Envoi...', 'Submitting...')
                  : getText('Konfime top-up', 'Confirmer la recharge', 'Confirm top-up')
                }
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Withdraw Modal */}
        <Dialog open={showWithdrawModal} onOpenChange={setShowWithdrawModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowDown className="text-amber-600" size={24} />
                {getText('Retire sou bous', 'Retirer vers wallet', 'Withdraw to wallet')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-4">
                <p className="text-sm text-stone-600 dark:text-stone-300">
                  {getText(
                    'Retrè sa a ap voye lajan soti nan kat la tounen nan bous USD ou (si kat la sipòte sa).',
                    'Ce retrait renvoie les fonds de la carte vers votre wallet USD (si la carte le supporte).',
                    'This withdraw sends funds from the card back to your USD wallet (if supported).'
                  )}
                </p>
              </div>

              {/* Card selection */}
              {approvedCards.length > 1 ? (
                <div>
                  <Label>{getText('Chwazi kat la', 'Choisir la carte', 'Choose the card')}</Label>
                  <Select value={withdrawCardId} onValueChange={setWithdrawCardId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder={getText('Chwazi yon kat', 'Choisir une carte', 'Choose a card')} />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedCards.map(card => (
                        <SelectItem key={card.order_id} value={card.order_id}>
                          <div className="flex items-center gap-2">
                            <CreditCard size={16} />
                            <span>{card.card_brand || 'Card'}</span>
                            <span className="text-stone-500">•••• {card.card_last4 || '****'}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : approvedCards.length === 1 ? (
                <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4">
                  <p className="text-sm text-stone-500 mb-1">{getText('Kat chwazi', 'Carte sélectionnée', 'Selected card')}</p>
                  <div className="flex items-center gap-2">
                    <CreditCard size={20} className="text-amber-600" />
                    <span className="font-medium">{approvedCards[0].card_brand || 'Card'}</span>
                    <span className="text-stone-500 font-mono">•••• {approvedCards[0].card_last4 || '****'}</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-1">{approvedCards[0].card_email}</p>
                </div>
              ) : null}

              {/* Amount */}
              <div>
                <Label>{getText('Montan (USD)', 'Montant (USD)', 'Amount (USD)')}</Label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-stone-400">$</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="pl-10 text-xl font-bold"
                    min="5"
                  />
                </div>
                <p className="text-xs text-stone-500 mt-1">{getText('Minimòm: $5', 'Minimum: $5', 'Minimum: $5')}</p>
              </div>

              <Button
                onClick={submitWithdraw}
                disabled={submittingWithdraw || !withdrawAmount || parseFloat(withdrawAmount) < 5 || !withdrawCardId}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                {submittingWithdraw
                  ? getText('Soumisyon...', 'Envoi...', 'Submitting...')
                  : getText('Konfime retrè', 'Confirmer retrait', 'Confirm withdrawal')
                }
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Card Details Modal */}
        <Dialog open={showCardDetails} onOpenChange={setShowCardDetails}>
          <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="text-[#EA580C]" size={24} />
                {getText('Detay Kat ou', 'Détails de votre Carte', 'Your Card Details')}
              </DialogTitle>
            </DialogHeader>
            
            {selectedCard && (
              <div className="space-y-4 py-4">
                {/* Quick info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3">
                    <p className="text-xs text-stone-500">{getText('Email Kat', 'Email Carte', 'Card Email')}</p>
                    <p className="font-medium break-all">{selectedCard.card_email || user?.email || '—'}</p>
                  </div>
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3">
                    <p className="text-xs text-stone-500">{getText('ID Kat (Provider)', 'ID Carte (Provider)', 'Card ID (Provider)')}</p>
                    <p className="font-mono text-sm break-all">{selectedCard.provider_card_id || '—'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3">
                    <p className="text-xs text-stone-500">{getText('Estati', 'Statut', 'Status')}</p>
                    <p className="font-semibold capitalize">{selectedCard.card_status || '—'}</p>
                  </div>
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3">
                    <p className="text-xs text-stone-500">{getText('Balans Kat', 'Solde Carte', 'Card balance')}</p>
                    <p className="font-semibold">
                      {selectedCard.card_balance != null
                        ? `${Number(selectedCard.card_balance).toFixed(2)} ${selectedCard.card_currency || 'USD'}`
                        : '—'}
                    </p>
                    <p className="text-[11px] text-stone-500 mt-1">
                      {getText('Klike “Refresh” pou ajou li.', 'Cliquez “Rafraîchir” pour le mettre à jour.', 'Use “Refresh” to update.')}
                    </p>
                  </div>
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3">
                    <p className="text-xs text-stone-500">{getText('Echèk Peman', 'Échecs Paiement', 'Payment fails')}</p>
                    <p className="font-semibold">
                      {typeof selectedCard.failed_payment_count === 'number' ? `${selectedCard.failed_payment_count}/3` : '—'}
                    </p>
                  </div>
                </div>

                {selectedCard.card_status === 'locked' && selectedCard.locked_reason ? (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <p className="text-red-700 dark:text-red-300 text-sm">
                      <strong>{getText('Rezon blokaj:', 'Raison du blocage:', 'Lock reason:')}</strong> {selectedCard.locked_reason}
                    </p>
                  </div>
                ) : null}

                {/* Card Visual */}
                <div className={`relative rounded-2xl p-4 sm:p-6 text-white overflow-hidden ${
                  selectedCard.card_type === 'mastercard' 
                    ? 'bg-gradient-to-br from-orange-500 via-red-500 to-pink-600' 
                    : 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800'
                }`}>
                  {(selectedCard.card_image || defaultCardBg) ? (
                    <img 
                      src={selectedCard.card_image || defaultCardBg} 
                      alt="Card" 
                      className="absolute inset-0 w-full h-full object-cover opacity-90"
                    />
                  ) : null}
                  
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        {selectedCard.card_brand && (
                          <span className="text-white/90 font-bold text-lg">{selectedCard.card_brand}</span>
                        )}
                      </div>
                      <img 
                        src={selectedCard.card_type === 'mastercard' ? MASTERCARD_LOGO : VISA_LOGO} 
                        alt={selectedCard.card_type}
                        className="h-10 w-auto"
                      />
                    </div>
                    
                    <div className="mb-6">
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-lg sm:text-xl tracking-wider break-all">
                          {formatCardNumber(selectedCard.card_last4)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-white/60 text-xs uppercase mb-1">{getText('Pòtè Kat', 'Titulaire', 'Card Holder')}</p>
                        <p className="font-medium tracking-wide">
                          {selectedCard.card_holder_name || (user?.full_name ? String(user.full_name).toUpperCase() : 'N/A')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/60 text-xs uppercase mb-1">{getText('Ekspire', 'Expire', 'Expires')}</p>
                        <p className="font-mono font-medium">{selectedCard.card_expiry || 'MM/YY'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {(selectedCard.billing_address || selectedCard.billing_city || selectedCard.billing_country) && (
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="text-stone-500 mt-1" size={18} />
                      <div>
                        <p className="text-stone-500 text-sm mb-1">{getText('Adrès Faktirasyon', 'Adresse de Facturation', 'Billing Address')}</p>
                        <p className="text-stone-900 dark:text-white font-medium">{selectedCard.billing_address}</p>
                        <p className="text-stone-700 dark:text-stone-300">
                          {[selectedCard.billing_city, selectedCard.billing_country, selectedCard.billing_zip].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => copyToClipboard(
                        `${selectedCard.billing_address || ''}, ${selectedCard.billing_city || ''}, ${selectedCard.billing_country || ''} ${selectedCard.billing_zip || ''}`.trim(),
                        getText('Adrès', 'Adresse', 'Address')
                      )}
                    >
                      <Copy size={14} className="mr-2" />
                      {getText('Kopye Adrès', 'Copier Adresse', 'Copy Address')}
                    </Button>
                  </div>
                )}

                {selectedCard.admin_notes && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <p className="text-blue-700 dark:text-blue-400 text-sm">
                      <strong>{getText('Nòt:', 'Note:', 'Note:')}</strong> {selectedCard.admin_notes}
                    </p>
                  </div>
                )}

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <p className="text-amber-700 dark:text-amber-400 text-sm flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    {getText(
                      'Pa pataje enfòmasyon kat ou ak pèsonn. Itilize kat sa a sèlman pou sit legal yo.',
                      'Ne partagez pas les informations de votre carte avec personne. Utilisez cette carte uniquement pour des sites légaux.',
                      'Do not share your card information with anyone. Only use this card for legal websites.'
                    )}
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={() => refreshCardDetails(selectedCard)}
                  disabled={refreshingDetails}
                  className="w-full"
                >
                  <RefreshCw size={16} className={`mr-2 ${refreshingDetails ? 'animate-spin' : ''}`} />
                  {getText('Rechaje detay kat', 'Rafraîchir détails carte', 'Refresh card details')}
                </Button>

                <Button onClick={() => setShowCardDetails(false)} className="w-full" variant="outline">
                  {getText('Fèmen', 'Fermer', 'Close')}
                </Button>

              {/* Controls */}
              {selectedCard?.provider === 'strowallet' ? (
                <div className="border-t pt-4 space-y-3">
                  <h4 className="font-semibold text-stone-900 dark:text-white">
                    {getText('Jesyon Kat', 'Gestion Carte', 'Card Management')}
                  </h4>

                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
                    {getText(
                      'Atansyon: Depi premye echèk peman, kat la ka auto-freeze pou pwoteje w (pou evite rive 3 echèk). Verifye balans ou + adrès bòdwo, epi debloke lè ou pare.',
                      'Attention: dès le premier échec, la carte peut être auto-freeze pour vous protéger (éviter 3 échecs). Vérifiez solde + adresse, puis débloquez.',
                      'Warning: after the first failure, the card may auto-freeze to protect you (avoid reaching 3 failures). Check balance/billing, then unlock.'
                    )}
                    {typeof selectedCard.failed_payment_count === 'number' ? (
                      <div className="mt-2 font-semibold">
                        {getText('Echèk: ', 'Échecs: ', 'Fails: ')}{selectedCard.failed_payment_count}/3
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>{getText('Limit depans (USD)', 'Limite dépenses (USD)', 'Spending limit (USD)')}</Label>
                      <Input
                        type="number"
                        min="1"
                        value={spendingLimit}
                        onChange={(e) => setSpendingLimit(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>{getText('Peryòd', 'Période', 'Period')}</Label>
                      <Select value={spendingPeriod} onValueChange={setSpendingPeriod}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">{getText('Chak jou', 'Quotidien', 'Daily')}</SelectItem>
                          <SelectItem value="monthly">{getText('Chak mwa', 'Mensuel', 'Monthly')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => updateControls({ spending_limit_usd: parseFloat(spendingLimit), spending_limit_period: spendingPeriod })}
                      disabled={updatingControls || !spendingLimit || Number(spendingLimit) <= 0}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {getText('Sove limit', 'Enregistrer limite', 'Save limit')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openTransactions(selectedCard)}
                      disabled={txLoading}
                      className="border-purple-300 text-purple-700 hover:bg-purple-50"
                    >
                      {getText('Wè tranzaksyon', 'Voir transactions', 'View transactions')}
                    </Button>
                    {selectedCard?.card_status === 'locked' ? (
                      <Button
                        variant="outline"
                        onClick={() => updateControls({ lock: false })}
                        disabled={updatingControls || (selectedCard.failed_payment_count >= 3)}
                        className="border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        {getText('Debloke', 'Débloquer', 'Unlock')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => updateControls({ lock: true })}
                        disabled={updatingControls}
                        className="border-red-300 text-red-700 hover:bg-red-50"
                      >
                        {getText('Bloke kat la', 'Bloquer la carte', 'Lock card')}
                      </Button>
                    )}
                  </div>

                  {(selectedCard.failed_payment_count >= 3) ? (
                    <div className="text-xs text-red-600">
                      {getText(
                        'Kat la bloke apre 3 echèk. Kontakte sipò pou debloke.',
                        'Carte bloquée après 3 échecs. Contactez le support pour débloquer.',
                        'Card locked after 3 failures. Contact support to unlock.'
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Transactions Modal (Strowallet) */}
        <Dialog open={showTxModal} onOpenChange={setShowTxModal}>
          <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="text-purple-700" size={20} />
                {getText('Tranzaksyon Kat', 'Transactions Carte', 'Card Transactions')}
              </DialogTitle>
            </DialogHeader>
            {txLoading ? (
              <div className="py-8 text-center text-stone-500">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-stone-500">
                  {getText(
                    'Nòt: sa montre repons Strowallet la (si IP whitelist la pa fèt, li ka bay 403).',
                    'Note: affiche la réponse Strowallet (si IP non whitelist, peut retourner 403).',
                    'Note: shows Strowallet response (may return 403 if IP is not whitelisted).'
                  )}
                </p>
                {extractTxRows(txData).length ? (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-stone-50 dark:bg-stone-900">
                        <tr>
                          <th className="text-left p-2">{getText('Dat', 'Date', 'Date')}</th>
                          <th className="text-left p-2">{getText('Deskripsyon', 'Description', 'Description')}</th>
                          <th className="text-right p-2">{getText('Montan', 'Montant', 'Amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractTxRows(txData).slice(0, 50).map((r, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2 whitespace-nowrap">
                              {String(r.created_at || r.createdAt || r.date || r.time || '—')}
                            </td>
                            <td className="p-2">
                              {String(r.description || r.narration || r.merchant || r.type || '—')}
                            </td>
                            <td className="p-2 text-right whitespace-nowrap">
                              {String(r.amount ?? r.value ?? r.total ?? '—')} {String(r.currency || '')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <pre className="text-xs whitespace-pre-wrap bg-stone-50 dark:bg-stone-900 border rounded-lg p-3 overflow-x-auto">
                    {txData ? JSON.stringify(txData, null, 2) : ''}
                  </pre>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => selectedCard ? openTransactions(selectedCard) : null}
                    disabled={txLoading || !selectedCard}
                  >
                    <RefreshCw size={16} className="mr-2" />
                    {getText('Rechaje', 'Recharger', 'Reload')}
                  </Button>
                  <Button variant="outline" onClick={() => setShowTxModal(false)}>
                    {getText('Fèmen', 'Fermer', 'Close')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
