import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { API_BASE as API } from '@/lib/utils';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, RefreshCw, UserX, CheckCircle } from 'lucide-react';

export default function AdminTeam() {
  const { language } = useLanguage();
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'admin',
  });

  const getText = useCallback((ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  }, [language]);

  const roleOptions = useMemo(() => ([
    { value: 'admin', label: getText('Admin', 'Admin', 'Admin') },
    { value: 'support', label: getText('Sipò', 'Support', 'Support') },
    { value: 'finance', label: getText('Finans', 'Finance', 'Finance') },
    { value: 'manager', label: getText('Manadjè', 'Manager', 'Manager') },
    { value: 'superadmin', label: getText('Super Admin', 'Super Admin', 'Super Admin') },
  ]), [getText]);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/team`);
      setTeam(res.data.team || []);
    } catch (e) {
      toast.error(getText('Erè pandan chajman', 'Erreur lors du chargement', 'Error loading'));
    } finally {
      setLoading(false);
    }
  }, [getText]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const createMember = async () => {
    if (!form.email || !form.password || !form.full_name || !form.phone) {
      toast.error(getText('Ranpli tout chan yo', 'Veuillez remplir tous les champs', 'Fill all fields'));
      return;
    }
    setCreating(true);
    try {
      await axios.post(`${API}/admin/team`, form);
      toast.success(getText('Manm ekip la ajoute', 'Membre ajouté', 'Team member added'));
      setShowModal(false);
      setForm({ email: '', password: '', full_name: '', phone: '', role: 'admin' });
      fetchTeam();
    } catch (e) {
      toast.error(e.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (member) => {
    try {
      await axios.patch(`${API}/admin/team/${member.user_id}`, { is_active: !member.is_active });
      toast.success(getText('Mizajou fèt', 'Mis à jour', 'Updated'));
      fetchTeam();
    } catch (e) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    }
  };

  const changeRole = async (member, newRole) => {
    try {
      await axios.patch(`${API}/admin/team/${member.user_id}`, { admin_role: newRole });
      toast.success(getText('Wòl chanje!', 'Rôle changé!', 'Role changed!'));
      fetchTeam();
    } catch (e) {
      toast.error(e.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    }
  };

  return (
    <AdminLayout title={getText('Ekip / Admin', 'Équipe / Admin', 'Team / Admin')}>
      <div className="space-y-6" data-testid="admin-team">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{getText('Manm ekip yo', 'Membres de l’équipe', 'Team members')}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchTeam}>
                  <RefreshCw size={16} />
                </Button>
                <Button size="sm" onClick={() => setShowModal(true)} className="bg-[#EA580C]">
                  <Plus size={16} className="mr-2" />
                  {getText('Ajoute', 'Ajouter', 'Add')}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : team.length === 0 ? (
              <div className="text-center py-8 text-stone-500">{getText('Pa gen manm', 'Aucun membre', 'No members')}</div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {team.map((m) => (
                    <div key={m.user_id} className="border rounded-xl p-4 bg-white dark:bg-stone-800">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-stone-900 dark:text-white truncate">{m.full_name}</p>
                          <p className="text-sm text-stone-600 dark:text-stone-300 break-all">{m.email}</p>
                          <div className="mt-2">
                            <Label className="text-xs">{getText('Wòl', 'Rôle', 'Role')}</Label>
                            <Select 
                              value={m.admin_role || 'admin'} 
                              onValueChange={(v) => changeRole(m, v)}
                            >
                              <SelectTrigger className="w-full h-8 text-xs mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {roleOptions.map((r) => (
                                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              m.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {m.is_active ? getText('Aktif', 'Actif', 'Active') : getText('Bloke', 'Bloqué', 'Blocked')}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={m.is_active ? 'destructive' : 'default'}
                          onClick={() => toggleActive(m)}
                          title={m.is_active ? getText('Dezaktive', 'Désactiver', 'Disable') : getText('Aktive', 'Activer', 'Enable')}
                        >
                          {m.is_active ? <UserX size={16} /> : <CheckCircle size={16} />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="overflow-x-auto hidden md:block">
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
                      {team.map((m) => (
                        <tr key={m.user_id}>
                          <td className="font-medium">{m.full_name}</td>
                          <td>{m.email}</td>
                          <td>
                            <Select 
                              value={m.admin_role || 'admin'} 
                              onValueChange={(v) => changeRole(m, v)}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {roleOptions.map((r) => (
                                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td>
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              m.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {m.is_active ? getText('Aktif', 'Actif', 'Active') : getText('Bloke', 'Bloqué', 'Blocked')}
                            </span>
                          </td>
                          <td>
                            <Button
                              size="sm"
                              variant={m.is_active ? 'destructive' : 'default'}
                              onClick={() => toggleActive(m)}
                              title={m.is_active ? getText('Dezaktive', 'Désactiver', 'Disable') : getText('Aktive', 'Activer', 'Enable')}
                            >
                              {m.is_active ? <UserX size={16} /> : <CheckCircle size={16} />}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{getText('Ajoute manm ekip', 'Ajouter un membre', 'Add team member')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>{getText('Modpas', 'Mot de passe', 'Password')}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>{getText('Non konplè', 'Nom complet', 'Full name')}</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>{getText('Telefòn', 'Téléphone', 'Phone')}</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>{getText('Wòl', 'Rôle', 'Role')}</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="admin" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-stone-500 mt-1">
                  {getText(
                    'Chwazi wòl manm ekip la.',
                    'Choisissez le rôle du membre.',
                    'Choose the member role.'
                  )}
                </p>
              </div>

              <Button onClick={createMember} disabled={creating} className="w-full btn-primary">
                {creating ? getText('Kreye...', 'Création...', 'Creating...') : getText('Kreye', 'Créer', 'Create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

