'use client'

import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  DollarSign,
  Receipt,
  FileCheck,
  Upload
} from 'lucide-react'

export default function PayrollTabs() {
  const router = useRouter()
  const pathname = usePathname()

  const tabs = [
    { icon: LayoutDashboard, label: 'Overview', href: '/employees/employee/payroll' },
    { icon: DollarSign, label: 'My Salary', href: '/employees/employee/payroll/my-salary' },
    { icon: Receipt, label: 'My Payslips', href: '/employees/employee/payroll/payslips' },
    { icon: FileCheck, label: 'Tax Declaration', href: '/employees/employee/payroll/tax-declaration' },
    { icon: Upload, label: 'Investment Proofs', href: '/employees/employee/payroll/investment-proofs' },
  ]

  return (
    <div className="sticky top-0 bg-gray-950 z-10 py-3">
      <div className="w-full bg-gray-900/80 rounded-full p-1.5">
        <div className="grid grid-cols-5" role="tablist" aria-label="Payroll sections">
          {tabs.map((tab) => {
            // Use exact match first, then startsWith for nested routes
            const isActive = pathname === tab.href ||
              (tab.href !== '/employees/employee/payroll' && pathname.startsWith(tab.href))

            const Icon = tab.icon

            return (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href)}
                role="tab"
                aria-selected={isActive}
                className={`flex items-center justify-center gap-2 px-3 py-3 font-medium text-sm transition-all duration-200 rounded-full ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'text-gray-400 hover:bg-gray-700/60 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
