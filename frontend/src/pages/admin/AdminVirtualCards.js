import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';
import { Check, X, Eye, RefreshCw, CreditCard } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export default function AdminVirtualCards() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

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

  const handleProcess = async (action) => {
    setProcessing(true);
    try {
      await axios.patch(
        `${API}/admin/virtual-card-orders/${selectedOrder.order_id}?action=${action}${adminNotes ? `&admin_notes=${encodeURIComponent(adminNotes)}` : ''}`
      );
      toast.success(action === 'approve' ? 'Komand kat apwouve! Kliyan an resevwa $5 USD bonis.' : 'Komand kat rejte. Lajan ranbouse.');
      setShowModal(false);
      setAdminNotes('');
      fetchOrders();
    } catch (error) {
      toast.error('Erè nan tretman');
    } finally {
      setProcessing(false);
    }
  };

  const openModal = (order) => {
    setSelectedOrder(order);
    setAdminNotes(order.admin_notes || '');
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
              <Button variant="outline" size="sm" onClick={fetchOrders} className="ml-auto">
                <RefreshCw size={16} className="mr-2" />
                Aktyalize
              </Button>
            </div>
          </CardContent>
        </Card>

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
