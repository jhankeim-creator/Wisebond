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
  RefreshCw
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
  const [txLiveMode, setTxLiveMode] = useState(true);
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

  // PIN state
  const [hasPin, setHasPin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSetPinModal, setShowSetPinModal] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [showResetPinModal, setShowResetPinModal] = useState(false);
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [oldPinInput, setOldPinInput] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pendingCardOrder, setPendingCardOrder] = useState(null);
  const [sensitiveCardData, setSensitiveCardData] = useState(null);
  const [showSensitiveData, setShowSensitiveData] = useState(false);


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

  // Check PIN status on load
  const checkPinStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/virtual-cards/pin-status`);
      setHasPin(res.data.has_pin);
    } catch (e) {
      console.error('Error checking PIN status:', e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchConfig();
    checkPinStatus();
  }, [fetchData, fetchConfig, checkPinStatus]);

  // Live refresh transactions every 10 seconds when modal is open
  useEffect(() => {
    if (!showTxModal || !selectedCard?.order_id || !txLiveMode) return;
    
    const refreshTx = async () => {
      try {
        const resp = await axios.get(`${API}/virtual-cards/${selectedCard.order_id}/transactions?page=1&take=50`);
        setTxData(resp.data);
      } catch (e) {
        // Silent fail for live refresh
      }
    };
    
    const interval = setInterval(refreshTx, 10000); // 10 seconds
    return () => clearInterval(interval);
  }, [showTxModal, selectedCard?.order_id, txLiveMode]);

  // Set PIN for first time
  const handleSetPin = async () => {
    if (!newPinInput || newPinInput.length < 4) {
      toast.error(getText('PIN dwe gen omwen 4 chif', 'Le PIN doit avoir au moins 4 chiffres', 'PIN must have at least 4 digits'));
      return;
    }
    if (newPinInput !== confirmPinInput) {
      toast.error(getText('PIN yo pa matche', 'Les PINs ne correspondent pas', 'PINs do not match'));
      return;
    }

    setPinLoading(true);
    try {
      await axios.post(`${API}/virtual-cards/set-pin`, { pin: newPinInput });
      toast.success(getText('PIN kreye avèk siksè!', 'PIN créé avec succès!', 'PIN created successfully!'));
      setHasPin(true);
      setShowSetPinModal(false);
      setNewPinInput('');
      setConfirmPinInput('');
      
      // If there was a pending card to view, show PIN entry modal
      if (pendingCardOrder) {
        setShowPinModal(true);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    } finally {
      setPinLoading(false);
    }
  };

  // Change existing PIN
  const handleChangePin = async () => {
    if (!oldPinInput) {
      toast.error(getText('Antre ansyen PIN ou', 'Entrez votre ancien PIN', 'Enter your old PIN'));
      return;
    }
    if (!newPinInput || newPinInput.length < 4) {
      toast.error(getText('Nouvo PIN dwe gen omwen 4 chif', 'Le nouveau PIN doit avoir au moins 4 chiffres', 'New PIN must have at least 4 digits'));
      return;
    }
    if (newPinInput !== confirmPinInput) {
      toast.error(getText('PIN yo pa matche', 'Les PINs ne correspondent pas', 'PINs do not match'));
      return;
    }

    setPinLoading(true);
    try {
      await axios.post(`${API}/virtual-cards/change-pin`, { old_pin: oldPinInput, new_pin: newPinInput });
      toast.success(getText('PIN chanje avèk siksè!', 'PIN changé avec succès!', 'PIN changed successfully!'));
      setShowChangePinModal(false);
      setOldPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    } finally {
      setPinLoading(false);
    }
  };

  // Request PIN reset code via email
  const handleRequestPinReset = async () => {
    setPinLoading(true);
    try {
      await axios.post(`${API}/virtual-cards/request-pin-reset`);
      toast.success(getText('Kòd voye nan imèl ou!', 'Code envoyé à votre email!', 'Code sent to your email!'));
      setResetCodeSent(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    } finally {
      setPinLoading(false);
    }
  };

  // Reset PIN with verification code
  const handleResetPin = async () => {
    if (!resetCode || resetCode.length < 6) {
      toast.error(getText('Antre kòd 6 chif la', 'Entrez le code à 6 chiffres', 'Enter the 6-digit code'));
      return;
    }
    if (!newPinInput || newPinInput.length < 4) {
      toast.error(getText('PIN dwe gen omwen 4 chif', 'Le PIN doit avoir au moins 4 chiffres', 'PIN must be at least 4 digits'));
      return;
    }
    if (newPinInput !== confirmPinInput) {
      toast.error(getText('PIN yo pa menm', 'Les PIN ne correspondent pas', 'PINs do not match'));
      return;
    }

    setPinLoading(true);
    try {
      await axios.post(`${API}/virtual-cards/reset-pin?code=${resetCode}`, { new_pin: newPinInput });
      toast.success(getText('PIN reyinisyalize avèk siksè!', 'PIN réinitialisé avec succès!', 'PIN reset successfully!'));
      setShowResetPinModal(false);
      setResetCodeSent(false);
      setResetCode('');
      setNewPinInput('');
      setConfirmPinInput('');
      setHasPin(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    } finally {
      setPinLoading(false);
    }
  };

  // Verify PIN and get card details
  const handleVerifyPin = async () => {
    if (!pinInput || !pendingCardOrder) {
      return;
    }

    setPinLoading(true);
    try {
      const res = await axios.post(`${API}/virtual-cards/verify-pin`, {
        order_id: pendingCardOrder.order_id,
        pin: pinInput
      });
      
      setSensitiveCardData(res.data);
      setShowSensitiveData(true);
      setShowPinModal(false);
      setPinInput('');
      
      // Now show card details modal with sensitive data
      setSelectedCard(pendingCardOrder);
      setSpendingLimit(pendingCardOrder?.spending_limit_usd != null ? String(pendingCardOrder.spending_limit_usd) : '');
      setSpendingPeriod(pendingCardOrder?.spending_limit_period || 'monthly');
      setShowCardDetails(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || getText('PIN pa kòrèk', 'PIN incorrect', 'Incorrect PIN'));
    } finally {
      setPinLoading(false);
    }
  };

  // Open card details - now requires PIN
  const openCardDetails = (order) => {
    setPendingCardOrder(order);
    setSensitiveCardData(null);
    setShowSensitiveData(false);
    
    if (!hasPin) {
      // User needs to set up PIN first
      setShowSetPinModal(true);
    } else {
      // User has PIN, ask for it
      setShowPinModal(true);
    }
  };

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

  const openWithdrawModal = () => {
    // Auto-select card if only one
    if (approvedCards.length === 1) {
      setWithdrawCardId(approvedCards[0].order_id);
    }
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
    setSelectedCard(order); // Set selected card for live refresh
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
    if (!data) return [];
    
    // Helper to check and parse JSON strings
    const tryParseJSON = (val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      }
      return val;
    };
    
    // Check if value is a non-empty array
    const isValidArray = (val) => Array.isArray(val) && val.length > 0;
    
    // Try multiple paths to find transactions
    const checkPaths = (obj) => {
      if (!obj) return [];
      
      // Direct array check
      if (isValidArray(obj)) return obj;
      
      const paths = [
        obj?.data,
        obj?.transactions,
        obj?.message?.data,
        obj?.message?.transactions,
        obj?.result?.data,
        obj?.result?.transactions,
        obj?.result,
        obj?.records,
        obj?.items,
        obj?.list,
        obj?.history,
      ];
      
      for (let path of paths) {
        path = tryParseJSON(path);
        if (isValidArray(path)) {
          return path;
        }
      }
      return [];
    };
    
    // Debug log to see actual structure
    console.log('Transaction data received:', JSON.stringify(data, null, 2));
    
    // Check multiple levels: response.data, response, root
    let rows = [];
    
    // Level 1: data.response.data (most common for Strowallet)
    if (data?.response?.data) {
      const parsed = tryParseJSON(data.response.data);
      if (isValidArray(parsed)) rows = parsed;
    }
    
    // Level 2: data.response
    if (rows.length === 0 && data?.response) {
      rows = checkPaths(data.response);
    }
    
    // Level 3: root level
    if (rows.length === 0) {
      rows = checkPaths(data);
    }
    
    // Level 4: Try parsing message as JSON
    if (rows.length === 0) {
      const msg = data?.response?.message || data?.message;
      if (msg && typeof msg === 'string') {
        const parsed = tryParseJSON(msg);
        if (parsed) {
          rows = checkPaths(parsed);
        }
      }
    }
    
    console.log('Extracted transactions:', rows.length, rows);
    return rows;
  };

  // Check if there are transactions to display
  const hasTxData = (data) => {
    if (!data) return false;
    if (data.error) return false;
    const rows = extractTxRows(data);
    return rows.length > 0;
  };

  // Get a user-friendly message when no transactions
  const getTxMessage = (data) => {
    if (!data) return getText('Pa gen done', 'Pas de données', 'No data');
    if (data.error) return data.error;
    // Check for success message but empty data
    const respMsg = data?.response?.message || data?.message;
    if (respMsg && respMsg.toLowerCase().includes('success')) {
      return getText('Pa gen tranzaksyon pou kat sa a.', 'Aucune transaction pour cette carte.', 'No transactions for this card.');
    }
    if (data.message) return data.message;
    if (data?.response?.message && typeof data.response.message === 'string') {
      return data.response.message;
    }
    return getText('Pa gen tranzaksyon disponib pou kat sa a.', 'Aucune transaction disponible pour cette carte.', 'No transactions available for this card.');
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
        {/* Feature flag */}
        {virtualCardsEnabled === false ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
              <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-2">
                {getText('Kat vityèl pa disponib kounye a', 'Cartes virtuelles indisponibles', 'Virtual cards unavailable')}
              </h3>
              <p className="text-stone-600 dark:text-stone-400">
                {getText(
                  'Fonksyon sa a ap aktive lè admin lan pare.',
                  'Cette fonctionnalité sera activée par l’admin quand elle sera prête.',
                  'This feature will be enabled by the admin when ready.'
                )}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* KYC Check */}
        {virtualCardsEnabled === false ? null : virtualCardsEnabled === null ? (
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
            {/* Info Banner */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-6 text-white">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2">
                    {getText('Kat Vityèl pou Acha an Liy', 'Carte Virtuelle pour Achats en Ligne', 'Virtual Card for Online Purchases')}
                  </h2>
                  <p className="text-purple-100 text-sm mb-3">
                    {getText(
                      'Kreye yon kat vityèl pou fè acha an liy (Netflix, Amazon, elatriye). Kat la jere pa yon tyè pati.',
                      'Créez une carte virtuelle pour faire des achats en ligne (Netflix, Amazon, etc.). La carte est gérée par un tiers.',
                      'Create a virtual card for online purchases (Netflix, Amazon, etc.). The card is managed by a third party.'
                    )}
                  </p>
                  <div className="bg-red-500/20 border border-red-300/30 rounded-lg p-3">
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

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-stone-900 dark:text-white">
                  {getText('Kat Mwen Yo', 'Mes Cartes', 'My Cards')}
                </h2>
                <p className="text-stone-500 dark:text-stone-400">
                  {getText('Jere kat vityèl ou yo', 'Gérez vos cartes virtuelles', 'Manage your virtual cards')}
                </p>
              </div>
              <Button onClick={() => setShowOrderModal(true)} className="btn-primary">
                <Plus className="mr-2" size={18} />
                {getText('Nouvo Kat', 'Nouvelle Carte', 'New Card')}
              </Button>
            </div>

            {/* Pending order notice */}
            {!loading && approvedCards.length === 0 && cardOrders.some(o => o.status === 'pending') ? (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10">
                <CardContent className="p-4">
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    {getText(
                      'Demann kat ou an an atant apwobasyon admin lan.',
                      'Votre demande de carte est en attente d’approbation.',
                      'Your card request is pending admin approval.'
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

            {/* Virtual Cards Display */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map(i => (
                  <div key={i} className="skeleton h-64 rounded-2xl" />
                ))}
              </div>
            ) : cardOrders.length === 0 ? (
              <div className="text-center py-12 text-stone-500">
                <CreditCard className="mx-auto mb-3 text-stone-400" size={48} />
                <p>{getText('Ou poko gen komand kat', 'Vous n\'avez pas encore de commande de carte', 'You have no card orders yet')}</p>
                <Button onClick={() => setShowOrderModal(true)} className="btn-gold mt-4">
                  <ShoppingCart className="mr-2" size={18} />
                  {getText('Komande premye kat ou', 'Commander votre première carte', 'Order your first card')}
                </Button>
              </div>
            ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {cardOrders.map((order) => (
                      <div key={order.order_id} className="space-y-3">
                        {/* Card Visual with info overlay */}
                        {order.status === 'approved' ? (
                          <div className="relative rounded-2xl shadow-lg overflow-hidden" style={{ aspectRatio: '1.586/1' }}>
                            {/* Background - Image or gradient */}
                            {(order.card_image || defaultCardBg) ? (
                              <img 
                                src={order.card_image || defaultCardBg} 
                                alt="Card" 
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]" />
                            )}
                            {/* Info Overlay */}
                            <div className="absolute inset-0 p-3 flex flex-col justify-between text-white">
                              <div className="flex justify-between items-start">
                                <span className="font-bold text-sm sm:text-base tracking-wide drop-shadow-lg">KAYICOM</span>
                                <span className="font-bold text-sm sm:text-base italic drop-shadow-lg">
                                  {(order.card_brand || order.card_type || 'VISA').toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-mono text-xs sm:text-sm tracking-[0.1em] drop-shadow-lg">
                                  •••• •••• •••• {order.card_last4 || '****'}
                                </p>
                              </div>
                              <div className="flex justify-between items-end text-[9px] sm:text-[10px]">
                                <div className="max-w-[40%]">
                                  <p className="text-white/70 uppercase drop-shadow">{getText('Pòtè', 'Titulaire', 'Holder')}</p>
                                  <p className="font-medium truncate drop-shadow-lg">{order.card_holder_name || user?.full_name?.toUpperCase() || '••••••••'}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-white/70 uppercase drop-shadow">EXP</p>
                                  <p className="font-mono drop-shadow-lg">{order.card_expiry || '••/••'}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-white/70 uppercase drop-shadow">CVV</p>
                                  <p className="font-mono drop-shadow-lg">•••</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-stone-200 dark:bg-stone-800 flex items-center justify-center rounded-2xl shadow-lg" style={{ aspectRatio: '1.586/1' }}>
                            <div className="text-center">
                              <CreditCard className="mx-auto mb-2 text-stone-400" size={40} />
                              <p className="text-stone-500 text-sm">{getText('An atant apwobasyon', 'En attente d\'approbation', 'Pending approval')}</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Status and Actions */}
                        <div className="flex items-center justify-between mb-2">
                          {getStatusBadge(order.status)}
                          <span className="text-xs text-stone-500">{new Date(order.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        {order.status === 'approved' && (
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              onClick={() => openCardDetails(order)}
                              className="bg-[#0d6efd] hover:bg-[#0b5ed7] text-white text-xs py-2 px-2"
                            >
                              <Eye size={14} className="mr-1" />
                              {getText('Detay', 'Détails', 'Details')}
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedCard(order);
                                setShowTopUpModal(true);
                                setTopUpCardId(order.order_id);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 px-2"
                            >
                              <Plus size={14} className="mr-1" />
                              {getText('Depo', 'Dépôt', 'Deposit')}
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedCard(order);
                                setShowWithdrawModal(true);
                                setWithdrawCardId(order.order_id);
                              }}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-xs py-2 px-2"
                            >
                              <ArrowDown size={14} className="mr-1" />
                              {getText('Retrè', 'Retrait', 'Withdraw')}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => openTransactions(order)}
                              className="text-xs py-2 px-2"
                            >
                              <History size={14} className="mr-1" />
                              {getText('Istorik', 'Historique', 'History')}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedCard(order);
                                updateControls({ lock: order.card_status !== 'locked' });
                              }}
                              className={`text-xs py-2 px-2 ${
                                order.card_status === 'locked' 
                                  ? 'text-emerald-600 border-emerald-300' 
                                  : 'text-red-600 border-red-300'
                              }`}
                            >
                              <Shield size={14} className="mr-1" />
                              {order.card_status === 'locked' ? getText('Debloke', 'Débloquer', 'Unlock') : getText('Freeze', 'Geler', 'Freeze')}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedCard(order);
                                setShowChangePinModal(true);
                              }}
                              className="text-xs py-2 px-2"
                            >
                              <Shield size={14} className="mr-1" />
                              PIN
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

            {/* Deposit/Top-up History for Cards */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History size={20} className="text-amber-500" />
                  {getText('Istorik Top-up Kat', 'Historique des Recharges', 'Card Top-up History')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="skeleton h-16 rounded-lg" />
                    ))}
                  </div>
                ) : cardDeposits.length === 0 ? (
                  <div className="text-center py-8 text-stone-500">
                    <Wallet className="mx-auto mb-3 text-stone-400" size={48} />
                    <p>{getText('Pa gen istorik top-up', 'Pas d\'historique de recharge', 'No top-up history')}</p>
                    <p className="text-sm mt-1">{getText('Top-up kat ou yo ap parèt isit la', 'Vos recharges carte apparaîtront ici', 'Your card top-ups will appear here')}</p>
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
                            <p className="font-medium text-stone-900 dark:text-white">
                              ${deposit.amount.toFixed(2)} USD
                            </p>
                            <p className="text-sm text-stone-500">
                              {new Date(deposit.created_at).toLocaleDateString()} - {deposit.card_email}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(deposit.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Withdrawals History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History size={20} className="text-stone-600" />
                  {getText('Istorik Retrè Kat', 'Historique des Retraits', 'Card Withdrawal History')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="skeleton h-16 rounded-lg" />
                    ))}
                  </div>
                ) : cardWithdrawals.length === 0 ? (
                  <div className="text-center py-8 text-stone-500">
                    <Wallet className="mx-auto mb-3 text-stone-400" size={48} />
                    <p>{getText('Pa gen istorik retrè', 'Pas d\'historique de retrait', 'No withdrawal history')}</p>
                    <p className="text-sm mt-1">{getText('Retrè yo ap parèt isit la', 'Vos retraits apparaîtront ici', 'Your withdrawals will appear here')}</p>
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
                            <p className="font-medium text-stone-900 dark:text-white">
                              ${Number(w.amount || 0).toFixed(2)} USD
                            </p>
                            <p className="text-sm text-stone-500">
                              {new Date(w.created_at).toLocaleDateString()} - {w.card_email}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(w.status)}
                      </div>
                    ))}
                  </div>
                )}
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
                {/* Quick info - Card ID only visible to admin */}
                <div className={`grid grid-cols-1 ${user?.is_admin ? 'sm:grid-cols-2' : ''} gap-3`}>
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3">
                    <p className="text-xs text-stone-500">{getText('Email Kat', 'Email Carte', 'Card Email')}</p>
                    <p className="font-medium break-all">{selectedCard.card_email || user?.email || '—'}</p>
                  </div>
                  {user?.is_admin && (
                    <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3">
                      <p className="text-xs text-stone-500">{getText('ID Kat (Provider)', 'ID Carte (Provider)', 'Card ID (Provider)')}</p>
                      <p className="font-mono text-sm break-all">{selectedCard.provider_card_id || '—'}</p>
                    </div>
                  )}
                </div>

                {/* Card Visual with info overlay */}
                <div className="relative rounded-2xl shadow-lg overflow-hidden" style={{ aspectRatio: '1.586/1' }}>
                  {/* Background - Image or gradient */}
                  {(selectedCard.card_image || defaultCardBg) ? (
                    <img 
                      src={selectedCard.card_image || defaultCardBg} 
                      alt="Card" 
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]" />
                  )}
                  {/* Info Overlay - Always visible */}
                  <div className="absolute inset-0 p-3 sm:p-4 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-base sm:text-lg tracking-wide drop-shadow-lg">KAYICOM</span>
                      <span className="font-bold text-base sm:text-lg italic drop-shadow-lg">
                        {(selectedCard.card_brand || selectedCard.card_type || 'VISA').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-mono text-sm sm:text-base tracking-[0.1em] drop-shadow-lg">
                        {showSensitiveData && sensitiveCardData?.card_number 
                          ? sensitiveCardData.card_number.replace(/(.{4})/g, '$1 ').trim()
                          : `•••• •••• •••• ${selectedCard.card_last4 || '****'}`
                        }
                      </p>
                    </div>
                    <div className="flex justify-between items-end text-[10px] sm:text-xs">
                      <div className="max-w-[40%]">
                        <p className="text-white/70 uppercase drop-shadow">{getText('Pòtè', 'Titulaire', 'Holder')}</p>
                        <p className="font-medium truncate drop-shadow-lg">{selectedCard.card_holder_name || user?.full_name?.toUpperCase() || '••••••••'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-white/70 uppercase drop-shadow">EXP</p>
                        <p className="font-mono drop-shadow-lg">
                          {showSensitiveData && sensitiveCardData?.card_expiry 
                            ? sensitiveCardData.card_expiry 
                            : (selectedCard.card_expiry || '••/••')
                          }
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/70 uppercase drop-shadow">CVV</p>
                        <p className="font-mono font-bold drop-shadow-lg">
                          {showSensitiveData && sensitiveCardData?.cvv 
                            ? sensitiveCardData.cvv 
                            : '•••'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Balance & Copy Buttons */}
                <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-stone-500">{getText('Balans', 'Solde', 'Balance')}</span>
                    <span className="font-bold text-xl text-emerald-600">${(sensitiveCardData?.balance ?? selectedCard.balance ?? 0).toFixed(2)}</span>
                  </div>
                  
                  {showSensitiveData && sensitiveCardData ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(sensitiveCardData.card_number || '');
                          toast.success(getText('Nimewo kat kopye!', 'Numéro copié!', 'Card number copied!'));
                        }}
                      >
                        <Copy size={14} className="mr-2" />
                        {getText('Kopye Nimewo', 'Copier Numéro', 'Copy Number')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(sensitiveCardData.cvv || '');
                          toast.success(getText('CVV kopye!', 'CVV copié!', 'CVV copied!'));
                        }}
                      >
                        <Copy size={14} className="mr-2" />
                        {getText('Kopye CVV', 'Copier CVV', 'Copy CVV')}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500 text-center">
                      {getText(
                        'Antre PIN pou wè tout enfòmasyon kat la.',
                        'Entrez le PIN pour voir toutes les infos.',
                        'Enter PIN to see all card info.'
                      )}
                    </p>
                  )}
                </div>

                {/* Billing Address - Always show */}
                <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="text-stone-500 mt-1" size={18} />
                    <div className="flex-1">
                      <p className="text-stone-500 text-sm mb-1">{getText('Adrès Faktirasyon', 'Adresse de Facturation', 'Billing Address')}</p>
                      {(selectedCard.billing_address || sensitiveCardData?.billing_address) ? (
                        <>
                          <p className="text-stone-900 dark:text-white font-medium">
                            {sensitiveCardData?.billing_address || selectedCard.billing_address}
                          </p>
                          <p className="text-stone-700 dark:text-stone-300 text-sm">
                            {[
                              sensitiveCardData?.billing_city || selectedCard.billing_city,
                              sensitiveCardData?.billing_state || selectedCard.billing_state,
                              sensitiveCardData?.billing_zip || selectedCard.billing_zip,
                              sensitiveCardData?.billing_country || selectedCard.billing_country
                            ].filter(Boolean).join(', ')}
                          </p>
                        </>
                      ) : (
                        <p className="text-stone-400 dark:text-stone-500 italic text-sm">
                          {getText('Pa gen adrès faktirasyon', 'Pas d\'adresse de facturation', 'No billing address')}
                        </p>
                      )}
                    </div>
                  </div>
                  {(selectedCard.billing_address || sensitiveCardData?.billing_address) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => {
                        const addr = [
                          sensitiveCardData?.billing_address || selectedCard.billing_address,
                          sensitiveCardData?.billing_city || selectedCard.billing_city,
                          sensitiveCardData?.billing_state || selectedCard.billing_state,
                          sensitiveCardData?.billing_zip || selectedCard.billing_zip,
                          sensitiveCardData?.billing_country || selectedCard.billing_country
                        ].filter(Boolean).join(', ');
                        navigator.clipboard.writeText(addr);
                        toast.success(getText('Adrès kopye!', 'Adresse copiée!', 'Address copied!'));
                      }}
                    >
                      <Copy size={14} className="mr-2" />
                      {getText('Kopye Adrès', 'Copier Adresse', 'Copy Address')}
                    </Button>
                  )}
                </div>

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
                    <Button
                      variant="outline"
                      onClick={() => { setShowCardDetails(false); setShowChangePinModal(true); }}
                      className="border-stone-300 text-stone-700 hover:bg-stone-50"
                    >
                      <Shield size={16} className="mr-1" />
                      {getText('Chanje PIN', 'Changer PIN', 'Change PIN')}
                    </Button>
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
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="text-purple-700" size={20} />
                  {getText('Tranzaksyon Kat', 'Transactions Carte', 'Card Transactions')}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${txLiveMode ? 'text-emerald-600' : 'text-stone-400'}`}>
                    {txLiveMode && <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-1"></span>}
                    LIVE
                  </span>
                  <button
                    onClick={() => setTxLiveMode(!txLiveMode)}
                    className={`w-10 h-5 rounded-full transition-colors ${txLiveMode ? 'bg-emerald-500' : 'bg-stone-300'}`}
                  >
                    <span className={`block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${txLiveMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </DialogTitle>
            </DialogHeader>
            {txLoading ? (
              <div className="py-8 text-center text-stone-500">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : (
              <div className="space-y-3">
                {hasTxData(txData) ? (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-stone-50 dark:bg-stone-900">
                        <tr>
                          <th className="text-left p-2">{getText('Dat', 'Date', 'Date')}</th>
                          <th className="text-left p-2">{getText('Deskripsyon', 'Description', 'Description')}</th>
                          <th className="text-right p-2">{getText('Montan', 'Montant', 'Amount')}</th>
                          <th className="text-right p-2">{getText('Estati', 'Statut', 'Status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractTxRows(txData).slice(0, 50).map((r, idx) => (
                          <tr key={idx} className="border-t hover:bg-stone-50 dark:hover:bg-stone-800">
                            <td className="p-2 whitespace-nowrap text-stone-600 dark:text-stone-400">
                              {String(r.created_at || r.createdAt || r.date || r.time || r.transaction_date || '—')}
                            </td>
                            <td className="p-2 text-stone-800 dark:text-stone-200">
                              {String(r.description || r.narration || r.merchant || r.merchant_name || r.type || r.transaction_type || r.reference || '—')}
                            </td>
                            <td className={`p-2 text-right whitespace-nowrap font-medium ${
                              (r.type === 'credit' || r.transaction_type === 'credit' || parseFloat(r.amount) > 0) 
                                ? 'text-emerald-600' 
                                : 'text-red-600'
                            }`}>
                              {r.type === 'credit' || r.transaction_type === 'credit' ? '+' : '-'}
                              ${Math.abs(parseFloat(r.amount || r.value || r.total || 0)).toFixed(2)} {String(r.currency || 'USD')}
                            </td>
                            <td className="p-2 text-right">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                (r.status === 'success' || r.status === 'completed' || r.status === 'approved') 
                                  ? 'bg-emerald-100 text-emerald-700' 
                                  : r.status === 'pending' 
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-stone-100 text-stone-600'
                              }`}>
                                {String(r.status || 'completed')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-stone-50 dark:bg-stone-900 border rounded-lg p-6 text-center">
                    <History className="mx-auto mb-3 text-stone-400" size={40} />
                    <p className="text-stone-600 dark:text-stone-400">
                      {getTxMessage(txData)}
                    </p>
                  </div>
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


        {/* PIN Entry Modal */}
        <Dialog open={showPinModal} onOpenChange={setShowPinModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="text-[#EA580C]" size={24} />
                {getText('Antre PIN ou', 'Entrez votre PIN', 'Enter your PIN')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-stone-600 dark:text-stone-400">
                {getText(
                  'Pou sekirite w, antre PIN 4-6 chif ou pou wè detay kat la.',
                  'Pour votre sécurité, entrez votre PIN de 4-6 chiffres pour voir les détails de la carte.',
                  'For your security, enter your 4-6 digit PIN to view card details.'
                )}
              </p>
              <Input
                type="password"
                placeholder="****"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest"
              />
              <div className="flex gap-3">
                <Button
                  onClick={handleVerifyPin}
                  disabled={pinLoading || pinInput.length < 4}
                  className="flex-1 bg-[#EA580C] hover:bg-[#C54B0A]"
                >
                  {pinLoading ? getText('Ap verifye...', 'Vérification...', 'Verifying...') : getText('Verifye', 'Vérifier', 'Verify')}
                </Button>
                <Button variant="outline" onClick={() => { setShowPinModal(false); setPinInput(''); }}>
                  {getText('Anile', 'Annuler', 'Cancel')}
                </Button>
              </div>
              <button 
                onClick={() => { setShowPinModal(false); setShowResetPinModal(true); setResetCodeSent(false); setResetCode(''); }}
                className="text-sm text-[#EA580C] hover:underline w-full text-center"
              >
                {getText('Bliye PIN? Reyinisyalize li', 'PIN oublié? Réinitialisez-le', 'Forgot PIN? Reset it')}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Set PIN Modal (First Time) */}
        <Dialog open={showSetPinModal} onOpenChange={setShowSetPinModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="text-[#EA580C]" size={24} />
                {getText('Kreye PIN Kat', 'Créer PIN Carte', 'Create Card PIN')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-stone-600 dark:text-stone-400">
                {getText(
                  'Kreye yon PIN 4-6 chif pou pwoteje detay kat ou. Ou pral bezwen PIN sa a chak fwa ou vle wè nimewo kat la ak CVV.',
                  'Créez un PIN de 4-6 chiffres pour protéger les détails de votre carte. Vous aurez besoin de ce PIN chaque fois que vous voulez voir le numéro de carte et CVV.',
                  'Create a 4-6 digit PIN to protect your card details. You will need this PIN every time you want to see the card number and CVV.'
                )}
              </p>
              <div>
                <Label>{getText('Nouvo PIN', 'Nouveau PIN', 'New PIN')}</Label>
                <Input
                  type="password"
                  placeholder="****"
                  maxLength={6}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest mt-2"
                />
              </div>
              <div>
                <Label>{getText('Konfime PIN', 'Confirmer PIN', 'Confirm PIN')}</Label>
                <Input
                  type="password"
                  placeholder="****"
                  maxLength={6}
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest mt-2"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleSetPin}
                  disabled={pinLoading || newPinInput.length < 4}
                  className="flex-1 bg-[#EA580C] hover:bg-[#C54B0A]"
                >
                  {pinLoading ? getText('Ap kreye...', 'Création...', 'Creating...') : getText('Kreye PIN', 'Créer PIN', 'Create PIN')}
                </Button>
                <Button variant="outline" onClick={() => { setShowSetPinModal(false); setNewPinInput(''); setConfirmPinInput(''); }}>
                  {getText('Anile', 'Annuler', 'Cancel')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Change PIN Modal */}
        <Dialog open={showChangePinModal} onOpenChange={setShowChangePinModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="text-[#EA580C]" size={24} />
                {getText('Chanje PIN', 'Changer PIN', 'Change PIN')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>{getText('Ansyen PIN', 'Ancien PIN', 'Old PIN')}</Label>
                <Input
                  type="password"
                  placeholder="****"
                  maxLength={6}
                  value={oldPinInput}
                  onChange={(e) => setOldPinInput(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest mt-2"
                />
              </div>
              <div>
                <Label>{getText('Nouvo PIN', 'Nouveau PIN', 'New PIN')}</Label>
                <Input
                  type="password"
                  placeholder="****"
                  maxLength={6}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest mt-2"
                />
              </div>
              <div>
                <Label>{getText('Konfime Nouvo PIN', 'Confirmer Nouveau PIN', 'Confirm New PIN')}</Label>
                <Input
                  type="password"
                  placeholder="****"
                  maxLength={6}
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest mt-2"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleChangePin}
                  disabled={pinLoading || oldPinInput.length < 4 || newPinInput.length < 4}
                  className="flex-1 bg-[#EA580C] hover:bg-[#C54B0A]"
                >
                  {pinLoading ? getText('Ap chanje...', 'Changement...', 'Changing...') : getText('Chanje PIN', 'Changer PIN', 'Change PIN')}
                </Button>
                <Button variant="outline" onClick={() => { setShowChangePinModal(false); setOldPinInput(''); setNewPinInput(''); setConfirmPinInput(''); }}>
                  {getText('Anile', 'Annuler', 'Cancel')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reset PIN Modal (via email verification) */}
        <Dialog open={showResetPinModal} onOpenChange={(open) => { setShowResetPinModal(open); if (!open) { setResetCodeSent(false); setResetCode(''); setNewPinInput(''); setConfirmPinInput(''); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="text-[#EA580C]" size={24} />
                {getText('Reyinisyalize PIN', 'Réinitialiser PIN', 'Reset PIN')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!resetCodeSent ? (
                <>
                  <p className="text-stone-600 text-sm">
                    {getText(
                      'Nou pral voye yon kòd verifikasyon nan imèl ou pou reyinisyalize PIN ou.',
                      'Nous allons envoyer un code de vérification à votre email pour réinitialiser votre PIN.',
                      'We will send a verification code to your email to reset your PIN.'
                    )}
                  </p>
                  <Button
                    onClick={handleRequestPinReset}
                    disabled={pinLoading}
                    className="w-full bg-[#EA580C] hover:bg-[#C54B0A]"
                  >
                    {pinLoading ? getText('Ap voye...', 'Envoi...', 'Sending...') : getText('Voye Kòd', 'Envoyer Code', 'Send Code')}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-emerald-600 text-sm font-medium">
                    ✓ {getText('Kòd voye nan imèl ou!', 'Code envoyé à votre email!', 'Code sent to your email!')}
                  </p>
                  <div>
                    <Label>{getText('Kòd Verifikasyon (6 chif)', 'Code de Vérification (6 chiffres)', 'Verification Code (6 digits)')}</Label>
                    <Input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                      className="text-center text-2xl tracking-widest mt-2"
                    />
                  </div>
                  <div>
                    <Label>{getText('Nouvo PIN (4-6 chif)', 'Nouveau PIN (4-6 chiffres)', 'New PIN (4-6 digits)')}</Label>
                    <Input
                      type="password"
                      placeholder="****"
                      maxLength={6}
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                      className="text-center text-2xl tracking-widest mt-2"
                    />
                  </div>
                  <div>
                    <Label>{getText('Konfime Nouvo PIN', 'Confirmer Nouveau PIN', 'Confirm New PIN')}</Label>
                    <Input
                      type="password"
                      placeholder="****"
                      maxLength={6}
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                      className="text-center text-2xl tracking-widest mt-2"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleResetPin}
                      disabled={pinLoading || resetCode.length < 6 || newPinInput.length < 4}
                      className="flex-1 bg-[#EA580C] hover:bg-[#C54B0A]"
                    >
                      {pinLoading ? getText('Ap reyinisyalize...', 'Réinitialisation...', 'Resetting...') : getText('Reyinisyalize PIN', 'Réinitialiser PIN', 'Reset PIN')}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowResetPinModal(false); setResetCodeSent(false); setResetCode(''); setNewPinInput(''); setConfirmPinInput(''); }}>
                      {getText('Anile', 'Annuler', 'Cancel')}
                    </Button>
                  </div>
                  <button 
                    onClick={handleRequestPinReset}
                    disabled={pinLoading}
                    className="text-sm text-[#EA580C] hover:underline w-full text-center"
                  >
                    {getText('Revoye Kòd', 'Renvoyer Code', 'Resend Code')}
                  </button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
