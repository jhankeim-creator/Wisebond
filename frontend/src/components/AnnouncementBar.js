import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { ExternalLink, Megaphone } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { API_BASE } from '@/lib/utils';

export default function AnnouncementBar() {
  const { language } = useLanguage();
  const [cfg, setCfg] = useState(null);
  const barRef = useRef(null);

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

  // Ensure the bar is always visible (fixed) and layouts offset correctly
  useEffect(() => {
    const applyHeight = () => {
      const enabled = Boolean(cfg?.announcement_enabled) && Boolean(effectiveText);
      const h = enabled ? (barRef.current?.getBoundingClientRect?.().height || 0) : 0;
      document.documentElement.style.setProperty('--announcement-bar-h', `${Math.round(h)}px`);
    };

    applyHeight();
    window.addEventListener('resize', applyHeight);
    return () => {
      window.removeEventListener('resize', applyHeight);
      document.documentElement.style.setProperty('--announcement-bar-h', '0px');
    };
  }, [cfg?.announcement_enabled, effectiveText]);

  if (!cfg?.announcement_enabled) return null;
  if (!effectiveText) return null;

  return (
    <div ref={barRef} className="fixed top-0 inset-x-0 z-[60] w-full">
      <div className="w-full bg-gradient-to-r from-[#EA580C] to-amber-500 text-white shadow-lg">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              <Megaphone size={18} className="text-white/90" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-base leading-relaxed break-words">
                {effectiveText}
              </p>
              {cfg.announcement_link && (
                <a
                  href={cfg.announcement_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-white underline underline-offset-4"
                >
                  Open
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

