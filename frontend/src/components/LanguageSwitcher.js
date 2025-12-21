import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Globe } from 'lucide-react';

export const LanguageSwitcher = ({ className = '' }) => {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className={`lang-switcher ${className}`}
      data-testid="language-switcher"
    >
      <Globe size={18} className="text-slate-600" />
      <span className="font-medium text-sm">
        {language === 'fr' ? 'FR' : 'EN'}
      </span>
    </button>
  );
};

export default LanguageSwitcher;
