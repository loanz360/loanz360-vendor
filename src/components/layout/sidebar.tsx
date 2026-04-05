'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import { useTheme } from '@/lib/contexts/theme-context'
import type { UserRole } from '@/lib/types/database.types'
import { SidebarLogo } from '@/components/ui/logo'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

interface MenuItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: string | number
  submenu?: MenuItem[]
  permission?: string
  roles?: UserRole[]
}

interface SidebarProps {
  className?: string
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ className, collapsed = false, onToggle }: SidebarProps) {
  const { user, hasAnyRole } = useAuth()
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const { resolvedTheme, setTheme } = useTheme()

  // Get menu items based on user role
  const getMenuItems = (): MenuItem[] => {
    if (!user) return []

    switch (user.role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return getAdminMenuItems()
      case 'PARTNER':
        return getPartnerMenuItems()
      case 'EMPLOYEE':
        return getEmployeeMenuItems()
      case 'CUSTOMER':
        return getCustomerMenuItems()
      case 'VENDOR':
        return getVendorMenuItems()
      default:
        return []
    }
  }

  const getAdminMenuItems = (): MenuItem[] => [
    {
      label: 'Dashboard',
      href: '/admin/dashboard',
      icon: <DashboardIcon />
    },
    {
      label: 'User Management',
      href: '/admin/users',
      icon: <UsersIcon />,
      submenu: [
        { label: 'Analytics', href: '/admin/users/analytics', icon: <AnalyticsIcon /> },
        { label: 'Employees', href: '/admin/users/employees', icon: <EmployeeIcon /> }
      ]
    },
    {
      label: 'HR Management',
      href: '/employees/hr',
      icon: <HRIcon />,
      submenu: [
        { label: 'Onboarding Management', href: '/employees/hr/onboarding-management', icon: <TaskIcon /> },
        { label: 'Resignation Requests', href: '/employees/hr/resignations', icon: <ResignIcon /> },
        { label: 'Final Settlement', href: '/employees/hr/final-settlement', icon: <ReceiptIcon /> },
        { label: 'PIP Management', href: '/employees/hr/pip', icon: <AlertIcon /> },
        { label: 'HR Analytics', href: '/hr/analytics/dashboard', icon: <AnalyticsIcon /> },
        { label: 'Attendance', href: '/hr/attendance', icon: <CalendarIcon /> },
        { label: 'Leave Management', href: '/hr/leaves', icon: <CalendarIcon /> },
        { label: 'Payroll Processing', href: '/hr/payroll', icon: <PayoutIcon /> },
        { label: 'HR Reports', href: '/hr/reports', icon: <DetailsIcon /> }
      ]
    },
    {
      label: 'Admin Management',
      href: '/admin/admin-management',
      icon: <AdminIcon />,
      submenu: [
        { label: 'Pending Approvals', href: '/admin/admin-management/pending', icon: <ApprovalIcon /> },
        { label: 'All Admins', href: '/admin/admin-management/list', icon: <UsersIcon /> },
        { label: 'Add Admin', href: '/admin/admin-management/add', icon: <RecruitIcon /> }
      ]
    },
    {
      label: 'Partner Management',
      href: '/admin/partners',
      icon: <PartnerIcon />,
      submenu: [
        { label: 'Analytics', href: '/admin/partners/analytics', icon: <AnalyticsIcon /> },
        { label: 'Partners', href: '/admin/partners/list', icon: <PartnerIcon /> }
      ]
    },
    {
      label: 'Customer Management',
      href: '/admin/customers',
      icon: <CustomerIcon />,
      submenu: [
        { label: 'Analytics', href: '/admin/customers/analytics', icon: <AnalyticsIcon /> },
        { label: 'Customers', href: '/admin/customers/list', icon: <CustomerIcon /> }
      ]
    },
    {
      label: 'Payout Management',
      href: '/admin/payouts',
      icon: <PayoutIcon />,
      badge: 12,
      submenu: [
        { label: 'Analytics', href: '/admin/payouts/analytics', icon: <AnalyticsIcon /> },
        { label: 'CP Payout Approval', href: '/admin/cp-payout-approval', icon: <ApprovalIcon /> },
        { label: 'BA Approval', href: '/admin/payouts/ba-approval', icon: <ApprovalIcon /> },
        { label: 'BP Approval', href: '/admin/payouts/bp-approval', icon: <ApprovalIcon /> },
        { label: 'Payout Grid', href: '/admin/payouts/grid', icon: <GridIcon /> },
        { label: 'Payout Details', href: '/admin/payouts/details', icon: <DetailsIcon /> }
      ]
    },
    {
      label: 'Banner Management',
      href: '/admin/banners',
      icon: <BannerIcon />
    },
    {
      label: 'Incentive Management',
      href: '/admin/incentives',
      icon: <IncentiveIcon />
    },
    {
      label: 'Contest Management',
      href: '/admin/contests',
      icon: <ContestIcon />
    },
    {
      label: 'Admin Management',
      href: '/admin/admins',
      icon: <AdminIcon />,
      roles: ['SUPER_ADMIN']
    },
    {
      label: 'Property Management',
      href: '/admin/properties',
      icon: <PropertyIcon />
    },
    {
      label: 'Vendor Management',
      href: '/admin/vendors',
      icon: <VendorIcon />
    },
    {
      label: 'Knowledge Base',
      href: '/admin/knowledge-base',
      icon: <KnowledgeIcon />
    },
    {
      label: 'Compliance',
      href: '/compliance',
      icon: <ComplianceIcon />,
      submenu: [
        { label: 'GDPR Dashboard', href: '/compliance/gdpr', icon: <GDPRIcon /> },
        { label: 'SOC 2 Dashboard', href: '/compliance/soc2', icon: <SOC2Icon /> }
      ]
    },
    {
      label: 'Security',
      href: '/security',
      icon: <SecurityIcon />
    },
    {
      label: 'Team Calendar',
      href: '/calendar',
      icon: <CalendarIcon />
    }
  ]

  const getPartnerMenuItems = (): MenuItem[] => {
    const baseMenu = [
      {
        label: 'Dashboard',
        href: '/partners/dashboard',
        icon: <DashboardIcon />
      },
      {
        label: 'My Leads',
        href: '/partners/leads',
        icon: <LeadsIcon />,
        badge: 5
      },
      {
        label: 'My Customers',
        href: '/partners/customers',
        icon: <CustomerIcon />
      },
      {
        label: 'Payout Grid',
        href: '/partners/payout-grid',
        icon: <GridIcon />
      },
      {
        label: 'Payout Status',
        href: '/partners/payout-status',
        icon: <PayoutIcon />,
        badge: 3
      },
      {
        label: 'Incentive Details',
        href: '/partners/incentives',
        icon: <IncentiveIcon />
      },
      {
        label: 'Offers to Customers',
        href: '/offers',
        icon: <OffersIcon />
      },
      {
        label: 'Knowledge Base',
        href: '/partners/knowledge-base',
        icon: <KnowledgeIcon />
      }
    ]

    // Add role-specific menu items
    const partnerSubRole = user?.sub_role || user?.user_metadata?.sub_role
    if (partnerSubRole === 'BUSINESS_PARTNER') {
      baseMenu.splice(1, 0, {
        label: 'Recruit BH',
        href: '/partners/recruit',
        icon: <RecruitIcon />
      })
      baseMenu.push({
        label: 'MIT',
        href: '/partners/mit',
        icon: <TrainingIcon />
      })
    }
    if (partnerSubRole === 'CHANNEL_PARTNER') {
      baseMenu.splice(1, 0, {
        label: 'My Applications',
        href: '/partners/applications',
        icon: <ApplicationIcon />
      })
      // Add CP-specific payout status
      const payoutIndex = baseMenu.findIndex(item => item.href === '/partners/payout-status')
      if (payoutIndex !== -1) {
        baseMenu[payoutIndex] = {
          label: 'Payout Status',
          href: '/partners/cp/payout-status',
          icon: <PayoutIcon />,
          badge: 3
        }
      }
    }

    return baseMenu
  }

  const getEmployeeMenuItems = (): MenuItem[] => {
    const subRole = user?.sub_role || user?.user_metadata?.sub_role || 'employee'
    const baseRoute = `/employees/${subRole.toLowerCase().replace(/_/g, '-')}`

    const menuItems: MenuItem[] = [
      {
        label: 'Dashboard',
        href: `${baseRoute}/dashboard`,
        icon: <DashboardIcon />
      }
    ]

    // Add CRM menu for CRO sub-role
    const subRoleCheck = user?.sub_role?.toUpperCase() === 'CRO' || user?.sub_role?.toLowerCase() === 'cro'
    const designationCheck = user?.designation?.toUpperCase() === 'CRO' || user?.designation?.toLowerCase() === 'cro'
    const isCRO = subRoleCheck || designationCheck

    if (isCRO) {
      menuItems.push({
        label: 'CRM',
        href: '/employees/cro/dashboard',
        icon: <LeadsIcon />,
        submenu: [
          { label: 'Dashboard', href: '/employees/cro/dashboard', icon: <DashboardIcon /> },
          { label: 'My Leads', href: '/employees/cro/leads', icon: <UsersIcon /> },
          { label: 'Follow-ups', href: '/employees/cro/followups', icon: <CalendarIcon /> },
          { label: 'Reports', href: '/employees/cro/reports', icon: <AnalyticsIcon /> },
          { label: 'Import Leads', href: '/employees/cro/leads/import', icon: <UploadIcon /> },
          { label: 'Bulk Assign', href: '/employees/cro/leads/bulk-assign', icon: <AssignIcon /> },
          { label: 'Communications', href: '/employees/cro/communications', icon: <MessageIcon /> },
          { label: 'Call Tracking', href: '/employees/cro/call-tracking', icon: <PhoneIcon /> },
          { label: 'Offers to Customers', href: '/offers', icon: <OffersIcon /> }
        ]
      })
    }

    // Add Accounts Executive menu items
    const isAccountsExecutive = subRole.toUpperCase() === 'ACCOUNTS_EXECUTIVE' || subRole.toUpperCase() === 'ACCOUNTS_MANAGER'
    if (isAccountsExecutive) {
      menuItems.push({
        label: 'Applications for Approval',
        href: '/employees/accounts-executive/applications',
        icon: <ApprovalIcon />,
        badge: 'New',
        submenu: [
          { label: 'BA Applications', href: '/employees/accounts-executive/ba-applications', icon: <ApplicationIcon /> },
          { label: 'BP Applications', href: '/employees/accounts-executive/bp-applications', icon: <ApplicationIcon /> },
          { label: 'CP Applications', href: '/employees/accounts-executive/cp-applications', icon: <ApplicationIcon /> }
        ]
      })
    }

    // Add Finance Executive menu items
    const isFinanceExecutive = subRole.toUpperCase() === 'FINANCE_EXECUTIVE' || subRole.toUpperCase() === 'FINANCE_MANAGER'
    if (isFinanceExecutive) {
      menuItems.push({
        label: 'CP Payouts',
        href: '/employees/finance-executive/cp-payouts',
        icon: <PayoutIcon />,
        badge: 'New'
      })
    }

    // HRIS MODULES - Available for all employees

    // 1. My Profile & Onboarding
    menuItems.push({
      label: 'My Profile',
      href: `${baseRoute}/onboarding`,
      icon: <EmployeeIcon />,
      submenu: [
        { label: 'Onboarding Tasks', href: `${baseRoute}/onboarding`, icon: <TaskIcon /> },
        { label: 'My Documents', href: `${baseRoute}/documents`, icon: <DocumentIcon /> },
        { label: 'Resignation', href: `${baseRoute}/resignation`, icon: <ResignIcon /> }
      ]
    })

    // 2. Performance Management
    menuItems.push({
      label: 'Performance',
      href: isCRO ? '/employees/cro/performance' : `${baseRoute}/goals`,
      icon: <TargetIcon />,
      submenu: isCRO ? [
        { label: 'My Performance', href: '/employees/cro/performance', icon: <TrendingIcon /> },
        { label: 'My Goals & OKRs', href: `${baseRoute}/goals`, icon: <TargetIcon /> },
        { label: 'Recognition', href: `${baseRoute}/recognition`, icon: <TrophyIcon /> }
      ] : [
        { label: 'My Goals & OKRs', href: `${baseRoute}/goals`, icon: <TargetIcon /> },
        { label: 'Performance Reviews', href: `${baseRoute}/performance`, icon: <ReviewIcon /> },
        { label: 'Recognition', href: `${baseRoute}/recognition`, icon: <TrophyIcon /> }
      ]
    })

    // 3. Payroll & Finance
    menuItems.push({
      label: 'Payroll',
      href: `${baseRoute}/payroll`,
      icon: <PayoutIcon />,
      submenu: [
        { label: 'Payroll Summary', href: `${baseRoute}/payroll/summary`, icon: <DetailsIcon /> },
        { label: 'Loans', href: `${baseRoute}/payroll/loans`, icon: <LoanIcon /> },
        { label: 'Advances', href: `${baseRoute}/payroll/advances`, icon: <IncentiveIcon /> },
        { label: 'Reimbursements', href: `${baseRoute}/payroll/reimbursements`, icon: <ReceiptIcon /> }
      ]
    })

    // 4. Learning & Development
    menuItems.push({
      label: 'Learning',
      href: `${baseRoute}/learning`,
      icon: <TrainingIcon />,
      submenu: [
        { label: 'My Courses', href: `${baseRoute}/learning/courses`, icon: <CourseIcon /> },
        { label: 'My Skills', href: `${baseRoute}/learning/skills`, icon: <SkillIcon /> },
        { label: 'Course Catalog', href: `${baseRoute}/learning/catalog`, icon: <KnowledgeIcon /> }
      ]
    })

    // 5. Career Development
    menuItems.push({
      label: 'Career',
      href: `${baseRoute}/career`,
      icon: <CareerIcon />,
      submenu: [
        { label: 'My Career Plan', href: `${baseRoute}/career/plan`, icon: <RoadmapIcon /> },
        { label: 'Career Paths', href: `${baseRoute}/career/paths`, icon: <PathIcon /> },
        { label: 'Internal Jobs', href: `${baseRoute}/career/jobs`, icon: <JobIcon /> }
      ]
    })

    // 6. MyTargets & Incentives - Use common route for all employee sub-roles (except Accounts Executive/Manager)
    if (!isAccountsExecutive) {
      menuItems.push({
        label: 'MyTargets & Incentives',
        href: '/employees/incentives',
        icon: <TargetIcon />,
        submenu: [
          { label: 'Dashboard', href: '/employees/incentives', icon: <AnalyticsIcon /> },
          { label: 'My Targets', href: '/employees/incentives?tab=active', icon: <TargetIcon /> },
          { label: 'Performance', href: '/employees/incentives?tab=analytics', icon: <TrendingIcon /> },
          { label: 'History', href: '/employees/incentives?tab=expired', icon: <CalendarIcon /> }
        ]
      })
    }

    // CRO Statistics menu for HR role
    if (user?.role?.toUpperCase() === 'HR' || user?.sub_role?.toUpperCase()?.includes('HR')) {
      menuItems.push({
        label: 'HR Analytics',
        href: '/employees/hr/analytics',
        icon: <AnalyticsIcon />,
        submenu: [
          { label: 'Dashboard', href: '/employees/hr/analytics/dashboard', icon: <DashboardIcon /> },
          { label: 'Attrition Risk', href: '/employees/hr/analytics/attrition', icon: <AlertIcon /> },
          { label: 'Learning Stats', href: '/employees/hr/analytics/learning', icon: <TrainingIcon /> },
          { label: 'Performance', href: '/employees/hr/analytics/performance', icon: <ReviewIcon /> }
        ]
      })
    }

    // Knowledge Base - Available for sales-related roles (CRO, BDE, BDM, Digital Sales, Direct Sales, Tele Sales, Channel Partner Exec/Manager)
    // Excluded: HR, Finance, Accounts roles
    const isSalesRole = isCRO ||
      subRole.toUpperCase().includes('BUSINESS_DEVELOPMENT') ||
      subRole.toUpperCase().includes('DIGITAL_SALES') ||
      subRole.toUpperCase().includes('DIRECT_SALES') ||
      subRole.toUpperCase().includes('TELE_SALES') ||
      subRole.toUpperCase().includes('CHANNEL_PARTNER')

    const isExcludedRole = subRole.toUpperCase().includes('HR') ||
      subRole.toUpperCase().includes('FINANCE') ||
      subRole.toUpperCase().includes('ACCOUNTS')

    if (isSalesRole && !isExcludedRole) {
      menuItems.push({
        label: 'Knowledge Base',
        href: '/employees/knowledge-base',
        icon: <KnowledgeIcon />
      })
    }

    return menuItems
  }

  const getCustomerMenuItems = (): MenuItem[] => [
    {
      label: 'Dashboard',
      href: '/customers/dashboard',
      icon: <DashboardIcon />
    },
    {
      label: 'Apply Loan',
      href: '/customers/apply',
      icon: <ApplicationIcon />
    },
    {
      label: 'My Loans',
      href: '/customers/loans',
      icon: <LoanIcon />
    },
    {
      label: 'EMI Calculator',
      href: '/customers/emi-calculator',
      icon: <CalendarIcon />
    },
    {
      label: 'Documents',
      href: '/customers/documents',
      icon: <DocumentIcon />
    },
    {
      label: 'Knowledge Base',
      href: '/customers/knowledge-base',
      icon: <KnowledgeIcon />
    },
    {
      label: 'Notifications',
      href: '/customers/notifications',
      icon: <ReminderIcon />
    },
    {
      label: 'Support Tickets',
      href: '/customers/support',
      icon: <HelpIcon />
    },
    {
      label: 'My Profile',
      href: '/customers/my-profile',
      icon: <CustomerIcon />
    }
  ]

  const getVendorMenuItems = (): MenuItem[] => [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: <DashboardIcon />
    },
    {
      label: 'My Properties',
      href: '/properties',
      icon: <PropertyIcon />
    },
    {
      label: 'Collections',
      href: '/collections',
      icon: <CollectionIcon />
    }
  ]

  const toggleExpanded = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label)
        ? [] // Close if already open
        : [label] // Open only this one, closing all others
    )
  }

  const isItemActive = (href: string): boolean => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const hasPermission = (item: MenuItem): boolean => {
    if (item.roles && !hasAnyRole(item.roles)) return false
    if (item.permission && user?.role === 'ADMIN') {
      // Check specific admin permissions here
      return true // Simplified for now
    }
    return true
  }

  const renderMenuItem = (item: MenuItem, level = 0) => {
    if (!hasPermission(item)) return null

    const isActive = isItemActive(item.href)
    const isExpanded = expandedItems.includes(item.label)
    const hasSubMenu = item.submenu && item.submenu.length > 0

    return (
      <li key={item.label} className="mb-1">
        <div className="relative">
          {hasSubMenu ? (
            <button
              onClick={() => toggleExpanded(item.label)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors",
                "hover:bg-muted hover:text-primary",
                isActive && "bg-primary text-primary-foreground",
                level > 0 && "pl-8"
              )}
            >
              <div className="flex items-center space-x-3">
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <Badge variant="orange" size="sm">
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </div>
              {!collapsed && (
                <ChevronIcon
                  className={cn(
                    "w-4 h-4 transition-transform",
                    isExpanded && "rotate-90"
                  )}
                />
              )}
            </button>
          ) : (
            <Link
              href={item.href}
              className={cn(
                "flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors",
                "hover:bg-muted hover:text-primary",
                isActive && "bg-primary text-primary-foreground",
                level > 0 && "pl-8"
              )}
            >
              <div className="flex items-center space-x-3">
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <Badge variant="orange" size="sm">
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </Link>
          )}
        </div>

        {hasSubMenu && isExpanded && !collapsed && (
          <ul className="mt-1 space-y-1">
            {item.submenu!.map(subItem => renderMenuItem(subItem, level + 1))}
          </ul>
        )}
      </li>
    )
  }

  const menuItems = getMenuItems()

  return (
    <div
      className={cn(
        "sidebar flex flex-col h-full transition-all duration-300",
        collapsed ? "w-16" : "w-sidebar-width",
        className
      )}
    >
      {/* Logo and Header */}
      <div className="p-4 border-b border-border">
        {collapsed ? (
          <div className="flex justify-center">
            <SidebarLogo showFullText={false} />
          </div>
        ) : (
          <SidebarLogo />
        )}
      </div>

      {/* Profile Card */}
      {!collapsed && user && (
        <div className="sidebar-profile-card">
          <div className="flex items-center space-x-3">
            <UserAvatar
              src={user.avatar_url}
              name={user.full_name}
              role={user.role}
              verified={user.email_verified && user.mobile_verified}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user.full_name}
              </p>
              <p className="text-xs text-primary">
                {user.user_metadata?.generated_id}
              </p>
              <Badge variant="ash" size="sm" className="mt-1">
                {user.role?.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-2 overflow-hidden">
        <ul className="space-y-1">
          {menuItems.map(item => renderMenuItem(item))}
        </ul>
      </nav>

      {/* My Profile Link */}
      <div className="border-t border-border p-4">
        <Link
          href={`/${user?.role?.toLowerCase()}/profile`}
          className={cn(
            "flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
            "hover:bg-muted hover:text-primary",
            pathname.includes('/profile') && "bg-primary text-primary-foreground"
          )}
        >
          <ProfileIcon className="w-5 h-5" />
          {!collapsed && <span>My Profile</span>}
        </Link>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
          className="flex items-center space-x-3 px-3 py-2 mt-1 w-full text-sm font-medium rounded-md transition-colors hover:bg-muted hover:text-primary text-muted-foreground"
          title={resolvedTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {resolvedTheme === 'light' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
          {!collapsed && <span>{resolvedTheme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      {onToggle && (
        <div className="border-t border-border p-4">
          <button
            onClick={onToggle}
            className="flex items-center justify-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted hover:text-primary"
          >
            <CollapseIcon
              className={cn(
                "w-5 h-5 transition-transform",
                collapsed && "rotate-180"
              )}
            />
            {!collapsed && <span className="ml-2">Collapse</span>}
          </button>
        </div>
      )}
    </div>
  )
}

// Icon Components (simplified SVG icons)
const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
  </svg>
)

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
)

const PartnerIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
)

const CustomerIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

const PayoutIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
)

const ChevronIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

const ProfileIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

const CollapseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
)

// Additional simplified icons (only basic SVG paths for brevity)
const AnalyticsIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
const EmployeeIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0v6a2 2 0 01-2 2H10a2 2 0 01-2-2V6m8 0V4a2 2 0 00-2-2H10a2 2 0 00-2 2v2" /></svg>
const ApprovalIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
const GridIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
const DetailsIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
const BannerIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
const IncentiveIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
const ContestIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
const AdminIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
const PropertyIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
const VendorIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
const KnowledgeIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
const LeadsIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
const OffersIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
const RecruitIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
const TrainingIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /></svg>
const ApplicationIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
const HRIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>
const LoanIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
const ReminderIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
const CalendarIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
const CollectionIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
const UploadIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
const AssignIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
const MessageIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
const PhoneIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>

// HRIS-specific icons
const TaskIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
const DocumentIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
const ResignIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
const TargetIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
const ReviewIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
const TrophyIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
const ReceiptIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" /></svg>
const CourseIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
const SkillIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
const CareerIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
const RoadmapIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
const PathIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
const JobIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0v6a2 2 0 01-2 2H10a2 2 0 01-2-2V6m8 0V4a2 2 0 00-2-2H10a2 2 0 00-2 2v2" /></svg>
const AlertIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
const TrendingIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
const HelpIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>

// Compliance & Security icons
const ComplianceIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
const SecurityIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
const GDPRIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
const SOC2Icon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>