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
import { toast } from 'sonner';
import axios from 'axios';
import { Check, X, Eye, RefreshCw, CreditCard, Upload } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

// Visa and Mastercard logos
const VISA_LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0ODAgMjAwIj48cGF0aCBmaWxsPSIjMUE1RjdBIiBkPSJNMTcxLjcgNjUuNmwtNDEuMyA2OS40aDI1LjdsNi4xLTE1LjRoMjkuNGw2LjEgMTUuNGgyNS43bC00MS4zLTY5LjRoLTEwLjR6bTMuNCAyMC4zbDkuNiAyMy4xaC0xOS4zbDkuNy0yMy4xem01Ni4yLTIwLjNsLTE1LjggNDEuNy03LTQxLjdoLTI0LjZsMjAuNiA2OS40aDI0LjZsMjkuOS02OS40aC0yNy43em02NS4yIDBsLTE1LjggNDEuNy03LTQxLjdoLTI0LjZsMjAuNiA2OS40aDI0LjZsMjkuOS02OS40aC0yNy43em03MS41IDBoLTQ0LjZ2NjkuNGgyNS43di0yMy45aDIwLjFjMTkuOCAwIDMyLjEtMTEgMzIuMS0yMi44IDAtMTEuNy0xMi4zLTIyLjctMzMuMy0yMi43em0tMi41IDE4LjdjNy44IDAgMTEuNiAzLjQgMTEuNiA3LjQgMCAzLjktMy44IDcuNS0xMS42IDcuNWgtMTYuNHYtMTUuMWgxNi40eiIvPjwvc3ZnPg==';
const MASTERCARD_LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMzEuMiAxNTAiPjxjaXJjbGUgZmlsbD0iI2ViMDAxYiIgY3g9IjY4IiBjeT0iNzUiIHI9IjUyIi8+PGNpcmNsZSBmaWxsPSIjZjc5ZTFiIiBjeD0iMTYzIiBjeT0iNzUiIHI9IjUyIi8+PHBhdGggZmlsbD0iI2ZmNWYwMCIgZD0iTTExNS41IDMzLjJjLTE2LjcgMTMuMS0yNy40IDMzLjMtMjcuNCA1NS44czEwLjcgNDIuNyAyNy40IDU1LjhjMTYuNy0xMy4xIDI3LjQtMzMuMyAyNy40LTU1LjhzLTEwLjctNDIuNy0yNy40LTU1Ljh6Ii8+PC9zdmc+';

export default function AdminVirtualCards() {
  const { language } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  
  // Card details for manual entry
  const [cardDetails, setCardDetails] = useState({
    card_brand: '', // Wise, Payoneer, etc.
    card_type: 'visa', // visa or mastercard
    card_holder_name: '',
    card_number: '',
    card_last4: '',
    card_expiry: '',
    card_cvv: '',
    billing_address: '',
    billing_city: '',
    billing_country: '',
    billing_zip: '',
    card_image: ''
  });

  const getText = useCallback((ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  }, [language]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}/admin/virtual-card-orders`;
      if (filter !== 'all') url += `?status=${filter}`;
      const response = await axios.get(url);
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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

  const handleProcess = async (action) => {
    setProcessing(true);
    try {
      const payload = {
        action,
        admin_notes: adminNotes,
        ...cardDetails,
        card_last4: cardDetails.card_number ? cardDetails.card_number.slice(-4) : cardDetails.card_last4
      };
      
      await axios.patch(`${API}/admin/virtual-card-orders/${selectedOrder.order_id}`, payload);
      toast.success(action === 'approve' 
        ? getText('Komand kat apwouve! Kliyan an resevwa $5 USD bonis.', 'Commande carte approuvée! Le client reçoit $5 USD bonus.', 'Card order approved! Client receives $5 USD bonus.') 
        : getText('Komand kat rejte. Lajan ranbouse.', 'Commande carte rejetée. Montant remboursé.', 'Card order rejected. Amount refunded.'));
      setShowModal(false);
      resetForm();
      fetchOrders();
    } catch (error) {
      toast.error(getText('Erè nan tretman', 'Erreur lors du traitement', 'Error processing'));
    } finally {
      setProcessing(false);
    }
  };

  const updateCardDetails = async () => {
    setProcessing(true);
    try {
      const payload = {
        ...cardDetails,
        card_last4: cardDetails.card_number ? cardDetails.card_number.slice(-4) : cardDetails.card_last4
      };
      
      await axios.patch(`${API}/admin/virtual-card-orders/${selectedOrder.order_id}/details`, payload);
      toast.success(getText('Detay kat mete ajou!', 'Détails carte mis à jour!', 'Card details updated!'));
      fetchOrders();
      
      // Update selected order
      setSelectedOrder(prev => ({...prev, ...payload}));
    } catch (error) {
      toast.error(getText('Erè nan mizajou', 'Erreur lors de la mise à jour', 'Error updating'));
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setAdminNotes('');
    setCardDetails({
      card_brand: '',
      card_type: 'visa',
      card_holder_name: '',
      card_number: '',
      card_last4: '',
      card_expiry: '',
      card_cvv: '',
      billing_address: '',
      billing_city: '',
      billing_country: '',
      billing_zip: '',
      card_image: ''
    });
  };

  const openModal = (order) => {
    setSelectedOrder(order);
    setAdminNotes(order.admin_notes || '');
    setCardDetails({
      card_brand: order.card_brand || '',
      card_type: order.card_type || 'visa',
      card_holder_name: order.card_holder_name || '',
      card_number: order.card_number || '',
      card_last4: order.card_last4 || '',
      card_expiry: order.card_expiry || '',
      card_cvv: order.card_cvv || '',
      billing_address: order.billing_address || '',
      billing_city: order.billing_city || '',
      billing_country: order.billing_country || '',
      billing_zip: order.billing_zip || '',
      card_image: order.card_image || ''
    });
    setShowModal(true);
  };

  return (
    <AdminLayout title={getText('Jesyon Komand Kat Vityèl', 'Gestion Commandes Cartes Virtuelles', 'Virtual Card Order Management')}>
      <div className="space-y-6" data-testid="admin-virtual-cards">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-amber-50 dark:bg-amber-900/30">
            <CardContent className="p-4 text-center">
              <p className="text-amber-800 dark:text-amber-300 font-bold text-2xl">{orders.filter(o => o.status === 'pending').length}</p>
              <p className="text-amber-600 dark:text-amber-400 text-sm">{getText('An atant', 'En attente', 'Pending')}</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 dark:bg-emerald-900/30">
            <CardContent className="p-4 text-center">
              <p className="text-emerald-800 dark:text-emerald-300 font-bold text-2xl">{orders.filter(o => o.status === 'approved').length}</p>
              <p className="text-emerald-600 dark:text-emerald-400 text-sm">{getText('Apwouve', 'Approuvé', 'Approved')}</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-900/30">
            <CardContent className="p-4 text-center">
              <p className="text-red-800 dark:text-red-300 font-bold text-2xl">{orders.filter(o => o.status === 'rejected').length}</p>
              <p className="text-red-600 dark:text-red-400 text-sm">{getText('Rejte', 'Rejeté', 'Rejected')}</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 dark:bg-blue-900/30">
            <CardContent className="p-4 text-center">
              <p className="text-blue-800 dark:text-blue-300 font-bold text-2xl">{orders.length}</p>
              <p className="text-blue-600 dark:text-blue-400 text-sm">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {['pending', 'approved', 'rejected', 'all'].map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className={filter === f ? 'bg-[#EA580C]' : ''}
                >
                  {f === 'pending' ? getText('An atant', 'En attente', 'Pending') : 
                   f === 'approved' ? getText('Apwouve', 'Approuvé', 'Approved') : 
                   f === 'rejected' ? getText('Rejte', 'Rejeté', 'Rejected') : 
                   getText('Tout', 'Tous', 'All')}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={fetchOrders} className="ml-auto">
                <RefreshCw size={16} className="mr-2" />
                {getText('Aktyalize', 'Actualiser', 'Refresh')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={20} className="text-[#EA580C]" />
              {getText('Komand Kat', 'Commandes Cartes', 'Card Orders')} ({orders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client ID</th>
                    <th>Email Kat</th>
                    <th>{getText('Mak Kat', 'Marque', 'Brand')}</th>
                    <th>{getText('Tip', 'Type', 'Type')}</th>
                    <th>{getText('Frè', 'Frais', 'Fee')}</th>
                    <th>Date</th>
                    <th>{getText('Statis', 'Statut', 'Status')}</th>
                    <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8">{getText('Pa gen komand', 'Aucune commande', 'No orders')}</td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.order_id}>
                        <td className="font-mono text-sm">{order.client_id}</td>
                        <td>{order.card_email}</td>
                        <td className="font-medium">{order.card_brand || '-'}</td>
                        <td>
                          {order.card_type && (
                            <img 
                              src={order.card_type === 'mastercard' ? MASTERCARD_LOGO : VISA_LOGO} 
                              alt={order.card_type} 
                              className="h-6 w-auto"
                            />
                          )}
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
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openModal(order)}
                          >
                            <Eye size={16} className="mr-2" />
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

        {/* Review Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
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
                  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>{getText('Nòt:', 'Note:', 'Note:')}</strong> {getText(
                        'Lè ou apwouve, kliyan an ap resevwa $5 USD bonis nan bous li. Lè ou rejte, lajan frè a ap ranbouse.',
                        'Lors de l\'approbation, le client recevra $5 USD bonus. En cas de rejet, les frais seront remboursés.',
                        'When approved, the client will receive $5 USD bonus. If rejected, the fees will be refunded.'
                      )}
                    </p>
                  </div>
                )}

                {/* Card Details Form */}
                <div className="border rounded-xl p-4 space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <CreditCard size={18} />
                    {getText('Enfòmasyon Kat la', 'Informations de la Carte', 'Card Information')}
                  </h4>

                  {/* Card Brand and Type */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{getText('Mak Kat (pa egzanp Wise)', 'Marque (ex: Wise)', 'Brand (e.g. Wise)')}</Label>
                      <Input
                        placeholder="Wise, Payoneer, etc."
                        value={cardDetails.card_brand}
                        onChange={(e) => setCardDetails({...cardDetails, card_brand: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>{getText('Tip Kat', 'Type de Carte', 'Card Type')}</Label>
                      <Select 
                        value={cardDetails.card_type} 
                        onValueChange={(v) => setCardDetails({...cardDetails, card_type: v})}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="visa">
                            <div className="flex items-center gap-2">
                              <img src={VISA_LOGO} alt="Visa" className="h-4 w-auto" />
                              Visa
                            </div>
                          </SelectItem>
                          <SelectItem value="mastercard">
                            <div className="flex items-center gap-2">
                              <img src={MASTERCARD_LOGO} alt="Mastercard" className="h-4 w-auto" />
                              Mastercard
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Card Holder Name */}
                  <div>
                    <Label>{getText('Non sou Kat la', 'Nom sur la Carte', 'Name on Card')}</Label>
                    <Input
                      placeholder="JEAN PIERRE"
                      value={cardDetails.card_holder_name}
                      onChange={(e) => setCardDetails({...cardDetails, card_holder_name: e.target.value.toUpperCase()})}
                      className="mt-1 uppercase"
                    />
                  </div>

                  {/* Card Number */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{getText('Nimewo Kat Konplè', 'Numéro de Carte Complet', 'Full Card Number')}</Label>
                      <Input
                        placeholder="4532 XXXX XXXX 1234"
                        value={cardDetails.card_number}
                        onChange={(e) => setCardDetails({...cardDetails, card_number: e.target.value.replace(/\s/g, '')})}
                        className="mt-1 font-mono"
                        maxLength={19}
                      />
                    </div>
                    <div>
                      <Label>{getText('Dènye 4 Chif', 'Derniers 4 Chiffres', 'Last 4 Digits')}</Label>
                      <Input
                        placeholder="1234"
                        value={cardDetails.card_last4 || (cardDetails.card_number ? cardDetails.card_number.slice(-4) : '')}
                        onChange={(e) => setCardDetails({...cardDetails, card_last4: e.target.value})}
                        className="mt-1 font-mono"
                        maxLength={4}
                        disabled={!!cardDetails.card_number}
                      />
                    </div>
                  </div>

                  {/* Expiry and CVV */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{getText('Dat Ekspirasyon', 'Date d\'Expiration', 'Expiry Date')}</Label>
                      <Input
                        placeholder="MM/YY"
                        value={cardDetails.card_expiry}
                        onChange={(e) => setCardDetails({...cardDetails, card_expiry: e.target.value})}
                        className="mt-1 font-mono"
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <Label>CVV</Label>
                      <Input
                        placeholder="123"
                        value={cardDetails.card_cvv}
                        onChange={(e) => setCardDetails({...cardDetails, card_cvv: e.target.value})}
                        className="mt-1 font-mono"
                        maxLength={4}
                        type="password"
                      />
                    </div>
                  </div>

                  {/* Billing Address */}
                  <div className="border-t pt-4">
                    <h5 className="font-medium mb-3">{getText('Adrès Faktirasyon', 'Adresse de Facturation', 'Billing Address')}</h5>
                    <div className="space-y-3">
                      <div>
                        <Label>{getText('Adrès', 'Adresse', 'Address')}</Label>
                        <Input
                          placeholder="123 Main Street"
                          value={cardDetails.billing_address}
                          onChange={(e) => setCardDetails({...cardDetails, billing_address: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label>{getText('Vil', 'Ville', 'City')}</Label>
                          <Input
                            placeholder="Miami"
                            value={cardDetails.billing_city}
                            onChange={(e) => setCardDetails({...cardDetails, billing_city: e.target.value})}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>{getText('Peyi', 'Pays', 'Country')}</Label>
                          <Input
                            placeholder="USA"
                            value={cardDetails.billing_country}
                            onChange={(e) => setCardDetails({...cardDetails, billing_country: e.target.value})}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>{getText('Kòd Postal', 'Code Postal', 'ZIP Code')}</Label>
                          <Input
                            placeholder="33101"
                            value={cardDetails.billing_zip}
                            onChange={(e) => setCardDetails({...cardDetails, billing_zip: e.target.value})}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Image */}
                  <div className="border-t pt-4">
                    <Label>{getText('Imaj Kat (Opsyonèl)', 'Image de la Carte (Optionnel)', 'Card Image (Optional)')}</Label>
                    <div className="mt-2">
                      <div 
                        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                          cardDetails.card_image ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20' : 'border-stone-300 hover:border-[#EA580C]'
                        }`}
                        onClick={() => document.getElementById('card-image-upload').click()}
                      >
                        {cardDetails.card_image ? (
                          <img 
                            src={cardDetails.card_image} 
                            alt="Card" 
                            className="max-h-32 mx-auto rounded-lg"
                          />
                        ) : (
                          <>
                            <Upload className="mx-auto text-stone-400 mb-2" size={32} />
                            <p className="text-stone-600 dark:text-stone-400">{getText('Klike pou telechaje imaj kat', 'Cliquez pour télécharger l\'image de la carte', 'Click to upload card image')}</p>
                          </>
                        )}
                      </div>
                      <input
                        id="card-image-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>
                </div>

                {/* Admin Notes */}
                <div>
                  <Label>{getText('Nòt Admin (opsyonèl)', 'Notes Admin (optionnel)', 'Admin Notes (optional)')}</Label>
                  <Textarea
                    placeholder={getText('Ekri nòt pou kliyan an...', 'Écrire une note pour le client...', 'Write a note for the client...')}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={2}
                    className="mt-1"
                  />
                </div>

                {/* Action Buttons */}
                {selectedOrder.status === 'pending' ? (
                  <div className="flex gap-4 pt-4 border-t">
                    <Button 
                      onClick={() => handleProcess('approve')}
                      disabled={processing}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                    >
                      <Check size={18} className="mr-2" />
                      {getText('Apwouve', 'Approuver', 'Approve')}
                    </Button>
                    <Button 
                      onClick={() => handleProcess('reject')}
                      disabled={processing}
                      variant="destructive"
                      className="flex-1"
                    >
                      <X size={18} className="mr-2" />
                      {getText('Rejte', 'Rejeter', 'Reject')}
                    </Button>
                  </div>
                ) : (
                  <div className="pt-4 border-t">
                    <Button 
                      onClick={updateCardDetails}
                      disabled={processing}
                      className="w-full bg-blue-500 hover:bg-blue-600"
                    >
                      {getText('Mete Detay Kat Ajou', 'Mettre à Jour les Détails', 'Update Card Details')}
                    </Button>
                  </div>
                )}

                {/* Display existing admin notes */}
                {selectedOrder.status !== 'pending' && selectedOrder.admin_notes && (
                  <div className="bg-stone-50 dark:bg-stone-800 rounded-lg p-3">
                    <p className="text-sm text-stone-500 mb-1">{getText('Nòt Admin', 'Notes Admin', 'Admin Notes')}</p>
                    <p>{selectedOrder.admin_notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
