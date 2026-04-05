'use client'

import React from 'react'
import { Shield, Key, Smartphone, Monitor, Lock } from 'lucide-react'

export default function ProfileSecuritySection() {
  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
        <Shield className="w-5 h-5 text-orange-500" />
        <h3 className="text-lg font-semibold text-white">Security</h3>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {/* Password */}
          <div className="flex items-center justify-between p-4 bg-gray-800/40 rounded-xl border border-gray-700/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Key className="w-4.5 h-4.5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Password</p>
                <p className="text-[11px] text-gray-500">Last changed recently</p>
              </div>
            </div>
            <span className="text-[11px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
              Active
            </span>
          </div>

          {/* Two-Factor Authentication */}
          <div className="flex items-center justify-between p-4 bg-gray-800/40 rounded-xl border border-gray-700/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Smartphone className="w-4.5 h-4.5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Two-Factor Authentication</p>
                <p className="text-[11px] text-gray-500">Add extra security to your account</p>
              </div>
            </div>
            <span className="text-[11px] text-gray-400 bg-gray-700/50 px-2 py-0.5 rounded-full border border-gray-600/30">
              Coming Soon
            </span>
          </div>

          {/* Active Sessions */}
          <div className="flex items-center justify-between p-4 bg-gray-800/40 rounded-xl border border-gray-700/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Monitor className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Active Sessions</p>
                <p className="text-[11px] text-gray-500">1 active session on this device</p>
              </div>
            </div>
            <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              1 Session
            </span>
          </div>

          {/* Account Recovery */}
          <div className="flex items-center justify-between p-4 bg-gray-800/40 rounded-xl border border-gray-700/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Lock className="w-4.5 h-4.5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Account Recovery</p>
                <p className="text-[11px] text-gray-500">Recovery email and phone configured</p>
              </div>
            </div>
            <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              Configured
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
