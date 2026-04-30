'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { fetchWithErrorHandling, showSuccessToast } from '@/lib/errors/client-errors'

const MODULES = [
  { id: 'dashboard', name: 'Dashboard', permissions: ['view'] },
  { id: 'admin_management', name: 'Admin Management', permissions: ['view', 'create', 'edit', 'delete'] },
  { id: 'customer_management', name: 'Customer Management', permissions: ['view', 'create', 'edit', 'delete'] },
  { id: 'loan_applications', name: 'Loan Applications', permissions: ['view', 'create', 'edit', 'approve', 'reject'] },
  { id: 'disbursement', name: 'Disbursement', permissions: ['view', 'process', 'approve'] },
  { id: 'collections', name: 'Collections', permissions: ['view', 'create', 'edit'] },
  { id: 'reports', name: 'Reports', permissions: ['view', 'export'] },
  { id: 'settings', name: 'Settings', permissions: ['view', 'edit'] }
]

export function PermissionsMatrix({ adminId, onSave }: { adminId: string; onSave?: () => void }) {
  const [permissions, setPermissions] = React.useState<Record<string, string[]>>({})
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    fetchPermissions()
  }, [adminId])

  const fetchPermissions = async () => {
    const result = await fetchWithErrorHandling(`/api/admin-management/${adminId}/permissions`)
    if (result.success) {
      const perms: Record<string, string[]> = {}
      result.data.forEach((p: unknown) => {
        if (!perms[p.module_name]) perms[p.module_name] = []
        if (p.can_view) perms[p.module_name].push('view')
        if (p.can_create) perms[p.module_name].push('create')
        if (p.can_edit) perms[p.module_name].push('edit')
        if (p.can_delete) perms[p.module_name].push('delete')
        if (p.can_approve) perms[p.module_name].push('approve')
        if (p.can_reject) perms[p.module_name].push('reject')
        if (p.can_process) perms[p.module_name].push('process')
        if (p.can_export) perms[p.module_name].push('export')
      })
      setPermissions(perms)
    }
    setLoading(false)
  }

  const togglePermission = (moduleId: string, permission: string) => {
    setPermissions(prev => {
      const modulePerms = prev[moduleId] || []
      const hasPermission = modulePerms.includes(permission)
      return {
        ...prev,
        [moduleId]: hasPermission
          ? modulePerms.filter(p => p !== permission)
          : [...modulePerms, permission]
      }
    })
  }

  const savePermissions = async () => {
    setSaving(true)
    const updates = MODULES.map(module => ({
      module_name: module.id,
      can_view: permissions[module.id]?.includes('view') || false,
      can_create: permissions[module.id]?.includes('create') || false,
      can_edit: permissions[module.id]?.includes('edit') || false,
      can_delete: permissions[module.id]?.includes('delete') || false,
      can_approve: permissions[module.id]?.includes('approve') || false,
      can_reject: permissions[module.id]?.includes('reject') || false,
      can_process: permissions[module.id]?.includes('process') || false,
      can_export: permissions[module.id]?.includes('export') || false
    }))

    const result = await fetchWithErrorHandling(`/api/admin-management/${adminId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ permissions: updates })
    })

    if (result.success) {
      showSuccessToast('Permissions updated successfully')
      onSave?.()
    }
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Module Permissions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">Module</th>
                <th className="text-center p-2 font-medium">View</th>
                <th className="text-center p-2 font-medium">Create</th>
                <th className="text-center p-2 font-medium">Edit</th>
                <th className="text-center p-2 font-medium">Delete</th>
                <th className="text-center p-2 font-medium">Special</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map(module => (
                <tr key={module.id} className="border-b">
                  <td className="p-2 font-medium">{module.name}</td>
                  {['view', 'create', 'edit', 'delete'].map(perm => (
                    <td key={perm} className="text-center p-2">
                      {module.permissions.includes(perm) && (
                        <Checkbox
                          checked={permissions[module.id]?.includes(perm) || false}
                          onCheckedChange={() => togglePermission(module.id, perm)}
                        />
                      )}
                    </td>
                  ))}
                  <td className="text-center p-2">
                    {module.permissions.filter(p => !['view', 'create', 'edit', 'delete'].includes(p)).map(perm => (
                      <Checkbox
                        key={perm}
                        checked={permissions[module.id]?.includes(perm) || false}
                        onCheckedChange={() => togglePermission(module.id, perm)}
                        className="mr-1"
                      />
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={savePermissions} disabled={saving}>
            {saving ? 'Saving...' : 'Save Permissions'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
