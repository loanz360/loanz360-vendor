'use client'

import React from 'react'
import { BookOpen, CheckCircle, Clock, Lock, ChevronRight, Award } from 'lucide-react'

interface LearningModule {
  id: string
  title: string
  description: string
  duration_hours: number
  status: 'locked' | 'available' | 'in_progress' | 'completed'
  completion_percentage?: number
  type: 'course' | 'assessment' | 'project' | 'certification'
}

interface LearningPath {
  id: string
  title: string
  description: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  modules: LearningModule[]
  total_hours: number
  enrolled_count?: number
  certification_name?: string
}

interface LearningPathCardProps {
  path: LearningPath
  onModuleClick?: (moduleId: string) => void
  onEnroll?: (pathId: string) => void
  isEnrolled?: boolean
  compact?: boolean
}

const DIFFICULTY_COLORS = {
  beginner: 'bg-green-500/20 text-green-400',
  intermediate: 'bg-yellow-500/20 text-yellow-400',
  advanced: 'bg-red-500/20 text-red-400',
}

const MODULE_TYPE_ICONS = {
  course: BookOpen,
  assessment: Award,
  project: CheckCircle,
  certification: Award,
}

const STATUS_STYLES = {
  locked: { bg: 'bg-gray-800', border: 'border-gray-700', dot: 'bg-gray-600', text: 'text-gray-500' },
  available: { bg: 'bg-gray-800', border: 'border-gray-600', dot: 'bg-blue-500', text: 'text-blue-400' },
  in_progress: { bg: 'bg-gray-800', border: 'border-[#FF6700]/50', dot: 'bg-[#FF6700]', text: 'text-[#FF6700]' },
  completed: { bg: 'bg-gray-800', border: 'border-green-500/50', dot: 'bg-green-500', text: 'text-green-400' },
}

export function LearningPathCard({ path, onModuleClick, onEnroll, isEnrolled, compact }: LearningPathCardProps) {
  const completedModules = path.modules.filter(m => m.status === 'completed').length
  const progress = path.modules.length > 0 ? Math.round((completedModules / path.modules.length) * 100) : 0

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-700">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-base font-bold text-white">{path.title}</h3>
            <p className="text-sm text-gray-400 mt-1">{path.description}</p>
          </div>
          <span className={`px-2 py-1 rounded-md text-xs font-medium ${DIFFICULTY_COLORS[path.difficulty]}`}>
            {path.difficulty}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {path.modules.length} modules</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {path.total_hours}h</span>
          {path.certification_name && <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5 text-[#FF6700]" /> {path.certification_name}</span>}
        </div>
        {isEnrolled && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400">{completedModules}/{path.modules.length} completed</span>
              <span className="text-[#FF6700] font-medium">{progress}%</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#FF6700] to-[#FF8533] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Modules Timeline */}
      {!compact && (
        <div className="p-5">
          <div className="space-y-0">
            {path.modules.map((module, idx) => {
              const style = STATUS_STYLES[module.status]
              const Icon = MODULE_TYPE_ICONS[module.type]
              const isLast = idx === path.modules.length - 1
              return (
                <div key={module.id} className="flex gap-3">
                  {/* Timeline */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${style.dot} flex-shrink-0 mt-1.5 ${module.status === 'in_progress' ? 'ring-2 ring-[#FF6700]/30' : ''}`} />
                    {!isLast && <div className="w-0.5 flex-1 bg-gray-700 my-1" />}
                  </div>
                  {/* Content */}
                  <button
                    onClick={() => module.status !== 'locked' && onModuleClick?.(module.id)}
                    disabled={module.status === 'locked'}
                    className={`flex-1 flex items-center gap-3 p-3 rounded-xl ${style.bg} border ${style.border} mb-2 text-left hover:bg-gray-700/50 transition-colors disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <Icon className={`w-4 h-4 ${style.text} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{module.title}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                        <span>{module.duration_hours}h</span>
                        {module.status === 'in_progress' && module.completion_percentage !== undefined && (
                          <span className="text-[#FF6700]">{module.completion_percentage}% done</span>
                        )}
                      </div>
                    </div>
                    {module.status === 'locked' ? (
                      <Lock className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    ) : module.status === 'completed' ? (
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      {!isEnrolled && onEnroll && (
        <div className="px-5 pb-5">
          <button
            onClick={() => onEnroll(path.id)}
            className="w-full py-2.5 bg-[#FF6700] text-white rounded-xl text-sm font-medium hover:bg-[#FF6700]/80 transition-colors"
          >
            Enroll in Path
          </button>
        </div>
      )}
    </div>
  )
}
