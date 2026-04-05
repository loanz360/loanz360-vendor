/**
 * Share Loan Form Modal Component
 * Version: 1.0.0
 *
 * A modal that displays share options including:
 * - Copy link button
 * - WhatsApp share
 * - QR Code display
 * - Link customization options
 */

'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'
import type { SenderType, SourceMedium, ShareLinkData } from '@/types/ulafm'

interface ShareLoanFormModalProps {
  isOpen: boolean
  onClose: () => void
  sender_type: SenderType
  sender_subrole?: string
  campaign_id?: string
  campaign_name?: string
  source?: SourceMedium
  onSuccess?: (data: ShareLinkData) => void
  onError?: (error: string) => void
}

// Icons
const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
)

const WhatsAppIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
)

const QRIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
    />
  </svg>
)

const EmailIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
)

const SMSIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
    />
  </svg>
)

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
)

// Source options
const SOURCE_OPTIONS: { value: SourceMedium; label: string }[] = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'QR_CODE', label: 'QR Code' },
  { value: 'SOCIAL_MEDIA', label: 'Social Media' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'DIRECT', label: 'Direct Link' },
]

export default function ShareLoanFormModal({
  isOpen,
  onClose,
  sender_type,
  sender_subrole,
  campaign_id,
  campaign_name,
  source: initialSource,
  onSuccess,
  onError,
}: ShareLoanFormModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [shareData, setShareData] = useState<ShareLinkData | null>(null)
  const [copied, setCopied] = useState(false)
  const [selectedSource, setSelectedSource] = useState<SourceMedium>(
    initialSource || 'DIRECT'
  )
  const [customCampaign, setCustomCampaign] = useState(campaign_name || '')
  const [showQR, setShowQR] = useState(false)

  // Generate share link when modal opens
  useEffect(() => {
    if (isOpen && !shareData) {
      generateShareLink()
    }
  }, [isOpen])

  // Generate share link
  const generateShareLink = async () => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/ulafm/generate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender_type,
          sender_subrole,
          campaign_id,
          campaign_name: customCampaign || campaign_name,
          source: selectedSource,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to generate link')
      }

      setShareData(result.data)
      onSuccess?.(result.data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Copy link to clipboard
  const handleCopyLink = async () => {
    if (!shareData) return

    try {
      await navigator.clipboard.writeText(shareData.short_url || shareData.full_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = shareData.short_url || shareData.full_url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Share via WhatsApp
  const handleWhatsAppShare = () => {
    if (!shareData) return

    const message = encodeURIComponent(
      `Apply for a loan easily with this link:\n\n${shareData.short_url || shareData.full_url}`
    )
    window.open(`https://wa.me/?text=${message}`, '_blank')
  }

  // Share via Email
  const handleEmailShare = () => {
    if (!shareData) return

    const subject = encodeURIComponent('Easy Loan Application')
    const body = encodeURIComponent(
      `Hi,\n\nYou can apply for a loan easily using this link:\n\n${shareData.short_url || shareData.full_url}\n\nBest regards`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
  }

  // Share via SMS
  const handleSMSShare = () => {
    if (!shareData) return

    const message = encodeURIComponent(
      `Apply for a loan: ${shareData.short_url || shareData.full_url}`
    )
    window.open(`sms:?body=${message}`, '_blank')
  }

  // Handle close
  const handleClose = () => {
    setShareData(null)
    setCopied(false)
    setShowQR(false)
    onClose()
  }

  // Regenerate with new options
  const handleRegenerate = () => {
    setShareData(null)
    generateShareLink()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Share Loan Application Form
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <LoadingSpinner />
              <p className="mt-4 text-sm text-muted-foreground">
                Generating your share link...
              </p>
            </div>
          ) : shareData ? (
            <>
              {/* Share Link Display */}
              <div className="space-y-2">
                <Label>Your Share Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={shareData.short_url || shareData.full_url}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant={copied ? 'success' : 'outline'}
                    size="icon"
                    onClick={handleCopyLink}
                    className="shrink-0"
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </Button>
                </div>
                {copied && (
                  <p className="text-xs text-success">Link copied to clipboard!</p>
                )}
              </div>

              {/* Short Code Display */}
              {shareData.short_code && (
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Short Code</p>
                  <p className="font-mono text-lg font-bold text-primary">
                    {shareData.short_code}
                  </p>
                </div>
              )}

              {/* Share Buttons */}
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="outline"
                  className="flex flex-col items-center justify-center h-16 gap-1"
                  onClick={handleWhatsAppShare}
                >
                  <WhatsAppIcon />
                  <span className="text-xs">WhatsApp</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col items-center justify-center h-16 gap-1"
                  onClick={handleEmailShare}
                >
                  <EmailIcon />
                  <span className="text-xs">Email</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col items-center justify-center h-16 gap-1"
                  onClick={handleSMSShare}
                >
                  <SMSIcon />
                  <span className="text-xs">SMS</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col items-center justify-center h-16 gap-1"
                  onClick={() => setShowQR(!showQR)}
                >
                  <QRIcon />
                  <span className="text-xs">QR Code</span>
                </Button>
              </div>

              {/* QR Code Display */}
              {showQR && shareData.qr_code_data_url && (
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border">
                  <img
                    src={shareData.qr_code_data_url}
                    alt="QR Code"
                    className="w-48 h-48"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Scan to open application form
                  </p>
                </div>
              )}

              {/* Link Options */}
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium mb-3">Customize Link</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Source</Label>
                    <Select
                      value={selectedSource}
                      onValueChange={(value) => setSelectedSource(value as SourceMedium)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Campaign (Optional)</Label>
                    <Input
                      placeholder="e.g., Diwali_2025"
                      value={customCampaign}
                      onChange={(e) => setCustomCampaign(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleRegenerate}
                >
                  Regenerate Link
                </Button>
              </div>

              {/* Stats Preview */}
              <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
                <p>
                  This link will track all applications submitted through it.
                  You can view your statistics in the dashboard.
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Failed to generate link</p>
              <Button variant="outline" className="mt-4" onClick={generateShareLink}>
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
