'use client'

import React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Crown, User, Building2 } from 'lucide-react'
import Link from 'next/link'

interface ConnectedProfile {
  id: string
  type: 'INDIVIDUAL' | 'ENTITY'
  name: string
}

interface GoldenProfileDeleteGuardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectedProfiles: ConnectedProfile[]
}

export default function GoldenProfileDeleteGuard({
  open,
  onOpenChange,
  connectedProfiles
}: GoldenProfileDeleteGuardProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[480px] bg-gray-900 border-yellow-500/30">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Crown className="h-5 w-5 text-yellow-400" />
            </div>
            <AlertDialogTitle className="text-white">
              This is Your Golden Profile
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left text-gray-400">
            Your primary profile cannot be deleted while other profiles are still connected.
            Please delete all connected profiles first before removing your Golden Profile.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Connected profiles list */}
        {connectedProfiles.length > 0 && (
          <div className="my-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Connected Profiles ({connectedProfiles.length})
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {connectedProfiles.map((profile) => (
                <Link
                  key={profile.id}
                  href={`/customers/profile/${profile.id}?type=${profile.type}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-800/60 border border-gray-700/40 hover:border-gray-600/50 transition-colors"
                  onClick={() => onOpenChange(false)}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    profile.type === 'INDIVIDUAL'
                      ? 'bg-gradient-to-br from-blue-500 to-orange-600'
                      : 'bg-gradient-to-br from-emerald-500 to-teal-700'
                  }`}>
                    {profile.type === 'INDIVIDUAL' ? (
                      <User className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{profile.name}</p>
                    <p className="text-[10px] text-gray-500">
                      {profile.type === 'INDIVIDUAL' ? 'Individual' : 'Business'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700">
            Close
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Link
              href="/customers/my-profile"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 h-10 px-4 py-2"
              onClick={() => onOpenChange(false)}
            >
              View My Profiles
            </Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
