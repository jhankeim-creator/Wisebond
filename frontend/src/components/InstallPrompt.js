import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Download, X, Smartphone, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function InstallPrompt() {
  const { language } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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

    // Check if dismissed recently (24 hours)
    const dismissedTime = localStorage.getItem('pwa-dismissed');
    if (dismissedTime && Date.now() - parseInt(dismissedTime) < 24 * 60 * 60 * 1000) {
      setDismissed(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
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
    setShowBanner(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-dismissed', Date.now().toString());
    setDismissed(true);
    setShowBanner(false);
  };

  // Don't show if installed, dismissed, or no prompt
  if (isInstalled || dismissed || !showBanner) return null;

  return (
    <>
      {/* Fixed bottom banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 border-t border-stone-700 shadow-2xl">
          <div className="max-w-screen-lg mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              {/* Icon & Text */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 bg-gradient-to-br from-[#EA580C] to-[#F59E0B] rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-white font-black text-xl">K</span>
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {getText('Enstale KAYICOM', 'Installer KAYICOM', 'Install KAYICOM')}
                  </p>
                  <p className="text-stone-400 text-xs truncate">
                    {getText('App leje, rapid, san entènèt', 'App légère, rapide, hors ligne', 'Lightweight, fast, offline')}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  onClick={handleInstall}
                  size="sm"
                  className="bg-gradient-to-r from-[#EA580C] to-[#F59E0B] hover:from-[#C2410C] hover:to-[#D97706] text-white font-semibold shadow-lg"
                >
                  <Download size={16} className="mr-1" />
                  {getText('Enstale', 'Installer', 'Install')}
                </Button>
                <button
                  onClick={handleDismiss}
                  className="p-2 text-stone-400 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add some padding to prevent content being hidden */}
      <div className="h-20" />
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
