'use client'

import React from 'react'
import { User, Building2 } from 'lucide-react'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
} from '@/components/ui/tooltip'

export type ProfileAvatarType = 'INDIVIDUAL' | 'ENTITY'

interface ProfileAvatarProps {
  id: string
  type: ProfileAvatarType
  name: string
  imageUrl?: string | null
  isActive?: boolean
  size?: 'sm' | 'md'
  onClick?: () => void
}

export default function ProfileAvatar({
  type,
  name,
  imageUrl,
  isActive = false,
  size = 'sm',
  onClick
}: ProfileAvatarProps) {
  const sizeClass = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5'
  const isIndividual = type === 'INDIVIDUAL'

  const gradientClass = isIndividual
    ? 'from-blue-500 to-orange-600'
    : 'from-emerald-500 to-teal-700'

  const dotColor = isIndividual ? 'bg-blue-400' : 'bg-emerald-400'

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={`relative flex-shrink-0 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none ${
              isActive
                ? 'ring-2 ring-orange-500 shadow-[0_0_8px_rgba(255,103,0,0.4)]'
                : 'ring-1 ring-gray-700/50 hover:ring-gray-500/50'
            }`}
          >
            <div className={`${sizeClass} rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center overflow-hidden`}>
              {imageUrl ? (
                <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
              ) : isIndividual ? (
                <User className={`${iconSize} text-white`} />
              ) : (
                <Building2 className={`${iconSize} text-white`} />
              )}
            </div>

            {/* Type indicator dot */}
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${dotColor} rounded-full border-2 border-[#111827]`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-gray-800 border border-gray-700">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
            <span className="text-[11px] text-white font-medium">{name}</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {isIndividual ? 'Individual' : 'Business'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
