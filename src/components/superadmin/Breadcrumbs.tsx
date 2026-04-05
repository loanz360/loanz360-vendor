'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

/**
 * E18: Auto-generated breadcrumb navigation for SuperAdmin portal
 * Derives breadcrumbs from the current URL path segments
 */

const SEGMENT_LABELS: Record<string, string> = {
  superadmin: 'Dashboard',
  'unified-crm': 'Unified CRM',
  'leads-management': 'Leads Management',
  'employee-management': 'Employee Management',
  'customer-management': 'Customer Management',
  'partner-management': 'Partner Management',
  'admin-management': 'Admin Management',
  'payout-management': 'Payout Management',
  'notification-center': 'Notification Center',
  'realtime-feed': 'Activity Feed',
  banners: 'Banners',
  'leads-analytics': 'Leads Analytics',
  'financial-analytics': 'Financial Analytics',
  'user-analytics': 'User Analytics',
  reports: 'Reports',
  'system-settings': 'System Settings',
  'role-management': 'Role Management',
  'loan-products': 'Loan Products',
  'bank-nbfc': 'Bank & NBFC',
  'commission-structure': 'Commission Structure',
  'api-integrations': 'API Integrations',
  'audit-logs': 'Audit Logs',
  'system-health': 'System Health',
  'document-management': 'Document Management',
  'compliance-checks': 'Compliance Checks',
  'dsa-management': 'DSA Management',
  'credit-analysis': 'Credit Analysis',
}

function formatSegment(segment: string): string {
  return (
    SEGMENT_LABELS[segment] ||
    segment
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}

export function Breadcrumbs() {
  const pathname = usePathname()

  if (!pathname) return null

  // Remove leading slash and split
  const segments = pathname.split('/').filter(Boolean)

  // Don't show breadcrumbs on root dashboard
  if (segments.length <= 1) return null

  // Build breadcrumb items
  const items = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    const isLast = index === segments.length - 1
    const label = formatSegment(segment)
    return { label, href, isLast }
  })

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm mb-4">
      <Link
        href="/superadmin"
        className="text-gray-400 hover:text-orange-400 transition-colors"
        aria-label="Home"
      >
        <Home className="w-4 h-4" />
      </Link>
      {items.slice(1).map((item) => (
        <span key={item.href} className="flex items-center gap-1.5">
          <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
          {item.isLast ? (
            <span className="text-orange-400 font-medium">{item.label}</span>
          ) : (
            <Link
              href={item.href}
              className="text-gray-400 hover:text-orange-400 transition-colors"
            >
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
