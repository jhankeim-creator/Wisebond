import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, Megaphone, Trash2, RefreshCw, Edit, Eye, EyeOff } from 'lucide-react';

import { API_BASE } from '@/lib/utils';
const API = API_BASE;

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    link_url: '',
    link_text: '',
    is_active: true,
    priority: 0
  });

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/announcements`);
      setAnnouncements(response.data.announcements || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const openCreate = () => {
    setEditing(null);
    setFormData({
      title: '',
      message: '',
      type: 'info',
      link_url: '',
      link_text: '',
      is_active: true,
      priority: 0
    });
    setShowModal(true);
  };

  const openEdit = (announcement) => {
    setEditing(announcement);
    setFormData({
      title: announcement.title,
      message: announcement.message,
      type: announcement.type || 'info',
      link_url: announcement.link_url || '',
      link_text: announcement.link_text || '',
      is_active: announcement.is_active !== false,
      priority: announcement.priority || 0
    });
    setShowModal(true);
  };

  const saveAnnouncement = async () => {
    if (!formData.title || !formData.message) {
      toast.error('Tit ak mesaj obligatwa');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await axios.put(`${API}/admin/announcements/${editing.announcement_id}`, formData);
        toast.success('Anons modifye!');
      } else {
        await axios.post(`${API}/admin/announcements`, formData);
        toast.success('Anons kreye!');
      }
      setShowModal(false);
      fetchAnnouncements();
    } catch (error) {
      toast.error('Erè pandan anrejistreman');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (announcement) => {
    try {
      await axios.patch(`${API}/admin/announcements/${announcement.announcement_id}/toggle`);
      fetchAnnouncements();
      toast.success(announcement.is_active ? 'Anons deaktive' : 'Anons aktive');
    } catch (error) {
      toast.error('Erè');
    }
  };

  const deleteAnnouncement = async (announcementId) => {
    if (!window.confirm('Siprime anons sa a?')) return;
    try {
      await axios.delete(`${API}/admin/announcements/${announcementId}`);
      toast.success('Anons siprime!');
      fetchAnnouncements();
    } catch (error) {
      toast.error('Erè pandan sipresyon');
    }
  };

  const typeOptions = [
    { value: 'info', label: 'Enfòmasyon', color: 'bg-blue-100 text-blue-700' },
    { value: 'warning', label: 'Avètisman', color: 'bg-amber-100 text-amber-700' },
    { value: 'success', label: 'Siksè', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'promo', label: 'Pwomosyon', color: 'bg-purple-100 text-purple-700' }
  ];

  return (
    <AdminLayout title="Anons Flotan">
      <div className="space-y-6" data-testid="admin-announcements">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-stone-900 dark:text-white">Jesyon Anons</h2>
            <p className="text-stone-500 dark:text-stone-400">Kreye ak jere anons flotan pou itilizatè yo</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchAnnouncements}>
              <RefreshCw size={16} className="mr-2" />
              Aktyalize
            </Button>
            <Button onClick={openCreate} className="btn-primary">
              <Plus size={16} className="mr-2" />
              Nouvo Anons
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-blue-50 dark:bg-blue-900/20">
            <CardContent className="p-4 text-center">
              <p className="text-blue-800 dark:text-blue-300 font-bold text-2xl">{announcements.length}</p>
              <p className="text-blue-600 dark:text-blue-400 text-sm">Total Anons</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 dark:bg-emerald-900/20">
            <CardContent className="p-4 text-center">
              <p className="text-emerald-800 dark:text-emerald-300 font-bold text-2xl">
                {announcements.filter(a => a.is_active).length}
              </p>
              <p className="text-emerald-600 dark:text-emerald-400 text-sm">Aktif</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 dark:bg-purple-900/20">
            <CardContent className="p-4 text-center">
              <p className="text-purple-800 dark:text-purple-300 font-bold text-2xl">
                {announcements.filter(a => a.type === 'promo').length}
              </p>
              <p className="text-purple-600 dark:text-purple-400 text-sm">Pwomosyon</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-900/20">
            <CardContent className="p-4 text-center">
              <p className="text-amber-800 dark:text-amber-300 font-bold text-2xl">
                {announcements.filter(a => !a.is_active).length}
              </p>
              <p className="text-amber-600 dark:text-amber-400 text-sm">Deaktive</p>
            </CardContent>
          </Card>
        </div>

        {/* Announcements List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone size={20} className="text-[#EA580C]" />
              Lis Anons
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Chajman...</div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-8 text-stone-500">
                <Megaphone size={48} className="mx-auto mb-3 text-stone-300" />
                <p>Pa gen anons</p>
                <Button onClick={openCreate} className="mt-4 btn-primary">
                  Kreye premye anons ou
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <div 
                    key={announcement.announcement_id}
                    className={`p-4 rounded-xl border ${announcement.is_active ? 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800' : 'border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 opacity-60'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-stone-900 dark:text-white">{announcement.title}</h4>
                          <Badge className={typeOptions.find(t => t.value === announcement.type)?.color || 'bg-stone-100 text-stone-700'}>
                            {typeOptions.find(t => t.value === announcement.type)?.label || announcement.type}
                          </Badge>
                          {!announcement.is_active && (
                            <Badge className="bg-stone-200 text-stone-600">Deaktive</Badge>
                          )}
                        </div>
                        <p className="text-stone-600 dark:text-stone-400 text-sm">{announcement.message}</p>
                        {announcement.link_url && (
                          <p className="text-xs text-[#EA580C] mt-1">{announcement.link_text || announcement.link_url}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => toggleActive(announcement)}
                        >
                          {announcement.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openEdit(announcement)}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => deleteAnnouncement(announcement.announcement_id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="text-[#EA580C]" size={20} />
                {editing ? 'Modifye Anons' : 'Nouvo Anons'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tit *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Ex: Nouvo fonksyonalite disponib!"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Mesaj *</Label>
                <Textarea
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  placeholder="Kontni mesaj la..."
                  className="mt-1"
                  rows={3}
                />
              </div>
              
              <div>
                <Label>Tip</Label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full mt-1 border rounded-lg px-3 py-2 bg-white dark:bg-stone-800"
                >
                  {typeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Lyen URL (opsyonèl)</Label>
                  <Input
                    value={formData.link_url}
                    onChange={(e) => setFormData({...formData, link_url: e.target.value})}
                    placeholder="https://..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Tèks lyen</Label>
                  <Input
                    value={formData.link_text}
                    onChange={(e) => setFormData({...formData, link_text: e.target.value})}
                    placeholder="Aprann plis"
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="font-medium text-stone-900 dark:text-white">Aktif</p>
                  <p className="text-xs text-stone-500">Anons la ap parèt pou itilizatè yo</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                />
              </div>

              <Button onClick={saveAnnouncement} disabled={saving} className="w-full btn-primary">
                {saving ? 'Anrejistreman...' : (editing ? 'Modifye' : 'Kreye Anons')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
