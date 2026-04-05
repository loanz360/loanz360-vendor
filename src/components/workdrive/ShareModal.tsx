'use client'

import { useState } from 'react'
import { X, Link2, Mail, Copy, Check, Calendar, Lock, Globe, Users, Loader2 } from 'lucide-react'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  item: {
    id: string
    name: string
    type: 'file' | 'folder'
  }
  onCreateShare: (data: ShareData) => Promise<{ shareUrl?: string; error?: string }>
}

interface ShareData {
  shareType: 'link' | 'email' | 'internal'
  accessLevel: 'view' | 'download' | 'edit'
  password?: string
  expiresAt?: string
  emails?: string[]
  userIds?: string[]
}

export default function ShareModal({
  isOpen,
  onClose,
  item,
  onCreateShare,
}: ShareModalProps) {
  const [shareType, setShareType] = useState<'link' | 'email' | 'internal'>('link')
  const [accessLevel, setAccessLevel] = useState<'view' | 'download' | 'edit'>('view')
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [expiryDays, setExpiryDays] = useState<number | ''>('')
  const [emails, setEmails] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreateShare = async () => {
    setIsLoading(true)
    setError('')

    try {
      const data: ShareData = {
        shareType,
        accessLevel,
      }

      if (usePassword && password) {
        data.password = password
      }

      if (expiryDays) {
        const expiry = new Date()
        expiry.setDate(expiry.getDate() + expiryDays)
        data.expiresAt = expiry.toISOString()
      }

      if (shareType === 'email' && emails) {
        data.emails = emails.split(',').map(e => e.trim()).filter(Boolean)
      }

      const result = await onCreateShare(data)

      if (result.error) {
        setError(result.error)
      } else if (result.shareUrl) {
        setShareUrl(result.shareUrl)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setShareType('link')
      setAccessLevel('view')
      setPassword('')
      setUsePassword(false)
      setExpiryDays('')
      setEmails('')
      setShareUrl('')
      setError('')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/20 rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Link2 className="w-6 h-6 text-orange-500" />
            Share {item.type === 'folder' ? 'Folder' : 'File'}
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Item Info */}
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-sm text-gray-400">Sharing</p>
            <p className="text-white font-medium truncate">{item.name}</p>
          </div>

          {!shareUrl ? (
            <>
              {/* Share Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Share Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setShareType('link')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                      shareType === 'link'
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                        : 'border-white/20 hover:border-white/40 text-gray-400'
                    }`}
                  >
                    <Globe className="w-5 h-5" />
                    <span className="text-xs">Public Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareType('email')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                      shareType === 'email'
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                        : 'border-white/20 hover:border-white/40 text-gray-400'
                    }`}
                  >
                    <Mail className="w-5 h-5" />
                    <span className="text-xs">Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareType('internal')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                      shareType === 'internal'
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                        : 'border-white/20 hover:border-white/40 text-gray-400'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span className="text-xs">Internal</span>
                  </button>
                </div>
              </div>

              {/* Email Input for email share */}
              {shareType === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Addresses
                  </label>
                  <input
                    type="text"
                    value={emails}
                    onChange={(e) => setEmails(e.target.value)}
                    placeholder="Enter emails separated by commas"
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
                    disabled={isLoading}
                  />
                </div>
              )}

              {/* Access Level */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Access Level
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'view', label: 'View Only', desc: 'Can only view the content' },
                    { value: 'download', label: 'View & Download', desc: 'Can view and download' },
                    { value: 'edit', label: 'Full Access', desc: 'Can view, download, and edit' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        accessLevel === option.value
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="accessLevel"
                        value={option.value}
                        checked={accessLevel === option.value}
                        onChange={(e) => setAccessLevel(e.target.value as typeof accessLevel)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        accessLevel === option.value ? 'border-orange-500' : 'border-gray-500'
                      }`}>
                        {accessLevel === option.value && (
                          <div className="w-2 h-2 rounded-full bg-orange-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{option.label}</p>
                        <p className="text-gray-500 text-xs">{option.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Security Options */}
              <div className="space-y-4">
                {/* Password Protection */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">Password Protection</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUsePassword(!usePassword)}
                    className={`relative w-10 h-6 rounded-full transition-colors ${
                      usePassword ? 'bg-orange-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        usePassword ? 'left-5' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {usePassword && (
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
                    disabled={isLoading}
                  />
                )}

                {/* Expiry */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">Expires in</span>
                  </div>
                  <select
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(e.target.value ? parseInt(e.target.value) : '')}
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500 transition-colors"
                    disabled={isLoading}
                  >
                    <option value="">Never</option>
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                  </select>
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}
            </>
          ) : (
            /* Share URL Generated */
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 text-sm font-medium mb-2">
                  Share link created successfully!
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm"
                  />
                  <button
                    onClick={handleCopy}
                    className="p-2 bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <Copy className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
              </div>
              {usePassword && (
                <p className="text-sm text-yellow-400">
                  🔒 This link is password protected. Share the password separately.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 border border-white/20 rounded-lg text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {shareUrl ? 'Done' : 'Cancel'}
          </button>
          {!shareUrl && (
            <button
              onClick={handleCreateShare}
              disabled={isLoading || (shareType === 'email' && !emails.trim())}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  Create Share Link
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
