/**
 * Email Aliases & Shared Mailbox Service
 * Enterprise-grade alias and shared mailbox management
 *
 * Features:
 * - Email aliases (personal, department, distribution, catchall)
 * - Shared mailboxes with permission management
 * - Distribution lists (static and dynamic)
 * - Delegation and proxy access
 */

import { createSupabaseAdmin } from '@/lib/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

export type AliasType = 'personal' | 'department' | 'distribution' | 'catchall';

export interface EmailAlias {
  id: string;
  aliasAddress: string;
  aliasType: AliasType;
  displayName?: string;
  description?: string;
  emailAccountId?: string;
  departmentId?: string;
  forwardToAccounts: string[];
  forwardToExternal: string[];
  keepCopy: boolean;
  isActive: boolean;
  allowSendAs: boolean;
  autoReplyEnabled: boolean;
  autoReplyMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SharedMailboxType = 'shared' | 'room' | 'equipment' | 'team';
export type MailboxPermission = 'full_access' | 'send_as' | 'send_on_behalf' | 'read_only' | 'editor';

export interface SharedMailbox {
  id: string;
  emailAddress: string;
  displayName: string;
  mailboxType: SharedMailboxType;
  description?: string;
  departmentId?: string;
  ownerAccountId?: string;
  storageQuotaMb: number;
  storageUsedMb: number;
  isActive: boolean;
  autoMapping: boolean;
  sendAsEnabled: boolean;
  sendOnBehalfEnabled: boolean;
  allowBooking: boolean;
  bookingCapacity?: number;
  accessList: SharedMailboxAccess[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SharedMailboxAccess {
  id: string;
  mailboxId: string;
  emailAccountId: string;
  accountEmail?: string;
  permissionLevel: MailboxPermission;
  grantedBy?: string;
  grantedAt: Date;
  expiresAt?: Date;
}

export type DistributionListType = 'static' | 'dynamic' | 'security';

export interface DistributionList {
  id: string;
  emailAddress: string;
  displayName: string;
  listType: DistributionListType;
  description?: string;
  ownerAccountId?: string;
  departmentId?: string;
  moderationEnabled: boolean;
  moderatorAccountIds: string[];
  isActive: boolean;
  allowExternalSenders: boolean;
  hideFromGal: boolean;
  requireSenderAuthentication: boolean;
  sendDeliveryReports: boolean;
  dynamicFilter?: Record<string, unknown>;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type DelegationPermission =
  | 'read_email'
  | 'send_as'
  | 'send_on_behalf'
  | 'manage_calendar'
  | 'manage_contacts'
  | 'full_access';

export interface EmailDelegation {
  id: string;
  delegatorAccountId: string;
  delegatorEmail?: string;
  delegateAccountId: string;
  delegateEmail?: string;
  permissions: DelegationPermission[];
  validFrom: Date;
  validUntil?: Date;
  isActive: boolean;
  reason?: string;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CREATE PARAMS
// ============================================================================

export interface CreateAliasParams {
  aliasAddress: string;
  aliasType: AliasType;
  displayName?: string;
  description?: string;
  emailAccountId?: string;
  departmentId?: string;
  forwardToAccounts?: string[];
  forwardToExternal?: string[];
  keepCopy?: boolean;
  allowSendAs?: boolean;
}

export interface CreateSharedMailboxParams {
  emailAddress: string;
  displayName: string;
  mailboxType: SharedMailboxType;
  description?: string;
  departmentId?: string;
  ownerAccountId?: string;
  storageQuotaMb?: number;
  autoMapping?: boolean;
  allowBooking?: boolean;
  bookingCapacity?: number;
}

export interface CreateDistributionListParams {
  emailAddress: string;
  displayName: string;
  listType: DistributionListType;
  description?: string;
  ownerAccountId?: string;
  departmentId?: string;
  moderationEnabled?: boolean;
  moderatorAccountIds?: string[];
  allowExternalSenders?: boolean;
  dynamicFilter?: Record<string, unknown>;
}

export interface CreateDelegationParams {
  delegatorAccountId: string;
  delegateAccountId: string;
  permissions: DelegationPermission[];
  validFrom?: Date;
  validUntil?: Date;
  reason?: string;
}

// ============================================================================
// ALIAS SERVICE
// ============================================================================

export class AliasService {
  private supabase = createSupabaseAdmin();

  // ============================================================================
  // EMAIL ALIASES
  // ============================================================================

  /**
   * Create a new email alias
   */
  async createAlias(
    params: CreateAliasParams,
    createdBy: string
  ): Promise<{ success: boolean; aliasId?: string; error?: string }> {
    try {
      // Check if alias already exists
      const { data: existing } = await this.supabase
        .from('email_aliases')
        .select('id')
        .eq('alias_address', params.aliasAddress)
        .maybeSingle();

      if (existing) {
        return { success: false, error: 'Alias address already exists' };
      }

      const { data, error } = await this.supabase
        .from('email_aliases')
        .insert({
          alias_address: params.aliasAddress,
          alias_type: params.aliasType,
          display_name: params.displayName,
          description: params.description,
          email_account_id: params.emailAccountId,
          department_id: params.departmentId,
          forward_to_accounts: params.forwardToAccounts || [],
          forward_to_external: params.forwardToExternal || [],
          keep_copy: params.keepCopy ?? true,
          is_active: true,
          allow_send_as: params.allowSendAs ?? false,
          created_by: createdBy,
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[AliasService] Error creating alias:', error);
        return { success: false, error: 'Failed to create alias' };
      }

      return { success: true, aliasId: data.id };
    } catch (error) {
      console.error('[AliasService] Error creating alias:', error);
      return { success: false, error: 'Failed to create alias' };
    }
  }

  /**
   * Get all aliases
   */
  async getAliases(options?: {
    type?: AliasType;
    accountId?: string;
    isActive?: boolean;
  }): Promise<EmailAlias[]> {
    let query = this.supabase
      .from('email_aliases')
      .select('*')
      .order('alias_address');

    if (options?.type) {
      query = query.eq('alias_type', options.type);
    }
    if (options?.accountId) {
      query = query.eq('email_account_id', options.accountId);
    }
    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    const { data } = await query;
    return (data || []).map(this.mapDbToAlias);
  }

  /**
   * Get alias by ID
   */
  async getAliasById(aliasId: string): Promise<EmailAlias | null> {
    const { data } = await this.supabase
      .from('email_aliases')
      .select('*')
      .eq('id', aliasId)
      .maybeSingle();

    if (!data) return null;
    return this.mapDbToAlias(data);
  }

  /**
   * Update alias
   */
  async updateAlias(
    aliasId: string,
    updates: Partial<CreateAliasParams>,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.forwardToAccounts !== undefined) updateData.forward_to_accounts = updates.forwardToAccounts;
      if (updates.forwardToExternal !== undefined) updateData.forward_to_external = updates.forwardToExternal;
      if (updates.keepCopy !== undefined) updateData.keep_copy = updates.keepCopy;
      if (updates.allowSendAs !== undefined) updateData.allow_send_as = updates.allowSendAs;

      const { error } = await this.supabase
        .from('email_aliases')
        .update(updateData)
        .eq('id', aliasId);

      if (error) {
        return { success: false, error: 'Failed to update alias' };
      }

      return { success: true };
    } catch (error) {
      console.error('[AliasService] Error updating alias:', error);
      return { success: false, error: 'Failed to update alias' };
    }
  }

  /**
   * Delete alias
   */
  async deleteAlias(aliasId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('email_aliases')
      .delete()
      .eq('id', aliasId);

    if (error) {
      return { success: false, error: 'Failed to delete alias' };
    }

    return { success: true };
  }

  // ============================================================================
  // SHARED MAILBOXES
  // ============================================================================

  /**
   * Create a shared mailbox
   */
  async createSharedMailbox(
    params: CreateSharedMailboxParams,
    createdBy: string
  ): Promise<{ success: boolean; mailboxId?: string; error?: string }> {
    try {
      const { data: existing } = await this.supabase
        .from('email_shared_mailboxes')
        .select('id')
        .eq('email_address', params.emailAddress)
        .maybeSingle();

      if (existing) {
        return { success: false, error: 'Mailbox address already exists' };
      }

      const { data, error } = await this.supabase
        .from('email_shared_mailboxes')
        .insert({
          email_address: params.emailAddress,
          display_name: params.displayName,
          mailbox_type: params.mailboxType,
          description: params.description,
          department_id: params.departmentId,
          owner_account_id: params.ownerAccountId,
          storage_quota_mb: params.storageQuotaMb || 10240,
          storage_used_mb: 0,
          is_active: true,
          auto_mapping: params.autoMapping ?? false,
          send_as_enabled: true,
          send_on_behalf_enabled: true,
          allow_booking: params.allowBooking ?? false,
          booking_capacity: params.bookingCapacity,
          created_by: createdBy,
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[AliasService] Error creating shared mailbox:', error);
        return { success: false, error: 'Failed to create shared mailbox' };
      }

      return { success: true, mailboxId: data.id };
    } catch (error) {
      console.error('[AliasService] Error creating shared mailbox:', error);
      return { success: false, error: 'Failed to create shared mailbox' };
    }
  }

  /**
   * Get all shared mailboxes
   */
  async getSharedMailboxes(options?: {
    type?: SharedMailboxType;
    departmentId?: string;
    isActive?: boolean;
  }): Promise<SharedMailbox[]> {
    let query = this.supabase
      .from('email_shared_mailboxes')
      .select(`
        *,
        email_shared_mailbox_access (
          id,
          email_account_id,
          permission_level,
          granted_by,
          granted_at,
          expires_at
        )
      `)
      .order('display_name');

    if (options?.type) {
      query = query.eq('mailbox_type', options.type);
    }
    if (options?.departmentId) {
      query = query.eq('department_id', options.departmentId);
    }
    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    const { data } = await query;
    return (data || []).map(this.mapDbToSharedMailbox);
  }

  /**
   * Get shared mailbox by ID
   */
  async getSharedMailboxById(mailboxId: string): Promise<SharedMailbox | null> {
    const { data } = await this.supabase
      .from('email_shared_mailboxes')
      .select(`
        *,
        email_shared_mailbox_access (
          id,
          email_account_id,
          permission_level,
          granted_by,
          granted_at,
          expires_at
        )
      `)
      .eq('id', mailboxId)
      .maybeSingle();

    if (!data) return null;
    return this.mapDbToSharedMailbox(data);
  }

  /**
   * Grant access to shared mailbox
   */
  async grantMailboxAccess(
    mailboxId: string,
    accountId: string,
    permissionLevel: MailboxPermission,
    grantedBy: string,
    expiresAt?: Date
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('email_shared_mailbox_access')
        .upsert({
          mailbox_id: mailboxId,
          email_account_id: accountId,
          permission_level: permissionLevel,
          granted_by: grantedBy,
          granted_at: new Date().toISOString(),
          expires_at: expiresAt?.toISOString(),
        }, {
          onConflict: 'mailbox_id,email_account_id',
        });

      if (error) {
        return { success: false, error: 'Failed to grant access' };
      }

      return { success: true };
    } catch (error) {
      console.error('[AliasService] Error granting mailbox access:', error);
      return { success: false, error: 'Failed to grant access' };
    }
  }

  /**
   * Revoke mailbox access
   */
  async revokeMailboxAccess(
    mailboxId: string,
    accountId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('email_shared_mailbox_access')
      .delete()
      .eq('mailbox_id', mailboxId)
      .eq('email_account_id', accountId);

    if (error) {
      return { success: false, error: 'Failed to revoke access' };
    }

    return { success: true };
  }

  // ============================================================================
  // DISTRIBUTION LISTS
  // ============================================================================

  /**
   * Create a distribution list
   */
  async createDistributionList(
    params: CreateDistributionListParams,
    createdBy: string
  ): Promise<{ success: boolean; listId?: string; error?: string }> {
    try {
      const { data: existing } = await this.supabase
        .from('email_distribution_lists')
        .select('id')
        .eq('email_address', params.emailAddress)
        .maybeSingle();

      if (existing) {
        return { success: false, error: 'Distribution list address already exists' };
      }

      const { data, error } = await this.supabase
        .from('email_distribution_lists')
        .insert({
          email_address: params.emailAddress,
          display_name: params.displayName,
          list_type: params.listType,
          description: params.description,
          owner_account_id: params.ownerAccountId,
          department_id: params.departmentId,
          moderation_enabled: params.moderationEnabled ?? false,
          moderator_account_ids: params.moderatorAccountIds || [],
          is_active: true,
          allow_external_senders: params.allowExternalSenders ?? false,
          hide_from_gal: false,
          require_sender_authentication: true,
          send_delivery_reports: false,
          dynamic_filter: params.dynamicFilter,
          created_by: createdBy,
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[AliasService] Error creating distribution list:', error);
        return { success: false, error: 'Failed to create distribution list' };
      }

      return { success: true, listId: data.id };
    } catch (error) {
      console.error('[AliasService] Error creating distribution list:', error);
      return { success: false, error: 'Failed to create distribution list' };
    }
  }

  /**
   * Get all distribution lists
   */
  async getDistributionLists(options?: {
    type?: DistributionListType;
    departmentId?: string;
    isActive?: boolean;
  }): Promise<DistributionList[]> {
    let query = this.supabase
      .from('email_distribution_lists')
      .select('*')
      .order('display_name');

    if (options?.type) {
      query = query.eq('list_type', options.type);
    }
    if (options?.departmentId) {
      query = query.eq('department_id', options.departmentId);
    }
    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    const { data } = await query;

    // Get member counts
    const lists = data || [];
    const listsWithCounts: DistributionList[] = [];

    for (const list of lists) {
      const { count } = await this.supabase
        .from('email_distribution_list_members')
        .select('id', { count: 'exact', head: true })
        .eq('list_id', list.id)
        .eq('is_active', true);

      listsWithCounts.push({
        ...this.mapDbToDistributionList(list),
        memberCount: count || 0,
      });
    }

    return listsWithCounts;
  }

  /**
   * Add member to distribution list
   */
  async addListMember(
    listId: string,
    member: {
      emailAccountId?: string;
      nestedListId?: string;
      sharedMailboxId?: string;
      externalEmail?: string;
    },
    addedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      let memberType: string;
      if (member.emailAccountId) memberType = 'user';
      else if (member.nestedListId) memberType = 'nested_list';
      else if (member.sharedMailboxId) memberType = 'shared_mailbox';
      else if (member.externalEmail) memberType = 'external';
      else return { success: false, error: 'Invalid member specification' };

      const { error } = await this.supabase
        .from('email_distribution_list_members')
        .insert({
          list_id: listId,
          member_type: memberType,
          email_account_id: member.emailAccountId,
          nested_list_id: member.nestedListId,
          shared_mailbox_id: member.sharedMailboxId,
          external_email: member.externalEmail,
          is_active: true,
          added_by: addedBy,
        });

      if (error) {
        return { success: false, error: 'Failed to add member' };
      }

      return { success: true };
    } catch (error) {
      console.error('[AliasService] Error adding list member:', error);
      return { success: false, error: 'Failed to add member' };
    }
  }

  /**
   * Remove member from distribution list
   */
  async removeListMember(listId: string, memberId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('email_distribution_list_members')
      .delete()
      .eq('list_id', listId)
      .eq('id', memberId);

    if (error) {
      return { success: false, error: 'Failed to remove member' };
    }

    return { success: true };
  }

  // ============================================================================
  // DELEGATIONS
  // ============================================================================

  /**
   * Create a delegation
   */
  async createDelegation(
    params: CreateDelegationParams,
    createdBy: string
  ): Promise<{ success: boolean; delegationId?: string; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('email_delegations')
        .insert({
          delegator_account_id: params.delegatorAccountId,
          delegate_account_id: params.delegateAccountId,
          permissions: params.permissions,
          valid_from: params.validFrom?.toISOString() || new Date().toISOString(),
          valid_until: params.validUntil?.toISOString(),
          is_active: true,
          reason: params.reason,
          approved_by: createdBy,
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[AliasService] Error creating delegation:', error);
        return { success: false, error: 'Failed to create delegation' };
      }

      return { success: true, delegationId: data.id };
    } catch (error) {
      console.error('[AliasService] Error creating delegation:', error);
      return { success: false, error: 'Failed to create delegation' };
    }
  }

  /**
   * Get delegations for an account
   */
  async getDelegations(accountId: string, type: 'delegator' | 'delegate' | 'both' = 'both'): Promise<EmailDelegation[]> {
    let query = this.supabase
      .from('email_delegations')
      .select(`
        *,
        delegator:delegator_account_id (email_address),
        delegate:delegate_account_id (email_address)
      `)
      .eq('is_active', true);

    if (type === 'delegator') {
      query = query.eq('delegator_account_id', accountId);
    } else if (type === 'delegate') {
      query = query.eq('delegate_account_id', accountId);
    } else {
      query = query.or(`delegator_account_id.eq.${accountId},delegate_account_id.eq.${accountId}`);
    }

    const { data } = await query.order('created_at', { ascending: false });

    return (data || []).map((d): EmailDelegation => ({
      id: d.id,
      delegatorAccountId: d.delegator_account_id,
      delegatorEmail: d.delegator?.email_address,
      delegateAccountId: d.delegate_account_id,
      delegateEmail: d.delegate?.email_address,
      permissions: d.permissions,
      validFrom: new Date(d.valid_from),
      validUntil: d.valid_until ? new Date(d.valid_until) : undefined,
      isActive: d.is_active,
      reason: d.reason,
      approvedBy: d.approved_by,
      createdAt: new Date(d.created_at),
      updatedAt: new Date(d.updated_at),
    }));
  }

  /**
   * Revoke delegation
   */
  async revokeDelegation(delegationId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('email_delegations')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', delegationId);

    if (error) {
      return { success: false, error: 'Failed to revoke delegation' };
    }

    return { success: true };
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapDbToAlias(data: Record<string, unknown>): EmailAlias {
    return {
      id: data.id as string,
      aliasAddress: data.alias_address as string,
      aliasType: data.alias_type as AliasType,
      displayName: data.display_name as string | undefined,
      description: data.description as string | undefined,
      emailAccountId: data.email_account_id as string | undefined,
      departmentId: data.department_id as string | undefined,
      forwardToAccounts: (data.forward_to_accounts as string[]) || [],
      forwardToExternal: (data.forward_to_external as string[]) || [],
      keepCopy: data.keep_copy as boolean,
      isActive: data.is_active as boolean,
      allowSendAs: data.allow_send_as as boolean,
      autoReplyEnabled: data.auto_reply_enabled as boolean,
      autoReplyMessage: data.auto_reply_message as string | undefined,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  private mapDbToSharedMailbox(data: Record<string, unknown>): SharedMailbox {
    const accessList = (data.email_shared_mailbox_access as Array<Record<string, unknown>> || [])
      .map((a): SharedMailboxAccess => ({
        id: a.id as string,
        mailboxId: data.id as string,
        emailAccountId: a.email_account_id as string,
        permissionLevel: a.permission_level as MailboxPermission,
        grantedBy: a.granted_by as string | undefined,
        grantedAt: new Date(a.granted_at as string),
        expiresAt: a.expires_at ? new Date(a.expires_at as string) : undefined,
      }));

    return {
      id: data.id as string,
      emailAddress: data.email_address as string,
      displayName: data.display_name as string,
      mailboxType: data.mailbox_type as SharedMailboxType,
      description: data.description as string | undefined,
      departmentId: data.department_id as string | undefined,
      ownerAccountId: data.owner_account_id as string | undefined,
      storageQuotaMb: data.storage_quota_mb as number,
      storageUsedMb: data.storage_used_mb as number,
      isActive: data.is_active as boolean,
      autoMapping: data.auto_mapping as boolean,
      sendAsEnabled: data.send_as_enabled as boolean,
      sendOnBehalfEnabled: data.send_on_behalf_enabled as boolean,
      allowBooking: data.allow_booking as boolean,
      bookingCapacity: data.booking_capacity as number | undefined,
      accessList,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  private mapDbToDistributionList(data: Record<string, unknown>): DistributionList {
    return {
      id: data.id as string,
      emailAddress: data.email_address as string,
      displayName: data.display_name as string,
      listType: data.list_type as DistributionListType,
      description: data.description as string | undefined,
      ownerAccountId: data.owner_account_id as string | undefined,
      departmentId: data.department_id as string | undefined,
      moderationEnabled: data.moderation_enabled as boolean,
      moderatorAccountIds: (data.moderator_account_ids as string[]) || [],
      isActive: data.is_active as boolean,
      allowExternalSenders: data.allow_external_senders as boolean,
      hideFromGal: data.hide_from_gal as boolean,
      requireSenderAuthentication: data.require_sender_authentication as boolean,
      sendDeliveryReports: data.send_delivery_reports as boolean,
      dynamicFilter: data.dynamic_filter as Record<string, unknown> | undefined,
      memberCount: 0,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }
}

// Singleton
let aliasServiceInstance: AliasService | null = null;

export function getAliasService(): AliasService {
  if (!aliasServiceInstance) {
    aliasServiceInstance = new AliasService();
  }
  return aliasServiceInstance;
}

export default AliasService;
