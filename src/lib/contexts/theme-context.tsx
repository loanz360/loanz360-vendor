'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'dark' | 'light' | 'system'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: 'dark' | 'light'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark')

  const resolveTheme = useCallback((t: Theme): 'dark' | 'light' => {
    if (t === 'system') {
      if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
      }
      return 'dark'
    }
    return t
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    const resolved = resolveTheme(newTheme)
    setResolvedTheme(resolved)
    if (typeof window !== 'undefined') {
      localStorage.setItem('loanz360_theme', newTheme)
      document.documentElement.setAttribute('data-theme', resolved)
      document.documentElement.classList.toggle('light-mode', resolved === 'light')
    }
  }, [resolveTheme])

  useEffect(() => {
    const stored = localStorage.getItem('loanz360_theme') as Theme | null
    const initial = stored || 'dark'
    setThemeState(initial)
    const resolved = resolveTheme(initial)
    setResolvedTheme(resolved)
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.classList.toggle('light-mode', resolved === 'light')

    // Listen for system theme changes
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = () => {
      if (initial === 'system') {
        const newResolved = mq.matches ? 'light' : 'dark'
        setResolvedTheme(newResolved)
        document.documentElement.setAttribute('data-theme', newResolved)
        document.documentElement.classList.toggle('light-mode', newResolved === 'light')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [resolveTheme])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
