'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  IndianRupee,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  MessageSquare,
  TrendingUp,
  Building,
  Calendar,
  Loader2,
} from 'lucide-react'
import { cn, formatCurrency} from '@/lib/utils/cn'
import type { CPPayoutConfig, ReconciliationStatus } from '@/types/cp-profile'
import { toast } from 'sonner'

interface PayoutPeriod {
  id: string
  lender_association_id: string
  lender_name: string
  lender_type: string
  period_start: string
  period_end: string
  disbursements_count: number
  disbursements_value: number
  expected_commission: number
  tds_deducted: number
  gst_amount: number
  net_expected: number
  received_amount: number
  difference: number
  reconciliation_status: ReconciliationStatus
  payment_date: string | null
  utr_number: string | null
  payment_mode: string | null
  remarks: string | null
  dispute_id: string | null
  dispute_status: string | null
}

interface PayoutReconciliationSectionProps {
  payoutConfig: CPPayoutConfig
  payoutPeriods: PayoutPeriod[]
  onRaiseDispute: (reconciliationId: string, reason: string) => Promise<void>
}

export default function PayoutReconciliationSection({
  payoutConfig,
  payoutPeriods,
  onRaiseDispute,
}: PayoutReconciliationSectionProps) {
  const [disputeModal, setDisputeModal] = useState<{
    open: boolean
    reconciliationId: string
    lenderName: string
    period: string
    difference: number
  } | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [submittingDispute, setSubmittingDispute] = useState(false)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getReconciliationBadge = (status: ReconciliationStatus) => {
    switch (status) {
      case 'MATCHED':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Matched
          </Badge>
        )
      case 'MISMATCH':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Mismatch
          </Badge>
        )
      case 'PENDING':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      case 'RESOLVED':
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Resolved
          </Badge>
        )
      default:
        return null
    }
  }

  const handleRaiseDispute = async () => {
    if (!disputeModal || !disputeReason.trim()) {
      toast.error('Please provide a reason for the dispute')
      return
    }

    if (disputeReason.trim().length < 10) {
      toast.error('Dispute reason must be at least 10 characters')
      return
    }

    try {
      setSubmittingDispute(true)
      await onRaiseDispute(disputeModal.reconciliationId, disputeReason)
      toast.success('Dispute raised successfully')
      setDisputeModal(null)
      setDisputeReason('')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmittingDispute(false)
    }
  }

  // Calculate summary
  const summary = payoutConfig.payout_summary || {
    period: 'Last 6 Months',
    total_expected: 0,
    total_received: 0,
    total_pending: 0,
    reconciliation_mismatches: [],
  }

  const mismatchCount = payoutPeriods.filter((p) => p.reconciliation_status === 'MISMATCH').length

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-gray-700/50 bg-gray-800/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Expected</p>
                <p className="text-lg font-bold text-white">{formatCurrency(summary.total_expected)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-700/50 bg-gray-800/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-primary/20">
                <IndianRupee className="w-5 h-5 text-brand-primary" />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Received</p>
                <p className="text-lg font-bold text-white">{formatCurrency(summary.total_received)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-700/50 bg-gray-800/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Pending</p>
                <p className="text-lg font-bold text-white">{formatCurrency(summary.total_pending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-700/50 bg-gray-800/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Mismatches</p>
                <p className="text-lg font-bold text-white">{mismatchCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bank Account Info */}
      <Card className="border-gray-700/50 bg-gray-800/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building className="w-5 h-5 text-brand-primary" />
            Payout Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-500 text-xs">Account Holder</p>
              <p className="text-white">{payoutConfig.primary_account.account_holder_name}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Bank Name</p>
              <p className="text-white">{payoutConfig.primary_account.bank_name}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Account Number</p>
              <p className="text-white font-mono">{payoutConfig.primary_account.account_number_masked}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Settlement Frequency</p>
              <p className="text-white">{payoutConfig.settlement_frequency}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-700/50">
            <div>
              <p className="text-gray-500 text-xs">TDS Applicable</p>
              <p className="text-white">
                {payoutConfig.tds_applicable ? `Yes (${payoutConfig.tds_percentage}%)` : 'No'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">GST on Commission</p>
              <p className="text-white">{payoutConfig.gst_on_commission ? 'Yes' : 'No'}</p>
            </div>
            {payoutConfig.gstin && (
              <div>
                <p className="text-gray-500 text-xs">GSTIN</p>
                <p className="text-white font-mono">{payoutConfig.gstin}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card className="border-gray-700/50 bg-gray-800/50">
        <CardHeader>
          <CardTitle className="text-lg">Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          {payoutPeriods.length === 0 ? (
            <div className="text-center py-12">
              <IndianRupee className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-white font-medium">No Payout Records</p>
              <p className="text-gray-400 text-sm mt-1">
                Payout records will appear here once disbursements are processed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {payoutPeriods.map((period) => (
                <div
                  key={period.id}
                  className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-medium">{period.lender_name}</h4>
                        <Badge className="bg-gray-700/50 text-gray-300 text-xs">
                          {period.lender_type}
                        </Badge>
                      </div>
                      <p className="text-gray-400 text-sm mt-1">
                        {formatDate(period.period_start)} - {formatDate(period.period_end)}
                      </p>
                    </div>
                    {getReconciliationBadge(period.reconciliation_status)}
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div>
                      <p className="text-gray-500 text-xs">Disbursements</p>
                      <p className="text-white text-sm">
                        {period.disbursements_count} ({formatCurrency(period.disbursements_value)})
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Gross Commission</p>
                      <p className="text-white text-sm">{formatCurrency(period.expected_commission)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">TDS Deducted</p>
                      <p className="text-white text-sm">{formatCurrency(period.tds_deducted)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Net Expected</p>
                      <p className="text-green-400 font-semibold">{formatCurrency(period.net_expected)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Received</p>
                      <p
                        className={cn(
                          'font-semibold',
                          period.received_amount > 0 ? 'text-brand-primary' : 'text-yellow-400'
                        )}
                      >
                        {period.received_amount > 0 ? formatCurrency(period.received_amount) : 'Pending'}
                      </p>
                    </div>
                  </div>

                  {/* Mismatch Warning */}
                  {period.reconciliation_status === 'MISMATCH' && period.difference !== 0 && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-red-400 text-sm font-medium">
                            Discrepancy: {formatCurrency(Math.abs(period.difference))}
                            {period.difference > 0 ? ' (Overpaid)' : ' (Underpaid)'}
                          </span>
                        </div>
                        {!period.dispute_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            onClick={() =>
                              setDisputeModal({
                                open: true,
                                reconciliationId: period.id,
                                lenderName: period.lender_name,
                                period: `${formatDate(period.period_start)} - ${formatDate(period.period_end)}`,
                                difference: period.difference,
                              })
                            }
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            Raise Dispute
                          </Button>
                        )}
                      </div>
                      {period.dispute_id && (
                        <p className="text-gray-400 text-xs mt-2">
                          Dispute Status: <span className="text-yellow-400">{period.dispute_status}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Payment Info */}
                  {period.received_amount > 0 && (
                    <div className="flex items-center gap-4 text-sm text-gray-400 pt-3 border-t border-gray-700/50">
                      {period.payment_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(period.payment_date)}
                        </span>
                      )}
                      {period.utr_number && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          UTR: {period.utr_number}
                        </span>
                      )}
                      {period.payment_mode && <span>{period.payment_mode}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dispute Modal */}
      <Dialog
        open={disputeModal?.open || false}
        onOpenChange={(open) => !open && setDisputeModal(null)}
      >
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Raise Payout Dispute</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-sm">Lender: {disputeModal?.lenderName}</p>
              <p className="text-gray-400 text-sm">Period: {disputeModal?.period}</p>
              <p className="text-red-400 text-sm font-medium">
                Discrepancy: {disputeModal?.difference ? formatCurrency(Math.abs(disputeModal.difference)) : 'N/A'}
              </p>
            </div>

            <div>
              <label className="text-gray-300 text-sm">
                Reason for Dispute <span className="text-red-400">*</span>
              </label>
              <Textarea
                className="bg-gray-800/50 border-gray-700 mt-1"
                placeholder="Please describe the discrepancy in detail (minimum 10 characters)"
                rows={4}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
              />
            </div>

            <p className="text-gray-500 text-xs">
              Our team will review your dispute and respond within 3-5 business days.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-gray-600"
              onClick={() => setDisputeModal(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-brand-primary hover:bg-brand-primary/90"
              onClick={handleRaiseDispute}
              disabled={submittingDispute}
            >
              {submittingDispute ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Dispute'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
