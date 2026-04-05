'use client'

import React from 'react'
import { Globe, Linkedin, Twitter, Instagram, Share2 } from 'lucide-react'

const SOCIAL_ICONS = [
  { icon: Linkedin, label: 'LinkedIn', color: 'text-blue-500/30' },
  { icon: Twitter, label: 'X (Twitter)', color: 'text-sky-500/30' },
  { icon: Instagram, label: 'Instagram', color: 'text-pink-500/30' },
  { icon: Globe, label: 'Website', color: 'text-emerald-500/30' },
]

export default function ProfileSocialPlaceholder() {
  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden relative">
      {/* Coming Soon badge */}
      <div className="absolute top-4 right-4 z-10">
        <span className="text-[10px] font-semibold text-gray-400 bg-gray-700/60 px-2.5 py-1 rounded-full border border-gray-600/30 uppercase tracking-wider">
          Coming Soon
        </span>
      </div>

      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
        <Share2 className="w-5 h-5 text-orange-500" />
        <h3 className="text-lg font-semibold text-white">Social Accounts</h3>
      </div>
      <div className="p-6 opacity-40 cursor-not-allowed select-none">
        <p className="text-sm text-gray-400 mb-5">
          Connect social accounts for enhanced profile verification and networking
        </p>
        <div className="grid grid-cols-2 gap-3">
          {SOCIAL_ICONS.map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/30 border border-gray-700/30"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center">
                <Icon className={`w-4.5 h-4.5 ${color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">{label}</p>
                <p className="text-[10px] text-gray-600">Not connected</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
