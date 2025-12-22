import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, RefreshCw, Trash2, Shield, Pencil } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminTeam() {
  const { getText } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState([]);
  const [roles, setRoles] = useState([]);

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState('admin');
  const [adding, setAdding] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editRole, setEditRole] = useState('admin');
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [teamResp, rolesResp] = await Promise.all([
        axios.get(`${API}/admin/team`),
        axios.get(`${API}/admin/team/roles`).catch(() => ({ data: { roles: ['owner', 'admin', 'support', 'finance', 'viewer'] } }))
      ]);
      setTeam(teamResp.data.team || []);
      setRoles(rolesResp.data.roles || []);
    } catch (e) {
      setTeam([]);
      setRoles(['owner', 'admin', 'support', 'finance', 'viewer']);
      toast.error(getText('Erè pandan chajman', 'Erreur lors du chargement', 'Error loading'));
    } finally {
      setLoading(false);
    }
  }, [getText]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const roleBadge = (role) => {
    const r = String(role || '').toLowerCase();
    if (r === 'owner') return 'bg-purple-100 text-purple-700';
    if (r === 'admin') return 'bg-amber-100 text-amber-700';
    if (r === 'finance') return 'bg-emerald-100 text-emerald-700';
    if (r === 'support') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-700';
  };

  const normalizedTeam = useMemo(() => {
    return (team || []).map((m) => ({
      ...m,
      admin_role: m.admin_role || (m.is_admin ? 'admin' : 'viewer')
    }));
  }, [team]);

  const openEdit = (member) => {
    setSelected(member);
    setEditRole(member.admin_role || (member.is_admin ? 'admin' : 'viewer'));
    setEditActive(member.is_active !== false);
    setEditOpen(true);
  };

  const addMember = async () => {
    if (!addEmail.trim()) {
      toast.error(getText('Mete imèl la', "Entrez l'email", 'Enter email'));
      return;
    }
    setAdding(true);
    try {
      await axios.post(`${API}/admin/team`, { email: addEmail.trim(), role: addRole });
      toast.success(getText('Manm ajoute', 'Membre ajouté', 'Member added'));
      setAddOpen(false);
      setAddEmail('');
      setAddRole('admin');
      await fetchAll();
    } catch (e) {
      toast.error(getText('Erè pandan ajout', "Erreur lors de l'ajout", 'Error adding member'));
    } finally {
      setAdding(false);
    }
  };

  const saveMember = async () => {
    if (!selected?.user_id) return;
    setSaving(true);
    try {
      await axios.patch(`${API}/admin/team/${selected.user_id}`, {
        role: editRole,
        is_active: editActive
      });
      toast.success(getText('Mizajou fèt', 'Mise à jour effectuée', 'Updated'));
      setEditOpen(false);
      setSelected(null);
      await fetchAll();
    } catch (e) {
      toast.error(getText('Erè pandan mizajou', 'Erreur lors de la mise à jour', 'Error updating'));
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (member) => {
    if (!member?.user_id) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(getText('Retire aksè admin pou manm sa?', 'Retirer les droits admin?', 'Remove admin access?'))) return;
    try {
      await axios.delete(`${API}/admin/team/${member.user_id}`);
      toast.success(getText('Retire', 'Retiré', 'Removed'));
      await fetchAll();
    } catch (e) {
      toast.error(getText('Erè pandan retire', 'Erreur lors de la suppression', 'Error removing'));
    }
  };

  return (
    <AdminLayout title={getText('Ekip / Jere Ekip', 'Équipe / Gérer équipe', 'Team / Manage team')}>
      <div className="space-y-6" data-testid="admin-team">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield size={18} />
                {getText('Manm ekip la', "Membres de l'équipe", 'Team members')} ({normalizedTeam.length})
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
                  <RefreshCw size={16} className="mr-2" />
                  {getText('Aktyalize', 'Actualiser', 'Refresh')}
                </Button>
                <Button size="sm" onClick={() => setAddOpen(true)} className="bg-[#EA580C] hover:bg-[#EA580C]/90">
                  <Plus size={16} className="mr-2" />
                  {getText('Ajoute', 'Ajouter', 'Add')}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : normalizedTeam.length === 0 ? (
              <div className="py-8 text-center text-slate-500">{getText('Pa gen done', 'Aucune donnée', 'No data')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{getText('Non', 'Nom', 'Name')}</th>
                      <th>{getText('Imèl', 'Email', 'Email')}</th>
                      <th>{getText('Wòl', 'Rôle', 'Role')}</th>
                      <th>{getText('Statis', 'Statut', 'Status')}</th>
                      <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedTeam.map((m) => (
                      <tr key={m.user_id}>
                        <td className="font-medium">{m.full_name || '-'}</td>
                        <td className="font-mono text-sm">{m.email}</td>
                        <td>
                          <Badge className={roleBadge(m.admin_role)}>{String(m.admin_role || '').toUpperCase()}</Badge>
                        </td>
                        <td>
                          <Badge className={m.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                            {m.is_active !== false ? getText('Aktif', 'Actif', 'Active') : getText('Bloke', 'Bloqué', 'Blocked')}
                          </Badge>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEdit(m)} title={getText('Modifye', 'Modifier', 'Edit')}>
                              <Pencil size={16} />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => removeMember(m)} title={getText('Retire', 'Retirer', 'Remove')}>
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{getText('Ajoute manm ekip', "Ajouter un membre", 'Add team member')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{getText('Imèl itilizatè a', "Email de l'utilisateur", 'User email')}</Label>
                <Input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="name@example.com" />
                <p className="text-xs text-slate-500">
                  {getText(
                    'Itilizatè a dwe deja anrejistre avan ou ka mete li nan ekip la.',
                    "L'utilisateur doit déjà être inscrit avant de l'ajouter à l'équipe.",
                    'User must already be registered before you can add them.'
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{getText('Wòl', 'Rôle', 'Role')}</Label>
                <Select value={addRole} onValueChange={setAddRole}>
                  <SelectTrigger>
                    <SelectValue placeholder={getText('Chwazi wòl', 'Choisir un rôle', 'Select role')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(roles.length ? roles : ['owner', 'admin', 'support', 'finance', 'viewer']).map((r) => (
                      <SelectItem key={r} value={r}>
                        {String(r).toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>
                  {getText('Anile', 'Annuler', 'Cancel')}
                </Button>
                <Button onClick={addMember} disabled={adding} className="bg-[#EA580C] hover:bg-[#EA580C]/90">
                  <Plus size={16} className="mr-2" />
                  {getText('Ajoute', 'Ajouter', 'Add')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{getText('Modifye manm ekip', 'Modifier le membre', 'Edit member')}</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <div className="text-sm font-medium">{selected.full_name || '-'}</div>
                  <div className="text-xs text-slate-500 font-mono">{selected.email}</div>
                </div>
                <div className="space-y-2">
                  <Label>{getText('Wòl', 'Rôle', 'Role')}</Label>
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(roles.length ? roles : ['owner', 'admin', 'support', 'finance', 'viewer']).map((r) => (
                        <SelectItem key={r} value={r}>
                          {String(r).toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="text-sm font-medium">{getText('Kont aktif', 'Compte actif', 'Active account')}</div>
                    <div className="text-xs text-slate-500">{getText('Si ou fèmen, li pa ka konekte.', "S'il est désactivé, il ne peut pas se connecter.", 'If disabled, they cannot log in.')}</div>
                  </div>
                  <Switch checked={editActive} onCheckedChange={setEditActive} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                    {getText('Fèmen', 'Fermer', 'Close')}
                  </Button>
                  <Button onClick={saveMember} disabled={saving} className="bg-[#EA580C] hover:bg-[#EA580C]/90">
                    {getText('Sove', 'Sauvegarder', 'Save')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

