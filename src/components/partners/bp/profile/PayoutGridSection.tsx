'use client'

import React from 'react'
import {
  DollarSign,
  TrendingUp,
  Percent,
  Calendar,
  Info,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import CollapsibleSection from '@/components/partners/shared/CollapsibleSection'
import type { BPCommissionStructure } from '@/types/bp-profile'
import { formatCurrency } from '@/lib/utils/cn'

interface PayoutGridSectionProps {
  data: BPCommissionStructure | null
  isLoading?: boolean
}

export default function PayoutGridSection({
  data,
  isLoading = false,
}: PayoutGridSectionProps) {
  if (isLoading) {
    return (
      <CollapsibleSection
        title="Commission & Payout Grid"
        icon={DollarSign}
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          <span className="ml-3 text-gray-400">Loading payout grid...</span>
        </div>
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection
      title="Commission & Payout Grid"
      icon={DollarSign}
      badge={
        data?.effective_from_date
          ? { text: 'Active', variant: 'success' }
          : { text: 'Not Configured', variant: 'warning' }
      }
      actions={
        <Button
          variant="outline"
          size="sm"
          className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
          asChild
        >
          <a href="/partners/bp/payout-grid">
            <ExternalLink className="w-4 h-4 mr-2" />
            View Full Grid
          </a>
        </Button>
      }
    >
      <div className="space-y-6 mt-4">
        {/* Read-Only Notice */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <p className="text-blue-400 font-medium">Commission Structure (Read-Only)</p>
              <p className="text-gray-400 text-sm mt-1">
                Your commission structure is configured by the admin. For changes or
                queries, please contact support or your account manager.
              </p>
            </div>
          </div>
        </div>

        {/* Commission Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Self-Sourcing Commission */}
          <div className="p-5 bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/30 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-500/20">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <h4 className="text-white font-medium">Self-Sourcing Commission</h4>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Model</span>
                <span className="text-white font-medium">
                  {data?.self_sourcing_commission_model || 'Not Set'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Rate</span>
                <span className="text-green-400 font-bold text-lg">
                  {data?.self_sourcing_commission_rate || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Team Override Commission */}
          <div className="p-5 bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/30 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <TrendingUp className="w-5 h-5 text-orange-400" />
              </div>
              <h4 className="text-white font-medium">Team Override Commission</h4>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Model</span>
                <span className="text-white font-medium">
                  {data?.team_override_commission_model || 'Not Set'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Override %</span>
                <span className="text-orange-400 font-bold text-lg">
                  {data?.team_override_percentage || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Incentive Slabs */}
        {data?.slab_based_incentives && data.incentive_slabs && data.incentive_slabs.length > 0 && (
          <div className="border-t border-gray-700/50 pt-6">
            <h4 className="text-white font-medium mb-4 flex items-center gap-2">
              <Percent className="w-4 h-4 text-orange-400" />
              Incentive Slabs
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700/50">
                    <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">
                      Slab
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">
                      Min Amount
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">
                      Max Amount
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">
                      Commission Rate
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">
                      Bonus
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.incentive_slabs.map((slab, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-700/30 hover:bg-gray-800/30"
                    >
                      <td className="py-3 px-4 text-white font-medium">
                        {slab.slab_name}
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {formatCurrency(slab.min_amount)}
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {slab.max_amount ? formatCurrency(slab.max_amount) : 'No Limit'}
                      </td>
                      <td className="py-3 px-4 text-green-400 font-medium">
                        {slab.commission_rate}
                      </td>
                      <td className="py-3 px-4 text-orange-400">
                        {slab.bonus_amount ? formatCurrency(slab.bonus_amount) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Effective Date & Admin Remarks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-gray-800/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-orange-400" />
              <span className="text-gray-400 text-sm">Effective From</span>
            </div>
            <p className="text-white font-medium">
              {data?.effective_from_date
                ? new Date(data.effective_from_date).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'Not Set'}
            </p>
          </div>

          {data?.admin_remarks && (
            <div className="p-4 bg-gray-800/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-orange-400" />
                <span className="text-gray-400 text-sm">Admin Remarks</span>
              </div>
              <p className="text-white text-sm">{data.admin_remarks}</p>
            </div>
          )}
        </div>

        {/* No Data State */}
        {!data?.self_sourcing_commission_model && !data?.team_override_commission_model && (
          <div className="text-center py-8 bg-gray-800/30 rounded-lg">
            <DollarSign className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-white font-medium mb-2">Commission Not Configured</p>
            <p className="text-gray-400 text-sm">
              Your commission structure has not been set up yet. Please contact your
              account manager for configuration.
            </p>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
