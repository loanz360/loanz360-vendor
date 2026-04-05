'use client'

import { toast } from 'sonner'

import { useState } from 'react'
import { Settings, Loader2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface WorkDriveSettings {
  maxFileSize: number
  defaultQuota: number
  allowedFileTypes: string
  blockedFileTypes: string
  enableVersioning: boolean
  versionLimit: number
  trashRetentionDays: number
  shareExpireDefault: number
  requireShareApproval: boolean
  enableAuditLogging: boolean
}

export default function AdminSettingsPanel() {
  const [settings, setSettings] = useState<WorkDriveSettings>({
    maxFileSize: 15,
    defaultQuota: 10,
    allowedFileTypes: '',
    blockedFileTypes: 'exe,bat,cmd,sh,ps1',
    enableVersioning: true,
    versionLimit: 10,
    trashRetentionDays: 30,
    shareExpireDefault: 7,
    requireShareApproval: false,
    enableAuditLogging: true,
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const response = await fetch('/api/workdrive/admin/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        throw new Error('Failed to save settings')
      }

      toast.success('Settings saved successfully!')
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const ToggleSwitch = ({
    enabled,
    onChange
  }: {
    enabled: boolean
    onChange: () => void
  }) => (
    <button
      onClick={onChange}
      className={`relative w-10 h-6 rounded-full transition-colors ${
        enabled ? 'bg-orange-500' : 'bg-gray-600'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          enabled ? 'left-5' : 'left-1'
        }`}
      />
    </button>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-orange-500" />
          WorkDrive Settings
        </h2>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save Settings
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File Settings */}
        <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">File Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Max File Size (MB)</label>
              <input
                type="number"
                value={settings.maxFileSize}
                onChange={(e) => setSettings({ ...settings, maxFileSize: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Default Quota (GB)</label>
              <input
                type="number"
                value={settings.defaultQuota}
                onChange={(e) => setSettings({ ...settings, defaultQuota: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Blocked File Extensions</label>
              <input
                type="text"
                value={settings.blockedFileTypes}
                onChange={(e) => setSettings({ ...settings, blockedFileTypes: e.target.value })}
                placeholder="exe,bat,cmd,sh"
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated list of extensions</p>
            </div>
          </div>
        </div>

        {/* Version & Trash Settings */}
        <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">Version & Trash</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Enable Versioning</span>
              <ToggleSwitch
                enabled={settings.enableVersioning}
                onChange={() => setSettings({ ...settings, enableVersioning: !settings.enableVersioning })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Version Limit</label>
              <input
                type="number"
                value={settings.versionLimit}
                onChange={(e) => setSettings({ ...settings, versionLimit: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                disabled={!settings.enableVersioning}
              />
              <p className="text-xs text-gray-500 mt-1">Maximum versions to keep per file</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Trash Retention (Days)</label>
              <input
                type="number"
                value={settings.trashRetentionDays}
                onChange={(e) => setSettings({ ...settings, trashRetentionDays: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
              <p className="text-xs text-gray-500 mt-1">Days before permanent deletion</p>
            </div>
          </div>
        </div>

        {/* Sharing Settings */}
        <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">Sharing Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Default Share Expiry (Days)</label>
              <input
                type="number"
                value={settings.shareExpireDefault}
                onChange={(e) => setSettings({ ...settings, shareExpireDefault: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
              <p className="text-xs text-gray-500 mt-1">0 for no expiry</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-300">Require Share Approval</span>
                <p className="text-xs text-gray-500">External and public shares need admin approval</p>
              </div>
              <ToggleSwitch
                enabled={settings.requireShareApproval}
                onChange={() => setSettings({ ...settings, requireShareApproval: !settings.requireShareApproval })}
              />
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">Security & Audit</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-300">Enable Audit Logging</span>
                <p className="text-xs text-gray-500">Track all file operations</p>
              </div>
              <ToggleSwitch
                enabled={settings.enableAuditLogging}
                onChange={() => setSettings({ ...settings, enableAuditLogging: !settings.enableAuditLogging })}
              />
            </div>
            {!settings.enableAuditLogging && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <p className="text-sm text-yellow-400">
                    Disabling audit logging is not recommended for compliance reasons.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
