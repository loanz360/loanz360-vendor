'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle, Circle, Clock, AlertCircle, FileText, Upload, ExternalLink } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'

interface Task {
  id: string
  task_status: string
  due_date: string
  completed_at: string | null
  task_template: {
    task_title: string
    task_description: string
    task_category: string
    assigned_to_role: string
    estimated_duration_minutes: number
    instructions: string
    is_mandatory: boolean
  }
}

interface OnboardingData {
  employee: any
  session: {
    completion_percentage: number
    total_tasks: number
    completed_tasks: number
    pending_tasks: number
    current_phase: string
  }
  tasksByCategory: {
    PRE_JOINING: Task[]
    DAY_1: Task[]
    WEEK_1: Task[]
    MONTH_1: Task[]
    PROBATION_END: Task[]
  }
}

export default function OnboardingChecklist() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<OnboardingData | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('PRE_JOINING')
  const [updatingTask, setUpdatingTask] = useState<string | null>(null)

  useEffect(() => {
    fetchOnboardingData()
  }, [])

  const fetchOnboardingData = async () => {
    try {
      const response = await fetch('/api/employees/onboarding')
      if (response.ok) {
        const result = await response.json()
        setData(result.data)
        // Auto-select current phase
        if (result.data.session.current_phase) {
          setSelectedCategory(result.data.session.current_phase)
        }
      }
    } catch (error) {
      console.error('Failed to fetch onboarding data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    setUpdatingTask(taskId)
    try {
      const response = await fetch('/api/employees/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          status: newStatus
        })
      })

      if (response.ok) {
        await fetchOnboardingData() // Refresh data
      }
    } catch (error) {
      console.error('Failed to update task:', error)
    } finally {
      setUpdatingTask(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'IN_PROGRESS':
        return <Clock className="w-5 h-5 text-yellow-400" />
      case 'NOT_STARTED':
        return <Circle className="w-5 h-5 text-gray-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-orange-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/20 text-green-300'
      case 'IN_PROGRESS':
        return 'bg-yellow-500/20 text-yellow-300'
      case 'NOT_STARTED':
        return 'bg-gray-500/20 text-gray-300'
      default:
        return 'bg-orange-500/20 text-orange-300'
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      PRE_JOINING: 'Pre-Joining (Before Day 1)',
      DAY_1: 'Day 1 (Joining Day)',
      WEEK_1: 'Week 1 (First 7 Days)',
      MONTH_1: 'Month 1 (First 30 Days)',
      PROBATION_END: 'Probation End (90 Days)'
    }
    return labels[category] || category
  }

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status === 'COMPLETED') return false
    return new Date(dueDate) < new Date()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading onboarding checklist...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-300">Failed to load onboarding data. Please refresh the page.</p>
      </div>
    )
  }

  const tasks = data.tasksByCategory[selectedCategory as keyof typeof data.tasksByCategory] || []

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <div className="frosted-card p-6 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Welcome, {data.employee.full_name}!</h2>
            <p className="text-gray-400 mt-1">Complete your onboarding journey</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-orange-500">{data.session.completion_percentage}%</div>
            <p className="text-sm text-gray-400">Complete</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-orange-500 to-yellow-500 h-4 rounded-full transition-all duration-500"
            style={{ width: `${data.session.completion_percentage}%` }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <div className="text-2xl font-bold text-white">{data.session.total_tasks}</div>
            <div className="text-xs text-gray-400">Total Tasks</div>
          </div>
          <div className="text-center p-3 bg-green-900/30 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{data.session.completed_tasks}</div>
            <div className="text-xs text-gray-400">Completed</div>
          </div>
          <div className="text-center p-3 bg-yellow-900/30 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{data.session.pending_tasks}</div>
            <div className="text-xs text-gray-400">Pending</div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Object.keys(data.tasksByCategory).map((category) => {
          const categoryTasks = data.tasksByCategory[category as keyof typeof data.tasksByCategory]
          const completedCount = categoryTasks.filter(t => t.task_status === 'COMPLETED').length
          const totalCount = categoryTasks.length
          const isActive = selectedCategory === category

          return (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-3 rounded-lg whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <div className="text-sm font-semibold">{getCategoryLabel(category)}</div>
              <div className="text-xs mt-1">
                {completedCount}/{totalCount} done
              </div>
            </button>
          )
        })}
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="frosted-card p-8 text-center rounded-lg">
            <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No tasks in this category</p>
          </div>
        ) : (
          tasks.map((task) => {
            const overdue = isOverdue(task.due_date, task.task_status)
            const canUpdate = task.task_template.assigned_to_role === 'EMPLOYEE'

            return (
              <div
                key={task.id}
                className={`frosted-card p-5 rounded-lg border-l-4 ${
                  task.task_status === 'COMPLETED'
                    ? 'border-green-500'
                    : overdue
                    ? 'border-red-500'
                    : 'border-orange-500'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className="mt-1">
                    {getStatusIcon(task.task_status)}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                          {task.task_template.task_title}
                          {task.task_template.is_mandatory && (
                            <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                              Required
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                          {task.task_template.task_description}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(task.task_status)}`}>
                        {task.task_status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Meta Info */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      {task.due_date && (
                        <span className={overdue ? 'text-red-400' : ''}>
                          Due: {new Date(task.due_date).toLocaleDateString()}
                          {overdue && ' (Overdue)'}
                        </span>
                      )}
                      <span>~{task.task_template.estimated_duration_minutes} min</span>
                      <span>Assigned to: {task.task_template.assigned_to_role}</span>
                    </div>

                    {/* Instructions */}
                    {task.task_template.instructions && (
                      <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm text-blue-300">
                        <strong>Instructions:</strong> {task.task_template.instructions}
                      </div>
                    )}

                    {/* Action Buttons */}
                    {canUpdate && task.task_status !== 'COMPLETED' && (
                      <div className="flex gap-2 mt-4">
                        {task.task_status === 'NOT_STARTED' && (
                          <button
                            onClick={() => updateTaskStatus(task.id, 'IN_PROGRESS')}
                            disabled={updatingTask === task.id}
                            className="px-4 py-2 bg-yellow-500/20 text-yellow-300 rounded hover:bg-yellow-500/30 transition text-sm font-medium disabled:opacity-50"
                          >
                            {updatingTask === task.id ? 'Updating...' : 'Start Task'}
                          </button>
                        )}
                        {task.task_status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => updateTaskStatus(task.id, 'COMPLETED')}
                            disabled={updatingTask === task.id}
                            className="px-4 py-2 bg-green-500/20 text-green-300 rounded hover:bg-green-500/30 transition text-sm font-medium disabled:opacity-50"
                          >
                            {updatingTask === task.id ? 'Updating...' : 'Mark Complete'}
                          </button>
                        )}
                      </div>
                    )}

                    {task.completed_at && (
                      <p className="text-xs text-green-400 mt-3">
                        ✓ Completed on {new Date(task.completed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
