/**
 * Toast Helper for non-hook contexts (Class components, utility functions)
 *
 * This provides a way to show toasts without using React hooks.
 * It works by dispatching custom events that the ToastProvider listens to.
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastEvent {
  message: string
  type: ToastType
}

/**
 * Show a toast notification from anywhere in the app
 * Works in class components and utility functions
 */
export const showToast = (message: string, type: ToastType = 'info') => {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<ToastEvent>('show-toast', {
      detail: { message, type }
    })
    window.dispatchEvent(event)
  }
}

/**
 * Convenience methods for different toast types
 */
export const toast = {
  success: (message: string) => showToast(message, 'success'),
  error: (message: string) => showToast(message, 'error'),
  warning: (message: string) => showToast(message, 'warning'),
  info: (message: string) => showToast(message, 'info'),
}
