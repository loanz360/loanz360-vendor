// =====================================================
// HIERARCHY MANAGEMENT TYPES
// =====================================================

export interface Department {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  parent_department_id: string | null;
  head_of_department: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface DepartmentWithRelations extends Department {
  parent_department?: Department | null;
  head?: {
    id: string;
    name: string;
    email: string;
  } | null;
  sub_departments?: Department[];
}

export interface OrganizationalRole {
  id: string;
  role_name: string;
  role_code: string;
  department_id: string | null;
  parent_role_id: string | null;
  level: number;
  level_code: string | null;
  description: string | null;
  responsibilities: string[];
  duties_tasks: string[];
  is_active: boolean;
  requires_approval: boolean;
  can_approve_leaves: boolean;
  can_approve_attendance: boolean;
  max_reportees: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface OrganizationalRoleWithRelations extends OrganizationalRole {
  department?: Department | null;
  parent_role?: OrganizationalRole | null;
  sub_roles?: OrganizationalSubRole[];
  kpis?: RoleKPI[];
  kris?: RoleKRI[];
  targets?: RoleTarget[];
  location_mappings?: RoleLocationMapping[];
  loan_type_mappings?: RoleLoanTypeMapping[];
}

export interface OrganizationalSubRole {
  id: string;
  parent_role_id: string;
  sub_role_name: string;
  sub_role_code: string;
  description: string | null;
  specialization: string | null;
  responsibilities: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface OrganizationalSubRoleWithRelations extends OrganizationalSubRole {
  parent_role?: OrganizationalRole;
}

export interface RoleKRI {
  id: string;
  role_id: string | null;
  sub_role_id: string | null;
  kri_name: string;
  kri_description: string | null;
  measurement_criteria: string | null;
  target_value: number | null;
  weightage: number | null;
  measurement_frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  is_active: boolean;
  created_at: string;
  updated_by: string | null;
}

export interface RoleKPI {
  id: string;
  role_id: string | null;
  sub_role_id: string | null;
  kpi_name: string;
  kpi_description: string | null;
  measurement_unit: string | null;
  target_monthly: number | null;
  target_quarterly: number | null;
  target_yearly: number | null;
  threshold_excellent: number | null;
  threshold_good: number | null;
  threshold_acceptable: number | null;
  weightage: number | null;
  is_active: boolean;
  created_at: string;
  updated_by: string | null;
}

export interface RoleTarget {
  id: string;
  role_id: string | null;
  sub_role_id: string | null;
  target_name: string;
  target_description: string | null;
  target_type: 'revenue' | 'volume' | 'quality' | 'efficiency' | 'customer_satisfaction';
  target_monthly: number | null;
  target_quarterly: number | null;
  target_yearly: number | null;
  measurement_unit: string | null;
  financial_year: number | null;
  quarter: 1 | 2 | 3 | 4 | null;
  is_active: boolean;
  created_at: string;
  updated_by: string | null;
}

export interface RoleLocationMapping {
  id: string;
  role_id: string | null;
  sub_role_id: string | null;
  location_name: string;
  city: string | null;
  state: string | null;
  region: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
}

export interface RoleLoanTypeMapping {
  id: string;
  role_id: string | null;
  sub_role_id: string | null;
  loan_type: string;
  can_originate: boolean;
  can_process: boolean;
  can_approve: boolean;
  approval_limit: number | null;
  is_active: boolean;
  created_at: string;
}

export interface OrganizationalReportingStructure {
  id: string;
  role_id: string;
  reports_to_role_id: string | null;
  reporting_level: number;
  is_dotted_line: boolean;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_by: string | null;
}

export interface ReportingStructureWithRelations extends OrganizationalReportingStructure {
  role?: OrganizationalRole;
  reports_to_role?: OrganizationalRole | null;
}

export interface HierarchyVersion {
  id: string;
  version_number: number;
  version_name: string | null;
  description: string | null;
  hierarchy_snapshot: unknown  is_published: boolean;
  published_at: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  published_by: string | null;
}

export interface HierarchyChangeLog {
  id: string;
  entity_type: 'department' | 'role' | 'sub_role' | 'kri' | 'kpi' | 'target' | 'location_mapping' | 'loan_type_mapping' | 'reporting_structure';
  entity_id: string;
  action: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated';
  old_values: unknown | null;
  new_values: unknown | null;
  changed_by: string | null;
  changed_at: string;
  change_reason: string | null;
}

export interface HierarchyChangeLogWithUser extends HierarchyChangeLog {
  changed_by_user?: {
    id: string;
    name: string;
    email: string;
  };
}

// Hierarchy Tree Structure
export interface HierarchyNode {
  role: OrganizationalRoleWithRelations;
  reports_to?: HierarchyNode | null;
  reportees: HierarchyNode[];
  level: number;
}
