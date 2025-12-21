import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Globe } from 'lucide-react';

export const LanguageSwitcher = ({ className = '' }) => {
  const { language, setLanguage } = useLanguage();

  const languages = [
    { code: 'ht', label: 'KR', name: 'Kreyòl' },
    { code: 'fr', label: 'FR', name: 'Français' },
    { code: 'en', label: 'EN', name: 'English' }
  ];

  const currentLang = languages.find(l => l.code === language) || languages[0];

  return (
    <div className="relative group">
      <button
        className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-stone-100 transition-colors ${className}`}
        data-testid="language-switcher"
      >
        <Globe size={18} className="text-stone-600" />
        <span className="font-medium text-sm text-stone-700">
          {currentLang.label}
        </span>
      </button>
      
      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-stone-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[140px]">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`w-full px-4 py-2 text-left text-sm hover:bg-orange-50 transition-colors flex items-center justify-between ${
              language === lang.code ? 'text-[#EA580C] font-semibold bg-orange-50' : 'text-stone-700'
            }`}
          >
            <span>{lang.name}</span>
            <span className="text-xs text-stone-400">{lang.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSwitcher;
