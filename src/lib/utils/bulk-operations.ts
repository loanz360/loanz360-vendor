/**
 * Bulk Operations Utility
 * Helpers for bulk import/export and bulk actions on admins
 */

export interface BulkImportAdmin {
  full_name: string
  email: string
  mobile_number: string
  location?: string
  status?: 'active' | 'inactive' | 'suspended'
  modules?: string[] // Array of module keys to enable
}

export interface BulkImportResult {
  success: boolean
  total: number
  imported: number
  failed: number
  errors: Array<{
    row: number
    email: string
    error: string
  }>
  created_admins: Array<{
    id: string
    email: string
    admin_unique_id: string
  }>
}

export interface BulkActionResult {
  success: boolean
  total: number
  processed: number
  failed: number
  errors: Array<{
    admin_id: string
    error: string
  }>
}

/**
 * Parse CSV file content to admin records
 */
export function parseAdminCSV(csvContent: string): BulkImportAdmin[] {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) {
    throw new Error('CSV file must contain at least a header row and one data row')
  }

  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  const admins: BulkImportAdmin[] = []

  // Validate required columns
  const requiredColumns = ['full_name', 'email', 'mobile_number']
  for (const col of requiredColumns) {
    if (!header.includes(col)) {
      throw new Error(`Missing required column: ${col}`)
    }
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    if (values.length === 0 || !values[0]) continue

    const admin: BulkImportAdmin = {
      full_name: '',
      email: '',
      mobile_number: ''
    }

    header.forEach((col, index) => {
      const value = values[index]?.trim()

      switch (col) {
        case 'full_name':
          admin.full_name = value
          break
        case 'email':
          admin.email = value
          break
        case 'mobile_number':
          admin.mobile_number = value
          break
        case 'location':
          admin.location = value
          break
        case 'status':
          if (['active', 'inactive', 'suspended'].includes(value?.toLowerCase())) {
            admin.status = value.toLowerCase() as 'active' | 'inactive' | 'suspended'
          }
          break
        case 'modules':
          // Comma-separated module keys in quotes or semicolon-separated
          if (value) {
            admin.modules = value.split(';').map(m => m.trim()).filter(Boolean)
          }
          break
      }
    })

    // Validate admin
    if (admin.full_name && admin.email && admin.mobile_number) {
      admins.push(admin)
    }
  }

  return admins
}

/**
 * Validate admin data before import
 */
export function validateAdminData(admin: BulkImportAdmin): string | null {
  // Validate full name
  if (!admin.full_name || admin.full_name.length < 2) {
    return 'Full name must be at least 2 characters'
  }

  if (admin.full_name.length > 100) {
    return 'Full name cannot exceed 100 characters'
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(admin.email)) {
    return 'Invalid email format'
  }

  // Validate mobile number
  const phoneRegex = /^[0-9+\-\s()]{10,20}$/
  if (!phoneRegex.test(admin.mobile_number)) {
    return 'Invalid mobile number format (10-20 digits allowed)'
  }

  // Validate location if provided
  if (admin.location && admin.location.length > 200) {
    return 'Location cannot exceed 200 characters'
  }

  return null
}

/**
 * Convert admins to CSV format for export
 */
export function adminsToCSV(
  admins: unknown[],
  includeModules: boolean = false
): string {
  const headers = [
    'Admin ID',
    'Full Name',
    'Email',
    'Mobile Number',
    'Location',
    'Status',
    'Two-Factor Enabled',
    'Created At',
    'Last Activity'
  ]

  if (includeModules) {
    headers.push('Enabled Modules')
  }

  const csvRows = [headers.join(',')]

  admins.forEach(admin => {
    const row = [
      admin.admin_unique_id || '',
      `"${admin.full_name || ''}"`,
      admin.email || '',
      admin.mobile_number || '',
      `"${admin.location || ''}"`,
      admin.status || '',
      admin.two_factor_enabled ? 'Yes' : 'No',
      admin.created_at ? new Date(admin.created_at).toLocaleDateString() : '',
      admin.last_activity_at ? new Date(admin.last_activity_at).toLocaleDateString() : ''
    ]

    if (includeModules && admin.enabled_modules) {
      row.push(`"${admin.enabled_modules.join('; ')}"`)
    }

    csvRows.push(row.join(','))
  })

  return csvRows.join('\n')
}

/**
 * Export admins with filters
 */
export async function exportAdmins(filters?: {
  status?: string
  location?: string
  created_after?: string
  created_before?: string
  has_2fa?: boolean
}): Promise<string> {
  const supabase = createClientComponentClient()

  let query = supabase
    .from('admins')
    .select('*')
    .eq('is_deleted', false)

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.location) {
    query = query.eq('location', filters.location)
  }

  if (filters?.created_after) {
    query = query.gte('created_at', filters.created_after)
  }

  if (filters?.created_before) {
    query = query.lte('created_at', filters.created_before)
  }

  if (filters?.has_2fa !== undefined) {
    query = query.eq('two_factor_enabled', filters.has_2fa)
  }

  const { data: admins, error } = await query.order('created_at', { ascending: false })

  if (error) throw error

  return adminsToCSV(admins || [])
}

/**
 * Bulk update admin status
 */
export async function bulkUpdateStatus(
  adminIds: string[],
  newStatus: 'active' | 'inactive' | 'suspended',
  updatedBy: string,
  reason?: string
): Promise<BulkActionResult> {
  const supabase = createClientComponentClient()

  const result: BulkActionResult = {
    success: true,
    total: adminIds.length,
    processed: 0,
    failed: 0,
    errors: []
  }

  for (const adminId of adminIds) {
    try {
      // Get admin details
      const { data: admin } = await supabase
        .from('admins')
        .select('id, admin_unique_id, status')
        .eq('id', adminId)
        .maybeSingle()

      if (!admin) {
        result.failed++
        result.errors.push({
          admin_id: adminId,
          error: 'Admin not found'
        })
        continue
      }

      // Update status
      const { error: updateError } = await supabase
        .from('admins')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', adminId)

      if (updateError) throw updateError

      // Create audit log
      await supabase.rpc('create_admin_audit_log', {
        p_admin_id: adminId,
        p_action_type: 'status_changed',
        p_action_description: `Status changed from ${admin.status} to ${newStatus}${reason ? ` - Reason: ${reason}` : ''}`,
        p_changes: JSON.stringify({
          before: { status: admin.status },
          after: { status: newStatus },
          reason: reason || 'Bulk update'
        }),
        p_performed_by: updatedBy,
        p_ip_address: 'bulk_operation',
        p_user_agent: 'bulk_operation'
      })

      result.processed++
    } catch (error: unknown) {
      result.failed++
      result.errors.push({
        admin_id: adminId,
        error: error.message
      })
    }
  }

  result.success = result.failed === 0

  return result
}

/**
 * Bulk enable/disable 2FA
 */
export async function bulkToggle2FA(
  adminIds: string[],
  enable: boolean,
  updatedBy: string,
  reason?: string
): Promise<BulkActionResult> {
  const supabase = createClientComponentClient()

  const result: BulkActionResult = {
    success: true,
    total: adminIds.length,
    processed: 0,
    failed: 0,
    errors: []
  }

  for (const adminId of adminIds) {
    try {
      const { data: admin } = await supabase
        .from('admins')
        .select('id, admin_unique_id, two_factor_enabled')
        .eq('id', adminId)
        .maybeSingle()

      if (!admin) {
        result.failed++
        result.errors.push({
          admin_id: adminId,
          error: 'Admin not found'
        })
        continue
      }

      // Skip if already in desired state
      if (admin.two_factor_enabled === enable) {
        result.processed++
        continue
      }

      if (enable) {
        // Cannot bulk enable 2FA (requires individual setup)
        result.failed++
        result.errors.push({
          admin_id: adminId,
          error: '2FA cannot be bulk enabled. Each admin must set it up individually.'
        })
        continue
      }

      // Bulk disable 2FA
      const { error: updateError } = await supabase
        .from('admins')
        .update({
          two_factor_enabled: false,
          two_factor_secret: null,
          two_factor_backup_codes: null,
          two_factor_enabled_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', adminId)

      if (updateError) throw updateError

      // Revoke trusted devices
      await supabase
        .from('admin_trusted_devices')
        .update({ is_active: false })
        .eq('admin_id', adminId)

      // Create audit log
      await supabase.rpc('create_admin_audit_log', {
        p_admin_id: adminId,
        p_action_type: 'security_2fa_disabled',
        p_action_description: `2FA disabled (bulk operation)${reason ? ` - Reason: ${reason}` : ''}`,
        p_changes: JSON.stringify({
          two_factor_enabled: false,
          reason: reason || 'Bulk operation'
        }),
        p_performed_by: updatedBy,
        p_ip_address: 'bulk_operation',
        p_user_agent: 'bulk_operation'
      })

      result.processed++
    } catch (error: unknown) {
      result.failed++
      result.errors.push({
        admin_id: adminId,
        error: error.message
      })
    }
  }

  result.success = result.failed === 0

  return result
}

/**
 * Bulk delete admins (soft delete)
 */
export async function bulkDeleteAdmins(
  adminIds: string[],
  deletedBy: string,
  reason?: string
): Promise<BulkActionResult> {
  const supabase = createClientComponentClient()

  const result: BulkActionResult = {
    success: true,
    total: adminIds.length,
    processed: 0,
    failed: 0,
    errors: []
  }

  for (const adminId of adminIds) {
    try {
      const { data: admin } = await supabase
        .from('admins')
        .select('id, admin_unique_id, full_name')
        .eq('id', adminId)
        .maybeSingle()

      if (!admin) {
        result.failed++
        result.errors.push({
          admin_id: adminId,
          error: 'Admin not found'
        })
        continue
      }

      // Soft delete
      const { error: deleteError } = await supabase
        .from('admins')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: deletedBy,
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', adminId)

      if (deleteError) throw deleteError

      // Terminate all sessions
      await supabase
        .from('admin_sessions')
        .update({ is_active: false })
        .eq('admin_id', adminId)

      // Create audit log
      await supabase.rpc('create_admin_audit_log', {
        p_admin_id: adminId,
        p_action_type: 'admin_deleted',
        p_action_description: `Admin ${admin.admin_unique_id} (${admin.full_name}) was deleted (bulk operation)${reason ? ` - Reason: ${reason}` : ''}`,
        p_changes: JSON.stringify({
          is_deleted: true,
          reason: reason || 'Bulk deletion'
        }),
        p_performed_by: deletedBy,
        p_ip_address: 'bulk_operation',
        p_user_agent: 'bulk_operation'
      })

      result.processed++
    } catch (error: unknown) {
      result.failed++
      result.errors.push({
        admin_id: adminId,
        error: error.message
      })
    }
  }

  result.success = result.failed === 0

  return result
}

/**
 * Bulk assign modules to admins
 */
export async function bulkAssignModules(
  adminIds: string[],
  moduleKeys: string[],
  isEnabled: boolean,
  assignedBy: string
): Promise<BulkActionResult> {
  const supabase = createClientComponentClient()

  const result: BulkActionResult = {
    success: true,
    total: adminIds.length * moduleKeys.length,
    processed: 0,
    failed: 0,
    errors: []
  }

  for (const adminId of adminIds) {
    for (const moduleKey of moduleKeys) {
      try {
        // Get module details
        const { data: module } = await supabase
          .from('system_modules')
          .select('module_name')
          .eq('module_key', moduleKey)
          .maybeSingle()

        if (!module) {
          result.failed++
          result.errors.push({
            admin_id: `${adminId}-${moduleKey}`,
            error: `Module ${moduleKey} not found`
          })
          continue
        }

        // Check existing permission
        const { data: existing } = await supabase
          .from('admin_module_permissions')
          .select('id')
          .eq('admin_id', adminId)
          .eq('module_key', moduleKey)
          .maybeSingle()

        if (existing) {
          // Update existing
          await supabase
            .from('admin_module_permissions')
            .update({
              is_enabled: isEnabled,
              modified_at: new Date().toISOString(),
              modified_by: assignedBy
            })
            .eq('id', existing.id)
        } else {
          // Insert new
          await supabase
            .from('admin_module_permissions')
            .insert({
              admin_id: adminId,
              module_key: moduleKey,
              module_name: module.module_name,
              is_enabled: isEnabled,
              granted_by: assignedBy,
              modified_by: assignedBy
            })
        }

        result.processed++
      } catch (error: unknown) {
        result.failed++
        result.errors.push({
          admin_id: `${adminId}-${moduleKey}`,
          error: error.message
        })
      }
    }
  }

  result.success = result.failed === 0

  return result
}

/**
 * Generate CSV template for bulk import
 */
export function generateImportTemplate(): string {
  const headers = [
    'full_name',
    'email',
    'mobile_number',
    'location',
    'status',
    'modules'
  ]

  const exampleRows = [
    [
      'John Doe',
      'john.doe@example.com',
      '+1234567890',
      'New York',
      'active',
      'dashboard;users;reports'
    ],
    [
      'Jane Smith',
      'jane.smith@example.com',
      '+0987654321',
      'London',
      'active',
      'dashboard;analytics'
    ]
  ]

  const csvRows = [headers.join(',')]
  exampleRows.forEach(row => {
    csvRows.push(row.map(val => `"${val}"`).join(','))
  })

  return csvRows.join('\n')
}
