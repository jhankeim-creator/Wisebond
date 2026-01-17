import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { LifeBuoy, Search, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { API_BASE as API } from '@/lib/utils';
import axios from 'axios';

export default function HelpCenter() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  const getLocalized = (article, key) => {
    const fromLang = article?.[`${key}_${language}`];
    return fromLang || article?.[`${key}_ht`] || article?.[`${key}_fr`] || article?.[`${key}_en`] || '';
  };

  useEffect(() => {
    const fetchHelp = async () => {
      try {
        const res = await axios.get(`${API}/public/help-center`);
        setArticles(res.data.articles || []);
      } catch (error) {
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };
    fetchHelp();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return (articles || []).filter((article) => {
      const title = getLocalized(article, 'title').toLowerCase();
      const content = getLocalized(article, 'content').toLowerCase();
      const category = String(article.category || '').toLowerCase();
      return title.includes(q) || content.includes(q) || category.includes(q);
    });
  }, [articles, query, language]);

  const grouped = useMemo(() => {
    return filtered.reduce((acc, article) => {
      const category = article.category || getText('Jeneral', 'Général', 'General');
      if (!acc[category]) acc[category] = [];
      acc[category].push(article);
      return acc;
    }, {});
  }, [filtered, language]);

  const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900">
      <div className="bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </Button>
          <Logo />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700 p-6 sm:p-8 text-center sm:text-left">
          <div className="flex items-center gap-3 mb-4 justify-center sm:justify-start">
            <div className="w-12 h-12 bg-[#EA580C]/10 rounded-xl flex items-center justify-center">
              <LifeBuoy className="text-[#EA580C]" size={24} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-white">
                {getText('Sant Èd', 'Centre d’aide', 'Help Center')}
              </h1>
              <p className="text-stone-500 text-base sm:text-sm">
                {getText('Repons pou kestyon kliyan yo', 'Réponses aux questions fréquentes', 'Answers to common questions')}
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={getText('Chèche kestyon...', 'Rechercher...', 'Search questions...')}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center text-stone-500">{getText('Chajman...', 'Chargement...', 'Loading...')}</div>
        ) : categories.length === 0 ? (
          <div className="text-center text-stone-500">
            {getText('Pa gen kestyon pou moman an.', 'Aucune question pour le moment.', 'No articles yet.')}
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category} className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 text-center sm:text-left">
                <h2 className="text-xl sm:text-lg font-semibold text-stone-900 dark:text-white mb-4">{category}</h2>
                <Accordion type="multiple" className="w-full">
                  {(grouped[category] || []).map((article) => (
                    <AccordionItem key={article.article_id} value={article.article_id}>
                      <AccordionTrigger className="text-base sm:text-sm text-center sm:text-left">
                        {getLocalized(article, 'title') || getText('San tit', 'Sans titre', 'Untitled')}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="text-base sm:text-sm text-stone-600 dark:text-stone-300 whitespace-pre-line leading-relaxed text-center sm:text-left">
                          {getLocalized(article, 'content') || getText('Pa gen detay.', 'Pas de détails.', 'No details.')}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
