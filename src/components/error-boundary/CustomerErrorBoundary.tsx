'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'
import Link from 'next/link'
import { clientLogger } from '@/lib/utils/client-logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Error Boundary Component for Customer Management Module
 * Catches React errors and displays a user-friendly fallback UI
 *
 * Fortune 500 Grade: Production-ready error handling
 */
export class CustomerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so next render shows fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console
    console.error('Customer Error Boundary caught an error:', error, errorInfo)

    // Log to client logger (Sentry, etc.)
    clientLogger.error('React Error Boundary - Customer Management', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Update state with error info
    this.setState({
      error,
      errorInfo
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
          <div className="max-w-2xl w-full">
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/10 p-8">
              {/* Error Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-10 h-10 text-red-400" />
                </div>
              </div>

              {/* Error Title */}
              <h1 className="text-3xl font-bold text-white text-center mb-4 font-poppins">
                Something Went Wrong
              </h1>

              {/* Error Description */}
              <p className="text-gray-400 text-center mb-6">
                We encountered an unexpected error while processing your request.
                Our team has been notified and we're working to fix it.
              </p>

              {/* Error Details (only in development) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
                  <h3 className="text-sm font-semibold text-red-400 mb-2">
                    Error Details (Development Only)
                  </h3>
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-auto max-h-40">
                    {this.state.error.message}
                  </pre>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                        Component Stack
                      </summary>
                      <pre className="text-xs text-gray-400 mt-2 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={this.handleReset}
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
                >
                  <RefreshCcw className="w-5 h-5" />
                  <span>Try Again</span>
                </button>

                <button
                  onClick={this.handleReload}
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/20 font-medium"
                >
                  <RefreshCcw className="w-5 h-5" />
                  <span>Reload Page</span>
                </button>

                <Link
                  href="/superadmin/customer-management"
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/20 font-medium"
                >
                  <Home className="w-5 h-5" />
                  <span>Go Home</span>
                </Link>
              </div>

              {/* Support Info */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-sm text-gray-500 text-center">
                  If this problem persists, please contact{' '}
                  <a
                    href="mailto:support@loanz360.com"
                    className="text-orange-400 hover:text-orange-300 underline"
                  >
                    support@loanz360.com
                  </a>
                </p>
                {this.state.error && (
                  <p className="text-xs text-gray-600 text-center mt-2">
                    Error ID: {Date.now().toString(36)}-{Math.random().toString(36).substr(2, 9)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook-based error boundary wrapper
 * Use this for functional components
 */
export function withCustomerErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <CustomerErrorBoundary fallback={fallback}>
        <Component {...props} />
      </CustomerErrorBoundary>
    )
  }
}
