import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { X, ExternalLink, Megaphone } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { API_BASE } from '@/lib/utils';

export default function AnnouncementBanner() {
  const { language } = useLanguage();
  const [cfg, setCfg] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const localizedText = useMemo(() => {
    if (!cfg) return '';
    if (language === 'ht') return cfg.announcement_text_ht || '';
    if (language === 'fr') return cfg.announcement_text_fr || '';
    return cfg.announcement_text_en || '';
  }, [cfg, language]);

  const effectiveText = useMemo(() => {
    if (!cfg) return '';
    return (localizedText || cfg.announcement_text_ht || cfg.announcement_text_fr || cfg.announcement_text_en || '').trim();
  }, [cfg, localizedText]);

  const sessionKey = useMemo(() => {
    if (!cfg) return null;
    const base = [
      cfg.announcement_enabled ? '1' : '0',
      cfg.announcement_text_ht || '',
      cfg.announcement_text_fr || '',
      cfg.announcement_text_en || '',
      cfg.announcement_link || '',
      (cfg.updated_at || '').toString(),
    ].join('|');
    const hash = btoa(unescape(encodeURIComponent(base))).slice(0, 24) || 'v1';
    return `kayicom_announcement_session_${hash}`;
  }, [cfg]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/public/app-config`, {
          headers: { 'Cache-Control': 'no-cache' },
          params: { _ts: Date.now() },
        });
        if (!mounted) return;
        setCfg(res.data || {});
      } catch (e) {
        // silent
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionKey) return;
    const v = sessionStorage.getItem(sessionKey);
    setDismissed(v === '1');
  }, [sessionKey]);

  if (!cfg?.announcement_enabled) return null;
  if (!effectiveText) return null;
  if (dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-stone-900 shadow-xl overflow-hidden">
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <div className="mt-0.5 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#EA580C] to-amber-500 flex items-center justify-center">
                <Megaphone size={18} className="text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-base text-stone-900 dark:text-white leading-relaxed break-words">
                {effectiveText}
              </p>
              {cfg.announcement_link && (
                <a
                  href={cfg.announcement_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#EA580C] hover:underline"
                >
                  Open
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (sessionKey) sessionStorage.setItem(sessionKey, '1');
                setDismissed(true);
              }}
              className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
              aria-label="Dismiss announcement"
            >
              <X size={18} className="text-stone-500 dark:text-stone-300" />
            </button>
          </div>
          <div className="h-1 bg-gradient-to-r from-[#EA580C] to-amber-500" />
        </div>
      </div>
    </div>
  );
}

