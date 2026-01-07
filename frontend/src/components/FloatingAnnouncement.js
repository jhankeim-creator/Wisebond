import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { X, Megaphone, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { API_BASE } from '@/lib/utils';

export default function FloatingAnnouncement() {
  const { language } = useLanguage();
  const [cfg, setCfg] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const text = useMemo(() => {
    if (!cfg) return '';
    if (language === 'ht') return cfg.announcement_text_ht || '';
    if (language === 'fr') return cfg.announcement_text_fr || '';
    return cfg.announcement_text_en || '';
  }, [cfg, language]);

  const fallbackText = useMemo(() => {
    if (!cfg) return '';
    return (cfg.announcement_text_ht || cfg.announcement_text_fr || cfg.announcement_text_en || '').trim();
  }, [cfg]);

  const effectiveText = (text || '').trim() || fallbackText;

  const key = useMemo(() => {
    if (!cfg) return null;
    // Reset dismissal when settings.updated_at changes OR when content changes (fallback)
    const versionBase = [
      (cfg.updated_at || '').toString(),
      cfg.announcement_enabled ? '1' : '0',
      cfg.announcement_text_ht || '',
      cfg.announcement_text_fr || '',
      cfg.announcement_text_en || '',
      cfg.announcement_link || '',
    ].join('|');
    const version = btoa(unescape(encodeURIComponent(versionBase))).slice(0, 24) || 'v1';
    return `kayicom_announcement_dismissed_${version}`;
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
    if (!key) return;
    const v = localStorage.getItem(key);
    setDismissed(v === '1');
  }, [key]);

  if (!cfg?.announcement_enabled) return null;
  if (!effectiveText) return null;
  if (dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 shadow-lg p-4">
          <div className="mt-0.5">
            <Megaphone size={18} className="text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-relaxed break-words">{effectiveText}</p>
            {cfg.announcement_link && (
              <a
                href={cfg.announcement_link}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-[#EA580C] hover:underline"
              >
                Open
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (key) localStorage.setItem(key, '1');
              setDismissed(true);
            }}
            className="p-1 rounded-lg hover:bg-amber-100"
            aria-label="Dismiss announcement"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

