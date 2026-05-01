'use client'

import { useEffect, useRef } from 'react'

export default function SwaggerUI() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js'
    script.onload = () => {
      if (containerRef.current && (window as Record<string, unknown>).SwaggerUIBundle) {
        const SwaggerUIBundle = (window as Record<string, unknown>).SwaggerUIBundle as Function
        SwaggerUIBundle({
          url: '/api/docs',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            (SwaggerUIBundle as Record<string, unknown>).presets?.apis,
            (SwaggerUIBundle as Record<string, unknown>).SwaggerUIStandalonePreset,
          ],
          layout: 'BaseLayout',
        })
      }
    }
    document.body.appendChild(script)

    return () => {
      document.head.removeChild(link)
      document.body.removeChild(script)
    }
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <div id="swagger-ui" ref={containerRef} />
    </div>
  )
}
