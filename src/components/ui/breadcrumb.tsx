'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  showHome?: boolean
  homeHref?: string
}

export default function Breadcrumb({ items, showHome = true, homeHref = '/' }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm font-poppins mb-4">
      {showHome && (
        <>
          <Link
            href={homeHref}
            className="flex items-center gap-1 text-gray-400 hover:text-[#FF6700] transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="sr-only">Home</span>
          </Link>
          {items.length > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
        </>
      )}
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {isLast ? (
              <span className="text-white font-medium truncate max-w-[200px]" aria-current="page">
                {item.label}
              </span>
            ) : (
              <>
                <Link
                  href={item.href || '#'}
                  className="text-gray-400 hover:text-[#FF6700] transition-colors truncate max-w-[200px]"
                >
                  {item.label}
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
              </>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
