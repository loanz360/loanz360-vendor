'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Eye } from 'lucide-react'

interface BDEPerformanceTableProps {
  month: number
  year: number
}

interface BDEPerformance {
  bdeId: string
  bdeName: string
  employeeCode: string
  email: string
  metrics: {
    leadsContacted: number
    conversions: number
    revenue: number
    conversionRate: number
    currentStreak: number
  }
  targets: {
    leadsContacted: number
    conversions: number
    revenue: number
  }
  achievement: {
    leadsAchievement: number
    conversionsAchievement: number
    revenueAchievement: number
    overallAchievement: number
  }
  status: 'exceeding' | 'on_track' | 'at_risk' | 'behind'
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'
  badges: Array<{
    id: string
    name: string
    icon: string
    rarity: string
  }>
  totalBadges: number
  lastActivityDate: string | null
}

export default function BDEPerformanceTable({ month, year }: BDEPerformanceTableProps) {
  const [bdeData, setBdeData] = useState<BDEPerformance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchBDEData()
  }, [month, year])

  const fetchBDEData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/bdm/team-targets/overview/bde-table?month=${month}&year=${year}`)
      const data = await response.json()

      if (data.success) {
        setBdeData(data.data.bdes)
      }
    } catch (error) {
      console.error('Error fetching BDE data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors = {
      exceeding: 'bg-green-900/50 text-green-400 border-green-700',
      on_track: 'bg-blue-900/50 text-blue-400 border-blue-700',
      at_risk: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
      behind: 'bg-red-900/50 text-red-400 border-red-700',
    }
    return colors[status as keyof typeof colors] || colors.behind
  }

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-400'
    if (grade.startsWith('B')) return 'text-blue-400'
    if (grade.startsWith('C')) return 'text-yellow-400'
    if (grade === 'D') return 'text-orange-400'
    return 'text-red-400'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (bdeData.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg">No team members found</p>
        <p className="text-sm mt-2">Add team members to start tracking performance</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-800 hover:bg-gray-800/50">
            <TableHead className="text-gray-400">#</TableHead>
            <TableHead className="text-gray-400">BDE</TableHead>
            <TableHead className="text-gray-400 text-right">Leads</TableHead>
            <TableHead className="text-gray-400 text-right">Conversions</TableHead>
            <TableHead className="text-gray-400 text-right">Revenue</TableHead>
            <TableHead className="text-gray-400 text-center">Conv. Rate</TableHead>
            <TableHead className="text-gray-400 text-center">Achievement</TableHead>
            <TableHead className="text-gray-400 text-center">Status</TableHead>
            <TableHead className="text-gray-400 text-center">Grade</TableHead>
            <TableHead className="text-gray-400 text-center">Badges</TableHead>
            <TableHead className="text-gray-400 text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bdeData.map((bde, index) => (
            <TableRow
              key={bde.bdeId}
              className="border-gray-800 hover:bg-gray-800/50 cursor-pointer"
              onClick={() => router.push(`/employees/bdm/team-targets/bde/${bde.bdeId}?month=${month}&year=${year}`)}
            >
              <TableCell className="font-medium text-gray-300">{index + 1}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-semibold text-white">{bde.bdeName}</span>
                  <span className="text-xs text-gray-500">{bde.employeeCode}</span>
                  {bde.metrics.currentStreak > 0 && (
                    <span className="text-xs text-orange-500 mt-1">
                      🔥 {bde.metrics.currentStreak} day streak
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col">
                  <span className="font-semibold text-white">{bde.metrics.leadsContacted}</span>
                  <span className="text-xs text-gray-500">of {bde.targets.leadsContacted}</span>
                  <div className="w-full bg-gray-800 rounded-full h-1 mt-1">
                    <div
                      className="h-full rounded-full bg-purple-500"
                      style={{ width: `${Math.min(100, bde.achievement.leadsAchievement)}%` }}
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col">
                  <span className="font-semibold text-white">{bde.metrics.conversions}</span>
                  <span className="text-xs text-gray-500">of {bde.targets.conversions}</span>
                  <div className="w-full bg-gray-800 rounded-full h-1 mt-1">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${Math.min(100, bde.achievement.conversionsAchievement)}%` }}
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col">
                  <span className="font-semibold text-white">
                    ₹{(bde.metrics.revenue / 100000).toFixed(1)}L
                  </span>
                  <span className="text-xs text-gray-500">
                    of ₹{(bde.targets.revenue / 100000).toFixed(1)}L
                  </span>
                  <div className="w-full bg-gray-800 rounded-full h-1 mt-1">
                    <div
                      className="h-full rounded-full bg-yellow-500"
                      style={{ width: `${Math.min(100, bde.achievement.revenueAchievement)}%` }}
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <span className="font-semibold text-white">{bde.metrics.conversionRate}%</span>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex flex-col items-center">
                  <span className="font-bold text-lg text-white">
                    {bde.achievement.overallAchievement.toFixed(0)}%
                  </span>
                  <div className="w-16 bg-gray-800 rounded-full h-1.5 mt-1">
                    <div
                      className="h-full rounded-full bg-orange-500"
                      style={{ width: `${Math.min(100, bde.achievement.overallAchievement)}%` }}
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className={getStatusColor(bde.status)}>
                  {bde.status.replace(/_/g, ' ')}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <span className={`text-2xl font-bold ${getGradeColor(bde.grade)}`}>{bde.grade}</span>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  {bde.badges.slice(0, 3).map((badge) => (
                    <span key={badge.id} className="text-lg" title={badge.name}>
                      {badge.icon}
                    </span>
                  ))}
                  {bde.totalBadges > 3 && (
                    <span className="text-xs text-gray-500">+{bde.totalBadges - 3}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/employees/bdm/team-targets/bde/${bde.bdeId}?month=${month}&year=${year}`)
                  }}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded-lg text-white text-xs flex items-center gap-1 mx-auto transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  View
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
