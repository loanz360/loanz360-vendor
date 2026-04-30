'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TeamMilestone } from '@/types/bdm-team-performance'
import { Flag, CheckCircle, Target, DollarSign, Award, Trophy } from 'lucide-react'

interface TeamMilestonesPanelProps {
  milestones: TeamMilestone[]
}

export default function TeamMilestonesPanel({ milestones }: TeamMilestonesPanelProps) {
  const achievedCount = milestones.filter((m) => m.achieved).length
  const totalCount = milestones.length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-indigo-600" />
            Team Milestones
          </CardTitle>
          <div className="text-sm font-semibold text-gray-600">
            {achievedCount}/{totalCount} Achieved
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {milestones.map((milestone) => {
          const Icon = getIconComponent(milestone.icon)
          const percentage = Math.min(100, milestone.percentage)

          return (
            <div
              key={milestone.id}
              className={`p-4 rounded-lg border-2 ${milestone.achieved ? 'bg-green-50 border-green-500' : 'bg-white border-gray-200'} transition-all`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={`p-2 rounded-lg ${milestone.achieved ? 'bg-green-500' : milestone.color} flex-shrink-0`}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{milestone.title}</h4>
                    {milestone.achieved && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {milestone.formattedCurrent || milestone.current} / {milestone.formattedTarget || milestone.target}
                      </span>
                      <span className={`font-semibold ${percentage >= 100 ? 'text-green-600' : 'text-gray-700'}`}>
                        {percentage.toFixed(0)}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${milestone.achieved ? 'bg-green-500' : milestone.color}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Message */}
                  {milestone.achieved ? (
                    <div className="mt-2 text-sm font-medium text-green-700 flex items-center gap-1">
                      <Trophy className="h-4 w-4" />
                      Milestone Achieved!
                    </div>
                  ) : percentage >= 75 ? (
                    <div className="mt-2 text-sm text-blue-600">
                      Almost there! {(milestone.target - milestone.current).toFixed(0)} more to go
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-gray-600">
                      {(milestone.target - milestone.current).toFixed(0)} remaining
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {milestones.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Flag className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No milestones set</p>
          </div>
        )}

        {/* Overall Progress */}
        {milestones.length > 0 && (
          <div className="pt-4 border-t">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">Overall Progress</span>
                <span className="text-2xl font-bold text-indigo-600">
                  {Math.round((achievedCount / totalCount) * 100)}%
                </span>
              </div>
              <div className="w-full bg-white/50 rounded-full h-4 overflow-hidden">
                <div
                  className="h-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${(achievedCount / totalCount) * 100}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-gray-600 text-center">
                {achievedCount === totalCount ? (
                  <span className="text-green-700 font-semibold flex items-center justify-center gap-1">
                    <Trophy className="h-4 w-4" />
                    All milestones achieved! Outstanding performance!
                  </span>
                ) : (
                  <span>
                    {achievedCount} of {totalCount} milestones achieved
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getIconComponent(iconName: string) {
  const icons: Record<string, unknown> = {
    Target,
    DollarSign,
    Award,
    Trophy,
    Flag,
    CheckCircle,
  }
  return icons[iconName] || Flag
}
