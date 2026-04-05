import { z } from 'zod';

// =====================================================
// HIERARCHY MANAGEMENT VALIDATION SCHEMAS
// =====================================================

// Department Schemas
export const createDepartmentSchema = z.object({
  name: z.string().min(2, 'Department name must be at least 2 characters').max(255),
  code: z.string().min(2).max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  parent_department_id: z.string().uuid().optional().nullable(),
  head_of_department: z.string().uuid().optional().nullable(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

// Organizational Role Schemas
export const createOrganizationalRoleSchema = z.object({
  role_name: z.string().min(2).max(255),
  role_code: z.string().min(2).max(50),
  department_id: z.string().uuid().optional().nullable(),
  parent_role_id: z.string().uuid().optional().nullable(),
  level: z.number().int().min(1).max(10).default(1),
  level_code: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  responsibilities: z.array(z.string()).default([]),
  duties_tasks: z.array(z.string()).default([]),
  requires_approval: z.boolean().default(false),
  can_approve_leaves: z.boolean().default(false),
  can_approve_attendance: z.boolean().default(false),
  max_reportees: z.number().int().positive().optional().nullable(),
});

export const updateOrganizationalRoleSchema = createOrganizationalRoleSchema.partial();

// Sub-Role Schemas
export const createSubRoleSchema = z.object({
  parent_role_id: z.string().uuid(),
  sub_role_name: z.string().min(2).max(255),
  sub_role_code: z.string().min(2).max(50),
  description: z.string().optional().nullable(),
  specialization: z.string().max(255).optional().nullable(),
  responsibilities: z.array(z.string()).default([]),
});

export const updateSubRoleSchema = createSubRoleSchema.partial().omit({ parent_role_id: true });

// KRI Schema
export const createKRISchema = z.object({
  role_id: z.string().uuid().optional().nullable(),
  sub_role_id: z.string().uuid().optional().nullable(),
  kri_name: z.string().min(2).max(255),
  kri_description: z.string().optional().nullable(),
  measurement_criteria: z.string().optional().nullable(),
  target_value: z.number().optional().nullable(),
  weightage: z.number().min(0).max(100).optional().nullable(),
  measurement_frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
}).refine(
  (data) => (data.role_id !== null && data.sub_role_id === null) ||
            (data.role_id === null && data.sub_role_id !== null),
  { message: 'Either role_id or sub_role_id must be provided, but not both' }
);

export const updateKRISchema = createKRISchema.partial();

// KPI Schema
export const createKPISchema = z.object({
  role_id: z.string().uuid().optional().nullable(),
  sub_role_id: z.string().uuid().optional().nullable(),
  kpi_name: z.string().min(2).max(255),
  kpi_description: z.string().optional().nullable(),
  measurement_unit: z.string().max(100).optional().nullable(),
  target_monthly: z.number().optional().nullable(),
  target_quarterly: z.number().optional().nullable(),
  target_yearly: z.number().optional().nullable(),
  threshold_excellent: z.number().optional().nullable(),
  threshold_good: z.number().optional().nullable(),
  threshold_acceptable: z.number().optional().nullable(),
  weightage: z.number().min(0).max(100).optional().nullable(),
}).refine(
  (data) => (data.role_id !== null && data.sub_role_id === null) ||
            (data.role_id === null && data.sub_role_id !== null),
  { message: 'Either role_id or sub_role_id must be provided, but not both' }
);

export const updateKPISchema = createKPISchema.partial();

// Role Target Schema
export const createRoleTargetSchema = z.object({
  role_id: z.string().uuid().optional().nullable(),
  sub_role_id: z.string().uuid().optional().nullable(),
  target_name: z.string().min(2).max(255),
  target_description: z.string().optional().nullable(),
  target_type: z.enum(['revenue', 'volume', 'quality', 'efficiency', 'customer_satisfaction']),
  target_monthly: z.number().optional().nullable(),
  target_quarterly: z.number().optional().nullable(),
  target_yearly: z.number().optional().nullable(),
  measurement_unit: z.string().max(100).optional().nullable(),
  financial_year: z.number().int().min(2020).max(2100).optional().nullable(),
  quarter: z.enum([1, 2, 3, 4]).optional().nullable(),
}).refine(
  (data) => (data.role_id !== null && data.sub_role_id === null) ||
            (data.role_id === null && data.sub_role_id !== null),
  { message: 'Either role_id or sub_role_id must be provided, but not both' }
);

export const updateRoleTargetSchema = createRoleTargetSchema.partial();

// Role Location Mapping Schema
export const createRoleLocationMappingSchema = z.object({
  role_id: z.string().uuid().optional().nullable(),
  sub_role_id: z.string().uuid().optional().nullable(),
  location_name: z.string().min(2).max(255),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  region: z.string().max(100).optional().nullable(),
  is_primary: z.boolean().default(false),
}).refine(
  (data) => (data.role_id !== null && data.sub_role_id === null) ||
            (data.role_id === null && data.sub_role_id !== null),
  { message: 'Either role_id or sub_role_id must be provided, but not both' }
);

export const updateRoleLocationMappingSchema = createRoleLocationMappingSchema.partial();

// Role Loan Type Mapping Schema
export const loanTypeEnum = z.enum([
  'HOME_LOAN',
  'PERSONAL_LOAN',
  'BUSINESS_LOAN',
  'CAR_LOAN',
  'EDUCATION_LOAN',
  'GOLD_LOAN',
  'PROPERTY_LOAN',
  'OTHERS'
]);

export const createRoleLoanTypeMappingSchema = z.object({
  role_id: z.string().uuid().optional().nullable(),
  sub_role_id: z.string().uuid().optional().nullable(),
  loan_type: loanTypeEnum,
  can_originate: z.boolean().default(true),
  can_process: z.boolean().default(true),
  can_approve: z.boolean().default(false),
  approval_limit: z.number().optional().nullable(),
}).refine(
  (data) => (data.role_id !== null && data.sub_role_id === null) ||
            (data.role_id === null && data.sub_role_id !== null),
  { message: 'Either role_id or sub_role_id must be provided, but not both' }
);

export const updateRoleLoanTypeMappingSchema = createRoleLoanTypeMappingSchema.partial();

// Reporting Structure Schema
export const createReportingStructureSchema = z.object({
  role_id: z.string().uuid(),
  reports_to_role_id: z.string().uuid().optional().nullable(),
  reporting_level: z.number().int().min(1).default(1),
  is_dotted_line: z.boolean().default(false),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const updateReportingStructureSchema = createReportingStructureSchema.partial().omit({ role_id: true });

// Hierarchy Version Schema
export const publishHierarchyVersionSchema = z.object({
  version_name: z.string().min(2).max(255).optional().nullable(),
  description: z.string().optional().nullable(),
});

// Query Parameter Schemas
export const getDepartmentsQuerySchema = z.object({
  include_inactive: z.string().transform(val => val === 'true').optional(),
});

export const getRolesQuerySchema = z.object({
  department_id: z.string().uuid().optional(),
  level: z.string().transform(val => parseInt(val, 10)).optional(),
  include_inactive: z.string().transform(val => val === 'true').optional(),
  include_kpis: z.string().transform(val => val === 'true').optional(),
  include_kris: z.string().transform(val => val === 'true').optional(),
});

export const getSubRolesQuerySchema = z.object({
  parent_role_id: z.string().uuid().optional(),
  include_inactive: z.string().transform(val => val === 'true').optional(),
});

export const getKPIsQuerySchema = z.object({
  role_id: z.string().uuid().optional(),
  sub_role_id: z.string().uuid().optional(),
});

export const getKRIsQuerySchema = z.object({
  role_id: z.string().uuid().optional(),
  sub_role_id: z.string().uuid().optional(),
});

export const getTargetsQuerySchema = z.object({
  role_id: z.string().uuid().optional(),
  sub_role_id: z.string().uuid().optional(),
  financial_year: z.string().transform(val => parseInt(val, 10)).optional(),
  quarter: z.string().transform(val => parseInt(val, 10)).optional(),
});

export const getChangeLogQuerySchema = z.object({
  entity_type: z.enum([
    'department',
    'role',
    'sub_role',
    'kri',
    'kpi',
    'target',
    'location_mapping',
    'loan_type_mapping',
    'reporting_structure'
  ]).optional(),
  entity_id: z.string().uuid().optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  changed_by: z.string().uuid().optional(),
  limit: z.string().transform(val => parseInt(val, 10)).default('50'),
  offset: z.string().transform(val => parseInt(val, 10)).default('0'),
});

// Type exports for TypeScript inference
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type CreateOrganizationalRoleInput = z.infer<typeof createOrganizationalRoleSchema>;
export type UpdateOrganizationalRoleInput = z.infer<typeof updateOrganizationalRoleSchema>;
export type CreateSubRoleInput = z.infer<typeof createSubRoleSchema>;
export type UpdateSubRoleInput = z.infer<typeof updateSubRoleSchema>;
export type CreateKRIInput = z.infer<typeof createKRISchema>;
export type UpdateKRIInput = z.infer<typeof updateKRISchema>;
export type CreateKPIInput = z.infer<typeof createKPISchema>;
export type UpdateKPIInput = z.infer<typeof updateKPISchema>;
export type CreateRoleTargetInput = z.infer<typeof createRoleTargetSchema>;
export type UpdateRoleTargetInput = z.infer<typeof updateRoleTargetSchema>;
export type CreateRoleLocationMappingInput = z.infer<typeof createRoleLocationMappingSchema>;
export type UpdateRoleLocationMappingInput = z.infer<typeof updateRoleLocationMappingSchema>;
export type CreateRoleLoanTypeMappingInput = z.infer<typeof createRoleLoanTypeMappingSchema>;
export type UpdateRoleLoanTypeMappingInput = z.infer<typeof updateRoleLoanTypeMappingSchema>;
export type CreateReportingStructureInput = z.infer<typeof createReportingStructureSchema>;
export type UpdateReportingStructureInput = z.infer<typeof updateReportingStructureSchema>;
export type PublishHierarchyVersionInput = z.infer<typeof publishHierarchyVersionSchema>;
