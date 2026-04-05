'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorCount: number
}

/**
 * Error Boundary for Chatbot Widget
 * Catches JavaScript errors in the widget and displays a fallback UI
 */
export class ChatWidgetErrorBoundary extends Component<Props, State> {
  private resetTimeout: NodeJS.Timeout | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console
    console.error('ChatWidget Error:', error)
    console.error('Error Info:', errorInfo)

    // Increment error count
    this.setState(prev => ({
      errorCount: prev.errorCount + 1
    }))

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Auto-reset after 10 seconds if this is the first error
    if (this.state.errorCount < 3) {
      this.resetTimeout = setTimeout(() => {
        this.handleReset()
      }, 10000)
    }
  }

  componentWillUnmount() {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout)
    }
  }

  handleReset = () => {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout)
    }
    this.setState({
      hasError: false,
      error: null
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-gray-900 rounded-lg border border-gray-800 text-center">
          <AlertTriangle className="w-12 h-12 text-orange-500 mb-4" />
          <h3 className="text-white font-medium mb-2">
            Something went wrong
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            {this.state.errorCount >= 3
              ? 'The chat is experiencing issues. Please try again later.'
              : 'We encountered an error. Please try again.'}
          </p>
          {this.state.errorCount < 3 && (
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          )}
          {this.state.errorCount >= 3 && (
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </button>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

export default ChatWidgetErrorBoundary
