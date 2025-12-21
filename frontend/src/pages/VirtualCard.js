import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
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
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  ShoppingCart,
  Shield
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VirtualCard() {
  const { language } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState({});
  const [ordering, setOrdering] = useState(false);
  const [cardName, setCardName] = useState('');

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const response = await axios.get(`${API}/virtual-cards`);
      setCards(response.data.cards || []);
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const orderCard = async () => {
    if (!cardName.trim()) {
      toast.error(language === 'fr' ? 'Veuillez entrer un nom pour la carte' : 'Please enter a name for the card');
      return;
    }

    setOrdering(true);
    try {
      await axios.post(`${API}/virtual-cards/order`, { card_name: cardName });
      toast.success(language === 'fr' ? 'Carte commandée avec succès!' : 'Card ordered successfully!');
      setShowOrderModal(false);
      setCardName('');
      fetchCards();
      refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    } finally {
      setOrdering(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(language === 'fr' ? 'Copié!' : 'Copied!');
  };

  const toggleCardDetails = (cardId) => {
    setShowCardDetails(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  const cardFee = 500; // 500 HTG for card

  return (
    <DashboardLayout title={language === 'fr' ? 'Carte Virtuelle' : 'Virtual Card'}>
      <div className="space-y-6" data-testid="virtual-card-page">
        {/* KYC Check */}
        {user?.kyc_status !== 'approved' ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
              <h3 className="text-xl font-bold text-stone-900 mb-2">
                {language === 'fr' ? 'Vérification KYC requise' : 'KYC verification required'}
              </h3>
              <p className="text-stone-600 mb-6">
                {language === 'fr' 
                  ? 'Vous devez compléter votre vérification KYC pour commander une carte.'
                  : 'You must complete KYC verification to order a card.'}
              </p>
              <Button className="btn-primary" onClick={() => window.location.href = '/kyc'}>
                {language === 'fr' ? 'Compléter KYC' : 'Complete KYC'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Order Card Button */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">
                  {language === 'fr' ? 'Mes Cartes' : 'My Cards'}
                </h2>
                <p className="text-stone-500">
                  {language === 'fr' ? 'Gérez vos cartes virtuelles KAYICOM' : 'Manage your KAYICOM virtual cards'}
                </p>
              </div>
              <Button onClick={() => setShowOrderModal(true)} className="btn-primary">
                <ShoppingCart className="mr-2" size={18} />
                {language === 'fr' ? 'Commander une carte' : 'Order a card'}
              </Button>
            </div>

            {/* Cards List */}
            {loading ? (
              <div className="grid md:grid-cols-2 gap-6">
                {[1, 2].map(i => (
                  <div key={i} className="skeleton h-64 rounded-2xl" />
                ))}
              </div>
            ) : cards.length === 0 ? (
              <Card className="bg-stone-50">
                <CardContent className="p-12 text-center">
                  <CreditCard className="mx-auto text-stone-400 mb-4" size={64} />
                  <h3 className="text-xl font-bold text-stone-900 mb-2">
                    {language === 'fr' ? 'Aucune carte' : 'No cards'}
                  </h3>
                  <p className="text-stone-600 mb-6">
                    {language === 'fr' 
                      ? 'Commandez votre première carte virtuelle pour payer partout!'
                      : 'Order your first virtual card to pay anywhere!'}
                  </p>
                  <Button onClick={() => setShowOrderModal(true)} className="btn-gold">
                    <ShoppingCart className="mr-2" size={18} />
                    {language === 'fr' ? 'Commander maintenant' : 'Order now'}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {cards.map((card) => (
                  <div key={card.card_id} className="space-y-4">
                    {/* Virtual Card Display */}
                    <div className="virtual-card">
                      <div className="relative z-10 h-full flex flex-col justify-between p-2">
                        <div className="flex justify-between items-start">
                          <Logo size="small" />
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-6 bg-gradient-to-r from-amber-400 to-amber-600 rounded opacity-80" />
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              card.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {card.status}
                            </span>
                          </div>
                        </div>
                        
                        <div className="mt-6">
                          <p className="font-mono text-xl tracking-widest mb-4">
                            {showCardDetails[card.card_id] 
                              ? card.card_number 
                              : `•••• •••• •••• ${card.card_number?.slice(-4)}`}
                          </p>
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-stone-400 text-xs uppercase">Titulaire</p>
                              <p className="font-medium">{card.card_name}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-stone-400 text-xs uppercase">CVV</p>
                              <p className="font-medium font-mono">
                                {showCardDetails[card.card_id] ? card.cvv : '•••'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-stone-400 text-xs uppercase">Expire</p>
                              <p className="font-medium">{card.expiry_date}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => toggleCardDetails(card.card_id)}
                        className="flex-1"
                      >
                        {showCardDetails[card.card_id] ? <EyeOff size={16} className="mr-2" /> : <Eye size={16} className="mr-2" />}
                        {showCardDetails[card.card_id] 
                          ? (language === 'fr' ? 'Masquer' : 'Hide') 
                          : (language === 'fr' ? 'Afficher' : 'Show')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => copyToClipboard(card.card_number)}
                        className="flex-1"
                      >
                        <Copy size={16} className="mr-2" />
                        {language === 'fr' ? 'Copier' : 'Copy'}
                      </Button>
                    </div>

                    {/* Card Balance */}
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-stone-500">{language === 'fr' ? 'Solde de la carte' : 'Card balance'}</p>
                            <p className="text-xl font-bold text-stone-900">G {card.balance?.toLocaleString() || 0}</p>
                          </div>
                          <Button size="sm" className="bg-[#EA580C] hover:bg-[#C2410C]">
                            {language === 'fr' ? 'Recharger' : 'Top up'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}

            {/* Card Features */}
            <Card>
              <CardHeader>
                <CardTitle>{language === 'fr' ? 'Avantages de la carte' : 'Card benefits'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  {[
                    { 
                      icon: Shield, 
                      title: language === 'fr' ? 'Sécurisée' : 'Secure',
                      desc: language === 'fr' ? 'Transactions protégées' : 'Protected transactions'
                    },
                    { 
                      icon: RefreshCw, 
                      title: language === 'fr' ? 'Rechargeable' : 'Rechargeable',
                      desc: language === 'fr' ? 'Depuis votre wallet' : 'From your wallet'
                    },
                    { 
                      icon: CreditCard, 
                      title: language === 'fr' ? 'Acceptée partout' : 'Accepted everywhere',
                      desc: 'Netflix, Amazon, etc.'
                    }
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                          <Icon className="text-[#EA580C]" size={24} />
                        </div>
                        <div>
                          <p className="font-semibold text-stone-900">{item.title}</p>
                          <p className="text-sm text-stone-500">{item.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Order Modal */}
        <Dialog open={showOrderModal} onOpenChange={setShowOrderModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === 'fr' ? 'Commander une carte virtuelle' : 'Order a virtual card'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="font-semibold text-amber-800 mb-2">
                  {language === 'fr' ? 'Frais de commande' : 'Order fee'}
                </p>
                <p className="text-2xl font-bold text-amber-700">G {cardFee.toLocaleString()}</p>
                <p className="text-sm text-amber-600 mt-1">
                  {language === 'fr' ? 'Débité de votre wallet HTG' : 'Debited from your HTG wallet'}
                </p>
              </div>

              {user?.wallet_htg < cardFee && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-sm">
                    {language === 'fr' 
                      ? `Solde insuffisant. Vous avez G ${user?.wallet_htg?.toLocaleString() || 0}`
                      : `Insufficient balance. You have G ${user?.wallet_htg?.toLocaleString() || 0}`}
                  </p>
                </div>
              )}

              <div>
                <Label>{language === 'fr' ? 'Nom sur la carte' : 'Name on card'}</Label>
                <Input
                  placeholder={user?.full_name?.toUpperCase()}
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                  className="mt-2 uppercase"
                  maxLength={25}
                />
              </div>

              <Button 
                onClick={orderCard}
                disabled={ordering || user?.wallet_htg < cardFee || !cardName.trim()}
                className="w-full btn-primary"
              >
                {ordering ? (language === 'fr' ? 'Commande en cours...' : 'Ordering...') : (language === 'fr' ? 'Commander' : 'Order')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
