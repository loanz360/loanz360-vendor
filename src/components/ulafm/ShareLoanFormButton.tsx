/**
 * Share Loan Form Button Component
 * Version: 1.0.0
 *
 * A button component that allows users to generate and share
 * loan application form links. Works for all user roles.
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import ShareLoanFormModal from './ShareLoanFormModal'
import type { ShareLoanFormButtonProps, ShareLinkData } from '@/types/ulafm'

// Share icon
const ShareIcon = ({ className }: { className?: string }) => (
  <svg
    className={cn('w-4 h-4', className)}
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
)

export default function ShareLoanFormButton({
  sender_type,
  sender_subrole,
  campaign_id,
  campaign_name,
  source,
  variant = 'default',
  size = 'md',
  className,
  onShareSuccess,
  onShareError,
}: ShareLoanFormButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Map size to button size
  const buttonSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'default'

  // Handle share success
  const handleSuccess = (data: ShareLinkData) => {
    onShareSuccess?.(data)
  }

  // Handle share error
  const handleError = (error: string) => {
    onShareError?.(error)
  }

  return (
    <>
      <Button
        variant={variant}
        size={buttonSize}
        className={cn('gap-2', className)}
        onClick={() => setIsModalOpen(true)}
      >
        <ShareIcon />
        Share Loan Form
      </Button>

      <ShareLoanFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sender_type={sender_type}
        sender_subrole={sender_subrole}
        campaign_id={campaign_id}
        campaign_name={campaign_name}
        source={source}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    </>
  )
}
