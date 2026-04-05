'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import { SidebarLogo } from '@/components/ui/logo'
import { cn } from '@/lib/utils/cn'

interface MenuItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: string | number
  submenu?: MenuItem[]
  isActive?: boolean
}

interface DashboardSidebarProps {
  className?: string
}

export function DashboardSidebar({ className }: DashboardSidebarProps) {
  const { user } = useAuth()
  const pathname = usePathname()

  const menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      href: '/admin/dashboard',
      icon: <DashboardIcon />,
      isActive: pathname === '/admin/dashboard'
    },
    {
      label: 'Employee Management',
      href: '/admin/employees',
      icon: <EmployeeIcon />,
      isActive: pathname.startsWith('/admin/employees')
    },
    {
      label: 'Partner Management',
      href: '/admin/partners',
      icon: <PartnerIcon />,
      isActive: pathname.startsWith('/admin/partners')
    },
    {
      label: 'Customer Management',
      href: '/admin/customers',
      icon: <CustomerIcon />,
      isActive: pathname.startsWith('/admin/customers')
    },
    {
      label: 'Payout Management',
      href: '/admin/payouts',
      icon: <PayoutIcon />,
      isActive: pathname.startsWith('/admin/payouts')
    },
    {
      label: 'Banner Management',
      href: '/admin/banners',
      icon: <BannerIcon />,
      isActive: pathname.startsWith('/admin/banners')
    },
    {
      label: 'Incentive Management',
      href: '/admin/incentives',
      icon: <IncentiveIcon />,
      isActive: pathname.startsWith('/admin/incentives')
    },
    {
      label: 'Contest Management',
      href: '/admin/contests',
      icon: <ContestIcon />,
      isActive: pathname.startsWith('/admin/contests')
    },
    {
      label: 'Admin Management',
      href: '/admin/admin-management',
      icon: <AdminIcon />,
      isActive: pathname.startsWith('/admin/admin-management')
    },
    {
      label: 'Vendor Management',
      href: '/admin/vendors',
      icon: <VendorIcon />,
      isActive: pathname.startsWith('/admin/vendors')
    },
    {
      label: 'Property Management',
      href: '/admin/properties',
      icon: <PropertyIcon />,
      isActive: pathname.startsWith('/admin/properties')
    },
    {
      label: 'Knowledge Base',
      href: '/admin/knowledge-base',
      icon: <KnowledgeIcon />,
      isActive: pathname.startsWith('/admin/knowledge-base')
    },
    {
      label: 'My Profile',
      href: '/admin/profile',
      icon: <ProfileIcon />,
      isActive: pathname.startsWith('/admin/profile')
    }
  ]

  const renderMenuItem = (item: MenuItem) => {
    return (
      <li key={item.label} className="mb-1">
        <Link
          href={item.href}
          className={cn(
            "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
            "hover:bg-white/5",
            item.isActive
              ? "bg-primary text-white"
              : "text-gray-300 hover:text-white"
          )}
        >
          <span className="flex-shrink-0 mr-3">
            {item.icon}
          </span>
          <span className="truncate">{item.label}</span>
          {item.badge && (
            <span className="ml-auto bg-primary text-white text-xs px-2 py-0.5 rounded-full">
              {item.badge}
            </span>
          )}
        </Link>
      </li>
    )
  }

  return (
    <div className={cn(
      "w-64 h-full bg-sidebar border-r border-gray-800 flex flex-col",
      className
    )}>
      {/* Logo Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center">
          <SidebarLogo />
        </div>
      </div>

      {/* Profile Card */}
      <div className="p-4 border-b border-gray-800">
        <div className="bg-brand-ash rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center overflow-hidden">
              {user?.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.full_name || 'User'}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-lg font-semibold">
                  {user?.full_name?.charAt(0) || 'J'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">
                {user?.full_name || 'John Doe'}
              </p>
              <p className="text-orange-500 text-xs font-medium">
                {user?.user_metadata?.generated_id || 'CRM001234'}
              </p>
              <div className="flex items-center mt-1">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-green-500 text-xs">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map(item => renderMenuItem(item))}
        </ul>
      </nav>
    </div>
  )
}

// Icon Components matching the design
const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
  </svg>
)

const EmployeeIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.5 7H17c-.8 0-1.5.7-1.5 1.5v.5h-2v-.5C13.5 7.7 12.8 7 12 7h-1.5c-.62 0-1.15.38-1.38.91L6.5 16H9v6h11zM12.5 11.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5S11 13.83 11 13s.67-1.5 1.5-1.5z"/>
  </svg>
)

const PartnerIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.5 7H17c-.8 0-1.5.7-1.5 1.5v.5h-2v-.5C13.5 7.7 12.8 7 12 7h-1.5c-.62 0-1.15.38-1.38.91L6.5 16H9v6h11z"/>
  </svg>
)

const CustomerIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
)

const PayoutIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
  </svg>
)

const BannerIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-5-7l-3 3.72L9 12l-3 4h12l-6-4z"/>
  </svg>
)

const IncentiveIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
  </svg>
)

const ContestIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
)

const AdminIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
  </svg>
)

const VendorIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z"/>
  </svg>
)

const PropertyIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </svg>
)

const KnowledgeIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
  </svg>
)

const ProfileIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
)