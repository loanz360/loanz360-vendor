'use client'

import React, { useMemo } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { getLoginBanner } from '@/lib/config/partner-banners'

export function BPBanner() {
  const { user } = useAuth()

  // Get dynamic banner (changes on each login)
  const bannerContent = useMemo(() => {
    return getLoginBanner('BUSINESS_PARTNER')
  }, [])

  return (
    <div className="rounded-xl overflow-hidden relative h-[140px]">
      {/* Background Image */}
      {bannerContent && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${bannerContent.image})`,
          }}
        />
      )}

      {/* Black overlay for readability */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Compact Content */}
      <div className="relative z-10 h-full flex items-center px-6">
        <div className="w-full flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1 drop-shadow-2xl font-poppins">
              Business Partner Dashboard
            </h1>
            <p className="text-gray-200 text-sm drop-shadow-lg">
              Welcome back, <span className="text-white font-semibold">{user?.full_name || user?.email?.split('@')[0] || 'Business Partner'}</span>
              <span className="text-gray-400 mx-2">|</span>
              <span className="text-gray-300">Manage your applications, monitor approvals, and grow your business</span>
            </p>
          </div>
          {bannerContent && (
            <div className="hidden lg:block max-w-md bg-black/40 backdrop-blur-sm border-l-2 border-orange-400 pl-3 pr-4 py-2 rounded-r-lg">
              <p className="text-gray-200 text-xs italic drop-shadow-lg">
                &ldquo;{bannerContent.quote}&rdquo;
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
