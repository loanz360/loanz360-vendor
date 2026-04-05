'use client'

import { useRouter } from 'next/navigation'

export function PageErrorFallback({ error, reset }: { error: Error; reset?: () => void }) {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-20 h-20 mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
        <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-white mb-3">Page Error</h2>
      <p className="text-gray-400 mb-6 max-w-md">{error.message || 'Something went wrong loading this page.'}</p>
      <div className="flex gap-3">
        {reset && (
          <button onClick={reset} className="px-5 py-2.5 bg-[#FF6700] text-white rounded-lg hover:bg-[#FF6700]/80 transition-colors font-medium">
            Try Again
          </button>
        )}
        <button onClick={() => router.back()} className="px-5 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium">
          Go Back
        </button>
      </div>
    </div>
  )
}
