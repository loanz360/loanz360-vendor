'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'cro_emi_calc_cache'
const MAX_CACHED_CALCULATIONS = 10

export interface EMICalcCache {
  id: string
  timestamp: string
  loanType: string
  principal: number
  interestRate: number
  tenure: number
  emi: number
  totalInterest: number
  totalAmount: number
  customerName?: string
}

function loadCalculationsFromStorage(): EMICalcCache[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as EMICalcCache[]
  } catch {
    return []
  }
}

function persistCalculations(calculations: EMICalcCache[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calculations))
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function useOfflineMode() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true
    return navigator.onLine
  })

  const [savedCalculations, setSavedCalculations] = useState<EMICalcCache[]>(() =>
    loadCalculationsFromStorage()
  )

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Sync initial state in case it changed between SSR and hydration
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const saveCalculation = useCallback((calc: EMICalcCache) => {
    setSavedCalculations((prev) => {
      // Prepend new calculation, cap at MAX_CACHED_CALCULATIONS
      const updated = [calc, ...prev.filter((c) => c.id !== calc.id)].slice(
        0,
        MAX_CACHED_CALCULATIONS
      )
      persistCalculations(updated)
      return updated
    })
  }, [])

  const clearSavedCalculations = useCallback(() => {
    setSavedCalculations([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  return {
    isOnline,
    savedCalculations,
    saveCalculation,
    clearSavedCalculations,
  }
}

export default useOfflineMode
