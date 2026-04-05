'use client'

/**
 * Reusable Confirmation Dialog Component
 * Used for critical actions that require user confirmation
 */

import * as React from 'react'
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
import { AlertTriangle, Info, Trash2, UserX, UserCheck, Key, Shield } from 'lucide-react'

export type ConfirmationVariant = 'danger' | 'warning' | 'info' | 'success'
export type ConfirmationAction =
  | 'delete'
  | 'disable'
  | 'enable'
  | 'reset-password'
  | 'revoke-permission'
  | 'grant-permission'
  | 'bulk-update'
  | 'custom'

interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  title?: string
  description?: string
  action?: ConfirmationAction
  variant?: ConfirmationVariant
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
  entityName?: string
  entityType?: string
  details?: string[]
  requiresInput?: boolean
  inputPlaceholder?: string
  inputValue?: string
  onInputChange?: (value: string) => void
  expectedInput?: string
}

const actionConfig: Record<
  ConfirmationAction,
  {
    title: string
    description: string
    confirmText: string
    variant: ConfirmationVariant
    icon: React.ReactNode
  }
> = {
  delete: {
    title: 'Delete {entityType}',
    description: 'Are you sure you want to delete {entityName}? This action cannot be undone.',
    confirmText: 'Delete',
    variant: 'danger',
    icon: <Trash2 className="h-5 w-5 text-red-600" />,
  },
  disable: {
    title: 'Disable {entityType}',
    description:
      '{entityName} will be disabled and will not be able to access the system. You can re-enable them later.',
    confirmText: 'Disable',
    variant: 'warning',
    icon: <UserX className="h-5 w-5 text-orange-600" />,
  },
  enable: {
    title: 'Enable {entityType}',
    description: '{entityName} will be able to access the system again.',
    confirmText: 'Enable',
    variant: 'success',
    icon: <UserCheck className="h-5 w-5 text-green-600" />,
  },
  'reset-password': {
    title: 'Reset Password',
    description:
      'A password reset link will be sent to {entityName}. They will need to set a new password before they can log in.',
    confirmText: 'Send Reset Link',
    variant: 'warning',
    icon: <Key className="h-5 w-5 text-orange-600" />,
  },
  'revoke-permission': {
    title: 'Revoke Permission',
    description:
      '{entityName} will lose access to {entityType}. This may affect their ability to perform certain tasks.',
    confirmText: 'Revoke',
    variant: 'warning',
    icon: <Shield className="h-5 w-5 text-orange-600" />,
  },
  'grant-permission': {
    title: 'Grant Permission',
    description: '{entityName} will gain access to {entityType}.',
    confirmText: 'Grant',
    variant: 'info',
    icon: <Shield className="h-5 w-5 text-blue-600" />,
  },
  'bulk-update': {
    title: 'Bulk Update',
    description: 'You are about to update multiple {entityType}s. This action will affect {entityName}.',
    confirmText: 'Update All',
    variant: 'warning',
    icon: <AlertTriangle className="h-5 w-5 text-orange-600" />,
  },
  custom: {
    title: 'Confirm Action',
    description: 'Are you sure you want to proceed?',
    confirmText: 'Confirm',
    variant: 'info',
    icon: <Info className="h-5 w-5 text-blue-600" />,
  },
}

const variantStyles: Record<ConfirmationVariant, string> = {
  danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-600',
  warning: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-600',
  info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-600',
  success: 'bg-green-600 hover:bg-green-700 focus:ring-green-600',
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  action = 'custom',
  variant,
  confirmText,
  cancelText = 'Cancel',
  isLoading = false,
  entityName = '',
  entityType = 'item',
  details = [],
  requiresInput = false,
  inputPlaceholder = 'Type to confirm',
  inputValue = '',
  onInputChange,
  expectedInput,
}: ConfirmationDialogProps) {
  const config = actionConfig[action]
  const finalVariant = variant || config.variant
  const finalTitle = title || config.title.replace('{entityType}', entityType)
  const finalDescription =
    description ||
    config.description.replace('{entityName}', entityName).replace('{entityType}', entityType)
  const finalConfirmText = confirmText || config.confirmText

  const [internalInputValue, setInternalInputValue] = React.useState('')
  const currentInputValue = inputValue || internalInputValue
  const handleInputChange = onInputChange || setInternalInputValue

  const isConfirmDisabled =
    isLoading || (requiresInput && expectedInput && currentInputValue !== expectedInput)

  const handleConfirm = async () => {
    if (isConfirmDisabled) return
    await onConfirm()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {config.icon}
            <AlertDialogTitle>{finalTitle}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            {finalDescription}
            {details.length > 0 && (
              <ul className="mt-3 space-y-1 list-disc list-inside text-sm">
                {details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requiresInput && (
          <div className="my-4">
            <label htmlFor="confirmation-input" className="text-sm font-medium text-gray-700 block mb-2">
              {expectedInput ? `Type "${expectedInput}" to confirm` : 'Confirm your action'}
            </label>
            <input
              id="confirmation-input"
              type="text"
              value={currentInputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={inputPlaceholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="off"
            />
            {expectedInput && currentInputValue && currentInputValue !== expectedInput && (
              <p className="mt-1 text-xs text-red-600">Text does not match</p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={variantStyles[finalVariant]}
          >
            {isLoading ? 'Processing...' : finalConfirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Hook for managing confirmation dialog state
 */
export function useConfirmationDialog() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [config, setConfig] = React.useState<Partial<ConfirmationDialogProps>>({})

  const openDialog = (dialogConfig: Partial<ConfirmationDialogProps>) => {
    setConfig(dialogConfig)
    setIsOpen(true)
  }

  const closeDialog = () => {
    setIsOpen(false)
    // Reset config after animation completes
    setTimeout(() => setConfig({}), 300)
  }

  const confirmDialog = async () => {
    if (config.onConfirm) {
      await config.onConfirm()
    }
    closeDialog()
  }

  return {
    isOpen,
    config,
    openDialog,
    closeDialog,
    confirmDialog,
  }
}

/**
 * Utility function for creating confirmation prompts
 */
export function createConfirmation(
  action: ConfirmationAction,
  entityName: string,
  entityType: string = 'item',
  onConfirm: () => void | Promise<void>,
  additionalConfig?: Partial<ConfirmationDialogProps>
): Partial<ConfirmationDialogProps> {
  return {
    action,
    entityName,
    entityType,
    onConfirm,
    ...additionalConfig,
  }
}
