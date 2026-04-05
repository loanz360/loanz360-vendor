'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Settings, Check, X, Target, Users } from 'lucide-react'
import SetTargetModal from './target-settings/SetTargetModal'
import BulkSetTargetsModal from './target-settings/BulkSetTargetsModal'

interface TargetSettingsProps {
  month: number
  year: number
}

interface TargetData {
  bdeId: string
  bdeName: string
  employeeCode: string
  hasTarget: boolean
  target: {
    dailyConversionTarget: number
    monthlyConversionTarget: number
    monthlyRevenueTarget: number
  } | null
  current: {
    mtdConversions: number
    mtdRevenue: number
  }
  progress: {
    conversions: number
    revenue: number
  } | null
  status: string
}

export default function TargetSettings({ month, year }: TargetSettingsProps) {
  const [targetsData, setTargetsData] = useState<TargetData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [selectedBDE, setSelectedBDE] = useState<any>(null)

  useEffect(() => {
    fetchTargets()
  }, [month, year])

  const fetchTargets = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/bdm/team-targets/targets/current-month?month=${month}&year=${year}`)
      const data = await response.json()

      if (data.success) {
        setTargetsData(data.data.targets)
      }
    } catch (error) {
      console.error('Error fetching targets:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      exceeding: { label: 'Exceeding', className: 'bg-green-900/50 text-green-400 border-green-700' },
      on_track: { label: 'On Track', className: 'bg-blue-900/50 text-blue-400 border-blue-700' },
      at_risk: { label: 'At Risk', className: 'bg-yellow-900/50 text-yellow-400 border-yellow-700' },
      behind: { label: 'Behind', className: 'bg-red-900/50 text-red-400 border-red-700' },
      no_target: { label: 'No Target', className: 'bg-gray-900/50 text-gray-400 border-gray-700' },
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.no_target
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <Card className="content-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Monthly Targets Configuration</h2>
              <p className="text-sm text-gray-400 mt-1">
                Set and manage targets for{' '}
                {new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => setShowBulkModal(true)}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Set Bulk Targets
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Targets List */}
      <div className="grid gap-4">
        {targetsData.map((target) => (
          <Card key={target.bdeId} className="content-card hover:border-orange-500/50 transition-all">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-bold text-white">{target.bdeName}</h3>
                    <span className="text-sm text-gray-500">{target.employeeCode}</span>
                    {getStatusBadge(target.status)}
                  </div>

                  {target.hasTarget ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400 mb-1">Daily Conversions</div>
                        <div className="text-white font-semibold">{target.target?.dailyConversionTarget}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-1">Monthly Conversions</div>
                        <div className="text-white font-semibold">{target.target?.monthlyConversionTarget}</div>
                        <div className="text-xs text-gray-500">
                          Current: {target.current.mtdConversions} ({target.progress?.conversions.toFixed(0)}%)
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-1">Monthly Revenue</div>
                        <div className="text-white font-semibold">
                          ₹{((target.target?.monthlyRevenueTarget || 0) / 10000000).toFixed(2)}Cr
                        </div>
                        <div className="text-xs text-gray-500">
                          Current: ₹{(target.current.mtdRevenue / 10000000).toFixed(2)}Cr (
                          {target.progress?.revenue.toFixed(0)}%)
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedBDE({
                              id: target.bdeId,
                              name: target.bdeName,
                              employeeCode: target.employeeCode,
                              existingTarget: target.target,
                            })
                            setShowModal(true)
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-gray-400">
                        <X className="w-4 h-4" />
                        <span>No target set for this month</span>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedBDE({
                            id: target.bdeId,
                            name: target.bdeName,
                            employeeCode: target.employeeCode,
                            existingTarget: null,
                          })
                          setShowModal(true)
                        }}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-white text-sm transition-colors"
                      >
                        Set Target
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {targetsData.length === 0 && (
        <Card className="content-card">
          <CardContent className="p-12 text-center">
            <p className="text-gray-400 text-lg mb-4">No team members found</p>
            <p className="text-sm text-gray-500">Add team members to set targets</p>
          </CardContent>
        </Card>
      )}

      {/* Set Target Modal */}
      <SetTargetModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setSelectedBDE(null)
        }}
        bde={selectedBDE ? {
          id: selectedBDE.id,
          name: selectedBDE.name,
          employeeCode: selectedBDE.employeeCode,
        } : null}
        month={month}
        year={year}
        existingTarget={selectedBDE?.existingTarget}
        onSuccess={() => {
          fetchTargets() // Refresh targets after successful save
        }}
      />

      <BulkSetTargetsModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        month={month}
        year={year}
        teamBDEs={targetsData.map((t) => ({
          bdeId: t.bdeId,
          bdeName: t.bdeName,
          employeeCode: t.employeeCode,
        }))}
        onSuccess={() => {
          fetchTargets() // Refresh targets after successful save
          setShowBulkModal(false)
        }}
      />
    </div>
  )
}
