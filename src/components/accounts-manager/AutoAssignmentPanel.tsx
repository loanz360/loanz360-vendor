'use client'

import React, { useState, useMemo } from 'react'
import {
  Shuffle,
  BarChart3,
  Brain,
  Users,
  Play,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Info,
} from 'lucide-react'

type Strategy = 'round_robin' | 'least_loaded' | 'skill_based'

interface TeamMember {
  id: string
  name: string
  current_load: number
  capacity: number
}

interface Props {
  teamMembers: TeamMember[]
  pendingCount: number
  onAssignComplete?: () => void
}

const strategyInfo: Record<Strategy, { label: string; icon: React.ReactNode; description: string }> = {
  round_robin: {
    label: 'Round Robin',
    icon: <Shuffle className="w-4 h-4" />,
    description: 'Distributes applications evenly across team members in rotation order.',
  },
  least_loaded: {
    label: 'Least Loaded',
    icon: <BarChart3 className="w-4 h-4" />,
    description: 'Assigns to the team member with the fewest in-progress items first.',
  },
  skill_based: {
    label: 'Skill-Based',
    icon: <Brain className="w-4 h-4" />,
    description: 'Matches applications to team members based on their partner-type expertise.',
  },
}

export default function AutoAssignmentPanel({ teamMembers, pendingCount, onAssignComplete }: Props) {
  const [strategy, setStrategy] = useState<Strategy>('least_loaded')
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<{ assigned: number; assignments: { member_name: string; count: number }[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalCapacity = useMemo(
    () => teamMembers.reduce((sum, m) => sum + (m.capacity - m.current_load), 0),
    [teamMembers]
  )

  const previewDistribution = useMemo(() => {
    if (pendingCount === 0 || teamMembers.length === 0) return []

    const members = [...teamMembers]
    const dist: Record<string, number> = {}
    members.forEach(m => { dist[m.id] = 0 })

    if (strategy === 'round_robin') {
      for (let i = 0; i < pendingCount; i++) {
        const member = members[i % members.length]
        dist[member.id]++
      }
    } else if (strategy === 'least_loaded') {
      const loads = Object.fromEntries(members.map(m => [m.id, m.current_load]))
      for (let i = 0; i < pendingCount; i++) {
        members.sort((a, b) => (loads[a.id] + dist[a.id]) - (loads[b.id] + dist[b.id]))
        dist[members[0].id]++
      }
    } else {
      // skill_based preview: approximate as least_loaded
      const loads = Object.fromEntries(members.map(m => [m.id, m.current_load]))
      for (let i = 0; i < pendingCount; i++) {
        members.sort((a, b) => (loads[a.id] + dist[a.id]) - (loads[b.id] + dist[b.id]))
        dist[members[0].id]++
      }
    }

    return teamMembers.map(m => ({
      id: m.id,
      name: m.name,
      current: m.current_load,
      capacity: m.capacity,
      willReceive: dist[m.id] || 0,
      newTotal: m.current_load + (dist[m.id] || 0),
    }))
  }, [strategy, teamMembers, pendingCount])

  const handleAssign = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setConfirmOpen(false)

    try {
      const res = await fetch('/api/employees/accounts-manager/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Assignment failed')
        return
      }

      setResult(data.data)
      onAssignComplete?.()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="frosted-card p-6 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold font-poppins text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-500" />
          Auto-Assignment Engine
        </h2>
        <span className="text-xs bg-orange-500/20 text-orange-400 px-2.5 py-1 rounded-lg">
          {pendingCount} pending
        </span>
      </div>

      {/* Strategy Selector */}
      <div className="mb-6">
        <label className="text-xs text-gray-400 uppercase tracking-wider mb-3 block font-poppins">
          Assignment Strategy
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(strategyInfo) as Strategy[]).map((key) => {
            const info = strategyInfo[key]
            const isActive = strategy === key

            return (
              <button
                key={key}
                onClick={() => { setStrategy(key); setResult(null) }}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isActive
                    ? 'border-orange-500/50 bg-orange-500/10'
                    : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600/50 hover:bg-gray-800/50'
                }`}
              >
                <div className={`flex items-center gap-2 mb-1.5 ${isActive ? 'text-orange-400' : 'text-gray-400'}`}>
                  {info.icon}
                  <span className="text-sm font-medium text-white">{info.label}</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">{info.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Team Capacity Table */}
      <div className="mb-6">
        <label className="text-xs text-gray-400 uppercase tracking-wider mb-3 block font-poppins">
          Team Capacity
        </label>
        <div className="border border-gray-700/50 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-800/50">
                <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider px-3 py-2">Member</th>
                <th className="text-center text-[10px] text-gray-500 uppercase tracking-wider px-3 py-2">Current</th>
                <th className="text-center text-[10px] text-gray-500 uppercase tracking-wider px-3 py-2">Capacity</th>
                <th className="text-center text-[10px] text-gray-500 uppercase tracking-wider px-3 py-2">Will Receive</th>
                <th className="text-center text-[10px] text-gray-500 uppercase tracking-wider px-3 py-2">New Total</th>
              </tr>
            </thead>
            <tbody>
              {previewDistribution.map((row) => {
                const utilization = row.capacity > 0 ? (row.newTotal / row.capacity) * 100 : 0
                const isOverloaded = row.newTotal > row.capacity

                return (
                  <tr key={row.id} className="border-t border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-white">{row.name}</span>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <span className="text-sm text-gray-400">{row.current}</span>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <span className="text-sm text-gray-400">{row.capacity}</span>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      {row.willReceive > 0 ? (
                        <span className="text-sm text-orange-400 font-medium">+{row.willReceive}</span>
                      ) : (
                        <span className="text-sm text-gray-600">0</span>
                      )}
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <div className="flex items-center justify-center gap-2">
                        <span className={`text-sm font-medium ${isOverloaded ? 'text-red-400' : 'text-white'}`}>
                          {row.newTotal}
                        </span>
                        <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              utilization > 100 ? 'bg-red-500' : utilization > 80 ? 'bg-orange-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <Info className="w-3 h-3 text-gray-600" />
          <span className="text-[10px] text-gray-600">
            Available capacity: {totalCapacity} items across {teamMembers.length} members
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mb-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">
              {result.assigned} application(s) assigned successfully
            </span>
          </div>
          <div className="space-y-1">
            {result.assignments.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{a.member_name}</span>
                <span className="text-white font-medium">{a.count} items</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmOpen && (
        <div className="mb-4 p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
          <p className="text-sm text-white mb-3">
            Assign <span className="text-orange-400 font-medium">{pendingCount}</span> pending application(s) using{' '}
            <span className="text-orange-400 font-medium">{strategyInfo[strategy].label}</span> strategy?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAssign}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Confirm
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!confirmOpen && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={pendingCount === 0 || teamMembers.length === 0 || loading}
            className="flex items-center gap-2 text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Auto-Assign All Pending
          </button>
          <span className="text-xs text-gray-600">
            {teamMembers.length} AE(s) available
          </span>
        </div>
      )}
    </div>
  )
}
