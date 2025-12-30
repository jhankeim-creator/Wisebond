import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  MapPin
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

// Card logos
const VISA_LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0ODAgMjAwIj48cGF0aCBmaWxsPSIjMUE1RjdBIiBkPSJNMTcxLjcgNjUuNmwtNDEuMyA2OS40aDI1LjdsNi4xLTE1LjRoMjkuNGw2LjEgMTUuNGgyNS43bC00MS4zLTY5LjRoLTEwLjR6bTMuNCAyMC4zbDkuNiAyMy4xaC0xOS4zbDkuNy0yMy4xem01Ni4yLTIwLjNsLTE1LjggNDEuNy03LTQxLjdoLTI0LjZsMjAuNiA2OS40aDI0LjZsMjkuOS02OS40aC0yNy43em02NS4yIDBsLTE1LjggNDEuNy03LTQxLjdoLTI0LjZsMjAuNiA2OS40aDI0LjZsMjkuOS02OS40aC0yNy43em03MS41IDBoLTQ0LjZ2NjkuNGgyNS43di0yMy45aDIwLjFjMTkuOCAwIDMyLjEtMTEgMzIuMS0yMi44IDAtMTEuNy0xMi4zLTIyLjctMzMuMy0yMi43em0tMi41IDE4LjdjNy44IDAgMTEuNiAzLjQgMTEuNiA3LjQgMCAzLjktMy44IDcuNS0xMS42IDcuNWgtMTYuNHYtMTUuMWgxNi40eiIvPjwvc3ZnPg==';
const MASTERCARD_LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMzEuMiAxNTAiPjxjaXJjbGUgZmlsbD0iI2ViMDAxYiIgY3g9IjY4IiBjeT0iNzUiIHI9IjUyIi8+PGNpcmNsZSBmaWxsPSIjZjc5ZTFiIiBjeD0iMTYzIiBjeT0iNzUiIHI9IjUyIi8+PHBhdGggZmlsbD0iI2ZmNWYwMCIgZD0iTTExNS41IDMzLjJjLTE2LjcgMTMuMS0yNy40IDMzLjMtMjcuNCA1NS44czEwLjcgNDIuNyAyNy40IDU1LjhjMTYuNy0xMy4xIDI3LjQtMzMuMyAyNy40LTU1LjhzLTEwLjctNDIuNy0yNy40LTU1Ljh6Ii8+PC9zdmc+';

export default function VirtualCard() {
  const { language } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [cardOrders, setCardOrders] = useState([]);
  const [cardDeposits, setCardDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [ordering, setOrdering] = useState(false);
  const [cardEmail, setCardEmail] = useState('');
  const [cardFee, setCardFee] = useState(500);
  const [showCVV, setShowCVV] = useState(false);
  const [showFullNumber, setShowFullNumber] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    fetchData();
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const resp = await axios.get(`${API}/public/app-config`);
      if (resp.data?.card_order_fee_htg) {
        setCardFee(resp.data.card_order_fee_htg);
      }
    } catch (e) {
      // keep default
    }
  };

  const fetchData = async () => {
    try {
      const [ordersRes, depositsRes] = await Promise.all([
        axios.get(`${API}/virtual-cards/orders`),
        axios.get(`${API}/virtual-cards/deposits`)
      ]);
      setCardOrders(ordersRes.data.orders || []);
      setCardDeposits(depositsRes.data.deposits || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const orderCard = async () => {
    if (!cardEmail.trim()) {
      toast.error(getText('Antre email pou kat la', 'Veuillez entrer un email pour la carte', 'Please enter an email for the card'));
      return;
    }

    setOrdering(true);
    try {
      await axios.post(`${API}/virtual-cards/order`, { card_email: cardEmail });
      toast.success(getText('Komand kat soumèt siksè!', 'Commande de carte soumise avec succès!', 'Card order submitted successfully!'));
      setShowOrderModal(false);
      setCardEmail('');
      fetchData();
      refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    } finally {
      setOrdering(false);
    }
  };

  const viewCardDetails = (order) => {
    setSelectedCard(order);
    setShowCVV(false);
    setShowFullNumber(false);
    setShowCardDetails(true);
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(getText(`${label} kopye!`, `${label} copié!`, `${label} copied!`));
  };

  const formatCardNumber = (number, show = false) => {
    if (!number) return '•••• •••• •••• ••••';
    if (show) {
      // Format as XXXX XXXX XXXX XXXX
      return number.replace(/(.{4})/g, '$1 ').trim();
    }
    return `•••• •••• •••• ${number.slice(-4)}`;
  };

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
        {/* KYC Check */}
        {user?.kyc_status !== 'approved' ? (
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
                  <div className="bg-white/10 rounded-lg p-3 mb-3">
                    <p className="text-emerald-300 font-semibold flex items-center gap-2">
                      🎁 {getText('Bonis: $5 USD sou premye kat ou!', 'Bonus: $5 USD sur votre première carte!', 'Bonus: $5 USD on your first card!')}
                    </p>
                  </div>
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

            {/* Order Card Button */}
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
                <ShoppingCart className="mr-2" size={18} />
                {getText('Komande yon kat', 'Commander une carte', 'Order a card')}
              </Button>
            </div>

            {/* Card Orders History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard size={20} className="text-[#EA580C]" />
                  {getText('Komand Kat yo', 'Commandes de cartes', 'Card Orders')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="skeleton h-16 rounded-lg" />
                    ))}
                  </div>
                ) : cardOrders.length === 0 ? (
                  <div className="text-center py-8 text-stone-500">
                    <CreditCard className="mx-auto mb-3 text-stone-400" size={48} />
                    <p>{getText('Ou poko gen komand kat', 'Vous n\'avez pas encore de commande de carte', 'You have no card orders yet')}</p>
                    <Button onClick={() => setShowOrderModal(true)} className="btn-gold mt-4">
                      <ShoppingCart className="mr-2" size={18} />
                      {getText('Komande premye kat ou', 'Commander votre première carte', 'Order your first card')}
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100 dark:divide-stone-700">
                    {cardOrders.map((order) => (
                      <div key={order.order_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
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
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-stone-900 dark:text-white">{order.card_email}</p>
                              {order.card_brand && order.status === 'approved' && (
                                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                                  {order.card_brand}
                                </span>
                              )}
                            </div>
                            {order.status === 'approved' && order.card_last4 && (
                              <p className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                                •••• •••• •••• {order.card_last4}
                              </p>
                            )}
                            <p className="text-sm text-stone-500">
                              {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {order.status === 'approved' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewCardDetails(order)}
                              className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                            >
                              <Eye size={16} className="mr-1" />
                              {getText('Wè Detay', 'Voir Détails', 'View Details')}
                            </Button>
                          )}
                          <span className="text-sm font-medium">G {order.fee}</span>
                          {getStatusBadge(order.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Deposit History for Cards */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History size={20} className="text-amber-500" />
                  {getText('Istorik Depo Kat', 'Historique des Dépôts Carte', 'Card Deposit History')}
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
                    <p>{getText('Pa gen istorik depo kat', 'Pas d\'historique de dépôt carte', 'No card deposit history')}</p>
                    <p className="text-sm mt-1">{getText('Depo kat ou yo ap parèt isit la', 'Vos dépôts carte apparaîtront ici', 'Your card deposits will appear here')}</p>
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
                  desc: getText('Retrè pa kat an USD sèlman', 'Retrait par carte en USD uniquement', 'Card withdrawal in USD only')
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
                <Input
                  type="email"
                  placeholder="votre@email.com"
                  value={cardEmail}
                  onChange={(e) => setCardEmail(e.target.value)}
                  className="mt-2"
                  data-testid="card-email-input"
                />
                <p className="text-sm text-stone-500 mt-2">
                  {getText(
                    'Email sa a ap itilize pou voye detay kat la ak pou retrè pa kat.',
                    'Cet email sera utilisé pour envoyer les détails de la carte et pour les retraits par carte.',
                    'This email will be used to send card details and for card withdrawals.'
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
                disabled={ordering || !cardEmail.trim()}
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

        {/* Card Details Modal */}
        <Dialog open={showCardDetails} onOpenChange={setShowCardDetails}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="text-[#EA580C]" size={24} />
                {getText('Detay Kat ou', 'Détails de votre Carte', 'Your Card Details')}
              </DialogTitle>
            </DialogHeader>
            
            {selectedCard && (
              <div className="space-y-4 py-4">
                {/* Card Visual */}
                <div className={`relative rounded-2xl p-6 text-white overflow-hidden ${
                  selectedCard.card_type === 'mastercard' 
                    ? 'bg-gradient-to-br from-orange-500 via-red-500 to-pink-600' 
                    : 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800'
                }`}>
                  {/* Card Image if available */}
                  {selectedCard.card_image ? (
                    <img 
                      src={selectedCard.card_image} 
                      alt="Card" 
                      className="absolute inset-0 w-full h-full object-cover opacity-90"
                    />
                  ) : null}
                  
                  <div className="relative z-10">
                    {/* Card Brand & Type */}
                    <div className="flex justify-between items-start mb-8">
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
                    
                    {/* Card Number */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xl tracking-wider">
                          {formatCardNumber(selectedCard.card_number, showFullNumber)}
                        </span>
                        {selectedCard.card_number && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-white/80 hover:text-white hover:bg-white/20"
                              onClick={() => setShowFullNumber(!showFullNumber)}
                            >
                              {showFullNumber ? <EyeOff size={14} /> : <Eye size={14} />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-white/80 hover:text-white hover:bg-white/20"
                              onClick={() => copyToClipboard(selectedCard.card_number, getText('Nimewo', 'Numéro', 'Number'))}
                            >
                              <Copy size={14} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Card Holder & Expiry */}
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-white/60 text-xs uppercase mb-1">{getText('Pòtè Kat', 'Titulaire', 'Card Holder')}</p>
                        <p className="font-medium tracking-wide">{selectedCard.card_holder_name || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/60 text-xs uppercase mb-1">{getText('Ekspire', 'Expire', 'Expires')}</p>
                        <p className="font-mono font-medium">{selectedCard.card_expiry || 'MM/YY'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CVV Section */}
                {selectedCard.card_cvv && (
                  <div className="bg-stone-100 dark:bg-stone-800 rounded-xl p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-stone-500 text-sm">{getText('Kòd Sekirite', 'Code de Sécurité', 'Security Code')} (CVV)</p>
                        <p className="font-mono font-bold text-lg text-stone-900 dark:text-white">
                          {showCVV ? selectedCard.card_cvv : '•••'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCVV(!showCVV)}
                        >
                          {showCVV ? <EyeOff size={16} /> : <Eye size={16} />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(selectedCard.card_cvv, 'CVV')}
                        >
                          <Copy size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Billing Address */}
                {(selectedCard.billing_address || selectedCard.billing_city || selectedCard.billing_country) && (
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="text-stone-500 mt-1" size={18} />
                      <div>
                        <p className="text-stone-500 text-sm mb-1">{getText('Adrès Faktirasyon', 'Adresse de Facturation', 'Billing Address')}</p>
                        <p className="text-stone-900 dark:text-white font-medium">
                          {selectedCard.billing_address}
                        </p>
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

                {/* Admin Notes */}
                {selectedCard.admin_notes && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <p className="text-blue-700 dark:text-blue-400 text-sm">
                      <strong>{getText('Nòt:', 'Note:', 'Note:')}</strong> {selectedCard.admin_notes}
                    </p>
                  </div>
                )}

                {/* Warning */}
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
                  onClick={() => setShowCardDetails(false)}
                  className="w-full"
                  variant="outline"
                >
                  {getText('Fèmen', 'Fermer', 'Close')}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
