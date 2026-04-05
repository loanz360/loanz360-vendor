'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

interface BenefitCardProps {
  icon: LucideIcon
  title: string
  description: string
  highlights?: string[]
  gradient?: 'orange' | 'green' | 'blue' | 'purple'
  delay?: number
}

const gradientClasses = {
  orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/30 hover:border-orange-500/50',
  green: 'from-green-500/20 to-green-600/5 border-green-500/30 hover:border-green-500/50',
  blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30 hover:border-blue-500/50',
  purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30 hover:border-purple-500/50'
}

const iconClasses = {
  orange: 'text-orange-400 bg-orange-500/20',
  green: 'text-green-400 bg-green-500/20',
  blue: 'text-blue-400 bg-blue-500/20',
  purple: 'text-purple-400 bg-purple-500/20'
}

export default function BenefitCard({
  icon: Icon,
  title,
  description,
  highlights,
  gradient = 'orange',
  delay = 0
}: BenefitCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`
        relative overflow-hidden rounded-xl border p-5
        bg-gradient-to-br ${gradientClasses[gradient]}
        transition-all duration-300 hover:scale-[1.02] hover:shadow-lg
        group cursor-default
      `}
    >
      {/* Background glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className={`absolute top-0 right-0 w-32 h-32 bg-${gradient}-500/10 rounded-full blur-3xl`} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-lg ${iconClasses[gradient]} flex items-center justify-center mb-4`}>
          <Icon className="w-6 h-6" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>

        {/* Description */}
        <p className="text-gray-400 text-sm leading-relaxed mb-3">{description}</p>

        {/* Highlights */}
        {highlights && highlights.length > 0 && (
          <ul className="space-y-1.5">
            {highlights.map((highlight, index) => (
              <li key={index} className="flex items-start gap-2 text-xs text-gray-300">
                <span className={`w-1.5 h-1.5 rounded-full bg-${gradient}-400 mt-1.5 flex-shrink-0`} />
                {highlight}
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  )
}
