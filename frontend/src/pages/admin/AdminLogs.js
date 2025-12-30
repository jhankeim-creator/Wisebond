import React, { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import axios from 'axios';
import { RefreshCw, Filter, Eye } from 'lucide-react';

import { API_BASE } from '@/lib/utils';
const API = API_BASE;

export default function AdminLogs() {
  const { getText } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [limit, setLimit] = useState(200);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (userId.trim()) params.set('user_id', userId.trim());
      if (action.trim()) params.set('action', action.trim());
      const resp = await axios.get(`${API}/admin/logs?${params.toString()}`);
      setLogs(resp.data.logs || []);
    } catch (e) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uniqueActions = useMemo(() => {
    const s = new Set();
    logs.forEach((l) => {
      if (l.action) s.add(l.action);
    });
    return Array.from(s).sort();
  }, [logs]);

  const openDetail = (log) => {
    setSelected(log);
    setOpen(true);
  };

  return (
    <AdminLayout title={getText('Mesaj / Jounal', 'Messages / Journaux', 'Messages / Logs')}>
      <div className="space-y-6" data-testid="admin-logs">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter size={18} />
              {getText('Filtre mesaj', 'Filtrer les messages', 'Filter messages')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-3">
            <Input
              placeholder={getText('User ID...', 'User ID...', 'User ID...')}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
            <Input
              placeholder={getText('Aksyon...', 'Action...', 'Action...')}
              value={action}
              onChange={(e) => setAction(e.target.value)}
              list="actions"
            />
            <datalist id="actions">
              {uniqueActions.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
            <Input
              type="number"
              min={50}
              max={500}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
            <div className="md:col-span-4 flex gap-2">
              <Button variant="outline" onClick={fetchLogs} disabled={loading}>
                <RefreshCw size={16} className="mr-2" />
                {getText('Chaje', 'Charger', 'Load')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setUserId('');
                  setAction('');
                  setLimit(200);
                  setTimeout(fetchLogs, 0);
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
              {getText('Lis mesaj yo', 'Liste des messages', 'Messages list')} ({logs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : logs.length === 0 ? (
              <div className="py-8 text-center text-slate-500">{getText('Pa gen done', 'Aucune donnée', 'No data')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{getText('Lè', 'Date', 'Date')}</th>
                      <th>User ID</th>
                      <th>{getText('Aksyon', 'Action', 'Action')}</th>
                      <th>{getText('Detay', 'Détails', 'Details')}</th>
                      <th>{getText('Gade', 'Voir', 'View')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.log_id}>
                        <td>{l.timestamp ? new Date(l.timestamp).toLocaleString() : '-'}</td>
                        <td className="font-mono text-sm">{l.user_id}</td>
                        <td>
                          <Badge className="bg-slate-100 text-slate-700">{l.action}</Badge>
                        </td>
                        <td className="max-w-[420px] truncate text-sm text-slate-600">
                          {l.details ? JSON.stringify(l.details) : '-'}
                        </td>
                        <td>
                          <Button size="sm" variant="outline" onClick={() => openDetail(l)}>
                            <Eye size={16} />
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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{getText('Detay mesaj', 'Détail du message', 'Message detail')}</DialogTitle>
            </DialogHeader>
            {selected && (
              <pre className="text-xs bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto">
{JSON.stringify(selected, null, 2)}
              </pre>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

