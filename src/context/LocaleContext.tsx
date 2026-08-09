/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Locale, locales, translate, TranslationKey } from '@/lib/i18n';

type LocaleState = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: TranslationKey) => string };
const LocaleContext = createContext<LocaleState | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  useEffect(() => {
    const saved = localStorage.getItem('fantafort-locale') as Locale;
    const browser = navigator.language.slice(0, 2) as Locale;
    if (locales.includes(saved)) setLocaleState(saved);
    else if (locales.includes(browser)) setLocaleState(browser);
  }, []);
  const setLocale = useCallback((value: Locale) => {
    setLocaleState(value);
    localStorage.setItem('fantafort-locale', value);
  }, []);
  return <LocaleContext.Provider value={{ locale, setLocale, t: key => translate(locale, key) }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used within LocaleProvider');
  return context;
}
