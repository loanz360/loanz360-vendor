/**
 * Column-Level Security Helper
 * Filters sensitive columns from API responses based on the requesting user's role.
 * Complements data-masking.ts (which masks values) by controlling column visibility entirely.
 */

type UserRole = 'super_admin' | 'admin' | 'hr_manager' | 'hr_executive' | 'employee' | 'manager'

interface ColumnPolicy {
  /** Columns visible to all authenticated users */
  public: string[]
  /** Columns visible to HR and above */
  hr: string[]
  /** Columns visible only to admin/super_admin */
  admin: string[]
  /** Columns visible only to the record owner */
  self: string[]
}

const HR_ROLES: UserRole[] = ['super_admin', 'admin', 'hr_manager', 'hr_executive']
const ADMIN_ROLES: UserRole[] = ['super_admin', 'admin']

const EMPLOYEE_COLUMNS: ColumnPolicy = {
  public: [
    'id', 'employee_id', 'full_name', 'email', 'department', 'designation',
    'date_of_joining', 'employment_status', 'profile_photo_url', 'reporting_manager_id',
  ],
  hr: [
    'phone', 'emergency_contact', 'address', 'blood_group', 'date_of_birth',
    'gender', 'marital_status', 'probation_end_date', 'shift_id',
    'employment_type', 'work_location', 'sub_role',
  ],
  admin: [
    'pan_number', 'aadhar_number', 'bank_account_number', 'bank_ifsc',
    'bank_name', 'salary_ctc', 'salary_basic', 'salary_hra',
    'pf_number', 'esi_number', 'uan_number',
  ],
  self: [
    'pan_number', 'aadhar_number', 'bank_account_number', 'bank_ifsc',
    'bank_name', 'salary_ctc', 'salary_basic', 'salary_hra',
    'pf_number', 'esi_number', 'uan_number',
    'phone', 'emergency_contact', 'address', 'blood_group', 'date_of_birth',
    'gender', 'marital_status',
  ],
}

export function getAllowedColumns(
  userRole: UserRole,
  isOwnRecord: boolean,
  entity: 'employee' = 'employee'
): string[] {
  const policy = entity === 'employee' ? EMPLOYEE_COLUMNS : EMPLOYEE_COLUMNS

  const columns = [...policy.public]

  if (isOwnRecord) {
    columns.push(...policy.self)
  }

  if (HR_ROLES.includes(userRole)) {
    columns.push(...policy.hr)
  }

  if (ADMIN_ROLES.includes(userRole)) {
    columns.push(...policy.admin)
  }

  // Return unique columns
  return Array.from(new Set(columns))
}

export function filterRecord<T extends Record<string, unknown>>(
  record: T,
  allowedColumns: string[]
): Partial<T> {
  const filtered: Record<string, unknown> = {}
  for (const col of allowedColumns) {
    if (col in record) {
      filtered[col] = record[col]
    }
  }
  return filtered as Partial<T>
}

export function filterRecords<T extends Record<string, unknown>>(
  records: T[],
  allowedColumns: string[]
): Partial<T>[] {
  return records.map(record => filterRecord(record, allowedColumns))
}

export type { UserRole, ColumnPolicy }
