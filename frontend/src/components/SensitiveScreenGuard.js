import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function SensitiveScreenGuard({ children }) {
  const { language } = useLanguage();
  const [shielded, setShielded] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    const handleVisibility = () => setShielded(document.visibilityState !== 'visible');
    const handleBlur = () => setShielded(true);
    const handleFocus = () => setShielded(false);
    const handlePrint = (event) => {
      if (event.key === 'PrintScreen' || event.key === 'PrintScrn') {
        setShielded(true);
        setTimeout(() => setShielded(false), 1500);
      }
    };

    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('keyup', handlePrint);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keyup', handlePrint);
    };
  }, []);

  return (
    <div className="relative">
      <div className={shielded ? 'blur-md pointer-events-none select-none' : undefined}>
        {children}
      </div>
      {shielded && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-stone-900/70 text-white text-center px-6">
          <div className="max-w-sm space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <Shield size={24} />
            </div>
            <p className="text-base font-semibold">
              {getText('Pwoteksyon ekran aktive', 'Protection écran activée', 'Screen protection enabled')}
            </p>
            <p className="text-xs text-white/80">
              {getText(
                'Sèvi ak app la san w pa fè kaptur ekran.',
                'Merci de ne pas faire de capture d’écran.',
                'Please avoid taking screenshots.'
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default SensitiveScreenGuard;
