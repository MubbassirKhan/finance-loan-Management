import React, { createContext, useContext, useState, useEffect } from 'react';
import enTranslations from '../i18n/en.json';
import knTranslations from '../i18n/kn.json';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  // Default to English as specified in requirements
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('sp_lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('sp_lang', language);
    // Update HTML lang attribute for accessibility
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = (lang) => {
    if (lang) {
      setLanguage(lang);
    } else {
      setLanguage((prev) => (prev === 'en' ? 'kn' : 'en'));
    }
  };

  /**
   * Translates key paths like "nav.dashboard" or "app.title".
   * Supports interpolation: t('common.showingOf', { count: 5, total: 20 })
   * Falls back to English, then to defaultText, then to the key itself.
   */
  const t = (keyPath, paramsOrDefault = '') => {
    const keys = keyPath.split('.');
    const activeDict = language === 'kn' ? knTranslations : enTranslations;
    const fallbackDict = enTranslations;

    const resolve = (dict) => {
      let val = dict;
      for (const key of keys) {
        if (val && typeof val === 'object' && key in val) {
          val = val[key];
        } else {
          return null;
        }
      }
      return typeof val === 'string' ? val : null;
    };

    const interpolate = (str, params) => {
      if (!params || typeof params !== 'object') return str;
      return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in params ? params[k] : `{{${k}}}`));
    };

    // If paramsOrDefault is a plain object, treat it as interpolation params
    const isParams = paramsOrDefault && typeof paramsOrDefault === 'object';
    const params = isParams ? paramsOrDefault : null;
    const defaultText = isParams ? '' : (paramsOrDefault || '');

    const result = resolve(activeDict) || resolve(fallbackDict);
    if (result) return interpolate(result, params);
    return defaultText || keyPath;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, t, isKannada: language === 'kn' }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
