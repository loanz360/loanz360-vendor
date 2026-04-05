'use client'

import React, { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { securityLogger } from '@/lib/security-logger'
import { clientLogger } from '@/lib/utils/client-logger'
import { toast } from '@/lib/utils/toast-helper'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  level?: 'page' | 'component' | 'critical'
  name?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return {
      hasError: true,
      error,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.state.errorId || `ERR_${Date.now()}`

    // Log error to security logger
    securityLogger.logSecurityEvent({
      level: this.props.level === 'critical' ? 'critical' : 'error',
      event: 'REACT_ERROR_BOUNDARY',
      details: {
        errorId,
        name: this.props.name || 'Unknown Component',
        level: this.props.level || 'component',
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
      }
    } as never)

    // Log to client logger in development
    if (process.env.NODE_ENV === 'development') {
      clientLogger.error(`Error Boundary (${this.props.name || 'Unknown'})`, {
        error: error.message,
        errorInfo: errorInfo.componentStack,
        errorId
      })
    }

    this.setState({
      error,
      errorInfo,
      errorId
    })
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    })
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
  }

  private handleReportError = () => {
    const { error, errorId } = this.state
    if (error && errorId) {
      const reportData = {
        errorId,
        message: error.message,
        stack: error.stack,
        component: this.props.name || 'Unknown',
        level: this.props.level || 'component',
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      }

      // Copy error details to clipboard
      navigator.clipboard.writeText(JSON.stringify(reportData, null, 2))
        .then(() => {
          toast.success('Error details copied to clipboard. Please share with support team.')
        })
        .catch(() => {
          toast.info(`Error ID: ${errorId} - Please share this ID with the support team.`)
        })
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      const { error, errorId } = this.state
      const level = this.props.level || 'component'

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full">
            <div className="bg-white border border-red-200 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2 font-poppins">
                  {level === 'critical' ? 'Critical Error' :
                   level === 'page' ? 'Page Error' : 'Component Error'}
                </h3>

                <p className="text-sm text-gray-600 mb-4">
                  {level === 'critical'
                    ? 'A critical error occurred that requires immediate attention.'
                    : level === 'page'
                    ? 'An error occurred while loading this page.'
                    : 'A component error occurred. The rest of the application should continue working.'}
                </p>

                {process.env.NODE_ENV === 'development' && error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-left">
                    <p className="text-xs font-mono text-red-800 break-all">
                      {error.message}
                    </p>
                  </div>
                )}

                <div className="text-xs text-gray-500 mb-4">
                  Error ID: {errorId}
                </div>

                <div className="flex flex-col space-y-2">
                  {level === 'component' && (
                    <button
                      onClick={this.handleRetry}
                      className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </button>
                  )}

                  {level === 'page' && (
                    <button
                      onClick={this.handleReload}
                      className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reload Page
                    </button>
                  )}

                  <button
                    onClick={this.handleGoHome}
                    className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Go Home
                  </button>

                  <button
                    onClick={this.handleReportError}
                    className="flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                  >
                    <Bug className="w-4 h-4 mr-2" />
                    Report Error
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Higher-order component for easy wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  return WrappedComponent
}

// Specific error boundary components for different use cases
export const PageErrorBoundary: React.FC<{ children: ReactNode; name?: string }> = ({ children, name }) => (
  <ErrorBoundary level="page" name={name}>
    {children}
  </ErrorBoundary>
)

export const ComponentErrorBoundary: React.FC<{ children: ReactNode; name?: string }> = ({ children, name }) => (
  <ErrorBoundary level="component" name={name}>
    {children}
  </ErrorBoundary>
)

export const CriticalErrorBoundary: React.FC<{ children: ReactNode; name?: string }> = ({ children, name }) => (
  <ErrorBoundary level="critical" name={name}>
    {children}
  </ErrorBoundary>
)