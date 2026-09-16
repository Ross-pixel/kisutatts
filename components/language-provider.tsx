'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translations, type Language } from '@/data/translations'

const STORAGE_KEY = 'kisu-lang'
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (typeof translations)[Language] }

const LanguageContext = createContext<LanguageContextValue>({ language: 'en', setLanguage: () => {}, t: translations.en })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'fi') setLanguageState(saved)
  }, [])

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage)
    window.localStorage.setItem(STORAGE_KEY, nextLanguage)
  }

  const value = useMemo(() => ({ language, setLanguage, t: translations[language] }), [language])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() { return useContext(LanguageContext) }
