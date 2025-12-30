import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Download, Smartphone, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function InstallPrompt() {
  const { language } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showButton, setShowButton] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowButton(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowButton(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Show button on Android even without prompt
    const userAgent = navigator.userAgent.toLowerCase();
    if (/android/i.test(userAgent)) {
      setShowButton(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Show manual instructions if no prompt available
      alert(getText(
        'Pou enstale: Klike sou Menu (⋮) nan Chrome epi chwazi "Add to Home screen"',
        'Pour installer: Cliquez sur Menu (⋮) dans Chrome et choisissez "Ajouter à l\'écran d\'accueil"',
        'To install: Click Menu (⋮) in Chrome and select "Add to Home screen"'
      ));
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
  };

  // Don't show if installed
  if (isInstalled) return null;

  // Don't show if not on mobile/no prompt
  if (!showButton) return null;

  return (
    <>
      {/* Fixed button at bottom */}
      <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center pointer-events-none">
        <Button
          onClick={handleInstall}
          className="pointer-events-auto bg-gradient-to-r from-[#EA580C] to-[#F59E0B] hover:from-[#C2410C] hover:to-[#D97706] text-white font-bold shadow-2xl shadow-orange-500/30 rounded-full px-6 py-6 h-auto animate-slide-up"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Download size={20} />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm">
                {getText('Enstale App', 'Installer App', 'Install App')}
              </p>
              <p className="text-xs text-orange-100 font-normal">
                {getText('Leje & Rapid', 'Légère & Rapide', 'Light & Fast')}
              </p>
            </div>
          </div>
        </Button>
      </div>

      {/* Spacer to prevent content overlap */}
      <div className="h-24" />
    </>
  );
}

// Separate component for showing in pages (like Landing or Settings)
export function InstallButton({ className = '' }) {
  const { language } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    // Check platform
    const userAgent = navigator.userAgent.toLowerCase();
    setIsAndroid(/android/i.test(userAgent));

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className={`flex items-center gap-2 text-emerald-600 ${className}`}>
        <Check size={20} />
        <span className="font-medium">
          {getText('App enstale', 'App installée', 'App installed')}
        </span>
      </div>
    );
  }

  if (!deferredPrompt && !isAndroid) return null;

  return (
    <Button
      onClick={handleInstall}
      disabled={!deferredPrompt}
      className={`bg-gradient-to-r from-[#EA580C] to-[#F59E0B] hover:from-[#C2410C] hover:to-[#D97706] text-white font-semibold shadow-lg ${className}`}
    >
      <Smartphone size={18} className="mr-2" />
      {getText('Enstale App Android', 'Installer App Android', 'Install Android App')}
    </Button>
  );
}

export default InstallPrompt;
