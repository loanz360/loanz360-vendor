'use client'

import React, { useState, useEffect } from 'react'
import { Users, User, Briefcase, Building2, Network, Loader2, Mail } from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'

interface Employee {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  avatarUrl: string | null
}

interface HierarchyData {
  currentEmployee: Employee
  manager: Employee | null
  directReports: Employee[]
  peers: Employee[]
  stats: {
    directReportCount: number
    peerCount: number
    hasManager: boolean
  }
}

export default function OrgChartView() {
  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadHierarchy()
  }, [])

  const loadHierarchy = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/employees/hierarchy')
      const result = await response.json()

      if (result.success && result.data) {
        setHierarchy(result.data)
      } else {
        setError(result.error || 'Failed to load hierarchy')
      }
    } catch (error) {
      clientLogger.error('Failed to load hierarchy', error)
      setError('Failed to load hierarchy. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const EmployeeCard = ({ employee, role }: { employee: Employee; role: 'manager' | 'current' | 'report' | 'peer' }) => {
    const cardColors = {
      manager: 'border-blue-500 bg-blue-500/10',
      current: 'border-orange-500 bg-orange-500/10',
      report: 'border-green-500 bg-green-500/10',
      peer: 'border-purple-500 bg-purple-500/10'
    }

    const roleLabels = {
      manager: 'Manager',
      current: 'You',
      report: 'Direct Report',
      peer: 'Peer'
    }

    return (
      <div className={`frosted-card p-4 rounded-lg border-2 ${cardColors[role]} transition-all hover:scale-105`}>
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
            {employee.avatarUrl ? (
              <img src={employee.avatarUrl} alt={employee.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-gray-400" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-semibold text-sm truncate font-poppins">{employee.name}</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                role === 'manager' ? 'bg-blue-500/20 text-blue-400' :
                role === 'current' ? 'bg-orange-500/20 text-orange-400' :
                role === 'report' ? 'bg-green-500/20 text-green-400' :
                'bg-purple-500/20 text-purple-400'
              }`}>
                {roleLabels[role]}
              </span>
            </div>

            <p className="text-gray-400 text-xs flex items-center gap-1 mb-1">
              <Briefcase className="w-3 h-3" />
              {employee.role}
            </p>

            {employee.department && (
              <p className="text-gray-500 text-xs flex items-center gap-1 mb-1">
                <Building2 className="w-3 h-3" />
                {employee.department}
              </p>
            )}

            <p className="text-gray-500 text-xs flex items-center gap-1 truncate">
              <Mail className="w-3 h-3" />
              {employee.email}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    )
  }

  if (error || !hierarchy) {
    return (
      <div className="text-center py-12">
        <Network className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-red-400 text-lg mb-2">{error || 'No hierarchy data available'}</p>
        <button
          onClick={loadHierarchy}
          className="text-orange-500 hover:text-orange-400 text-sm underline"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="frosted-card p-4 rounded-lg text-center">
          <div className="text-3xl font-bold text-orange-500 mb-1">
            {hierarchy.stats.hasManager ? '1' : '0'}
          </div>
          <div className="text-gray-400 text-sm">Reporting Manager</div>
        </div>
        <div className="frosted-card p-4 rounded-lg text-center">
          <div className="text-3xl font-bold text-green-500 mb-1">
            {hierarchy.stats.directReportCount}
          </div>
          <div className="text-gray-400 text-sm">Direct Reports</div>
        </div>
        <div className="frosted-card p-4 rounded-lg text-center">
          <div className="text-3xl font-bold text-purple-500 mb-1">
            {hierarchy.stats.peerCount}
          </div>
          <div className="text-gray-400 text-sm">Team Peers</div>
        </div>
      </div>

      {/* Org Chart */}
      <div className="space-y-6">
        {/* Manager Section */}
        {hierarchy.manager && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 font-poppins">
              <Users className="w-5 h-5 text-blue-500" />
              Reports To
            </h3>
            <EmployeeCard employee={hierarchy.manager} role="manager" />

            {/* Connecting Line */}
            <div className="h-8 flex justify-center">
              <div className="w-0.5 h-full bg-gray-700"></div>
            </div>
          </div>
        )}

        {/* Current Employee */}
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 font-poppins">
            <User className="w-5 h-5 text-orange-500" />
            Your Position
          </h3>
          <EmployeeCard employee={hierarchy.currentEmployee} role="current" />
        </div>

        {/* Direct Reports */}
        {hierarchy.directReports.length > 0 && (
          <div>
            {/* Connecting Line */}
            <div className="h-8 flex justify-center">
              <div className="w-0.5 h-full bg-gray-700"></div>
            </div>

            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 font-poppins">
              <Users className="w-5 h-5 text-green-500" />
              Your Team ({hierarchy.directReports.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hierarchy.directReports.map(report => (
                <EmployeeCard key={report.id} employee={report} role="report" />
              ))}
            </div>
          </div>
        )}

        {/* Peers */}
        {hierarchy.peers.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 font-poppins">
              <Users className="w-5 h-5 text-purple-500" />
              Team Colleagues ({hierarchy.peers.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hierarchy.peers.map(peer => (
                <EmployeeCard key={peer.id} employee={peer} role="peer" />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!hierarchy.manager && hierarchy.directReports.length === 0 && hierarchy.peers.length === 0 && (
          <div className="text-center py-12">
            <Network className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">No team structure yet</p>
            <p className="text-gray-500 text-sm">
              Assign a reporting manager or team members to see your org chart
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
