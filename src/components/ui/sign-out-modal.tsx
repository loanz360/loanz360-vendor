/**
 * PHASE 2: Reusable Sign-Out Confirmation Modal
 *
 * Provides a consistent confirmation dialog across all portals
 * before signing out users
 */

'use client'

import { Button } from '@/components/ui/button'

interface SignOutModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  portalName?: string
}

export function SignOutModal({
  isOpen,
  onClose,
  onConfirm,
  portalName = 'this portal'
}: SignOutModalProps) {
  if (!isOpen) return null

  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
        <h3 className="text-xl font-semibold mb-3 font-poppins">Confirm Sign Out</h3>
        <p className="text-gray-300 mb-6">
          Are you sure you want to sign out from {portalName}?
        </p>
        <div className="flex justify-end space-x-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            variant="orange"
            className="bg-orange-500 hover:bg-orange-600"
          >
            Yes, Sign Out
          </Button>
        </div>
      </div>
    </div>
  )
}
