import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'LOANZ 360 — Vendor Portal',
  description:
    'LOANZ 360 vendor portal: invoices, settlements and service catalog management. Sign in to continue.',
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white font-poppins flex flex-col">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center font-bold text-white">
            L
          </div>
          <span className="text-lg font-semibold tracking-wide">
            LOANZ <span className="text-orange-500">360</span>
          </span>
        </div>
        <Link
          href="/auth/login"
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          Sign in
        </Link>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-3xl text-center space-y-6">
          <p className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 px-3 py-1 rounded-full text-xs uppercase tracking-wider">
            Vendor portal
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
            Welcome to <span className="text-orange-500">LOANZ&nbsp;360</span>
          </h1>
          <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto">
            Manage invoices, view settlements, and update your service
            catalog — all in one place. Sign in with your vendor credentials
            to continue.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/auth/login"
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
            >
              Sign in to your account
            </Link>
            <Link
              href="/auth/forgot-password"
              className="text-gray-400 hover:text-white px-4 py-3 text-sm font-medium transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-4 text-xs text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© LOANZ 360 — All rights reserved.</p>
        <p className="text-gray-600">
          Authorised vendors only. Activity is logged for compliance.
        </p>
      </footer>
    </main>
  )
}
