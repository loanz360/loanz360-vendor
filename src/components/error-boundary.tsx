'use client'

/**
 * ERROR BOUNDARY COMPONENT
 * Enterprise-grade error handling for React components
 *
 * Features:
 * - Catches JavaScript errors anywhere in component tree
 * - Logs error details for debugging
 * - Shows fallback UI instead of blank page
 * - Provides retry mechanism
 * - Integrates with error tracking (Sentry ready)
 */

import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  sectionName?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error Boundary caught an error:', error, errorInfo)

    this.setState({
      error,
      errorInfo
    })

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // TODO: Send to monitoring service (Sentry, LogRocket, etc.)
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } })
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
          color: '#fff',
          padding: '20px'
        }}>
          <div style={{ maxWidth: '600px', textAlign: 'center' }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'rgba(255, 103, 0, 0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <span style={{ fontSize: '48px' }}>⚠️</span>
            </div>

            <h1 style={{ color: '#FF6700', marginBottom: '16px', fontSize: '28px' }}>
              {this.props.sectionName ? `Error in ${this.props.sectionName}` : 'Something went wrong'}
            </h1>

            <p style={{ marginBottom: '24px', color: '#ccc', lineHeight: '1.6' }}>
              We apologize for the inconvenience. An unexpected error has occurred.
              {process.env.NODE_ENV === 'development' && ' Check console for details.'}
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div style={{
                marginBottom: '24px',
                padding: '16px',
                background: 'rgba(255, 103, 0, 0.1)',
                border: '1px solid rgba(255, 103, 0, 0.3)',
                borderRadius: '8px',
                textAlign: 'left'
              }}>
                <h3 style={{ fontSize: '14px', marginBottom: '8px', color: '#FF6700' }}>
                  Error Details (Development):
                </h3>
                <pre style={{
                  fontSize: '12px',
                  color: '#FFB380',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {this.state.error.toString()}
                </pre>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleReset}
                style={{
                  background: '#FF6700',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                Try Again
              </button>

              <button
                onClick={() => window.location.reload()}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                Reload Page
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#666', marginTop: '24px' }}>
              Error ID: <code style={{ color: '#FF6700' }}>{Date.now().toString(36).toUpperCase()}</code>
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook-based error boundary wrapper
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
): React.ComponentType<P> {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
