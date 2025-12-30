import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import { Check, X, Eye, RefreshCw, CreditCard, Image, DollarSign, Settings } from 'lucide-react';

import { API_BASE } from '@/lib/utils';
const API = API_BASE;

export default function AdminVirtualCards() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  
  // Card Settings
  const [showSettings, setShowSettings] = useState(false);
  const [cardSettings, setCardSettings] = useState({
    card_order_fee_htg: 500,
    card_image_url: '',
    card_description: '',
    card_withdrawal_fee_percent: 0,
    card_withdrawal_fee_fixed: 0,
    card_provider_name: 'KAYICOM Virtual Card'
  });
  const [savingSettings, setSavingSettings] = useState(false);

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
    fetchCardSettings();
  }, [fetchOrders]);

  const fetchCardSettings = async () => {
    try {
      const resp = await axios.get(`${API}/admin/card-settings`);
      if (resp.data.settings) {
        setCardSettings(prev => ({ ...prev, ...resp.data.settings }));
      }
    } catch (e) {
      // Use defaults
    }
  };

  const saveCardSettings = async () => {
    setSavingSettings(true);
    try {
      await axios.put(`${API}/admin/card-settings`, cardSettings);
      toast.success('Paramèt kat yo anrejistre!');
      setShowSettings(false);
    } catch (e) {
      toast.error('Erè pandan anrejistreman');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleProcess = async (action) => {
    setProcessing(true);
    try {
      let url = `${API}/admin/virtual-card-orders/${selectedOrder.order_id}?action=${action}`;
      if (adminNotes) url += `&admin_notes=${encodeURIComponent(adminNotes)}`;
      if (action === 'approve' && cardName) url += `&card_name=${encodeURIComponent(cardName)}`;
      if (action === 'approve' && cardLast4) url += `&card_last4=${encodeURIComponent(cardLast4)}`;
      
      await axios.patch(url);
      toast.success(action === 'approve' ? 'Komand kat apwouve! Kliyan an resevwa $5 USD bonis.' : 'Komand kat rejte. Lajan ranbouse.');
      setShowModal(false);
      setAdminNotes('');
      setCardName('');
      setCardLast4('');
      fetchOrders();
    } catch (error) {
      toast.error('Erè nan tretman');
    } finally {
      setProcessing(false);
    }
  };

  const updateCardDetails = async () => {
    setProcessing(true);
    try {
      let url = `${API}/admin/virtual-card-orders/${selectedOrder.order_id}/details?`;
      if (cardName) url += `card_name=${encodeURIComponent(cardName)}&`;
      if (cardLast4) url += `card_last4=${encodeURIComponent(cardLast4)}`;
      
      await axios.patch(url);
      toast.success('Detay kat mete ajou!');
      fetchOrders();
      
      // Update selected order
      setSelectedOrder(prev => ({...prev, card_name: cardName, card_last4: cardLast4}));
    } catch (error) {
      toast.error('Erè nan mizajou');
    } finally {
      setProcessing(false);
    }
  };

  const openModal = (order) => {
    setSelectedOrder(order);
    setAdminNotes(order.admin_notes || '');
    setCardName(order.card_name || '');
    setCardLast4(order.card_last4 || '');
    setShowModal(true);
  };

  return (
    <AdminLayout title="Jesyon Komand Kat Vityèl">
      <div className="space-y-6" data-testid="admin-virtual-cards">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-amber-50">
            <CardContent className="p-4 text-center">
              <p className="text-amber-800 font-bold text-2xl">{orders.filter(o => o.status === 'pending').length}</p>
              <p className="text-amber-600 text-sm">An atant</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50">
            <CardContent className="p-4 text-center">
              <p className="text-emerald-800 font-bold text-2xl">{orders.filter(o => o.status === 'approved').length}</p>
              <p className="text-emerald-600 text-sm">Apwouve</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50">
            <CardContent className="p-4 text-center">
              <p className="text-red-800 font-bold text-2xl">{orders.filter(o => o.status === 'rejected').length}</p>
              <p className="text-red-600 text-sm">Rejte</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-50">
            <CardContent className="p-4 text-center">
              <p className="text-blue-800 font-bold text-2xl">{orders.length}</p>
              <p className="text-blue-600 text-sm">Total</p>
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
                  {f === 'pending' ? 'An atant' : f === 'approved' ? 'Apwouve' : f === 'rejected' ? 'Rejte' : 'Tout'}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="ml-auto">
                <Settings size={16} className="mr-2" />
                Paramèt Kat
              </Button>
              <Button variant="outline" size="sm" onClick={fetchOrders}>
                <RefreshCw size={16} className="mr-2" />
                Aktyalize
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card Settings Modal */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="text-[#EA580C]" />
                Paramèt Kat Vityèl
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Frè Komand Kat (HTG)</Label>
                <Input
                  type="number"
                  value={cardSettings.card_order_fee_htg}
                  onChange={(e) => setCardSettings({...cardSettings, card_order_fee_htg: parseInt(e.target.value) || 0})}
                  className="mt-1"
                />
                <p className="text-xs text-stone-500 mt-1">Pri pou komande yon kat vityèl</p>
              </div>
              
              <div>
                <Label>Non Founisè Kat</Label>
                <Input
                  value={cardSettings.card_provider_name}
                  onChange={(e) => setCardSettings({...cardSettings, card_provider_name: e.target.value})}
                  className="mt-1"
                  placeholder="Ex: KAYICOM Virtual Card"
                />
              </div>

              <div>
                <Label>URL Imaj Kat</Label>
                <Input
                  value={cardSettings.card_image_url}
                  onChange={(e) => setCardSettings({...cardSettings, card_image_url: e.target.value})}
                  className="mt-1"
                  placeholder="https://example.com/card-image.png"
                />
                <p className="text-xs text-stone-500 mt-1">Imaj pou montre kliyan yo</p>
                {cardSettings.card_image_url && (
                  <img src={cardSettings.card_image_url} alt="Card Preview" className="mt-2 max-h-32 rounded-lg border" />
                )}
              </div>

              <div>
                <Label>Deskripsyon Kat</Label>
                <Textarea
                  value={cardSettings.card_description}
                  onChange={(e) => setCardSettings({...cardSettings, card_description: e.target.value})}
                  className="mt-1"
                  rows={3}
                  placeholder="Enfòmasyon sou kat la..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Frè Retrè Kat (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={cardSettings.card_withdrawal_fee_percent}
                    onChange={(e) => setCardSettings({...cardSettings, card_withdrawal_fee_percent: parseFloat(e.target.value) || 0})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Frè Retrè Kat (Fiks USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cardSettings.card_withdrawal_fee_fixed}
                    onChange={(e) => setCardSettings({...cardSettings, card_withdrawal_fee_fixed: parseFloat(e.target.value) || 0})}
                    className="mt-1"
                  />
                </div>
              </div>

              <Button onClick={saveCardSettings} disabled={savingSettings} className="w-full btn-primary">
                {savingSettings ? 'Anrejistreman...' : 'Anrejistre Paramèt'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={20} className="text-[#EA580C]" />
              Komand Kat ({orders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client ID</th>
                    <th>Email Kat</th>
                    <th>Frè</th>
                    <th>Dat</th>
                    <th>Statis</th>
                    <th>Aksyon</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8">Chajman...</td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8">Pa gen komand</td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.order_id}>
                        <td className="font-mono text-sm">{order.client_id}</td>
                        <td>{order.card_email}</td>
                        <td className="font-semibold">G {order.fee?.toLocaleString()}</td>
                        <td>{new Date(order.created_at).toLocaleDateString()}</td>
                        <td>
                          <Badge className={
                            order.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            order.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }>
                            {order.status === 'pending' ? 'An atant' : order.status === 'approved' ? 'Apwouve' : 'Rejte'}
                          </Badge>
                        </td>
                        <td>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openModal(order)}
                          >
                            <Eye size={16} className="mr-2" />
                            Wè
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="text-[#EA580C]" />
                Detay Komand Kat
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-stone-500">Client ID</p>
                    <p className="font-mono">{selectedOrder.client_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Frè</p>
                    <p className="font-semibold">G {selectedOrder.fee?.toLocaleString()}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-stone-500">Email pou kat la</p>
                    <p className="font-medium text-[#EA580C]">{selectedOrder.card_email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Dat soumisyon</p>
                    <p>{new Date(selectedOrder.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Statis</p>
                    <Badge className={
                      selectedOrder.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      selectedOrder.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }>
                      {selectedOrder.status === 'pending' ? 'An atant' : selectedOrder.status === 'approved' ? 'Apwouve' : 'Rejte'}
                    </Badge>
                  </div>
                </div>

                {selectedOrder.status === 'pending' && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-700">
                        <strong>Nòt:</strong> Lè ou apwouve, kliyan an ap resevwa $5 USD bonis nan bous li. 
                        Lè ou rejte, lajan frè a (G {selectedOrder.fee}) ap ranbouse.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-stone-500 mb-2">Non Kat (lè apwouve)</p>
                        <input
                          type="text"
                          placeholder="Ex: KAYICOM VISA"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          className="w-full p-2 border rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <p className="text-sm text-stone-500 mb-2">Dènye 4 chif</p>
                        <input
                          type="text"
                          placeholder="Ex: 1234"
                          value={cardLast4}
                          onChange={(e) => setCardLast4(e.target.value)}
                          maxLength={4}
                          className="w-full p-2 border rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-stone-500 mb-2">Nòt Admin (opsyonèl)</p>
                      <Textarea
                        placeholder="Ekri nòt pou kliyan an..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="flex gap-4 pt-4 border-t">
                      <Button 
                        onClick={() => handleProcess('approve')}
                        disabled={processing}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                      >
                        <Check size={18} className="mr-2" />
                        Apwouve
                      </Button>
                      <Button 
                        onClick={() => handleProcess('reject')}
                        disabled={processing}
                        variant="destructive"
                        className="flex-1"
                      >
                        <X size={18} className="mr-2" />
                        Rejte
                      </Button>
                    </div>
                  </>
                )}

                {selectedOrder.status === 'approved' && (
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-semibold text-emerald-700">Detay Kat (pou kliyan wè)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-stone-500 mb-2">Non Kat</p>
                        <input
                          type="text"
                          placeholder="Ex: KAYICOM VISA"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          className="w-full p-2 border rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <p className="text-sm text-stone-500 mb-2">Dènye 4 chif</p>
                        <input
                          type="text"
                          placeholder="Ex: 1234"
                          value={cardLast4}
                          onChange={(e) => setCardLast4(e.target.value)}
                          maxLength={4}
                          className="w-full p-2 border rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={updateCardDetails}
                      disabled={processing}
                      className="w-full bg-blue-500 hover:bg-blue-600"
                    >
                      Mete Detay Kat Ajou
                    </Button>
                  </div>
                )}

                {selectedOrder.status !== 'pending' && selectedOrder.admin_notes && (
                  <div>
                    <p className="text-sm text-stone-500">Nòt Admin</p>
                    <p className="bg-stone-50 p-2 rounded">{selectedOrder.admin_notes}</p>
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
