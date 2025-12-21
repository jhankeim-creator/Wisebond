import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';
import { Check, X, Eye, RefreshCw, Phone } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminTopUp() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = `${API}/admin/topup-orders`;
      if (filter !== 'all') url += `?status=${filter}`;
      const response = await axios.get(url);
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (action) => {
    setProcessing(true);
    try {
      await axios.patch(
        `${API}/admin/topup-orders/${selectedOrder.order_id}?action=${action}${adminNotes ? `&admin_notes=${encodeURIComponent(adminNotes)}` : ''}`
      );
      toast.success(action === 'complete' ? 'Komand minit konplete!' : 'Komand anile. Lajan ranbouse.');
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
    <AdminLayout title="Jesyon Komand Minit Entènasyonal">
      <div className="space-y-6" data-testid="admin-topup">
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
              <p className="text-emerald-800 font-bold text-2xl">{orders.filter(o => o.status === 'completed').length}</p>
              <p className="text-emerald-600 text-sm">Konplete</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50">
            <CardContent className="p-4 text-center">
              <p className="text-red-800 font-bold text-2xl">{orders.filter(o => o.status === 'cancelled').length}</p>
              <p className="text-red-600 text-sm">Anile</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-50">
            <CardContent className="p-4 text-center">
              <p className="text-blue-800 font-bold text-2xl">${orders.reduce((sum, o) => sum + (o.price || 0), 0).toFixed(2)}</p>
              <p className="text-blue-600 text-sm">Total Vant</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {['pending', 'completed', 'cancelled', 'all'].map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className={filter === f ? 'bg-[#EA580C]' : ''}
                >
                  {f === 'pending' ? 'An atant' : f === 'completed' ? 'Konplete' : f === 'cancelled' ? 'Anile' : 'Tout'}
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
              <Phone size={20} className="text-[#EA580C]" />
              Komand Minit ({orders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client ID</th>
                    <th>Peyi</th>
                    <th>Minit</th>
                    <th>Pri</th>
                    <th>Nimewo</th>
                    <th>Dat</th>
                    <th>Statis</th>
                    <th>Aksyon</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8">Chajman...</td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8">Pa gen komand</td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.order_id}>
                        <td className="font-mono text-sm">{order.client_id}</td>
                        <td>{order.country_name}</td>
                        <td className="font-semibold">{order.minutes} min</td>
                        <td className="font-semibold text-emerald-600">${order.price}</td>
                        <td className="font-mono text-sm">{order.phone_number}</td>
                        <td>{new Date(order.created_at).toLocaleDateString()}</td>
                        <td>
                          <Badge className={
                            order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            order.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }>
                            {order.status === 'pending' ? 'An atant' : order.status === 'completed' ? 'Konplete' : 'Anile'}
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
                <Phone className="text-[#EA580C]" />
                Detay Komand Minit
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
                    <p className="text-sm text-stone-500">Pri</p>
                    <p className="font-semibold text-emerald-600">${selectedOrder.price}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Peyi</p>
                    <p className="font-medium">{selectedOrder.country_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Minit</p>
                    <p className="font-bold">{selectedOrder.minutes} minit</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-stone-500">Nimewo telefòn pou rechaje</p>
                    <p className="font-mono text-lg text-[#EA580C]">{selectedOrder.phone_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Dat soumisyon</p>
                    <p>{new Date(selectedOrder.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Statis</p>
                    <Badge className={
                      selectedOrder.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      selectedOrder.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }>
                      {selectedOrder.status === 'pending' ? 'An atant' : selectedOrder.status === 'completed' ? 'Konplete' : 'Anile'}
                    </Badge>
                  </div>
                </div>

                {selectedOrder.status === 'pending' && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-700">
                        <strong>Enstriksyon:</strong> Rechaje {selectedOrder.minutes} minit sou nimewo {selectedOrder.phone_number} pou {selectedOrder.country_name}. 
                        Lè ou fin fè sa, klike "Konplete". Si ou pa ka fè li, klike "Anile" pou ranbouse kliyan an.
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-stone-500 mb-2">Nòt Admin (opsyonèl)</p>
                      <Textarea
                        placeholder="Ekri nòt oswa nimewo tranzaksyon..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="flex gap-4 pt-4 border-t">
                      <Button 
                        onClick={() => handleProcess('complete')}
                        disabled={processing}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                      >
                        <Check size={18} className="mr-2" />
                        Konplete
                      </Button>
                      <Button 
                        onClick={() => handleProcess('cancel')}
                        disabled={processing}
                        variant="destructive"
                        className="flex-1"
                      >
                        <X size={18} className="mr-2" />
                        Anile
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
