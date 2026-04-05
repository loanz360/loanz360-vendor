'use client'

import React, { useState } from 'react'
import {
  Shield,
  Lock,
  Key,
  Smartphone,
  Mail,
  Monitor,
  Clock,
  MapPin,
  LogOut,
  AlertTriangle,
  Bell,
  Globe,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import CollapsibleSection from '@/components/partners/shared/CollapsibleSection'
import { SwitchField } from '@/components/partners/shared/FormField'
import type {
  BPSecuritySettings,
  BPSecurityForm,
  BPSession,
  TwoFactorMethod,
} from '@/types/bp-profile'
import { TWO_FACTOR_METHOD_LABELS } from '@/types/bp-profile'
import { cn } from '@/lib/utils/cn'

interface SecuritySectionProps {
  data: BPSecuritySettings | null
  formData: BPSecurityForm
  sessions: BPSession[]
  onChange: (field: keyof BPSecurityForm, value: boolean | string) => void
  onRevokeSession?: (sessionId: string) => Promise<void>
  onRevokeAllSessions?: () => Promise<void>
  onChangePassword?: () => void
  isEditing: boolean
  isRevokingSession?: string | null
}

const twoFactorMethods: Array<{
  method: TwoFactorMethod
  icon: React.ElementType
  description: string
}> = [
  { method: 'SMS', icon: Smartphone, description: 'Receive codes via SMS' },
  { method: 'EMAIL', icon: Mail, description: 'Receive codes via Email' },
  { method: 'AUTHENTICATOR_APP', icon: Key, description: 'Use Google/Microsoft Authenticator' },
]

export default function SecuritySection({
  data,
  formData,
  sessions,
  onChange,
  onRevokeSession,
  onRevokeAllSessions,
  onChangePassword,
  isEditing,
  isRevokingSession,
}: SecuritySectionProps) {
  const [isRevokingAll, setIsRevokingAll] = useState(false)

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isPasswordExpiringSoon = () => {
    if (!data?.password_expires_at) return false
    const expiryDate = new Date(data.password_expires_at)
    const fourteenDaysFromNow = new Date()
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14)
    return expiryDate <= fourteenDaysFromNow
  }

  const handleRevokeAll = async () => {
    if (!onRevokeAllSessions) return
    setIsRevokingAll(true)
    try {
      await onRevokeAllSessions()
    } finally {
      setIsRevokingAll(false)
    }
  }

  return (
    <CollapsibleSection
      title="Security Settings"
      icon={Shield}
      badge={
        formData.two_factor_enabled
          ? { text: '2FA Enabled', variant: 'success' }
          : { text: '2FA Disabled', variant: 'warning' }
      }
    >
      <div className="space-y-6 mt-4">
        {/* Password Management */}
        <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-700/50">
                <Lock className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">Password Management</h4>
                <p className="text-gray-400 text-sm">Manage your account password</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onChangePassword}
              className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
            >
              <Key className="w-4 h-4 mr-2" />
              Change Password
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">Username</p>
              <p className="text-white font-medium truncate">{data?.username || 'N/A'}</p>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">Last Password Change</p>
              <p className="text-white font-medium">{formatDate(data?.password_last_updated)}</p>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">Password Expires</p>
              <p
                className={cn(
                  'font-medium',
                  isPasswordExpiringSoon() ? 'text-yellow-400' : 'text-white'
                )}
              >
                {formatDate(data?.password_expires_at)}
                {isPasswordExpiringSoon() && (
                  <AlertTriangle className="w-4 h-4 inline ml-2" />
                )}
              </p>
            </div>
          </div>

          {isPasswordExpiringSoon() && (
            <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">
                  Your password will expire soon. Please update it to avoid access issues.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Two-Factor Authentication */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-400" />
            Two-Factor Authentication
          </h4>

          <SwitchField
            label="Enable Two-Factor Authentication"
            description="Add an extra layer of security to your account"
            icon={Shield}
            value={formData.two_factor_enabled}
            onChange={(v) => onChange('two_factor_enabled', v)}
            isEditing={isEditing}
            className="mb-4"
          />

          {formData.two_factor_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {twoFactorMethods.map((option) => (
                <div
                  key={option.method}
                  className={cn(
                    'p-4 rounded-lg border-2 transition-all',
                    isEditing ? 'cursor-pointer' : 'cursor-default',
                    formData.two_factor_method === option.method
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                  )}
                  onClick={() => isEditing && onChange('two_factor_method', option.method)}
                >
                  <option.icon
                    className={cn(
                      'w-6 h-6 mb-2',
                      formData.two_factor_method === option.method
                        ? 'text-orange-400'
                        : 'text-gray-400'
                    )}
                  />
                  <p className="text-white font-medium">
                    {TWO_FACTOR_METHOD_LABELS[option.method]}
                  </p>
                  <p className="text-gray-400 text-sm">{option.description}</p>
                </div>
              ))}
            </div>
          )}

          {data?.two_factor_setup_at && (
            <p className="text-gray-500 text-sm mt-4">
              2FA enabled on {formatDate(data.two_factor_setup_at)}
            </p>
          )}
        </div>

        {/* Active Sessions */}
        <div className="border-t border-gray-700/50 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-white font-medium flex items-center gap-2">
              <Monitor className="w-4 h-4 text-orange-400" />
              Active Sessions
              <Badge className="bg-gray-700/50 text-gray-300 ml-2">
                {sessions.length}
              </Badge>
            </h4>
            {sessions.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevokeAll}
                disabled={isRevokingAll}
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                {isRevokingAll ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4 mr-2" />
                )}
                Logout All Other
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.session_id}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border',
                  session.is_current
                    ? 'bg-green-500/5 border-green-500/30'
                    : 'bg-gray-800/30 border-gray-700/50'
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'p-2 rounded-lg',
                      session.is_current ? 'bg-green-500/10' : 'bg-gray-700/50'
                    )}
                  >
                    <Monitor
                      className={cn(
                        'w-5 h-5',
                        session.is_current ? 'text-green-400' : 'text-gray-400'
                      )}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">
                        {session.device_name} - {session.browser}
                      </p>
                      {session.is_current && (
                        <Badge className="bg-green-500/20 text-green-400 text-xs">
                          Current Session
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-gray-400 text-sm mt-1">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {session.ip_address}
                      </span>
                      {session.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {session.location}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Last active: {formatDate(session.last_activity_at)}
                    </p>
                  </div>
                </div>
                {!session.is_current && onRevokeSession && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => onRevokeSession(session.session_id)}
                    disabled={isRevokingSession === session.session_id}
                  >
                    {isRevokingSession === session.session_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogOut className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="text-center py-8 bg-gray-800/30 rounded-lg">
                <Monitor className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400">No active sessions found</p>
              </div>
            )}
          </div>
        </div>

        {/* Login Alerts */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-orange-400" />
            Security Alerts
          </h4>

          <div className="space-y-4">
            <SwitchField
              label="Login Alerts"
              description="Get notified when someone logs into your account"
              icon={Bell}
              value={formData.login_alerts_enabled}
              onChange={(v) => onChange('login_alerts_enabled', v)}
              isEditing={isEditing}
            />

            <SwitchField
              label="Suspicious Activity Alerts"
              description="Get notified about unusual login attempts or activity"
              icon={AlertTriangle}
              value={formData.suspicious_activity_alerts}
              onChange={(v) => onChange('suspicious_activity_alerts', v)}
              isEditing={isEditing}
            />
          </div>
        </div>

        {/* Last Login Info */}
        {data?.last_login_at && (
          <div className="border-t border-gray-700/50 pt-6">
            <h4 className="text-gray-400 text-sm mb-3">Last Login Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="p-3 bg-gray-800/30 rounded-lg">
                <p className="text-gray-500 text-xs">Date & Time</p>
                <p className="text-white text-sm">{formatDate(data.last_login_at)}</p>
              </div>
              <div className="p-3 bg-gray-800/30 rounded-lg">
                <p className="text-gray-500 text-xs">IP Address</p>
                <p className="text-white text-sm font-mono">{data.last_login_ip || 'N/A'}</p>
              </div>
              <div className="p-3 bg-gray-800/30 rounded-lg">
                <p className="text-gray-500 text-xs">Device</p>
                <p className="text-white text-sm">{data.last_login_device || 'N/A'}</p>
              </div>
              <div className="p-3 bg-gray-800/30 rounded-lg">
                <p className="text-gray-500 text-xs">Location</p>
                <p className="text-white text-sm">{data.last_login_location || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Account Security Status */}
        {data?.account_locked && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Account Locked</p>
                <p className="text-gray-400 text-sm mt-1">
                  Your account has been locked due to multiple failed login attempts.
                  {data.account_locked_until && (
                    <> It will be unlocked on {formatDate(data.account_locked_until)}.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
