'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { translations, type Language } from '@/data/translations'

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void; t: typeof translations.en }>({ language: 'en', setLanguage: () => {}, t: translations.en })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en')
  return <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>{children}</LanguageContext.Provider>
}

export function useLanguage() { return useContext(LanguageContext) }
