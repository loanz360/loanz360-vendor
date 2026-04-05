'use client'

import { toast } from 'sonner'

/**
 * Role Management Component
 *
 * Features:
 * - Create/edit custom roles
 * - Permission matrix editor
 * - Role templates
 * - Role assignment
 * - Permission inheritance
 * - Role analytics
 */

import { useState, useCallback } from 'react'
import {
  type CustomRole,
  type Permission,
  PERMISSION_CATEGORIES,
  PERMISSION_ACTIONS,
  getPermissionTemplate,
  groupPermissionsByCategory,
  calculatePermissionCoverage,
  generateDisplayName,
  validateRole,
} from '@/lib/roles/role-management'

// ============================================================================
// TYPES
// ============================================================================

interface RoleManagerProps {
  initialRoles?: CustomRole[]
  onSave?: (role: CustomRole) => Promise<void>
  onDelete?: (roleId: string) => Promise<void>
}

type ViewMode = 'list' | 'create' | 'edit'

// ============================================================================
// COMPONENT
// ============================================================================

export default function RoleManager({
  initialRoles = [],
  onSave,
  onDelete,
}: RoleManagerProps) {
  const [roles, setRoles] = useState<CustomRole[]>(initialRoles)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null)
  const [formData, setFormData] = useState<Partial<CustomRole>>({
    name: '',
    display_name: '',
    description: '',
    permissions: [],
    is_active: true,
  })

  const handleCreateRole = () => {
    setFormData({
      name: '',
      display_name: '',
      description: '',
      permissions: getPermissionTemplate('viewer'),
      is_active: true,
    })
    setViewMode('create')
  }

  const handleEditRole = (role: CustomRole) => {
    setSelectedRole(role)
    setFormData(role)
    setViewMode('edit')
  }

  const handleSaveRole = async () => {
    const validation = validateRole(formData)

    if (!validation.valid) {
      toast.error(validation.errors.join('\n'))
      return
    }

    if (onSave) {
      await onSave(formData as CustomRole)
    }

    setViewMode('list')
  }

  const togglePermission = (category: string, action: string) => {
    setFormData((prev) => {
      const permissions = prev.permissions || []
      const key = `${category}:${action}`
      const existing = permissions.find(
        (p) => p.category === category && p.action === action
      )

      if (existing) {
        return {
          ...prev,
          permissions: permissions.map((p) =>
            p.category === category && p.action === action
              ? { ...p, enabled: !p.enabled }
              : p
          ),
        }
      } else {
        return {
          ...prev,
          permissions: [
            ...permissions,
            { category, action, enabled: true },
          ],
        }
      }
    })
  }

  const isPermissionEnabled = (category: string, action: string): boolean => {
    return formData.permissions?.some(
      (p) => p.category === category && p.action === action && p.enabled
    ) || false
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Role Management</h2>
          <button
            onClick={handleCreateRole}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Custom Role
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onEdit={() => handleEditRole(role)}
              onDelete={() => onDelete?.(role.id!)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {viewMode === 'create' ? 'Create Role' : 'Edit Role'}
        </h2>
        <button
          onClick={() => setViewMode('list')}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      {/* Basic Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role Name (internal)
          </label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => {
              const name = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
              setFormData({ ...formData, name, display_name: generateDisplayName(name) })
            }}
            placeholder="e.g. sales_manager"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display Name
          </label>
          <input
            type="text"
            value={formData.display_name || ''}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            placeholder="e.g. Sales Manager"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">Permissions</h3>
        <PermissionMatrix
          permissions={formData.permissions || []}
          isEnabled={isPermissionEnabled}
          onToggle={togglePermission}
        />
      </div>

      <button
        onClick={handleSaveRole}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
      >
        {viewMode === 'create' ? 'Create Role' : 'Save Changes'}
      </button>
    </div>
  )
}

// ============================================================================
// ROLE CARD
// ============================================================================

function RoleCard({
  role,
  onEdit,
  onDelete,
}: {
  role: CustomRole
  onEdit: () => void
  onDelete: () => void
}) {
  const coverage = calculatePermissionCoverage(role.permissions)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-gray-900">{role.display_name}</h3>
          <p className="text-sm text-gray-500">{role.name}</p>
        </div>
        {role.is_system && (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
            System
          </span>
        )}
      </div>

      {role.description && (
        <p className="text-sm text-gray-600">{role.description}</p>
      )}

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Permissions</span>
          <span className="font-medium">{coverage.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full"
            style={{ width: `${coverage}%` }}
          />
        </div>
      </div>

      {role.user_count !== undefined && (
        <div className="text-sm text-gray-600">
          {role.user_count} user{role.user_count !== 1 ? 's' : ''}
        </div>
      )}

      {!role.is_system && (
        <div className="flex gap-2 pt-2 border-t border-gray-200">
          <button
            onClick={onEdit}
            className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex-1 px-3 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// PERMISSION MATRIX
// ============================================================================

function PermissionMatrix({
  permissions,
  isEnabled,
  onToggle,
}: {
  permissions: Permission[]
  isEnabled: (category: string, action: string) => boolean
  onToggle: (category: string, action: string) => void
}) {
  const categories = Object.values(PERMISSION_CATEGORIES)
  const actions = Object.values(PERMISSION_ACTIONS)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium">Category</th>
            {actions.map((action) => (
              <th key={action} className="text-center py-2 px-3 font-medium capitalize">
                {action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category} className="border-b border-gray-100">
              <td className="py-2 px-3 font-medium capitalize">{category}</td>
              {actions.map((action) => {
                const enabled = isEnabled(category, action)
                const valid = isValidPermission(category, action)

                return (
                  <td key={action} className="text-center py-2 px-3">
                    {valid ? (
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => onToggle(category, action)}
                        className="w-4 h-4"
                      />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function isValidPermission(category: string, action: string): boolean {
  // Audit logs are read-only
  if (category === 'audit' && !['read', 'export'].includes(action)) {
    return false
  }
  return true
}
