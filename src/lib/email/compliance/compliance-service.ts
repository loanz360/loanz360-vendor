/**
 * Email Compliance Service
 * Enterprise-grade compliance and governance features
 *
 * Features:
 * - Legal holds for litigation
 * - Retention policies
 * - eDiscovery support
 * - Compliance reporting
 * - Audit trail
 */

import { createSupabaseAdmin } from '@/lib/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

export type LegalHoldStatus = 'active' | 'released' | 'expired';
export type LegalHoldType = 'in_place' | 'preservation' | 'litigation';

export interface LegalHold {
  id: string;
  matterName: string;
  matterId?: string;
  description?: string;
  holdType: LegalHoldType;
  custodianAccountIds: string[];
  custodianEmails?: string[];
  contentStartDate?: Date;
  contentEndDate?: Date;
  status: LegalHoldStatus;
  legalCounsel?: string;
  internalNotes?: string;
  holdPlacedAt: Date;
  holdReleasedAt?: Date;
  createdBy: string;
  releasedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type RetentionAction = 'archive' | 'delete' | 'move';
export type RetentionScope = 'organization' | 'department' | 'role' | 'account';

export interface RetentionPolicy {
  id: string;
  policyName: string;
  description?: string;
  scopeType: RetentionScope;
  scopeIds?: string[];
  retentionPeriodDays: number;
  retentionAction: RetentionAction;
  applyToFolders: string[];
  excludeLabels?: string[];
  isActive: boolean;
  priority: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceReport {
  id: string;
  reportType: string;
  reportName: string;
  parameters?: Record<string, unknown>;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  resultUrl?: string;
  errorMessage?: string;
  generatedBy: string;
  generatedAt?: Date;
  createdAt: Date;
}

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string;
  performedByEmail?: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================================
// CREATE PARAMS
// ============================================================================

export interface CreateLegalHoldParams {
  matterName: string;
  matterId?: string;
  description?: string;
  holdType: LegalHoldType;
  custodianAccountIds: string[];
  contentStartDate?: Date;
  contentEndDate?: Date;
  legalCounsel?: string;
  internalNotes?: string;
}

export interface CreateRetentionPolicyParams {
  policyName: string;
  description?: string;
  scopeType: RetentionScope;
  scopeIds?: string[];
  retentionPeriodDays: number;
  retentionAction: RetentionAction;
  applyToFolders?: string[];
  excludeLabels?: string[];
  priority?: number;
}

// ============================================================================
// COMPLIANCE SERVICE
// ============================================================================

export class ComplianceService {
  private supabase = createSupabaseAdmin();

  // ============================================================================
  // LEGAL HOLDS
  // ============================================================================

  /**
   * Create a legal hold
   */
  async createLegalHold(
    params: CreateLegalHoldParams,
    createdBy: string
  ): Promise<{ success: boolean; holdId?: string; error?: string }> {
    try {
      // Validate custodians exist
      if (!params.custodianAccountIds || params.custodianAccountIds.length === 0) {
        return { success: false, error: 'At least one custodian is required' };
      }

      const { data, error } = await this.supabase
        .from('email_legal_holds')
        .insert({
          matter_name: params.matterName,
          matter_id: params.matterId,
          description: params.description,
          hold_type: params.holdType,
          custodian_account_ids: params.custodianAccountIds,
          content_start_date: params.contentStartDate?.toISOString(),
          content_end_date: params.contentEndDate?.toISOString(),
          status: 'active',
          legal_counsel: params.legalCounsel,
          internal_notes: params.internalNotes,
          hold_placed_at: new Date().toISOString(),
          created_by: createdBy,
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[ComplianceService] Error creating legal hold:', error);
        return { success: false, error: 'Failed to create legal hold' };
      }

      // Apply hold to all custodian accounts
      for (const accountId of params.custodianAccountIds) {
        await this.supabase
          .from('email_accounts')
          .update({
            legal_hold_applied: true,
            compliance_flags: {
              legal_hold_matter_id: params.matterId || data.id,
              legal_hold_applied_at: new Date().toISOString(),
              legal_hold_applied_by: createdBy,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', accountId);

        // Log lifecycle event
        await this.supabase.from('email_account_lifecycle_events').insert({
          email_account_id: accountId,
          event_type: 'legal_hold_applied',
          triggered_by: 'admin',
          triggered_by_user_id: createdBy,
          metadata: { holdId: data.id, matterName: params.matterName },
        });
      }

      // Log audit entry
      await this.logAuditEntry({
        entityType: 'legal_hold',
        entityId: data.id,
        action: 'created',
        performedBy: createdBy,
        newValues: params,
      });

      return { success: true, holdId: data.id };
    } catch (error) {
      console.error('[ComplianceService] Error creating legal hold:', error);
      return { success: false, error: 'Failed to create legal hold' };
    }
  }

  /**
   * Get all legal holds
   */
  async getLegalHolds(options?: {
    status?: LegalHoldStatus;
    accountId?: string;
  }): Promise<LegalHold[]> {
    let query = this.supabase
      .from('email_legal_holds')
      .select('*')
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.accountId) {
      query = query.contains('custodian_account_ids', [options.accountId]);
    }

    const { data } = await query;
    return (data || []).map(this.mapDbToLegalHold);
  }

  /**
   * Get legal hold by ID
   */
  async getLegalHoldById(holdId: string): Promise<LegalHold | null> {
    const { data } = await this.supabase
      .from('email_legal_holds')
      .select('*')
      .eq('id', holdId)
      .maybeSingle();

    if (!data) return null;
    return this.mapDbToLegalHold(data);
  }

  /**
   * Release a legal hold
   */
  async releaseLegalHold(
    holdId: string,
    releasedBy: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const hold = await this.getLegalHoldById(holdId);
      if (!hold) {
        return { success: false, error: 'Legal hold not found' };
      }

      if (hold.status !== 'active') {
        return { success: false, error: 'Legal hold is not active' };
      }

      // Update hold status
      const { error } = await this.supabase
        .from('email_legal_holds')
        .update({
          status: 'released',
          hold_released_at: new Date().toISOString(),
          released_by: releasedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('id', holdId);

      if (error) {
        return { success: false, error: 'Failed to release legal hold' };
      }

      // Check if custodians have any other active holds
      for (const accountId of hold.custodianAccountIds) {
        const { data: otherHolds } = await this.supabase
          .from('email_legal_holds')
          .select('id')
          .eq('status', 'active')
          .contains('custodian_account_ids', [accountId])
          .neq('id', holdId);

        if (!otherHolds || otherHolds.length === 0) {
          // No other active holds, release the account
          await this.supabase
            .from('email_accounts')
            .update({
              legal_hold_applied: false,
              compliance_flags: {
                legal_hold_released_at: new Date().toISOString(),
                legal_hold_released_by: releasedBy,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', accountId);

          // Log lifecycle event
          await this.supabase.from('email_account_lifecycle_events').insert({
            email_account_id: accountId,
            event_type: 'legal_hold_released',
            triggered_by: 'admin',
            triggered_by_user_id: releasedBy,
            reason,
            metadata: { holdId, matterName: hold.matterName },
          });
        }
      }

      // Log audit entry
      await this.logAuditEntry({
        entityType: 'legal_hold',
        entityId: holdId,
        action: 'released',
        performedBy: releasedBy,
        previousValues: { status: 'active' },
        newValues: { status: 'released', reason },
      });

      return { success: true };
    } catch (error) {
      console.error('[ComplianceService] Error releasing legal hold:', error);
      return { success: false, error: 'Failed to release legal hold' };
    }
  }

  /**
   * Add custodian to legal hold
   */
  async addCustodian(
    holdId: string,
    accountId: string,
    addedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const hold = await this.getLegalHoldById(holdId);
      if (!hold) {
        return { success: false, error: 'Legal hold not found' };
      }

      if (hold.custodianAccountIds.includes(accountId)) {
        return { success: false, error: 'Account is already a custodian' };
      }

      const newCustodians = [...hold.custodianAccountIds, accountId];

      const { error } = await this.supabase
        .from('email_legal_holds')
        .update({
          custodian_account_ids: newCustodians,
          updated_at: new Date().toISOString(),
        })
        .eq('id', holdId);

      if (error) {
        return { success: false, error: 'Failed to add custodian' };
      }

      // Apply hold to account
      await this.supabase
        .from('email_accounts')
        .update({
          legal_hold_applied: true,
          compliance_flags: {
            legal_hold_matter_id: hold.matterId || holdId,
            legal_hold_applied_at: new Date().toISOString(),
            legal_hold_applied_by: addedBy,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', accountId);

      return { success: true };
    } catch (error) {
      console.error('[ComplianceService] Error adding custodian:', error);
      return { success: false, error: 'Failed to add custodian' };
    }
  }

  // ============================================================================
  // RETENTION POLICIES
  // ============================================================================

  /**
   * Create a retention policy
   */
  async createRetentionPolicy(
    params: CreateRetentionPolicyParams,
    createdBy: string
  ): Promise<{ success: boolean; policyId?: string; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('email_retention_policies')
        .insert({
          policy_name: params.policyName,
          description: params.description,
          scope_type: params.scopeType,
          scope_ids: params.scopeIds,
          retention_period_days: params.retentionPeriodDays,
          retention_action: params.retentionAction,
          apply_to_folders: params.applyToFolders || ['all'],
          exclude_labels: params.excludeLabels,
          is_active: true,
          priority: params.priority || 100,
          created_by: createdBy,
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[ComplianceService] Error creating retention policy:', error);
        return { success: false, error: 'Failed to create retention policy' };
      }

      await this.logAuditEntry({
        entityType: 'retention_policy',
        entityId: data.id,
        action: 'created',
        performedBy: createdBy,
        newValues: params,
      });

      return { success: true, policyId: data.id };
    } catch (error) {
      console.error('[ComplianceService] Error creating retention policy:', error);
      return { success: false, error: 'Failed to create retention policy' };
    }
  }

  /**
   * Get all retention policies
   */
  async getRetentionPolicies(options?: {
    scopeType?: RetentionScope;
    isActive?: boolean;
  }): Promise<RetentionPolicy[]> {
    let query = this.supabase
      .from('email_retention_policies')
      .select('*')
      .order('priority');

    if (options?.scopeType) {
      query = query.eq('scope_type', options.scopeType);
    }
    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    const { data } = await query;
    return (data || []).map(this.mapDbToRetentionPolicy);
  }

  /**
   * Get effective retention policy for an account
   */
  async getEffectiveRetentionPolicy(accountId: string): Promise<RetentionPolicy | null> {
    // Get account details
    const { data: account } = await this.supabase
      .from('email_accounts')
      .select(`
        id,
        employee_profile:employee_profile_id (
          department,
          designation
        )
      `)
      .eq('id', accountId)
      .maybeSingle();

    if (!account) return null;

    // Check for account-specific policy
    const { data: accountPolicy } = await this.supabase
      .from('email_retention_policies')
      .select('*')
      .eq('scope_type', 'account')
      .contains('scope_ids', [accountId])
      .eq('is_active', true)
      .order('priority')
      .limit(1)
      .maybeSingle();

    if (accountPolicy) {
      return this.mapDbToRetentionPolicy(accountPolicy);
    }

    // Check for department policy
    const department = account.employee_profile?.department;
    if (department) {
      const { data: deptPolicy } = await this.supabase
        .from('email_retention_policies')
        .select('*')
        .eq('scope_type', 'department')
        .eq('is_active', true)
        .order('priority')
        .limit(1)
        .maybeSingle();

      if (deptPolicy) {
        return this.mapDbToRetentionPolicy(deptPolicy);
      }
    }

    // Return organization-wide policy
    const { data: orgPolicy } = await this.supabase
      .from('email_retention_policies')
      .select('*')
      .eq('scope_type', 'organization')
      .eq('is_active', true)
      .order('priority')
      .limit(1)
      .maybeSingle();

    if (orgPolicy) {
      return this.mapDbToRetentionPolicy(orgPolicy);
    }

    return null;
  }

  /**
   * Update retention policy
   */
  async updateRetentionPolicy(
    policyId: string,
    updates: Partial<CreateRetentionPolicyParams>,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.policyName !== undefined) updateData.policy_name = updates.policyName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.retentionPeriodDays !== undefined) updateData.retention_period_days = updates.retentionPeriodDays;
      if (updates.retentionAction !== undefined) updateData.retention_action = updates.retentionAction;
      if (updates.applyToFolders !== undefined) updateData.apply_to_folders = updates.applyToFolders;
      if (updates.excludeLabels !== undefined) updateData.exclude_labels = updates.excludeLabels;
      if (updates.priority !== undefined) updateData.priority = updates.priority;

      const { error } = await this.supabase
        .from('email_retention_policies')
        .update(updateData)
        .eq('id', policyId);

      if (error) {
        return { success: false, error: 'Failed to update retention policy' };
      }

      return { success: true };
    } catch (error) {
      console.error('[ComplianceService] Error updating retention policy:', error);
      return { success: false, error: 'Failed to update retention policy' };
    }
  }

  // ============================================================================
  // COMPLIANCE REPORTING
  // ============================================================================

  /**
   * Get compliance summary
   */
  async getComplianceSummary(): Promise<{
    activeHolds: number;
    accountsUnderHold: number;
    activeRetentionPolicies: number;
    accountsWithOverdueRetention: number;
    recentAuditEvents: number;
  }> {
    const [
      holdsResult,
      policiesResult,
      auditResult,
    ] = await Promise.all([
      this.supabase
        .from('email_legal_holds')
        .select('id, custodian_account_ids')
        .eq('status', 'active'),
      this.supabase
        .from('email_retention_policies')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      this.supabase
        .from('email_account_lifecycle_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const activeHolds = holdsResult.data?.length || 0;
    const accountsUnderHold = new Set(
      holdsResult.data?.flatMap(h => h.custodian_account_ids) || []
    ).size;

    return {
      activeHolds,
      accountsUnderHold,
      activeRetentionPolicies: policiesResult.count || 0,
      accountsWithOverdueRetention: 0, // Would need to calculate based on retention rules
      recentAuditEvents: auditResult.count || 0,
    };
  }

  // ============================================================================
  // AUDIT LOGGING
  // ============================================================================

  /**
   * Log an audit entry
   */
  async logAuditEntry(entry: {
    entityType: string;
    entityId: string;
    action: string;
    performedBy: string;
    previousValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      // Get performer's email
      const { data: user } = await this.supabase
        .from('user')
        .select('email')
        .eq('id', entry.performedBy)
        .maybeSingle();

      await this.supabase.from('email_account_lifecycle_events').insert({
        email_account_id: entry.entityType === 'email_account' ? entry.entityId : null,
        event_type: `audit_${entry.action}`,
        triggered_by: 'admin',
        triggered_by_user_id: entry.performedBy,
        metadata: {
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          performedByEmail: user?.email,
          previousValues: entry.previousValues,
          newValues: entry.newValues,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          ...entry.metadata,
        },
      });
    } catch (error) {
      console.error('[ComplianceService] Error logging audit entry:', error);
    }
  }

  /**
   * Get audit log
   */
  async getAuditLog(options?: {
    entityType?: string;
    entityId?: string;
    performedBy?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    let query = this.supabase
      .from('email_account_lifecycle_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options?.entityId) {
      query = query.eq('email_account_id', options.entityId);
    }
    if (options?.performedBy) {
      query = query.eq('triggered_by_user_id', options.performedBy);
    }
    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    const { data, count } = await query;

    const entries: AuditLogEntry[] = (data || []).map(d => ({
      id: d.id,
      entityType: d.metadata?.entityType || 'email_account',
      entityId: d.email_account_id || d.metadata?.entityId || '',
      action: d.event_type,
      performedBy: d.triggered_by_user_id || d.triggered_by,
      performedByEmail: d.metadata?.performedByEmail,
      previousValues: d.metadata?.previousValues,
      newValues: d.metadata?.newValues,
      ipAddress: d.metadata?.ipAddress,
      userAgent: d.metadata?.userAgent,
      metadata: d.metadata,
      createdAt: new Date(d.created_at),
    }));

    return { entries, total: count || 0 };
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapDbToLegalHold(data: Record<string, unknown>): LegalHold {
    return {
      id: data.id as string,
      matterName: data.matter_name as string,
      matterId: data.matter_id as string | undefined,
      description: data.description as string | undefined,
      holdType: data.hold_type as LegalHoldType,
      custodianAccountIds: (data.custodian_account_ids as string[]) || [],
      contentStartDate: data.content_start_date ? new Date(data.content_start_date as string) : undefined,
      contentEndDate: data.content_end_date ? new Date(data.content_end_date as string) : undefined,
      status: data.status as LegalHoldStatus,
      legalCounsel: data.legal_counsel as string | undefined,
      internalNotes: data.internal_notes as string | undefined,
      holdPlacedAt: new Date(data.hold_placed_at as string),
      holdReleasedAt: data.hold_released_at ? new Date(data.hold_released_at as string) : undefined,
      createdBy: data.created_by as string,
      releasedBy: data.released_by as string | undefined,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  private mapDbToRetentionPolicy(data: Record<string, unknown>): RetentionPolicy {
    return {
      id: data.id as string,
      policyName: data.policy_name as string,
      description: data.description as string | undefined,
      scopeType: data.scope_type as RetentionScope,
      scopeIds: data.scope_ids as string[] | undefined,
      retentionPeriodDays: data.retention_period_days as number,
      retentionAction: data.retention_action as RetentionAction,
      applyToFolders: (data.apply_to_folders as string[]) || ['all'],
      excludeLabels: data.exclude_labels as string[] | undefined,
      isActive: data.is_active as boolean,
      priority: data.priority as number,
      createdBy: data.created_by as string,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }
}

// Singleton
let complianceServiceInstance: ComplianceService | null = null;

export function getComplianceService(): ComplianceService {
  if (!complianceServiceInstance) {
    complianceServiceInstance = new ComplianceService();
  }
  return complianceServiceInstance;
}

export default ComplianceService;
