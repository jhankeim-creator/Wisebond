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
  Wallet
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VirtualCard() {
  const { language } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [cardOrders, setCardOrders] = useState([]);
  const [cardDeposits, setCardDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [cardEmail, setCardEmail] = useState('');

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const cardFee = 500; // 500 HTG for card

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            <CheckCircle size={12} />
            {getText('Apwouve', 'Approuvé', 'Approved')}
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            <XCircle size={12} />
            {getText('Rejte', 'Rejeté', 'Rejected')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
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
              <h3 className="text-xl font-bold text-stone-900 mb-2">
                {getText('Verifikasyon KYC obligatwa', 'Vérification KYC requise', 'KYC verification required')}
              </h3>
              <p className="text-stone-600 mb-6">
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
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2">
                    {getText('Kat Vityèl (Tyè Pati)', 'Carte Virtuelle (Tiers)', 'Virtual Card (Third Party)')}
                  </h2>
                  <p className="text-amber-100 text-sm">
                    {getText(
                      'Kat vityèl la jere pa yon tyè pati. Balans kat la pa afiche isit la. Ou ap wè sèlman istorik depo ou ki apwouve oswa rejte.',
                      'La carte virtuelle est gérée par un tiers. Le solde de la carte n\'est pas affiché ici. Vous ne verrez que l\'historique de vos dépôts approuvés ou rejetés.',
                      'The virtual card is managed by a third party. The card balance is not displayed here. You will only see your approved or rejected deposit history.'
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Card Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">
                  {getText('Kat Mwen Yo', 'Mes Cartes', 'My Cards')}
                </h2>
                <p className="text-stone-500">
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
                  <div className="divide-y divide-stone-100">
                    {cardOrders.map((order) => (
                      <div key={order.order_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
                            <CreditCard className="text-stone-600" size={20} />
                          </div>
                          <div>
                            <p className="font-medium text-stone-900">{order.card_email}</p>
                            <p className="text-sm text-stone-500">
                              {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
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
                  <div className="divide-y divide-stone-100">
                    {cardDeposits.map((deposit) => (
                      <div key={deposit.deposit_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            deposit.status === 'approved' ? 'bg-emerald-100' : 
                            deposit.status === 'rejected' ? 'bg-red-100' : 'bg-amber-100'
                          }`}>
                            <Wallet className={
                              deposit.status === 'approved' ? 'text-emerald-600' : 
                              deposit.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                            } size={20} />
                          </div>
                          <div>
                            <p className="font-medium text-stone-900">
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
                  <div key={i} className="bg-stone-50 rounded-xl p-6 text-center">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Icon className="text-[#EA580C]" size={24} />
                    </div>
                    <h3 className="font-semibold text-stone-900 mb-1">{feature.title}</h3>
                    <p className="text-sm text-stone-500">{feature.desc}</p>
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
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-amber-500 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-amber-800">
                      {getText('Kat Tyè Pati', 'Carte Tiers', 'Third Party Card')}
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
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

              <div className="bg-stone-50 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-stone-600">{getText('Frè komand', 'Frais de commande', 'Order fee')}</span>
                  <span className="font-bold text-stone-900">G {cardFee}</span>
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
      </div>
    </DashboardLayout>
  );
}
