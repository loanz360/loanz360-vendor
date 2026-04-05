'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { XCircle, RefreshCw, Home, AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class IncentiveErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Incentive Error Boundary caught an error:', error, errorInfo)

    this.setState({
      error,
      errorInfo
    })

    // Log to monitoring service
    if (typeof window !== 'undefined') {
      // Send to error tracking service (e.g., Sentry)
      try {
        fetch('/api/monitoring/log-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: error.toString(),
            errorInfo: errorInfo.componentStack,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            module: 'incentives'
          })
        }).catch(console.error)
      } catch (e) {
        console.error('Failed to log error:', e)
      }
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  private handleRefresh = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
          <div className="max-w-2xl w-full">
            {/* Error Card */}
            <div className="bg-gray-900 border border-red-500/50 rounded-lg p-8">
              {/* Icon */}
              <div className="flex items-center justify-center mb-6">
                <div className="relative">
                  <XCircle className="w-20 h-20 text-red-500" />
                  <AlertTriangle className="w-8 h-8 text-yellow-500 absolute -bottom-1 -right-1 animate-pulse" />
                </div>
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-white text-center mb-4 font-poppins">
                Oops! Something Went Wrong
              </h1>

              {/* Description */}
              <p className="text-gray-400 text-center mb-6">
                We encountered an unexpected error while loading your incentives dashboard.
                Don't worry, your data is safe and our team has been notified.
              </p>

              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-semibold text-red-400 mb-2 font-mono">
                    Error Details (Development Mode):
                  </h3>
                  <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono">
                    {this.state.error.toString()}
                  </pre>
                  {this.state.errorInfo && (
                    <details className="mt-3">
                      <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                        Component Stack
                      </summary>
                      <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap font-mono mt-2">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={this.handleReset}
                  className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Try Again
                </button>
                <button
                  onClick={this.handleRefresh}
                  className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Refresh Page
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Home className="w-5 h-5" />
                  Go Home
                </button>
              </div>

              {/* Support Info */}
              <div className="mt-6 pt-6 border-t border-gray-800">
                <p className="text-sm text-gray-500 text-center">
                  If this problem persists, please contact support at{' '}
                  <a
                    href="mailto:support@loanz360.com"
                    className="text-orange-400 hover:text-orange-300 underline"
                  >
                    support@loanz360.com
                  </a>
                </p>
              </div>
            </div>

            {/* Additional Help */}
            <div className="mt-6 bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-3 font-poppins">
                Common Solutions:
              </h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>Clear your browser cache and cookies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>Try using a different browser</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>Check your internet connection</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>Disable browser extensions temporarily</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>Contact your system administrator if you're on a corporate network</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default IncentiveErrorBoundary
