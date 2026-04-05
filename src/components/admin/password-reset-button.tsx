/**
 * Password Reset Button Component
 * Allows admins to request password reset for other admins
 */

'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { useConfirmationDialog, ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Key, Mail, CheckCircle } from 'lucide-react'
import { fetchWithErrorHandling, showErrorToast, showSuccessToast } from '@/lib/errors/client-errors'

interface PasswordResetButtonProps {
  adminId: string
  adminName: string
  adminEmail: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  showIcon?: boolean
}

export function PasswordResetButton({
  adminId,
  adminName,
  adminEmail,
  variant = 'outline',
  size = 'sm',
  showIcon = true,
}: PasswordResetButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const [showSuccess, setShowSuccess] = React.useState(false)
  const { isOpen, config, openDialog, closeDialog } = useConfirmationDialog()

  const handlePasswordReset = async () => {
    setIsLoading(true)

    try {
      const result = await fetchWithErrorHandling(`/api/admin-management/${adminId}/password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (result.success) {
        setShowSuccess(true)
        showSuccessToast(`Password reset email sent to ${adminEmail}`)

        // Hide success state after 3 seconds
        setTimeout(() => {
          setShowSuccess(false)
          closeDialog()
        }, 3000)
      } else {
        showErrorToast(result.error || 'Failed to send password reset email')
      }
    } catch (error) {
      showErrorToast('An error occurred while sending password reset email')
    } finally {
      setIsLoading(false)
    }
  }

  const requestPasswordReset = () => {
    openDialog({
      action: 'custom',
      title: 'Send Password Reset Email',
      description: `A password reset link will be sent to ${adminName}'s email address (${adminEmail}). The link will expire in 24 hours.`,
      details: [
        'The admin will receive an email with a secure reset link',
        'The link expires after 24 hours',
        'Only one reset link can be active at a time',
        'Previous reset links will be invalidated',
      ],
      confirmText: isLoading ? 'Sending...' : 'Send Reset Email',
      cancelText: 'Cancel',
      isLoading,
      variant: 'info',
      onConfirm: handlePasswordReset,
    })
  }

  if (showSuccess) {
    return (
      <Button variant={variant} size={size} disabled className="gap-2">
        <CheckCircle className="h-4 w-4 text-green-600" />
        Email Sent
      </Button>
    )
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={requestPasswordReset} disabled={isLoading} className="gap-2">
        {showIcon && (isLoading ? <Mail className="h-4 w-4 animate-pulse" /> : <Key className="h-4 w-4" />)}
        {isLoading ? 'Sending...' : 'Reset Password'}
      </Button>

      <ConfirmationDialog
        open={isOpen}
        onOpenChange={closeDialog}
        onConfirm={config.onConfirm || (() => {})}
        {...config}
      />
    </>
  )
}

/**
 * Password Reset Status Badge
 * Shows when a password reset is pending for an admin
 */
interface PasswordResetStatusProps {
  hasPendingReset?: boolean
  resetRequestedAt?: string
  resetExpiresAt?: string
}

export function PasswordResetStatus({ hasPendingReset, resetRequestedAt, resetExpiresAt }: PasswordResetStatusProps) {
  if (!hasPendingReset || !resetExpiresAt) {
    return null
  }

  const expiresAt = new Date(resetExpiresAt)
  const now = new Date()
  const isExpired = expiresAt < now

  if (isExpired) {
    return null
  }

  const hoursRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60))

  return (
    <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
      <Mail className="h-3 w-3" />
      <span>
        Reset pending
        {hoursRemaining > 0 && ` (${hoursRemaining}h remaining)`}
      </span>
    </div>
  )
}
