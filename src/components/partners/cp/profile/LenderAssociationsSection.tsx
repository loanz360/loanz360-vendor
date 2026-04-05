'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building2,
  Building,
  IndianRupee,
  FileText,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import { cn, formatCurrency} from '@/lib/utils/cn'
import type {
  CPLenderAssociation,
  LenderType,
  CodeStatus,
} from '@/types/cp-profile'
import {
  LENDER_TYPE_LABELS,
  PAYOUT_MODEL_LABELS,
  LOAN_PRODUCT_LABELS,
} from '@/types/cp-profile'

interface LenderAssociationsSectionProps {
  associations: CPLenderAssociation[]
  onViewDetails?: (id: string) => void
}

export default function LenderAssociationsSection({
  associations,
  onViewDetails,
}: LenderAssociationsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getCodeStatusBadge = (status: CodeStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Active
          </Badge>
        )
      case 'SUSPENDED':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <AlertCircle className="w-3 h-3 mr-1" />
            Suspended
          </Badge>
        )
      case 'TERMINATED':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Terminated
          </Badge>
        )
      default:
        return null
    }
  }

  const getLenderTypeIcon = (type: LenderType) => {
    switch (type) {
      case 'BANK':
        return <Building2 className="w-5 h-5" />
      case 'NBFC':
        return <Building className="w-5 h-5" />
      case 'HFC':
        return <Building className="w-5 h-5" />
      default:
        return <Building className="w-5 h-5" />
    }
  }

  const activeCount = associations.filter((a) => a.code_status === 'ACTIVE').length
  const suspendedCount = associations.filter((a) => a.code_status === 'SUSPENDED').length
  const totalDisbursementValue = associations.reduce(
    (sum, a) => sum + (a.total_disbursement_value || 0),
    0
  )

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-gray-700/50 bg-gray-800/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-primary/20">
                <Building2 className="w-5 h-5 text-brand-primary" />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Total Lenders</p>
                <p className="text-2xl font-bold text-white">{associations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-700/50 bg-gray-800/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Active Codes</p>
                <p className="text-2xl font-bold text-white">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-700/50 bg-gray-800/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Suspended</p>
                <p className="text-2xl font-bold text-white">{suspendedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-700/50 bg-gray-800/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <IndianRupee className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Total Disbursed</p>
                <p className="text-lg font-bold text-white">{formatCurrency(totalDisbursementValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lender List */}
      <div className="space-y-4">
        {associations.length === 0 ? (
          <Card className="border-gray-700/50 bg-gray-800/50">
            <CardContent className="p-12 text-center">
              <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Lender Associations</h3>
              <p className="text-gray-400">
                You don&apos;t have any Bank/NBFC associations yet. Contact admin to get your Loans360
                codes assigned.
              </p>
            </CardContent>
          </Card>
        ) : (
          associations.map((association) => (
            <Card
              key={association.id}
              className={cn(
                'border-gray-700/50 bg-gray-800/50 hover:border-gray-600/50 transition-all cursor-pointer',
                expandedId === association.id && 'border-brand-primary/30'
              )}
              onClick={() => setExpandedId(expandedId === association.id ? null : association.id)}
            >
              <CardContent className="p-6">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'p-3 rounded-lg',
                        association.lender_type === 'BANK'
                          ? 'bg-blue-500/20'
                          : association.lender_type === 'NBFC'
                            ? 'bg-purple-500/20'
                            : 'bg-green-500/20'
                      )}
                    >
                      {getLenderTypeIcon(association.lender_type)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{association.lender_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-gray-700/50 text-gray-300 text-xs">
                          {LENDER_TYPE_LABELS[association.lender_type]}
                        </Badge>
                        <span className="text-gray-500">•</span>
                        <span className="text-brand-primary font-mono text-sm">
                          {association.loans360_code}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getCodeStatusBadge(association.code_status)}
                    <ChevronRight
                      className={cn(
                        'w-5 h-5 text-gray-400 transition-transform',
                        expandedId === association.id && 'rotate-90'
                      )}
                    />
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 bg-gray-900/50 rounded-lg">
                    <p className="text-gray-500 text-xs mb-1">Total Disbursed</p>
                    <p className="text-white font-semibold">
                      {formatCurrency(association.total_disbursement_value || 0)}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/50 rounded-lg">
                    <p className="text-gray-500 text-xs mb-1">Cases Count</p>
                    <p className="text-white font-semibold">
                      {(association.total_disbursements_count || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/50 rounded-lg">
                    <p className="text-gray-500 text-xs mb-1">Payout Model</p>
                    <p className="text-white font-semibold">
                      {association.payout_model
                        ? PAYOUT_MODEL_LABELS[association.payout_model]
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-900/50 rounded-lg">
                    <p className="text-gray-500 text-xs mb-1">Last Disbursement</p>
                    <p className="text-white font-semibold">
                      {formatDate(association.last_disbursement_date)}
                    </p>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === association.id && (
                  <div className="border-t border-gray-700/50 pt-4 mt-4 space-y-4">
                    {/* Agreement Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Agreement Details</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Agreement Ref:</span>
                            <span className="text-white">
                              {association.agreement_reference_number || 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Signed Date:</span>
                            <span className="text-white">
                              {formatDate(association.agreement_signed_date)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Expiry Date:</span>
                            <span className="text-white">
                              {formatDate(association.agreement_expiry_date)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Code Activated:</span>
                            <span className="text-white">
                              {formatDate(association.code_activation_date)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Payout Configuration</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Model:</span>
                            <span className="text-white">
                              {association.payout_model
                                ? PAYOUT_MODEL_LABELS[association.payout_model]
                                : 'N/A'}
                            </span>
                          </div>
                          {association.payout_percentage && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Commission Rate:</span>
                              <span className="text-brand-primary font-semibold">
                                {association.payout_percentage}%
                              </span>
                            </div>
                          )}
                          {association.payout_flat_amount && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Flat Amount:</span>
                              <span className="text-brand-primary font-semibold">
                                {formatCurrency(association.payout_flat_amount)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Enabled Products */}
                    {association.enabled_products && association.enabled_products.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Enabled Products</h4>
                        <div className="flex flex-wrap gap-2">
                          {association.enabled_products.map((product) => (
                            <Badge
                              key={product}
                              className="bg-gray-700/50 text-gray-300 border-gray-600/50"
                            >
                              {LOAN_PRODUCT_LABELS[product] || product}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payout Slabs */}
                    {association.payout_slabs && association.payout_slabs.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Commission Slabs</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-700/50">
                                <th className="text-left py-2 text-gray-400 font-medium">Slab</th>
                                <th className="text-left py-2 text-gray-400 font-medium">Range</th>
                                <th className="text-left py-2 text-gray-400 font-medium">Rate</th>
                              </tr>
                            </thead>
                            <tbody>
                              {association.payout_slabs.map((slab, index) => (
                                <tr key={index} className="border-b border-gray-700/30">
                                  <td className="py-2 text-white">{slab.slab_name}</td>
                                  <td className="py-2 text-gray-300">
                                    {formatCurrency(slab.min_amount)} -{' '}
                                    {slab.max_amount ? formatCurrency(slab.max_amount) : 'Above'}
                                  </td>
                                  <td className="py-2 text-brand-primary font-semibold">
                                    {slab.commission_rate}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Suspension Info */}
                    {association.code_status === 'SUSPENDED' && association.code_suspension_reason && (
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-yellow-400 font-medium">Code Suspended</p>
                            <p className="text-yellow-200/80 text-sm mt-1">
                              {association.code_suspension_reason}
                            </p>
                            {association.code_suspension_date && (
                              <p className="text-yellow-200/60 text-xs mt-2">
                                Suspended on: {formatDate(association.code_suspension_date)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                      {association.agreement_document_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(association.agreement_document_url!, '_blank')
                          }}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          View Agreement
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="bg-brand-primary hover:bg-brand-primary/90"
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewDetails?.(association.id)
                        }}
                      >
                        View Full Details
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
