import React, { createContext, useContext, useState } from 'react'

const LanguageContext = createContext({ lang: 'es', setLang: () => {} })

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('ebony_lang') || 'es')

  const toggle = () => {
    const next = lang === 'es' ? 'en' : 'es'
    setLang(next)
    localStorage.setItem('ebony_lang', next)
  }

  return (
    <LanguageContext.Provider value={{ lang, toggle }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
