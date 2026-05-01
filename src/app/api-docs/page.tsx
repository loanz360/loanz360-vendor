'use client'

import dynamic from 'next/dynamic'

const SwaggerUIComponent = dynamic(
  () => import('./swagger-ui'),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div> }
)

export default function APIDocsPage() {
  return <SwaggerUIComponent />
}
