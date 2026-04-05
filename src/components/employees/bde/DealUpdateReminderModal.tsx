'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertCircle, Clock, Phone, DollarSign, User,
  Loader2, Bell, XCircle, ChevronRight
} from 'lucide-react'
import { DealUpdateForm } from './DealUpdateForm'
import type { DealStage, DealStatus, DealRequiringUpdate } from '@/types/ai-crm'
import { formatCurrency } from '@/lib/utils/cn'

// Stage labels
const stageLabels: Record<DealStage, string> = {
  docs_collected: 'Documents Collected',
  finalized_bank: 'Bank Finalized',
  login_complete: 'Login Completed',
  post_login_pending_cleared: 'Pendings Cleared',
  process_started_at_bank: 'Bank Processing',
  case_assessed_by_banker: 'Case Assessed',
  pd_complete: 'PD Complete',
  sanctioned: 'Sanctioned',
  disbursed: 'Disbursed',
  dropped: 'Dropped'
}

interface PendingUpdateDeal {
  deal_id: string
  customer_name: string
  phone: string
  email?: string
  location?: string
  loan_type: string
  loan_amount: number
  current_stage: DealStage
  current_status: DealStatus
  assigned_at?: string
  last_update_at?: string
  hours_since_update: number
  needs_update: boolean
  priority: 'low' | 'normal' | 'high' | 'critical'
}

interface PendingUpdatesStats {
  total_in_progress: number
  needs_update: number
  critical: number
  high: number
  normal: number
}

interface DealUpdateReminderModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdateComplete?: () => void
  autoFetch?: boolean
  fetchInterval?: number // in milliseconds
}

export function DealUpdateReminderModal({
  isOpen,
  onClose,
  onUpdateComplete,
  autoFetch = true,
  fetchInterval = 5 * 60 * 1000 // 5 minutes
}: DealUpdateReminderModalProps) {
  const [loading, setLoading] = useState(true)
  const [deals, setDeals] = useState<PendingUpdateDeal[]>([])
  const [stats, setStats] = useState<PendingUpdatesStats | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<PendingUpdateDeal | null>(null)
  const [showUpdateForm, setShowUpdateForm] = useState(false)
  const [snoozing, setSnoozing] = useState(false)

  const fetchPendingUpdates = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/ai-crm/bde/deals/pending-updates?hours=3')
      const data = await response.json()

      if (data.success) {
        setDeals(data.data.deals || [])
        setStats(data.data.stats || null)
      }
    } catch (error) {
      console.error('Error fetching pending updates:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch and auto-refresh
  useEffect(() => {
    if (isOpen) {
      fetchPendingUpdates()
    }
  }, [isOpen, fetchPendingUpdates])

  useEffect(() => {
    if (!autoFetch || !isOpen) return

    const interval = setInterval(fetchPendingUpdates, fetchInterval)
    return () => clearInterval(interval)
  }, [autoFetch, isOpen, fetchInterval, fetchPendingUpdates])

  const handleUpdateDeal = (deal: PendingUpdateDeal) => {
    setSelectedDeal(deal)
    setShowUpdateForm(true)
  }

  const handleUpdateSuccess = () => {
    setShowUpdateForm(false)
    setSelectedDeal(null)
    fetchPendingUpdates()
    if (onUpdateComplete) {
      onUpdateComplete()
    }
  }

  const handleSnooze = async (minutes: number) => {
    if (deals.length === 0) return

    setSnoozing(true)
    try {
      const dealIds = deals.map(d => d.deal_id)
      const response = await fetch('/api/ai-crm/bde/deals/pending-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'snooze',
          deal_ids: dealIds,
          snooze_minutes: minutes
        })
      })

      const data = await response.json()
      if (data.success) {
        onClose()
      }
    } catch (error) {
      console.error('Error snoozing reminders:', error)
    } finally {
      setSnoozing(false)
    }
  }

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} mins`
    if (hours < 24) return `${hours.toFixed(1)} hrs`
    return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500'
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500'
      case 'normal': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500'
    }
  }

  const canClose = deals.length === 0 || deals.every(d => !d.needs_update)

  return (
    <>
      <Dialog open={isOpen && !showUpdateForm} onOpenChange={canClose ? onClose : undefined}>
        <DialogContent className="max-w-2xl max-h-[85vh] bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Bell className="w-5 h-5 text-orange-500" />
              Deal Updates Required
            </DialogTitle>
            <DialogDescription>
              {stats && (
                <span>
                  You have{' '}
                  <span className="text-orange-400 font-medium">{stats.needs_update}</span>{' '}
                  deal{stats.needs_update !== 1 ? 's' : ''} requiring updates
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : deals.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">All Caught Up!</h3>
              <p className="text-gray-400">All your deals are up to date.</p>
              <Button onClick={onClose} className="mt-4 bg-orange-500 hover:bg-orange-600">
                Continue Working
              </Button>
            </div>
          ) : (
            <>
              {/* Priority Summary */}
              {stats && (
                <div className="flex gap-2 mb-4">
                  {stats.critical > 0 && (
                    <Badge variant="outline" className="border-red-500 text-red-400">
                      <XCircle className="w-3 h-3 mr-1" />
                      {stats.critical} Critical
                    </Badge>
                  )}
                  {stats.high > 0 && (
                    <Badge variant="outline" className="border-orange-500 text-orange-400">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {stats.high} High
                    </Badge>
                  )}
                  {stats.normal > 0 && (
                    <Badge variant="outline" className="border-yellow-500 text-yellow-400">
                      <Clock className="w-3 h-3 mr-1" />
                      {stats.normal} Normal
                    </Badge>
                  )}
                </div>
              )}

              {/* Deals List */}
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {deals.map((deal) => (
                    <div
                      key={deal.deal_id}
                      className={`p-4 rounded-lg border ${
                        deal.priority === 'critical' ? 'border-red-500 bg-red-500/5' :
                        deal.priority === 'high' ? 'border-orange-500 bg-orange-500/5' :
                        'border-gray-700 bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-white font-medium">{deal.customer_name}</h4>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getPriorityColor(deal.priority)}`}
                            >
                              {deal.priority}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {deal.phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {formatCurrency(deal.loan_amount)}
                            </span>
                            <span>{deal.loan_type}</span>
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <Badge className="bg-gray-700 text-gray-300 text-xs">
                              {stageLabels[deal.current_stage]}
                            </Badge>
                            <span className="text-xs text-red-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatHours(deal.hours_since_update)} since last update
                            </span>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleUpdateDeal(deal)}
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600"
                        >
                          Update
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSnooze(15)}
                    disabled={snoozing}
                    className="border-gray-700"
                  >
                    Snooze 15m
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSnooze(30)}
                    disabled={snoozing}
                    className="border-gray-700"
                  >
                    Snooze 30m
                  </Button>
                </div>

                <p className="text-xs text-gray-500">
                  Updates are required every 3 hours
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Form */}
      {selectedDeal && (
        <DealUpdateForm
          dealId={selectedDeal.deal_id}
          customerName={selectedDeal.customer_name}
          loanType={selectedDeal.loan_type}
          currentStage={selectedDeal.current_stage}
          currentStatus={selectedDeal.current_status}
          isOpen={showUpdateForm}
          onClose={() => {
            setShowUpdateForm(false)
            setSelectedDeal(null)
          }}
          onSuccess={handleUpdateSuccess}
          source="reminder_popup"
        />
      )}
    </>
  )
}

export default DealUpdateReminderModal
