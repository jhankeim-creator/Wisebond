import React, { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_BASE as API } from '@/lib/utils';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, Edit2, Trash2, LifeBuoy, Save } from 'lucide-react';

const makeEmptyArticle = () => ({
  article_id: null,
  title_ht: '',
  title_fr: '',
  title_en: '',
  content_ht: '',
  content_fr: '',
  content_en: '',
  category: 'General',
  order: 0,
  is_active: true,
});

export default function AdminHelpCenter() {
  const { language } = useLanguage();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(makeEmptyArticle());
  const [activeLang, setActiveLang] = useState('ht');

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  const getTitle = (article) => {
    const fromLang = article?.[`title_${language}`];
    return fromLang || article?.title_ht || article?.title_fr || article?.title_en || getText('San tit', 'Sans titre', 'Untitled');
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/help-center`);
      setArticles(res.data.articles || []);
    } catch (error) {
      toast.error(getText('Erè pandan chajman', 'Erreur lors du chargement', 'Error loading'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const openCreate = () => {
    setEditing(makeEmptyArticle());
    setActiveLang('ht');
    setShowModal(true);
  };

  const openEdit = (article) => {
    setEditing({
      ...makeEmptyArticle(),
      ...article,
    });
    setActiveLang('ht');
    setShowModal(true);
  };

  const saveArticle = async () => {
    const titles = [editing.title_ht, editing.title_fr, editing.title_en].map((t) => String(t || '').trim());
    if (!titles.some(Boolean)) {
      toast.error(getText('Mete omwen yon tit', 'Ajoutez au moins un titre', 'Add at least one title'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title_ht: editing.title_ht || null,
        title_fr: editing.title_fr || null,
        title_en: editing.title_en || null,
        content_ht: editing.content_ht || null,
        content_fr: editing.content_fr || null,
        content_en: editing.content_en || null,
        category: editing.category || 'General',
        order: Number(editing.order || 0),
        is_active: !!editing.is_active,
      };

      if (editing.article_id) {
        await axios.put(`${API}/admin/help-center/${editing.article_id}`, payload);
        toast.success(getText('Mizajou fèt!', 'Mise à jour!', 'Updated!'));
      } else {
        await axios.post(`${API}/admin/help-center`, payload);
        toast.success(getText('Atik ajoute!', 'Article ajouté!', 'Article added!'));
      }
      setShowModal(false);
      fetchArticles();
    } catch (error) {
      toast.error(error.response?.data?.detail || getText('Erè', 'Erreur', 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const deleteArticle = async (article) => {
    if (!window.confirm(getText('Siprime atik sa?', 'Supprimer cet article?', 'Delete this article?'))) return;
    try {
      await axios.delete(`${API}/admin/help-center/${article.article_id}`);
      toast.success(getText('Efase', 'Supprimé', 'Deleted'));
      fetchArticles();
    } catch (error) {
      toast.error(getText('Erè', 'Erreur', 'Error'));
    }
  };

  const sortedArticles = useMemo(() => {
    return [...(articles || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [articles]);

  return (
    <AdminLayout title={getText('Sant Èd', 'Centre d’aide', 'Help Center')}>
      <div className="space-y-6" data-testid="admin-help-center">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <LifeBuoy className="text-amber-600" size={20} />
                </div>
                <div>
                  <CardTitle className="text-lg">{getText('Sant Èd', 'Centre d’aide', 'Help Center')}</CardTitle>
                  <CardDescription>
                    {getText('Ajoute kestyon ak repons pou kliyan yo', 'Ajoutez des FAQ pour les clients', 'Add questions and answers for clients')}
                  </CardDescription>
                </div>
              </div>
              <Button size="sm" onClick={openCreate} className="bg-[#EA580C] hover:bg-[#C2410C]">
                <Plus size={16} className="mr-2" />
                {getText('Nouvo atik', 'Nouvel article', 'New article')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
            ) : sortedArticles.length === 0 ? (
              <div className="text-center py-10 text-stone-500">
                {getText('Pa gen atik', 'Aucun article', 'No articles')}
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{getText('Tit', 'Titre', 'Title')}</th>
                        <th>{getText('Kategori', 'Catégorie', 'Category')}</th>
                        <th>{getText('Lòd', 'Ordre', 'Order')}</th>
                        <th>{getText('Stati', 'Statut', 'Status')}</th>
                        <th>{getText('Aksyon', 'Actions', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedArticles.map((article) => (
                        <tr key={article.article_id}>
                          <td className="font-medium">{getTitle(article)}</td>
                          <td>{article.category || 'General'}</td>
                          <td>{article.order ?? 0}</td>
                          <td>
                            <Badge className={article.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-700'}>
                              {article.is_active ? getText('Aktif', 'Actif', 'Active') : getText('Inaktif', 'Inactif', 'Inactive')}
                            </Badge>
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => openEdit(article)}>
                                <Edit2 size={14} className="mr-1" />
                                {getText('Modifye', 'Modifier', 'Edit')}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteArticle(article)}>
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-3">
                  {sortedArticles.map((article) => (
                    <div key={article.article_id} className="border rounded-xl p-4 space-y-3 bg-white dark:bg-stone-900">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{getTitle(article)}</p>
                          <p className="text-xs text-stone-500">{article.category || 'General'}</p>
                        </div>
                        <Badge className={article.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-700'}>
                          {article.is_active ? getText('Aktif', 'Actif', 'Active') : getText('Inaktif', 'Inactif', 'Inactive')}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-stone-500">{getText('Lòd', 'Ordre', 'Order')}: {article.order ?? 0}</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(article)}>
                            <Edit2 size={14} />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteArticle(article)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editing.article_id ? getText('Modifye Atik', 'Modifier article', 'Edit Article') : getText('Nouvo Atik', 'Nouvel article', 'New Article')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Label>{getText('Kategori', 'Catégorie', 'Category')}</Label>
                  <Input
                    value={editing.category || ''}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    className="mt-1"
                    placeholder={getText('Eg: Jeneral', 'Ex: Général', 'e.g. General')}
                  />
                </div>
                <div>
                  <Label>{getText('Lòd', 'Ordre', 'Order')}</Label>
                  <Input
                    type="number"
                    value={editing.order ?? 0}
                    onChange={(e) => setEditing({ ...editing, order: parseInt(e.target.value || '0', 10) })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border rounded-lg p-3">
                <span className="text-sm">{getText('Aktif', 'Actif', 'Active')}</span>
                <Switch
                  checked={!!editing.is_active}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
              </div>

              <Tabs value={activeLang} onValueChange={setActiveLang} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="ht">Kreyòl</TabsTrigger>
                  <TabsTrigger value="fr">Français</TabsTrigger>
                  <TabsTrigger value="en">English</TabsTrigger>
                </TabsList>

                <TabsContent value="ht" className="space-y-3">
                  <div>
                    <Label>{getText('Tit (Kreyòl)', 'Titre (Créole)', 'Title (Creole)')}</Label>
                    <Input
                      value={editing.title_ht || ''}
                      onChange={(e) => setEditing({ ...editing, title_ht: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>{getText('Kontni (Kreyòl)', 'Contenu (Créole)', 'Content (Creole)')}</Label>
                    <Textarea
                      value={editing.content_ht || ''}
                      onChange={(e) => setEditing({ ...editing, content_ht: e.target.value })}
                      className="mt-1 min-h-[140px]"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="fr" className="space-y-3">
                  <div>
                    <Label>Titre (FR)</Label>
                    <Input
                      value={editing.title_fr || ''}
                      onChange={(e) => setEditing({ ...editing, title_fr: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Contenu (FR)</Label>
                    <Textarea
                      value={editing.content_fr || ''}
                      onChange={(e) => setEditing({ ...editing, content_fr: e.target.value })}
                      className="mt-1 min-h-[140px]"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="en" className="space-y-3">
                  <div>
                    <Label>Title (EN)</Label>
                    <Input
                      value={editing.title_en || ''}
                      onChange={(e) => setEditing({ ...editing, title_en: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Content (EN)</Label>
                    <Textarea
                      value={editing.content_en || ''}
                      onChange={(e) => setEditing({ ...editing, content_en: e.target.value })}
                      className="mt-1 min-h-[140px]"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <Button onClick={saveArticle} disabled={saving} className="w-full btn-primary">
                <Save size={18} className="mr-2" />
                {saving ? getText('Anrejistreman...', 'Enregistrement...', 'Saving...') : getText('Anrejistre', 'Enregistrer', 'Save')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
