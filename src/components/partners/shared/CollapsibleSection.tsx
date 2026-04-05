'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface CollapsibleSectionProps {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: {
    text: string
    variant: 'default' | 'success' | 'warning' | 'error' | 'info'
  }
  actions?: React.ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  disabled?: boolean
  id?: string
}

const badgeVariantStyles = {
  default: 'border-gray-500/50 text-gray-400 bg-gray-500/10',
  success: 'border-green-500/50 text-green-400 bg-green-500/10',
  warning: 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10',
  error: 'border-red-500/50 text-red-400 bg-red-500/10',
  info: 'border-blue-500/50 text-blue-400 bg-blue-500/10',
}

export default function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  badge,
  actions,
  className,
  headerClassName,
  contentClassName,
  disabled = false,
  id,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  return (
    <Card
      id={id}
      className={cn(
        'border-gray-700/50 bg-gray-900/50 backdrop-blur-sm transition-all duration-200',
        disabled && 'opacity-60',
        className
      )}
    >
      <CardHeader
        className={cn(
          'cursor-pointer hover:bg-gray-800/30 transition-colors rounded-t-lg',
          disabled && 'cursor-not-allowed',
          !isOpen && 'rounded-b-lg',
          headerClassName
        )}
        onClick={handleToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Icon className="w-5 h-5 text-orange-400" />
            </div>
            <CardTitle className="text-lg font-semibold font-poppins text-white">
              {title}
            </CardTitle>
            {badge && (
              <Badge
                variant="outline"
                className={cn('ml-2', badgeVariantStyles[badge.variant])}
              >
                {badge.text}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {actions && (
              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                {actions}
              </div>
            )}
            <div
              className={cn(
                'p-1 rounded-lg transition-colors',
                !disabled && 'hover:bg-gray-700/50'
              )}
            >
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className={cn('pt-0 pb-6', contentClassName)}>
          {children}
        </CardContent>
      )}
    </Card>
  )
}

// Export a read-only version for display-only sections
export function ReadOnlySection({
  title,
  icon,
  children,
  badge,
  className,
}: Omit<CollapsibleSectionProps, 'actions' | 'defaultOpen' | 'disabled'>) {
  return (
    <CollapsibleSection
      title={title}
      icon={icon}
      badge={badge}
      className={className}
      defaultOpen={true}
      disabled={false}
    >
      <div className="opacity-90">{children}</div>
    </CollapsibleSection>
  )
}
