'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, AlertCircle, RefreshCw, TrendingUp, Building2, MapPin, FileText, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface PayoutEntry {
  id: string
  bank_name: string
  location: string
  loan_type: string
  general_commission_percentage: number
  commission_percentage: number
  team_commission_percentage?: number
  specific_conditions?: string | null
  updated_at: string
}

interface PayoutSettings {
  multiplier: number
  team_multiplier?: number
}

interface PayoutGridTableProps {
  partnerType: 'ba' | 'bp' | 'cp'
  tableName: 'payout_ba_percentages' | 'payout_bp_percentages' | 'payout_cp_percentages'
  settingsTableName: 'payout_ba_settings' | 'payout_bp_settings' | 'payout_cp_settings'
  showTeamCommission?: boolean
  showMultiplier?: boolean
  showGeneralPercentage?: boolean
  showStats?: boolean
}

export default function PayoutGridTable({
  partnerType,
  tableName,
  settingsTableName,
  showTeamCommission = false,
  showMultiplier = true,
  showGeneralPercentage = false,
  showStats = true,
}: PayoutGridTableProps) {
  const supabase = createClient()
  const [payoutData, setPayoutData] = useState<PayoutEntry[]>([])
  const [settings, setSettings] = useState<PayoutSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterLoanType, setFilterLoanType] = useState<string>('all')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [conditions, setConditions] = useState<Array<{ id: string; condition_text: string; condition_order: number }>>([])
  const [conditionsLoading, setConditionsLoading] = useState(true) // FIX ISSUE #16: Add loading state
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null) // FIX ISSUE #13


  // Fetch payout data
  const fetchPayoutData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from(settingsTableName)
        .select('id, ba_percentage_multiplier, bp_percentage_multiplier, bp_team_percentage_multiplier, cp_percentage_multiplier, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (settingsError) {
        console.error('Settings error:', settingsError)
      } else if (settingsData) {
        if (partnerType === 'ba') {
          setSettings({ multiplier: settingsData.ba_percentage_multiplier })
        } else if (partnerType === 'bp') {
          setSettings({
            multiplier: settingsData.bp_percentage_multiplier,
            team_multiplier: settingsData.bp_team_percentage_multiplier,
          })
        } else if (partnerType === 'cp') {
          setSettings({ multiplier: settingsData.cp_percentage_multiplier })
        }
      }

      // Fetch payout percentages
      const { data, error: fetchError } = await supabase
        .from(tableName)
        .select('id, bank_name, loan_type, location, percentage, team_percentage, created_at, updated_at')
        .order('bank_name', { ascending: true })
        .order('location', { ascending: true })
        .order('loan_type', { ascending: true })

      if (fetchError) {
        throw new Error(fetchError.message)
      }

      // FIX ISSUE #12: Map data with proper error handling for missing columns
      const mappedData: PayoutEntry[] = data.map((item: Record<string, unknown>) => {
        // Determine commission percentage based on partner type with fallback
        let commissionPercentage = 0
        try {
          if (partnerType === 'ba') {
            commissionPercentage = (item.ba_commission_percentage as number) ?? 0
          } else if (partnerType === 'bp') {
            commissionPercentage = (item.bp_commission_percentage as number) ?? 0
          } else {
            commissionPercentage = (item.cp_commission_percentage as number) ?? 0
          }
        } catch (e) {
          console.error('Error accessing commission percentage:', e)
          commissionPercentage = 0
        }

        return {
          id: item.id as string,
          bank_name: (item.bank_name as string) || 'Unknown Bank',
          location: (item.location as string) || 'Unknown Location',
          loan_type: (item.loan_type as string) || 'Unknown Type',
          general_commission_percentage: (item.general_commission_percentage as number) ?? 0,
          commission_percentage: commissionPercentage,
          team_commission_percentage: partnerType === 'bp' ? ((item.bp_team_commission_percentage as number) ?? 0) : undefined,
          specific_conditions: item.specific_conditions as string | null,
          updated_at: (item.updated_at as string) || new Date().toISOString(),
        }
      })

      setPayoutData(mappedData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payout data')
    } finally {
      setLoading(false)
    }
  }

  // FIX ISSUE #16: Fetch payout conditions with loading state
  const fetchConditions = async () => {
    try {
      setConditionsLoading(true)
      const response = await fetch('/api/partners/payout-conditions')
      if (response.ok) {
        const data = await response.json()
        setConditions(data.conditions || [])
      } else {
        console.error('Failed to fetch conditions:', response.statusText)
        setConditions([]) // Fallback to empty array
      }
    } catch (error) {
      console.error('Error fetching payout conditions:', error)
      setConditions([]) // Fallback to empty array
    } finally {
      setConditionsLoading(false)
    }
  }

  // FIX ISSUE #14: Use useCallback to memoize fetchPayoutData to prevent infinite loops
  const fetchPayoutDataMemoized = React.useCallback(fetchPayoutData, [
    tableName,
    settingsTableName,
    partnerType,
    supabase
  ])

  const fetchConditionsMemoized = React.useCallback(fetchConditions, [])

  useEffect(() => {
    fetchPayoutDataMemoized()
    fetchConditionsMemoized()

    // FIX ISSUE #13: Real-time subscription with error handling
    const channel = supabase
      .channel(`payout-${partnerType}-realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, (payload) => {
        console.info(`${partnerType.toUpperCase()} payout data changed:`, payload.eventType)
        fetchPayoutDataMemoized()
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.info(`Real-time subscription active for ${partnerType}`)
          setSubscriptionError(null)
        } else if (status === 'CLOSED') {
          console.warn(`Real-time subscription closed for ${partnerType}`)
          setSubscriptionError('Real-time updates disconnected. Please refresh.')
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Real-time subscription error for ${partnerType}:`, err)
          setSubscriptionError('Real-time updates unavailable. Data may not auto-refresh.')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [partnerType, tableName, fetchPayoutDataMemoized, fetchConditionsMemoized, supabase])

  // Filter data
  const filteredData = payoutData.filter((entry) => {
    const matchesSearch =
      entry.bank_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.loan_type.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilter = filterLoanType === 'all' || entry.loan_type === filterLoanType

    return matchesSearch && matchesFilter
  })

  // Get unique loan types for filter
  const loanTypes = Array.from(new Set(payoutData.map((entry) => entry.loan_type))).sort()

  // Calculate stats
  const stats = {
    totalEntries: payoutData.length,
    uniqueBanks: new Set(payoutData.map((e) => e.bank_name)).size,
    uniqueLocations: new Set(payoutData.map((e) => e.location)).size,
    avgCommission:
      payoutData.length > 0
        ? (payoutData.reduce((sum, e) => sum + e.commission_percentage, 0) / payoutData.length).toFixed(2)
        : '0.00',
  }

  return (
    <div className="space-y-6">
      {/* FIX ISSUE #13: Show subscription error warning */}
      {subscriptionError && (
        <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <div>
            <p className="text-yellow-300 text-sm font-medium">Real-time Updates Unavailable</p>
            <p className="text-yellow-400/80 text-xs">{subscriptionError}</p>
          </div>
          <Button
            onClick={() => {
              fetchPayoutData()
              setSubscriptionError(null)
            }}
            variant="outline"
            size="sm"
            className="ml-auto border-yellow-500/50 text-yellow-300 hover:bg-yellow-900/30"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      )}

      {/* Settings Summary */}
      {settings && showMultiplier && (
        <div className="bg-gradient-to-r from-orange-900/20 to-orange-800/20 rounded-lg p-6 border border-orange-500/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2 font-poppins">Commission Multiplier</h3>
              <p className="text-gray-400 text-sm">
                Your commission is calculated as{' '}
                <span className="text-orange-400 font-bold">{settings.multiplier}%</span> of the general commission
                rate
              </p>
              {showTeamCommission && settings.team_multiplier && (
                <p className="text-gray-400 text-sm mt-1">
                  Team commission:{' '}
                  <span className="text-blue-400 font-bold">{settings.team_multiplier}%</span> of the general
                  commission rate
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-orange-400">{settings.multiplier}%</div>
              {showTeamCommission && settings.team_multiplier && (
                <div className="text-xl font-bold text-blue-400 mt-1">{settings.team_multiplier}%</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {showStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="content-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Entries</p>
                <p className="text-2xl font-bold text-white">{stats.totalEntries}</p>
              </div>
              <FileText className="w-8 h-8 text-gray-500" />
            </div>
          </div>

          <div className="content-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Banks</p>
                <p className="text-2xl font-bold text-white">{stats.uniqueBanks}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="content-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Locations</p>
                <p className="text-2xl font-bold text-white">{stats.uniqueLocations}</p>
              </div>
              <MapPin className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="content-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Avg Commission</p>
                <p className="text-2xl font-bold text-white">{stats.avgCommission}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-400" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="content-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by bank, location, or loan type..."
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Loan Type</label>
            <select
              value={filterLoanType}
              onChange={(e) => setFilterLoanType(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="all">All Loan Types</option>
              {loanTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            onClick={fetchPayoutData}
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="content-card overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
            <span className="ml-3 text-gray-400">Loading payout data...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 m-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h3 className="font-semibold mb-2 font-poppins">Error Loading Payout Data</h3>
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={fetchPayoutData} variant="outline" className="border-red-500 text-red-400">
              Try Again
            </Button>
          </div>
        )}

        {!loading && !error && filteredData.length === 0 && (
          <div className="text-center py-12 px-6">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 font-poppins">No Payout Data Found</h3>
            <p className="text-gray-400">
              {searchTerm || filterLoanType !== 'all'
                ? 'No results match your search criteria'
                : 'Payout data will appear here once configured by Super Admin'}
            </p>
          </div>
        )}

        {!loading && !error && filteredData.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Bank Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Loan Type
                  </th>
                  {showGeneralPercentage && (
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      General %
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Your Commission %
                  </th>
                  {showTeamCommission && (
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Team Commission %
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredData.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <tr
                      className="hover:bg-gray-800/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedRowId(expandedRowId === entry.id ? null : entry.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          {expandedRowId === entry.id ? (
                            <ChevronDown className="w-4 h-4 text-orange-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-white font-medium">{entry.bank_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-300">{entry.location}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700">
                          {entry.loan_type}
                        </span>
                      </td>
                      {showGeneralPercentage && (
                        <td className="px-6 py-4">
                          <div className="text-gray-400">{entry.general_commission_percentage}%</div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-orange-400 font-bold text-lg">{entry.commission_percentage}%</span>
                          <Info className="w-4 h-4 text-gray-400" />
                        </div>
                      </td>
                      {showTeamCommission && entry.team_commission_percentage !== undefined && (
                        <td className="px-6 py-4">
                          <div className="text-blue-400 font-bold text-lg">{entry.team_commission_percentage}%</div>
                        </td>
                      )}
                    </tr>
                    {expandedRowId === entry.id && (
                      <tr className="bg-gray-800/30">
                        <td colSpan={showGeneralPercentage && showTeamCommission ? 6 : showGeneralPercentage || showTeamCommission ? 5 : 4} className="px-6 py-6">
                          <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg p-6 border border-blue-500/30">
                            <div className="flex items-start space-x-3 mb-4">
                              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <h4 className="font-semibold text-lg mb-2 font-poppins">Payout Conditions & Details</h4>
                                <p className="text-gray-300 text-sm mb-4">
                                  The following conditions must be met to receive this commission payout:
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                              {/* Left Column - Loan Details */}
                              <div className="space-y-4">
                                <div>
                                  <h5 className="text-orange-400 font-semibold text-sm mb-3 flex items-center font-poppins">
                                    <Building2 className="w-4 h-4 mr-2" />
                                    Loan Details
                                  </h5>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                                      <span className="text-gray-400">Bank/NBFC:</span>
                                      <span className="text-white font-medium">{entry.bank_name}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                                      <span className="text-gray-400">Location:</span>
                                      <span className="text-white font-medium">{entry.location}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                                      <span className="text-gray-400">Loan Type:</span>
                                      <span className="text-white font-medium">{entry.loan_type}</span>
                                    </div>
                                    {showGeneralPercentage && (
                                      <div className="flex justify-between items-center py-2 border-b border-gray-700">
                                        <span className="text-gray-400">General Commission:</span>
                                        <span className="text-blue-400 font-bold">{entry.general_commission_percentage}%</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right Column - Commission Breakdown */}
                              <div className="space-y-4">
                                <div>
                                  <h5 className="text-orange-400 font-semibold text-sm mb-3 flex items-center font-poppins">
                                    <TrendingUp className="w-4 h-4 mr-2" />
                                    Commission Breakdown
                                  </h5>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                                      <span className="text-gray-400">Your Commission:</span>
                                      <span className="text-orange-400 font-bold text-lg">{entry.commission_percentage}%</span>
                                    </div>
                                    {showTeamCommission && entry.team_commission_percentage !== undefined && (
                                      <div className="flex justify-between items-center py-2 border-b border-gray-700">
                                        <span className="text-gray-400">Team Commission:</span>
                                        <span className="text-blue-400 font-bold text-lg">{entry.team_commission_percentage}%</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between items-center py-2">
                                      <span className="text-gray-400">Last Updated:</span>
                                      <span className="text-gray-300 text-xs">{new Date(entry.updated_at).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* FIX ISSUE #16: Mandatory Conditions with loading state */}
                            <div className="bg-orange-900/20 rounded-lg p-4 border border-orange-500/30">
                              <h5 className="text-orange-400 font-semibold text-sm mb-3 font-poppins">Mandatory Conditions for Payout</h5>
                              {conditionsLoading ? (
                                <div className="flex items-center space-x-2 text-gray-400">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span className="text-sm">Loading conditions...</span>
                                </div>
                              ) : conditions.length > 0 ? (
                                <ul className="space-y-2 text-sm text-gray-300">
                                  {conditions.map((condition) => (
                                    <li key={condition.id} className="flex items-start space-x-2">
                                      <span className="text-green-400 mt-1">✓</span>
                                      <span>{condition.condition_text.replace('{bank_name}', entry.bank_name)}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-gray-400">No conditions available for this payout.</p>
                              )}
                            </div>

                            {/* Specific Conditions (if any) */}
                            {entry.specific_conditions && entry.specific_conditions.trim() && (
                              <div className="mt-4 bg-blue-900/20 rounded-lg p-4 border border-blue-500/30">
                                <h5 className="text-blue-400 font-semibold text-sm mb-3 font-poppins">Specific Conditions for This Payout</h5>
                                <ul className="space-y-2 text-sm text-gray-300">
                                  {entry.specific_conditions.split('\n').filter(line => line.trim()).map((condition, index) => (
                                    <li key={index} className="flex items-start space-x-2">
                                      <span className="text-blue-400 mt-1">•</span>
                                      <span>{condition}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Additional Notes */}
                            <div className="mt-4 text-xs text-gray-400 italic">
                              <p>Note: Payout timelines may vary based on bank processing schedules. Contact support for specific queries.</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Results Count */}
      {!loading && !error && filteredData.length > 0 && (
        <div className="text-center text-gray-400 text-sm">
          Showing {filteredData.length} of {payoutData.length} entries
        </div>
      )}
    </div>
  )
}
