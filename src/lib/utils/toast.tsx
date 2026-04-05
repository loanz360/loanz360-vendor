/**
 * Toast Notification Utility
 * Centralized toast notification system using sonner
 */

import { toast, Toaster } from 'sonner'

// Export Toaster component for app-wide use
export { Toaster }

/**
 * Show success toast
 */
export const showSuccess = (message: string) => {
  return toast.success(message)
}

/**
 * Show error toast
 */
export const showError = (message: string) => {
  return toast.error(message)
}

/**
 * Show loading toast (returns toast id for dismissal)
 */
export const showLoading = (message: string) => {
  return toast.loading(message)
}

/**
 * Show info toast
 */
export const showInfo = (message: string) => {
  return toast.info(message)
}

/**
 * Show warning toast
 */
export const showWarning = (message: string) => {
  return toast.warning(message)
}

/**
 * Dismiss a specific toast by id
 */
export const dismissToast = (toastId: string | number) => {
  toast.dismiss(toastId)
}

/**
 * Dismiss all toasts
 */
export const dismissAllToasts = () => {
  toast.dismiss()
}

/**
 * Update an existing toast (useful for loading -> success/error)
 */
export const updateToast = (
  toastId: string | number,
  type: 'success' | 'error' | 'info' | 'warning',
  message: string,
) => {
  switch (type) {
    case 'success':
      toast.success(message, { id: toastId })
      break
    case 'error':
      toast.error(message, { id: toastId })
      break
    case 'info':
      toast.info(message, { id: toastId })
      break
    case 'warning':
      toast.warning(message, { id: toastId })
      break
  }
}

/**
 * Show a promise toast (automatically shows loading, then success/error)
 */
export const showPromise = <T,>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((err: unknown) => string)
  },
) => {
  return toast.promise(promise, messages)
}

/**
 * Batch operation toast (shows count)
 */
export const showBatchSuccess = (count: number, itemType: string = 'items') => {
  return showSuccess(`Successfully processed ${count} ${itemType}`)
}

/**
 * Batch error toast (shows count)
 */
export const showBatchError = (count: number, itemType: string = 'items') => {
  return showError(`Failed to process ${count} ${itemType}`)
}

// Default export for convenience
export default {
  success: showSuccess,
  error: showError,
  loading: showLoading,
  info: showInfo,
  warning: showWarning,
  dismiss: dismissToast,
  dismissAll: dismissAllToasts,
  update: updateToast,
  promise: showPromise,
  batchSuccess: showBatchSuccess,
  batchError: showBatchError,
}
