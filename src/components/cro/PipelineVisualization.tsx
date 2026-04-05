'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronDown,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Layers,
  Columns3,
  ArrowRight,
  Inbox,
} from 'lucide-react'
import { formatINR } from '@/lib/utils/cro-helpers'

// ============================================================================
// TYPES
// ============================================================================

interface PipelineStage {
  key: string
  label: string
  count: number
  value: number // Total loan amount in this stage
  color: string
  icon?: React.ReactNode
}

interface PipelineVisualizationProps {
  stages: PipelineStage[]
  view?: 'funnel' | 'kanban' | 'horizontal'
  onStageClick?: (stageKey: string) => void
  isLoading?: boolean
  showValues?: boolean
}

// ============================================================================
// DEFAULT STAGES (CRO Pipeline)
// ============================================================================

export const DEFAULT_CRO_STAGES: PipelineStage[] = [
  { key: 'new_contacts',  label: 'New Contacts',  count: 0, value: 0, color: '#3b82f6' },
  { key: 'called',        label: 'Called',         count: 0, value: 0, color: '#06b6d4' },
  { key: 'follow_up',     label: 'Follow Up',     count: 0, value: 0, color: '#8b5cf6' },
  { key: 'positive',      label: 'Positive',      count: 0, value: 0, color: '#14b8a6' },
  { key: 'lead_created',  label: 'Lead Created',  count: 0, value: 0, color: '#6366f1' },
  { key: 'qualified',     label: 'Qualified',      count: 0, value: 0, color: '#f59e0b' },
  { key: 'docs_pending',  label: 'Docs Pending',  count: 0, value: 0, color: '#FF6700' },
  { key: 'deal',          label: 'Deal',           count: 0, value: 0, color: '#10b981' },
  { key: 'approved',      label: 'Approved',       count: 0, value: 0, color: '#22c55e' },
  { key: 'disbursed',     label: 'Disbursed',      count: 0, value: 0, color: '#16a34a' },
]

// ============================================================================
// HELPERS
// ============================================================================

function computeConversionRate(from: number, to: number): number {
  if (from === 0) return 0
  return Math.round((to / from) * 100)
}

function getConversionColor(rate: number): string {
  if (rate >= 60) return 'text-green-400'
  if (rate >= 35) return 'text-yellow-400'
  return 'text-red-400'
}

function getConversionBg(rate: number): string {
  if (rate >= 60) return 'bg-green-500/15'
  if (rate >= 35) return 'bg-yellow-500/15'
  return 'bg-red-500/15'
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function ShimmerBar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`bg-gray-800 rounded animate-pulse ${className || ''}`} style={style} />
  )
}

function FunnelSkeleton() {
  return (
    <div className="space-y-3 py-4">
      {Array.from({ length: 6 }).map((_, i) => {
        const widthPct = 100 - i * 12
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <ShimmerBar
              className="h-12 rounded-lg"
              style={{ width: `${widthPct}%` } as React.CSSProperties}
            />
            {i < 5 && (
              <div className="flex items-center gap-1 py-1">
                <ShimmerBar className="h-3 w-12 rounded" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function HorizontalSkeleton() {
  return (
    <div className="flex items-end gap-3 h-48 px-4 py-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <ShimmerBar className="w-full rounded-t-lg" style={{ height: `${30 + Math.random() * 60}%` } as React.CSSProperties} />
          <ShimmerBar className="h-3 w-full rounded" />
        </div>
      ))}
    </div>
  )
}

function KanbanSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-56 bg-gray-900/80 rounded-xl border border-white/10 p-3 space-y-3">
          <ShimmerBar className="h-5 w-3/4 rounded" />
          <ShimmerBar className="h-3 w-1/2 rounded" />
          <div className="space-y-2 pt-2">
            <ShimmerBar className="h-16 w-full rounded-lg" />
            <ShimmerBar className="h-16 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

function LoadingSkeleton({ view }: { view: 'funnel' | 'kanban' | 'horizontal' }) {
  if (view === 'kanban') return <KanbanSkeleton />
  if (view === 'horizontal') return <HorizontalSkeleton />
  return <FunnelSkeleton />
}

// ============================================================================
// FUNNEL VIEW
// ============================================================================

function FunnelView({
  stages,
  onStageClick,
  showValues,
}: {
  stages: PipelineStage[]
  onStageClick?: (key: string) => void
  showValues: boolean
}) {
  const [animatedWidths, setAnimatedWidths] = useState<number[]>(stages.map(() => 0))
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const maxCount = useMemo(() => Math.max(...stages.map(s => s.count), 1), [stages])

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWidths(
        stages.map(s => Math.max(18, (s.count / maxCount) * 100))
      )
    }, 80)
    return () => clearTimeout(timer)
  }, [stages, maxCount])

  return (
    <div className="space-y-0 py-2">
      {stages.map((stage, index) => {
        const isLast = index === stages.length - 1
        const nextStage = isLast ? null : stages[index + 1]
        const convRate = nextStage ? computeConversionRate(stage.count, nextStage.count) : null
        const isHovered = hoveredIndex === index

        return (
          <div key={stage.key}>
            {/* Stage bar */}
            <div
              className="flex flex-col items-center cursor-pointer group"
              onClick={() => onStageClick?.(stage.key)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onStageClick?.(stage.key) }}
              aria-label={`${stage.label}: ${stage.count} items${showValues ? `, ${formatINR(stage.value)}` : ''}`}
            >
              <div
                className={`
                  relative h-[52px] rounded-lg overflow-hidden mx-auto
                  transition-all duration-700 ease-out
                  ${isHovered ? 'ring-2 ring-white/20 shadow-lg' : ''}
                `}
                style={{ width: `${animatedWidths[index]}%` }}
              >
                {/* Background fill */}
                <div
                  className="absolute inset-0 transition-opacity duration-300"
                  style={{
                    backgroundColor: stage.color,
                    opacity: isHovered ? 0.9 : 0.7,
                  }}
                />
                {/* Gradient overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />

                {/* Content overlay */}
                <div className="relative h-full flex items-center justify-between px-4">
                  <div className="flex items-center gap-2 min-w-0">
                    {stage.icon && (
                      <span className="flex-shrink-0 opacity-90">{stage.icon}</span>
                    )}
                    <span className="text-sm font-semibold text-white truncate">
                      {stage.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-lg font-bold text-white tabular-nums">
                      {stage.count.toLocaleString('en-IN')}
                    </span>
                    {showValues && stage.value > 0 && (
                      <span className="text-xs font-medium text-white/70 bg-black/20 px-2 py-0.5 rounded-full">
                        {formatINR(stage.value)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Conversion rate between stages */}
            {!isLast && convRate !== null && (
              <div className="flex items-center justify-center py-1.5 gap-1.5">
                <ChevronDown className="w-3 h-3 text-gray-600" />
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getConversionBg(convRate)} ${getConversionColor(convRate)}`}>
                  {convRate >= 50 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span className="tabular-nums">{convRate}% conversion</span>
                </div>
                <ChevronDown className="w-3 h-3 text-gray-600" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// HORIZONTAL VIEW
// ============================================================================

function HorizontalView({
  stages,
  onStageClick,
  showValues,
}: {
  stages: PipelineStage[]
  onStageClick?: (key: string) => void
  showValues: boolean
}) {
  const [animatedHeights, setAnimatedHeights] = useState<number[]>(stages.map(() => 0))
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const maxCount = useMemo(() => Math.max(...stages.map(s => s.count), 1), [stages])

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedHeights(
        stages.map(s => Math.max(12, (s.count / maxCount) * 100))
      )
    }, 80)
    return () => clearTimeout(timer)
  }, [stages, maxCount])

  return (
    <div className="pt-2 pb-4">
      {/* Bar chart area */}
      <div className="flex items-end gap-1.5 sm:gap-2 h-52 px-1">
        {stages.map((stage, index) => {
          const isLast = index === stages.length - 1
          const nextStage = isLast ? null : stages[index + 1]
          const convRate = nextStage ? computeConversionRate(stage.count, nextStage.count) : null
          const isHovered = hoveredIndex === index

          return (
            <React.Fragment key={stage.key}>
              {/* Bar + labels */}
              <div
                className="flex-1 flex flex-col items-center h-full justify-end cursor-pointer group"
                onClick={() => onStageClick?.(stage.key)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onStageClick?.(stage.key) }}
                aria-label={`${stage.label}: ${stage.count}`}
              >
                {/* Count label above bar */}
                <div className={`mb-1.5 text-center transition-all duration-200 ${isHovered ? 'transform -translate-y-1' : ''}`}>
                  <span className="text-sm font-bold text-white tabular-nums block">
                    {stage.count.toLocaleString('en-IN')}
                  </span>
                  {showValues && stage.value > 0 && (
                    <span className="text-[10px] font-medium text-gray-500 block">
                      {formatINR(stage.value)}
                    </span>
                  )}
                </div>

                {/* Bar */}
                <div
                  className={`
                    w-full rounded-t-lg transition-all duration-700 ease-out relative overflow-hidden
                    ${isHovered ? 'ring-1 ring-white/20 shadow-lg' : ''}
                  `}
                  style={{ height: `${animatedHeights[index]}%` }}
                >
                  <div
                    className="absolute inset-0 transition-opacity duration-300"
                    style={{
                      backgroundColor: stage.color,
                      opacity: isHovered ? 0.95 : 0.75,
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10" />
                </div>
              </div>

              {/* Arrow connector */}
              {!isLast && (
                <div className="flex flex-col items-center justify-end pb-8 flex-shrink-0">
                  <ArrowRight className="w-3 h-3 text-gray-600" />
                  {convRate !== null && (
                    <span className={`text-[9px] font-medium tabular-nums mt-0.5 ${getConversionColor(convRate)}`}>
                      {convRate}%
                    </span>
                  )}
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Stage labels below */}
      <div className="flex items-start gap-1.5 sm:gap-2 mt-2 px-1">
        {stages.map((stage, index) => {
          const isLast = index === stages.length - 1
          return (
            <React.Fragment key={stage.key}>
              <div className="flex-1 text-center">
                <div
                  className="w-2 h-2 rounded-full mx-auto mb-1"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="text-[10px] sm:text-[11px] text-gray-400 font-medium leading-tight block">
                  {stage.label}
                </span>
              </div>
              {/* Spacer for the arrow column */}
              {!isLast && <div className="flex-shrink-0 w-3" />}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// KANBAN VIEW
// ============================================================================

function KanbanView({
  stages,
  onStageClick,
  showValues,
}: {
  stages: PipelineStage[]
  onStageClick?: (key: string) => void
  showValues: boolean
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 pt-1 -mx-1 px-1 snap-x snap-mandatory md:snap-none">
      {stages.map((stage) => (
        <div
          key={stage.key}
          className={`
            flex-shrink-0 w-52 sm:w-56 snap-start
            bg-gray-900/80 border border-white/10 rounded-xl
            hover:border-white/15 transition-all duration-200
            cursor-pointer group
          `}
          onClick={() => onStageClick?.(stage.key)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onStageClick?.(stage.key) }}
          aria-label={`${stage.label}: ${stage.count} items`}
        >
          {/* Column header */}
          <div className="px-3.5 py-3 border-b border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              <h4 className="text-sm font-semibold text-gray-200 truncate group-hover:text-white transition-colors">
                {stage.label}
              </h4>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-white tabular-nums">
                {stage.count.toLocaleString('en-IN')}
              </span>
              {showValues && stage.value > 0 && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    color: stage.color,
                    backgroundColor: `${stage.color}15`,
                  }}
                >
                  {formatINR(stage.value)}
                </span>
              )}
            </div>
          </div>

          {/* Column body */}
          <div className="px-3.5 py-3 min-h-[80px]">
            {stage.count === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <Inbox className="w-6 h-6 text-gray-700 mb-2" />
                <p className="text-xs text-gray-600">No items in this stage</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Visual summary bars to indicate volume */}
                {Array.from({ length: Math.min(stage.count, 3) }).map((_, i) => (
                  <div
                    key={i}
                    className="h-8 rounded-lg border border-white/5 bg-white/[0.03] group-hover:bg-white/[0.05] transition-colors flex items-center px-3"
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full mr-2 flex-shrink-0"
                      style={{ backgroundColor: stage.color, opacity: 1 - i * 0.2 }}
                    />
                    <div className="flex-1">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          backgroundColor: stage.color,
                          opacity: 0.2,
                          width: `${60 + Math.random() * 30}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
                {stage.count > 3 && (
                  <p className="text-[11px] text-gray-600 text-center pt-1">
                    +{(stage.count - 3).toLocaleString('en-IN')} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// SUMMARY STATS BAR
// ============================================================================

function SummaryStats({ stages, showValues }: { stages: PipelineStage[]; showValues: boolean }) {
  const totalCount = stages.reduce((sum, s) => sum + s.count, 0)
  const totalValue = stages.reduce((sum, s) => sum + s.value, 0)
  const overallConversion = stages.length >= 2
    ? computeConversionRate(stages[0].count, stages[stages.length - 1].count)
    : 0

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 pt-3 border-t border-white/5 mt-1">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">Total:</span>
        <span className="text-xs font-bold text-white tabular-nums">
          {totalCount.toLocaleString('en-IN')}
        </span>
      </div>
      {showValues && totalValue > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Pipeline Value:</span>
          <span className="text-xs font-bold text-[#FF6700]">
            {formatINR(totalValue)}
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <ArrowRight className="w-3 h-3 text-[#FF6700]" />
        <span className="text-xs text-gray-500">End-to-end:</span>
        <span className={`text-xs font-bold tabular-nums ${
          overallConversion >= 10 ? 'text-green-400' : overallConversion >= 5 ? 'text-yellow-400' : 'text-red-400'
        }`}>
          {overallConversion}%
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// VIEW TOGGLE BUTTONS
// ============================================================================

const VIEW_OPTIONS: { key: 'funnel' | 'kanban' | 'horizontal'; label: string; icon: React.ElementType }[] = [
  { key: 'funnel', label: 'Funnel', icon: Layers },
  { key: 'horizontal', label: 'Bar', icon: BarChart3 },
  { key: 'kanban', label: 'Board', icon: Columns3 },
]

function ViewToggle({
  current,
  onChange,
}: {
  current: 'funnel' | 'kanban' | 'horizontal'
  onChange: (v: 'funnel' | 'kanban' | 'horizontal') => void
}) {
  return (
    <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
      {VIEW_OPTIONS.map(opt => {
        const Icon = opt.icon
        const isActive = current === opt.key
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`
              flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200
              ${isActive
                ? 'bg-[#FF6700] text-white shadow-sm shadow-[#FF6700]/20'
                : 'text-gray-400 hover:text-white'
              }
            `}
            aria-label={`${opt.label} view`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PipelineVisualization({
  stages,
  view = 'funnel',
  onStageClick,
  isLoading = false,
  showValues = true,
}: PipelineVisualizationProps) {
  const [currentView, setCurrentView] = useState<'funnel' | 'kanban' | 'horizontal'>(view)

  const handleViewChange = useCallback((v: 'funnel' | 'kanban' | 'horizontal') => {
    setCurrentView(v)
  }, [])

  // Sync if controlled externally
  useEffect(() => {
    setCurrentView(view)
  }, [view])

  const totalCount = useMemo(
    () => stages.reduce((sum, s) => sum + s.count, 0),
    [stages]
  )
  const totalValue = useMemo(
    () => stages.reduce((sum, s) => sum + s.value, 0),
    [stages]
  )

  return (
    <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#FF6700]/15 flex items-center justify-center flex-shrink-0">
            <Layers className="w-4 h-4 text-[#FF6700]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">Sales Pipeline</h3>
            <p className="text-[11px] text-gray-500 truncate">
              {totalCount.toLocaleString('en-IN')} total
              {showValues && totalValue > 0 && (
                <>
                  {' '}&middot;{' '}
                  {formatINR(totalValue)}
                </>
              )}
            </p>
          </div>
        </div>

        <ViewToggle current={currentView} onChange={handleViewChange} />
      </div>

      {/* Body */}
      <div className="p-4 sm:p-5">
        {isLoading ? (
          <LoadingSkeleton view={currentView} />
        ) : (
          <>
            {currentView === 'funnel' && (
              <FunnelView
                stages={stages}
                onStageClick={onStageClick}
                showValues={showValues}
              />
            )}

            {currentView === 'horizontal' && (
              <HorizontalView
                stages={stages}
                onStageClick={onStageClick}
                showValues={showValues}
              />
            )}

            {currentView === 'kanban' && (
              <KanbanView
                stages={stages}
                onStageClick={onStageClick}
                showValues={showValues}
              />
            )}

            <SummaryStats stages={stages} showValues={showValues} />
          </>
        )}
      </div>
    </div>
  )
}
