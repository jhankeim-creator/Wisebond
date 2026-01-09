import React, { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { API_BASE as API } from '@/lib/utils';
import axios from 'axios';
import { RefreshCw, Eye, Webhook } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function AdminWebhookEvents() {
  const { language } = useLanguage();
  const [provider, setProvider] = useState('all');
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  const providerOptions = useMemo(() => ([
    { value: 'all', label: getText('Tout', 'Tous', 'All') },
    { value: 'strowallet', label: 'Strowallet' },
    { value: 'amucha', label: 'Amucha' },
    { value: 'bankly', label: 'Bankly' },
    { value: 'paga', label: 'Paga' },
    { value: 'safe-haven', label: 'Safe Haven' },
  ]), [language]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (provider !== 'all') params.set('provider', provider);
      const resp = await axios.get(`${API}/admin/webhook-events?${params.toString()}`);
      setEvents(resp.data?.events || []);
    } catch (e) {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (ev) => {
    setOpen(true);
    setSelected(null);
    setDetailLoading(true);
    try {
      const resp = await axios.get(`${API}/admin/webhook-events/${ev.event_id}`);
      setSelected(resp.data?.event || null);
    } catch (e) {
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const providerBadge = (p) => {
    const v = String(p || '').toLowerCase();
    if (v === 'strowallet') return <Badge className="bg-purple-100 text-purple-700">Strowallet</Badge>;
    if (v === 'amucha') return <Badge className="bg-blue-100 text-blue-700">Amucha</Badge>;
    if (v === 'bankly') return <Badge className="bg-emerald-100 text-emerald-700">Bankly</Badge>;
    if (v === 'paga') return <Badge className="bg-amber-100 text-amber-700">Paga</Badge>;
    if (v === 'safe-haven') return <Badge className="bg-stone-100 text-stone-700">Safe Haven</Badge>;
    return <Badge variant="outline">{p || '-'}</Badge>;
  };

  return (
    <AdminLayout title={getText('Webhook Logs', 'Webhook Logs', 'Webhook Logs')}>
      <div className="space-y-6" data-testid="admin-webhook-events">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook size={18} />
              {getText('Webhook Events', 'Événements Webhook', 'Webhook Events')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-3 items-end">
            <div>
              <div className="text-xs text-stone-500 mb-1">{getText('Provider', 'Provider', 'Provider')}</div>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="text-xs text-stone-500 mb-1">{getText('Limit', 'Limite', 'Limit')}</div>
              <Input
                type="number"
                min={10}
                max={500}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value || 100))}
              />
            </div>

            <div className="md:col-span-2 flex gap-2">
              <Button variant="outline" onClick={fetchEvents} disabled={loading}>
                <RefreshCw size={16} className="mr-2" />
                {getText('Chaje', 'Charger', 'Load')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setProvider('all');
                  setLimit(100);
                  setTimeout(fetchEvents, 0);
                }}
              >
                {getText('Reyinisyalize', 'Réinitialiser', 'Reset')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {getText('Dènye evènman yo', 'Derniers événements', 'Latest events')} ({events.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : events.length === 0 ? (
              <div className="py-8 text-center text-stone-500">
                {getText('Pa gen evènman webhook', 'Aucun événement webhook', 'No webhook events')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{getText('Provider', 'Provider', 'Provider')}</th>
                      <th>{getText('Dat', 'Date', 'Date')}</th>
                      <th>{getText('Rezime', 'Résumé', 'Summary')}</th>
                      <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev) => (
                      <tr key={ev.event_id}>
                        <td>{providerBadge(ev.provider)}</td>
                        <td className="text-sm">
                          {ev.received_at ? new Date(ev.received_at).toLocaleString() : '-'}
                        </td>
                        <td className="text-sm text-stone-600">
                          {String(ev.summary || ev.payload?.message || ev.payload?.event || ev.payload?.type || ev.payload?.action || '-')}
                        </td>
                        <td>
                          <Button size="sm" variant="outline" onClick={() => openDetail(ev)}>
                            <Eye size={16} className="mr-1" />
                            {getText('Wè', 'Voir', 'View')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{getText('Detay webhook', 'Détail webhook', 'Webhook detail')}</DialogTitle>
            </DialogHeader>
            {detailLoading ? (
              <div className="py-8 text-center">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : (
              <pre className="text-xs whitespace-pre-wrap bg-stone-50 dark:bg-stone-900 border rounded-lg p-3 overflow-x-auto">
                {selected ? JSON.stringify(selected, null, 2) : 'Not found'}
              </pre>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

