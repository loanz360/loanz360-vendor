'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import GoldenProfileCard from '@/components/shared/GoldenProfileCard'
import {
  LayoutDashboard,
  Users,
  FileText,
  Briefcase,
  BarChart3,
  Shield,
  Settings,
  User,
  Building2,
  CreditCard,
  UserCheck,
  GitBranch,
  Webhook,
  type LucideIcon,
} from 'lucide-react'

interface MenuItem {
  label: string
  href: string
  icon: LucideIcon
  exact?: boolean
}

interface MenuSection {
  title: string
  items: MenuItem[]
}

const menuSections: MenuSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
      { label: 'My Profile', href: '/admin/my-profile', icon: User },
    ],
  },
  {
    title: 'User Management',
    items: [
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Admin Management', href: '/admin/admin-management', icon: Shield },
      { label: 'Onboarding', href: '/admin/onboarding', icon: UserCheck },
      { label: 'Hierarchy', href: '/admin/hierarchy', icon: GitBranch },
    ],
  },
  {
    title: 'Business',
    items: [
      { label: 'Leads Management', href: '/admin/leads-management', icon: Briefcase },
      { label: 'Partners', href: '/admin/partners', icon: Building2 },
      { label: 'Customers', href: '/admin/customers', icon: Users },
      { label: 'Loans', href: '/admin/loans', icon: CreditCard },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Documents', href: '/admin/documents', icon: FileText },
      { label: 'CP Applications', href: '/admin/cp-applications', icon: FileText },
      { label: 'CP Payout Approval', href: '/admin/cp-payout-approval', icon: CreditCard },
      { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Assignment Rules', href: '/admin/assignment-rules', icon: Settings },
      { label: 'DSE Settings', href: '/admin/dse-settings', icon: Settings },
      { label: 'Webhooks', href: '/admin/webhooks', icon: Webhook },
    ],
  },
]

export function AdminSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()

  const displayUser = {
    id: user?.id || 'ADM001',
    full_name: user?.full_name || 'Administrator',
    email: user?.email || 'admin@loanz360.com',
    avatar_url: user?.avatar_url || null,
  }

  const completionPercentage = React.useMemo(() => {
    if (!user) return 0
    let pct = 0
    if (user.full_name && user.full_name !== user.email?.split('@')[0]) pct += 20
    if (user.email) pct += 20
    if (user.phone) pct += 15
    if (user.avatar_url) pct += 15
    if (user.email_verified) pct += 15
    if (user.mobile_verified) pct += 15
    return pct
  }, [user])

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href
    if (pathname === href) return true
    return pathname.startsWith(href + '/')
  }

  return (
    <div className="w-full frosted-sidebar pb-6 pt-[70px]">
      <GoldenProfileCard
        userName={displayUser.full_name}
        userId={displayUser.id.slice(0, 8).toUpperCase()}
        roleLabel="Administrator"
        avatarUrl={displayUser.avatar_url}
        completionPercentage={completionPercentage}
        profileLink="/admin/my-profile"
        currentPath={pathname}
      />

      <div className="py-4">
        {menuSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-2">
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <div className="h-[1px] w-2 bg-gradient-to-r from-transparent to-orange-500/50"></div>
                <span className="text-[10px] font-semibold tracking-wider text-orange-400/80 uppercase">
                  {section.title}
                </span>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-orange-500/50 to-transparent"></div>
              </div>
            </div>

            {section.items.map((item, index) => {
              const Icon = item.icon
              const active = isActive(item.href, item.exact)

              return (
                <div key={index} className="px-3">
                  <button
                    onClick={() => router.push(item.href)}
                    className={`w-full px-3 py-2.5 mb-1 rounded-lg transition-all duration-200 text-left group ${
                      active
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20'
                        : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-orange-400'}`} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
