'use client'

import React, { useState, useEffect } from 'react'
import { Target, TrendingUp, AlertCircle, CheckCircle2, Plus, Edit2, Calendar } from 'lucide-react'

interface Goal {
  id: string
  goal_title: string
  goal_description: string
  goal_type: string
  goal_category: string
  measurement_type: string
  target_value: number
  current_value: number
  unit: string
  goal_period: string
  start_date: string
  end_date: string
  status: string
  completion_percentage: number
  weightage: number
  is_stretch_goal: boolean
}

interface GoalsTrackerProps {
  className?: string
}

export default function GoalsTracker({ className = '' }: GoalsTrackerProps) {
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState<Goal[]>([])
  const [stats, setStats] = useState<any>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('QUARTERLY')
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [updatingGoal, setUpdatingGoal] = useState<string | null>(null)

  const [newGoal, setNewGoal] = useState({
    goal_title: '',
    goal_description: '',
    goal_type: 'KEY_RESULT',
    goal_category: 'REVENUE',
    measurement_type: 'NUMBER',
    target_value: 0,
    unit: '',
    goal_period: 'QUARTERLY',
    start_date: '',
    end_date: '',
    weightage: 100
  })

  useEffect(() => {
    fetchGoals()
  }, [selectedPeriod])

  const fetchGoals = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedPeriod) params.append('period', selectedPeriod)

      const response = await fetch(`/api/employees/goals?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setGoals(result.data.goals || [])
        setStats(result.data.stats || null)
      }
    } catch (error) {
      console.error('Error fetching goals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/employees/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGoal)
      })

      const result = await response.json()
      if (result.success) {
        setShowAddGoal(false)
        fetchGoals()
        // Reset form
        setNewGoal({
          goal_title: '',
          goal_description: '',
          goal_type: 'KEY_RESULT',
          goal_category: 'REVENUE',
          measurement_type: 'NUMBER',
          target_value: 0,
          unit: '',
          goal_period: 'QUARTERLY',
          start_date: '',
          end_date: '',
          weightage: 100
        })
      }
    } catch (error) {
      console.error('Error creating goal:', error)
    }
  }

  const handleUpdateProgress = async (goalId: string, newValue: number) => {
    try {
      setUpdatingGoal(goalId)
      const response = await fetch('/api/employees/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_id: goalId,
          action: 'UPDATE_PROGRESS',
          new_value: newValue
        })
      })

      if (response.ok) {
        fetchGoals()
      }
    } catch (error) {
      console.error('Error updating goal:', error)
    } finally {
      setUpdatingGoal(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-500'
      case 'ON_TRACK': return 'text-blue-500'
      case 'AT_RISK': return 'text-orange-500'
      case 'BEHIND': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'ON_TRACK': return <TrendingUp className="w-5 h-5 text-blue-500" />
      case 'AT_RISK': return <AlertCircle className="w-5 h-5 text-orange-500" />
      case 'BEHIND': return <AlertCircle className="w-5 h-5 text-red-500" />
      default: return <Target className="w-5 h-5 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      {/* Header with Stats */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-7 h-7 text-orange-500" />
            My Goals & OKRs
          </h2>
          <p className="text-gray-400 mt-1">Track your objectives and key results</p>
        </div>
        <button
          onClick={() => setShowAddGoal(true)}
          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="w-5 h-5" />
          Add Goal
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
            <div className="text-gray-400 text-sm">Total Goals</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-green-900/30">
            <div className="text-gray-400 text-sm">Completed</div>
            <div className="text-2xl font-bold mt-1 text-green-500">{stats.completed}</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-blue-900/30">
            <div className="text-gray-400 text-sm">On Track</div>
            <div className="text-2xl font-bold mt-1 text-blue-500">{stats.on_track}</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-orange-900/30">
            <div className="text-gray-400 text-sm">At Risk</div>
            <div className="text-2xl font-bold mt-1 text-orange-500">{stats.at_risk}</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-red-900/30">
            <div className="text-gray-400 text-sm">Behind</div>
            <div className="text-2xl font-bold mt-1 text-red-500">{stats.behind}</div>
          </div>
        </div>
      )}

      {/* Period Filter */}
      <div className="flex gap-2 mb-6">
        {['ANNUAL', 'QUARTERLY', 'MONTHLY'].map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded-lg transition ${
              selectedPeriod === period
                ? 'bg-orange-500 text-white'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            {period}
          </button>
        ))}
      </div>

      {/* Goals List */}
      <div className="space-y-4">
        {goals.length === 0 ? (
          <div className="text-center py-12 content-card">
            <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No goals found for this period</p>
            <button
              onClick={() => setShowAddGoal(true)}
              className="mt-4 text-orange-500 hover:underline"
            >
              Create your first goal
            </button>
          </div>
        ) : (
          goals.map((goal) => (
            <div
              key={goal.id}
              className="bg-gray-900 p-6 rounded-lg border border-gray-800 hover:border-orange-500/30 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(goal.status)}
                    <h3 className="text-lg font-semibold">{goal.goal_title}</h3>
                    {goal.is_stretch_goal && (
                      <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded">
                        STRETCH
                      </span>
                    )}
                  </div>
                  {goal.goal_description && (
                    <p className="text-gray-400 text-sm mb-3">{goal.goal_description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(goal.start_date).toLocaleDateString()} - {new Date(goal.end_date).toLocaleDateString()}
                    </span>
                    <span>Type: {goal.goal_type}</span>
                    <span>Category: {goal.goal_category}</span>
                    <span>Weight: {goal.weightage}%</span>
                  </div>
                </div>
                <div className={`text-lg font-bold ${getStatusColor(goal.status)}`}>
                  {goal.completion_percentage}%
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="w-full bg-gray-800 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-yellow-500 h-3 rounded-full transition-all"
                    style={{ width: `${goal.completion_percentage}%` }}
                  />
                </div>
              </div>

              {/* Target vs Current */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-gray-400 text-sm">Current: </span>
                  <span className="font-semibold">
                    {goal.current_value} {goal.unit}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Target: </span>
                  <span className="font-semibold">
                    {goal.target_value} {goal.unit}
                  </span>
                </div>
              </div>

              {/* Update Progress */}
              {goal.status !== 'COMPLETED' && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Update value"
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement
                        handleUpdateProgress(goal.id, parseFloat(input.value))
                        input.value = ''
                      }
                    }}
                  />
                  <button className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Create New Goal</h3>
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Goal Title *</label>
                <input
                  type="text"
                  required
                  value={newGoal.goal_title}
                  onChange={(e) => setNewGoal({ ...newGoal, goal_title: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                  placeholder="e.g., Close 50 deals this quarter"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={newGoal.goal_description}
                  onChange={(e) => setNewGoal({ ...newGoal, goal_description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Goal Type *</label>
                  <select
                    value={newGoal.goal_type}
                    onChange={(e) => setNewGoal({ ...newGoal, goal_type: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                  >
                    <option value="OBJECTIVE">Objective</option>
                    <option value="KEY_RESULT">Key Result</option>
                    <option value="KPI">KPI</option>
                    <option value="MILESTONE">Milestone</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Category *</label>
                  <select
                    value={newGoal.goal_category}
                    onChange={(e) => setNewGoal({ ...newGoal, goal_category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                  >
                    <option value="REVENUE">Revenue</option>
                    <option value="CUSTOMER">Customer</option>
                    <option value="PROCESS">Process</option>
                    <option value="LEARNING">Learning</option>
                    <option value="TEAM">Team</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Target Value *</label>
                  <input
                    type="number"
                    required
                    value={newGoal.target_value}
                    onChange={(e) => setNewGoal({ ...newGoal, target_value: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Unit *</label>
                  <input
                    type="text"
                    required
                    value={newGoal.unit}
                    onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                    placeholder="e.g., deals, ₹, leads"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Period *</label>
                  <select
                    value={newGoal.goal_period}
                    onChange={(e) => setNewGoal({ ...newGoal, goal_period: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                  >
                    <option value="ANNUAL">Annual</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={newGoal.start_date}
                    onChange={(e) => setNewGoal({ ...newGoal, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">End Date *</label>
                  <input
                    type="date"
                    required
                    value={newGoal.end_date}
                    onChange={(e) => setNewGoal({ ...newGoal, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg hover:opacity-90"
                >
                  Create Goal
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddGoal(false)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
