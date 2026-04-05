/**
 * Google reCAPTCHA v3 Provider Component
 * Provides reCAPTCHA functionality throughout the app
 * Uses Google's invisible reCAPTCHA v3 for seamless UX
 */

'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface RecaptchaContextType {
  executeRecaptcha: (action: string) => Promise<string>
  isReady: boolean
}

const RecaptchaContext = createContext<RecaptchaContextType>({
  executeRecaptcha: async () => '',
  isReady: false
})

export const useRecaptcha = () => useContext(RecaptchaContext)

interface RecaptchaProviderProps {
  children: React.ReactNode
  siteKey: string
}

declare global {
  interface Window {
    grecaptcha: any
  }
}

export function RecaptchaProvider({ children, siteKey }: RecaptchaProviderProps) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Load reCAPTCHA script
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
    script.async = true
    script.defer = true

    script.onload = () => {
      // Wait for grecaptcha to be ready
      window.grecaptcha.ready(() => {
        setIsReady(true)
      })
    }

    document.head.appendChild(script)

    return () => {
      // Cleanup
      const badge = document.querySelector('.grecaptcha-badge')
      if (badge) {
        badge.remove()
      }
      document.head.removeChild(script)
    }
  }, [siteKey])

  const executeRecaptcha = async (action: string): Promise<string> => {
    if (!isReady) {
      throw new Error('reCAPTCHA not ready')
    }

    try {
      const token = await window.grecaptcha.execute(siteKey, { action })
      return token
    } catch (error) {
      console.error('Error executing reCAPTCHA:', error)
      throw error
    }
  }

  return (
    <RecaptchaContext.Provider value={{ executeRecaptcha, isReady }}>
      {children}
    </RecaptchaContext.Provider>
  )
}
