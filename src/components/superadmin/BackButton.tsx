'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface BackButtonProps {
  href?: string
  label?: string
  className?: string
}

export function BackButton({ href, label = 'Back', className }: BackButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    if (href) {
      router.push(href)
    } else {
      router.back()
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg',
        'bg-gray-800/50 hover:bg-gray-700/50',
        'text-gray-300 hover:text-white',
        'border border-gray-700/50 hover:border-gray-600/50',
        'transition-all duration-200',
        'text-sm font-medium',
        className
      )}
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  )
}

export default BackButton
