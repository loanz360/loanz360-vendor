'use client'

import { useCallback, useRef } from 'react'

type ToolName = 'emi_calculator' | 'eligibility_checker' | 'knowledge_base' | 'offers' | 'bank_products' | 'product_comparison'

/**
 * Hook to track tool usage analytics
 * Sends non-blocking analytics events to the backend
 */
export function useToolAnalytics(toolName: ToolName) {
  const pendingRef = useRef(false)

  const trackAction = useCallback(async (action: string, metadata?: Record<string, unknown>) => {
    // Avoid duplicate rapid-fire events
    if (pendingRef.current) return
    pendingRef.current = true

    try {
      await fetch('/api/tools/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_name: toolName, action, metadata }),
      })
    } catch {
      // Analytics logging should never block the user
    } finally {
      pendingRef.current = false
    }
  }, [toolName])

  return {
    trackCalculation: (metadata?: Record<string, unknown>) => trackAction('calculate', metadata),
    trackSearch: (query?: string) => trackAction('search', { query }),
    trackShare: (method?: string) => trackAction('share', { method }),
    trackView: (itemId?: string) => trackAction('view', { item_id: itemId }),
    trackExport: (format?: string) => trackAction('export', { format }),
    trackAction,
  }
}
