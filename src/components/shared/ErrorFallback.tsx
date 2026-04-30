'use client';
import { useEffect } from 'react';
export default function ErrorFallback({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Page error:', error); }, [error]);
  return (<div className="flex items-center justify-center min-h-[60vh]"><div className="text-center max-w-md"><div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><h2 className="text-xl font-bold mb-2">Something went wrong</h2><p className="text-sm text-zinc-400 mb-6">An unexpected error occurred. Please try again.</p><button onClick={reset} className="px-6 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors">Try again</button></div></div>);
}
