'use client'

/**
 * E26: Role Simulation - "View as CRO/Partner/Customer" mode
 * Allows SuperAdmin to preview what other user types see
 */

import { useState } from 'react'
import { Eye, EyeOff, Users, UserCheck, Handshake, Store, Shield } from 'lucide-react'

interface RoleOption {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  portalUrl: string
  color: string
}

const ROLES: RoleOption[] = [
  {
    id: 'employee',
    label: 'Employee Portal',
    description: 'View as CRO, BDE, HR, or Telecaller',
    icon: <Users className="w-5 h-5" />,
    portalUrl: '/employees',
    color: 'blue',
  },
  {
    id: 'partner',
    label: 'Partner Portal',
    description: 'View as Business Associate, BP, or CP',
    icon: <Handshake className="w-5 h-5" />,
    portalUrl: '/partners',
    color: 'green',
  },
  {
    id: 'customer',
    label: 'Customer Portal',
    description: 'View as loan applicant',
    icon: <UserCheck className="w-5 h-5" />,
    portalUrl: '/customers',
    color: 'purple',
  },
  {
    id: 'admin',
    label: 'Admin Portal',
    description: 'View as branch/regional admin',
    icon: <Shield className="w-5 h-5" />,
    portalUrl: '/admin',
    color: 'orange',
  },
  {
    id: 'vendor',
    label: 'Vendor Portal',
    description: 'View as bank/NBFC vendor',
    icon: <Store className="w-5 h-5" />,
    portalUrl: '/vendors',
    color: 'cyan',
  },
]

export function RoleSimulator() {
  const [isSimulating, setIsSimulating] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)

  const handleSimulate = (role: RoleOption) => {
    // Open portal in new tab with simulation flag
    window.open(`${role.portalUrl}?simulate=true&from=superadmin`, '_blank')
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-white font-poppins">Role Simulator</h3>
        </div>
        <span className="text-xs text-gray-500">Preview other portals</span>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        Open any portal in a new tab to see what users experience. No actions will be taken as the simulated user.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ROLES.map((role) => (
          <button
            key={role.id}
            onClick={() => handleSimulate(role)}
            className={`p-4 rounded-xl border border-gray-700 hover:border-${role.color}-500/50 bg-gray-800/50 hover:bg-gray-800 transition-all text-left group`}
          >
            <div className={`text-${role.color}-400 mb-2`}>{role.icon}</div>
            <p className="text-sm font-medium text-white group-hover:text-orange-400 transition-colors">
              {role.label}
            </p>
            <p className="text-xs text-gray-500 mt-1">{role.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
