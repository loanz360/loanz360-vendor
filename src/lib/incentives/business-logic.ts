/**
 * Enhanced Business Logic for Incentives Module
 *
 * Fixes:
 * - Issue #10: Conflict resolution for overlapping incentives
 * - Issue #11: Grace period for claims
 * - Issue #12: Proration logic for mid-period joins
 * - Issue #13: Escalation workflow for rejected claims
 * - Issue #14: Bulk claim processing
 */

import { createClient } from '@/lib/supabase/server';

// ===================================
// TYPE DEFINITIONS
// ===================================

export interface IncentiveConflict {
  primaryIncentiveId: string;
  conflictingIncentiveId: string;
  conflictType: 'same_metric' | 'overlapping_period' | 'duplicate_target' | 'resource_constraint';
  severity: 'low' | 'medium' | 'high';
  resolutionStrategy?: 'allow_both' | 'prioritize_primary' | 'merge' | 'manual_review';
  details: string;
}

export interface ProrationCalculation {
  factor: number;
  originalTarget: number;
  proratedTarget: number;
  remainingDays: number;
  totalDays: number;
}

export interface ClaimEscalation {
  claimId: string;
  escalatedTo: string;
  escalationReason: string;
  slaDeadline: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface BulkClaimResult {
  processed: number;
  approved: number;
  rejected: number;
  failed: number;
  errors: { claimId: string; error: string }[];
}

// ===================================
// CONFLICT DETECTION & RESOLUTION
// ===================================

/**
 * Detect conflicts for a user's incentive allocation
 */
export async function detectIncentiveConflicts(
  userId: string,
  incentiveId: string
): Promise<IncentiveConflict[]> {
  const supabase = await createClient();
  const conflicts: IncentiveConflict[] = [];

  try {
    // Get the primary incentive details
    const { data: primaryIncentive, error: fetchError } = await supabase
      .from('incentives')
      .select('*')
      .eq('id', incentiveId)
      .maybeSingle();

    if (fetchError || !primaryIncentive) {
      return conflicts;
    }

    // Get all active incentives for the user
    const { data: userAllocations } = await supabase
      .from('incentive_allocations')
      .select(`
        incentive_id,
        incentives:incentive_id (
          id,
          title,
          performance_criteria,
          start_date,
          end_date,
          status
        )
      `)
      .eq('user_id', userId)
      .neq('incentive_id', incentiveId);

    if (!userAllocations) {
      return conflicts;
    }

    // Check for conflicts
    for (const allocation of userAllocations) {
      const otherIncentive = allocation.incentives as unknown;

      if (otherIncentive.status !== 'active') continue;

      // Check 1: Same metric conflict
      if (
        primaryIncentive.performance_criteria?.metric ===
        otherIncentive.performance_criteria?.metric
      ) {
        const datesOverlap = checkDateOverlap(
          new Date(primaryIncentive.start_date),
          new Date(primaryIncentive.end_date),
          new Date(otherIncentive.start_date),
          new Date(otherIncentive.end_date)
        );

        if (datesOverlap) {
          conflicts.push({
            primaryIncentiveId: incentiveId,
            conflictingIncentiveId: otherIncentive.id,
            conflictType: 'same_metric',
            severity: 'high',
            resolutionStrategy: 'manual_review',
            details: `Both incentives track the same metric: ${primaryIncentive.performance_criteria.metric}`,
          });
        }
      }

      // Check 2: Overlapping period
      const periodOverlap = checkDateOverlap(
        new Date(primaryIncentive.start_date),
        new Date(primaryIncentive.end_date),
        new Date(otherIncentive.start_date),
        new Date(otherIncentive.end_date)
      );

      if (periodOverlap) {
        conflicts.push({
          primaryIncentiveId: incentiveId,
          conflictingIncentiveId: otherIncentive.id,
          conflictType: 'overlapping_period',
          severity: 'medium',
          resolutionStrategy: 'allow_both',
          details: `Incentive periods overlap`,
        });
      }
    }

    // Store conflicts in database
    if (conflicts.length > 0) {
      await supabase.from('incentive_conflicts').insert(
        conflicts.map((c) => ({
          user_id: userId,
          primary_incentive_id: c.primaryIncentiveId,
          conflicting_incentive_id: c.conflictingIncentiveId,
          conflict_type: c.conflictType,
          resolution_strategy: c.resolutionStrategy,
        }))
      );
    }

    return conflicts;
  } catch (error) {
    console.error('Error detecting conflicts:', error);
    return conflicts;
  }
}

/**
 * Check if two date ranges overlap
 */
function checkDateOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 <= end2 && start2 <= end1;
}

/**
 * Resolve incentive conflicts automatically
 */
export async function resolveConflicts(
  userId: string,
  conflicts: IncentiveConflict[]
): Promise<{ resolved: number; manualReviewRequired: number }> {
  const supabase = await createClient();
  let resolved = 0;
  let manualReviewRequired = 0;

  for (const conflict of conflicts) {
    if (conflict.resolutionStrategy === 'manual_review') {
      manualReviewRequired++;
      continue;
    }

    if (conflict.resolutionStrategy === 'allow_both') {
      // Mark as resolved but allow both
      await supabase
        .from('incentive_conflicts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolution_notes: 'Both incentives allowed to run concurrently',
        })
        .eq('user_id', userId)
        .eq('primary_incentive_id', conflict.primaryIncentiveId)
        .eq('conflicting_incentive_id', conflict.conflictingIncentiveId);

      resolved++;
    }

    if (conflict.resolutionStrategy === 'prioritize_primary') {
      // Pause the conflicting incentive for this user
      await supabase
        .from('incentive_allocations')
        .update({
          allocation_status: 'paused',
          metadata: {
            paused_reason: 'Conflict with higher priority incentive',
            conflicting_incentive_id: conflict.primaryIncentiveId,
          },
        })
        .eq('user_id', userId)
        .eq('incentive_id', conflict.conflictingIncentiveId);

      resolved++;
    }
  }

  return { resolved, manualReviewRequired };
}

// ===================================
// PRORATION LOGIC
// ===================================

/**
 * Calculate proration for mid-period joins
 */
export function calculateProration(
  startDate: Date,
  endDate: Date,
  joinDate: Date
): ProrationCalculation {
  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const effectiveStart = joinDate > startDate ? joinDate : startDate;
  const remainingDays = Math.ceil(
    (endDate.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  const safeTotalDays = totalDays > 0 ? totalDays : 1;
  const factor = Math.min(1.0, Math.max(0, remainingDays / safeTotalDays));

  return {
    factor,
    originalTarget: 0, // Will be set by caller
    proratedTarget: 0, // Will be calculated by caller
    remainingDays,
    totalDays,
  };
}

/**
 * Apply proration to allocation
 */
export async function applyProration(
  allocationId: string,
  originalTarget: number
): Promise<boolean> {
  const supabase = await createClient();

  try {
    // Get allocation details
    const { data: allocation, error: fetchError } = await supabase
      .from('incentive_allocations')
      .select(`
        *,
        incentives:incentive_id (start_date, end_date)
      `)
      .eq('id', allocationId)
      .maybeSingle();

    if (fetchError || !allocation) {
      return false;
    }

    const incentive = allocation.incentives as unknown;
    const joinDate = allocation.joined_on
      ? new Date(allocation.joined_on)
      : new Date();

    const proration = calculateProration(
      new Date(incentive.start_date),
      new Date(incentive.end_date),
      joinDate
    );

    // Update allocation with proration
    await supabase
      .from('incentive_allocations')
      .update({
        prorated: proration.factor < 1,
        proration_factor: proration.factor,
        original_target_value: originalTarget,
        custom_target_value: originalTarget * proration.factor,
      })
      .eq('id', allocationId);

    return true;
  } catch (error) {
    console.error('Error applying proration:', error);
    return false;
  }
}

// ===================================
// GRACE PERIOD FOR CLAIMS
// ===================================

/**
 * Check if claim is within grace period
 */
export function isWithinGracePeriod(
  incentiveEndDate: Date,
  claimDate: Date,
  graceDays: number = 7
): boolean {
  const gracePeriodEnd = new Date(incentiveEndDate);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + graceDays);

  return claimDate <= gracePeriodEnd;
}

/**
 * Calculate grace period end date
 */
export function calculateGracePeriodEnd(
  incentiveEndDate: Date,
  graceDays: number = 7
): Date {
  const graceEnd = new Date(incentiveEndDate);
  graceEnd.setDate(graceEnd.getDate() + graceDays);
  return graceEnd;
}

/**
 * Extend grace period for allocation
 */
export async function extendGracePeriod(
  allocationId: string,
  additionalDays: number,
  reason: string
): Promise<boolean> {
  const supabase = await createClient();

  try {
    const { data: allocation } = await supabase
      .from('incentive_allocations')
      .select('grace_period_days, grace_period_end_date')
      .eq('id', allocationId)
      .maybeSingle();

    if (!allocation) return false;

    const currentGraceDays = allocation.grace_period_days || 0;
    const newGraceDays = currentGraceDays + additionalDays;

    const graceEndSource = allocation.grace_period_end_date || new Date().toISOString();
    const newGraceEnd = new Date(graceEndSource);
    newGraceEnd.setDate(newGraceEnd.getDate() + additionalDays);

    // Merge with existing metadata instead of overwriting
    const existingMetadata = (typeof allocation.metadata === 'object' && allocation.metadata) ? allocation.metadata : {};
    await supabase
      .from('incentive_allocations')
      .update({
        grace_period_days: newGraceDays,
        grace_period_end_date: newGraceEnd.toISOString(),
        metadata: {
          ...existingMetadata,
          grace_extension_reason: reason,
          grace_extended_at: new Date().toISOString(),
        },
      })
      .eq('id', allocationId);

    return true;
  } catch (error) {
    console.error('Error extending grace period:', error instanceof Error ? error.message : error);
    return false;
  }
}

// ===================================
// CLAIM ESCALATION WORKFLOW
// ===================================

/**
 * Escalate rejected claim
 */
export async function escalateClaim(
  claimId: string,
  escalationReason: string,
  priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
): Promise<ClaimEscalation | null> {
  const supabase = await createClient();

  try {
    // Get claim details
    const { data: claim } = await supabase
      .from('incentive_claims')
      .select('*, user_id, allocation_id')
      .eq('id', claimId)
      .maybeSingle();

    if (!claim || claim.claim_status !== 'rejected') {
      return null;
    }

    // Find appropriate escalation target (manager or HR)
    const { data: profile } = await supabase
      .from('employee_profile')
      .select('reporting_manager_id')
      .eq('user_id', claim.user_id)
      .maybeSingle();

    const escalatedTo = profile?.reporting_manager_id || 'HR';

    // Calculate SLA deadline based on priority
    const slaHours = {
      low: 72,
      normal: 48,
      high: 24,
      urgent: 12,
    };

    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + slaHours[priority]);

    // Update claim with escalation (safely merge metadata)
    const existingClaimMeta = (typeof claim.metadata === 'object' && claim.metadata) ? claim.metadata : {};
    await supabase
      .from('incentive_claims')
      .update({
        escalated: true,
        escalated_to: escalatedTo,
        escalated_at: new Date().toISOString(),
        sla_deadline: slaDeadline.toISOString(),
        metadata: {
          ...existingClaimMeta,
          escalation_reason: escalationReason,
          escalation_priority: priority,
        },
      })
      .eq('id', claimId);

    // Create notification for escalation target (only if it's a valid user_id, not 'HR')
    const notificationRecipient = escalatedTo !== 'HR' ? escalatedTo : null;
    if (notificationRecipient) {
      await supabase.from('incentive_notification_queue').insert({
        recipient_user_id: notificationRecipient,
      channel: 'email',
      subject: `Escalated Claim Review Required`,
      body: `Claim ${claimId} has been escalated for your review. Reason: ${escalationReason}`,
      priority,
      scheduled_for: new Date().toISOString(),
      });
    }

    return {
      claimId,
      escalatedTo,
      escalationReason,
      slaDeadline,
      priority,
    };
  } catch (error) {
    console.error('Error escalating claim:', error);
    return null;
  }
}

/**
 * Auto-escalate claims approaching SLA deadline
 */
export async function autoEscalateExpiringSLAs(): Promise<number> {
  const supabase = await createClient();
  let escalatedCount = 0;

  try {
    // Find claims with SLA expiring in next 2 hours
    const twoHoursFromNow = new Date();
    twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2);

    const { data: expiringClaims } = await supabase
      .from('incentive_claims')
      .select('*')
      .eq('claim_status', 'pending')
      .eq('escalated', false)
      .lte('sla_deadline', twoHoursFromNow.toISOString());

    if (!expiringClaims) return 0;

    for (const claim of expiringClaims) {
      await escalateClaim(
        claim.id,
        'SLA deadline approaching',
        'urgent'
      );
      escalatedCount++;
    }

    return escalatedCount;
  } catch (error) {
    console.error('Error auto-escalating claims:', error);
    return escalatedCount;
  }
}

// ===================================
// BULK CLAIM PROCESSING
// ===================================

/**
 * Process multiple claims in bulk
 */
export async function bulkProcessClaims(
  claimIds: string[],
  action: 'approve' | 'reject',
  processedBy: string,
  notes?: string
): Promise<BulkClaimResult> {
  const supabase = await createClient();

  const result: BulkClaimResult = {
    processed: 0,
    approved: 0,
    rejected: 0,
    failed: 0,
    errors: [],
  };

  for (const claimId of claimIds) {
    try {
      // Get claim details
      const { data: claim, error: fetchError } = await supabase
        .from('incentive_claims')
        .select('*')
        .eq('id', claimId)
        .maybeSingle();

      if (fetchError || !claim) {
        result.failed++;
        result.errors.push({
          claimId,
          error: 'Claim not found',
        });
        continue;
      }

      // Validate claim can be processed
      if (claim.claim_status !== 'pending') {
        result.failed++;
        result.errors.push({
          claimId,
          error: `Claim status is ${claim.claim_status}, expected pending`,
        });
        continue;
      }

      // Process the claim
      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      const { error: updateError } = await supabase
        .from('incentive_claims')
        .update({
          claim_status: newStatus,
          reviewed_by: processedBy,
          reviewed_at: new Date().toISOString(),
          notes: notes || `Bulk ${action} by ${processedBy}`,
        })
        .eq('id', claimId);

      if (updateError) {
        result.failed++;
        result.errors.push({
          claimId,
          error: updateError.message,
        });
        continue;
      }

      // Update statistics
      result.processed++;
      if (action === 'approve') {
        result.approved++;
      } else {
        result.rejected++;
      }

      // Send notification
      await supabase.from('incentive_notification_queue').insert({
        recipient_user_id: claim.user_id,
        channel: 'email',
        subject: `Your claim has been ${action}ed`,
        body: `Your incentive claim for ${claim.claimed_amount} has been ${action}ed.${notes ? ` Notes: ${notes}` : ''}`,
        priority: 'normal',
      });
    } catch (error: unknown) {
      result.failed++;
      result.errors.push({
        claimId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Bulk approve claims under threshold
 * IMPORTANT: This function must only be called by authenticated HR/admin users or scheduled jobs
 * @param threshold - Maximum claim amount for auto-approval
 * @param approvedBy - User ID of the person authorizing the bulk approval (required for audit trail)
 */
export async function bulkAutoApproveClaims(
  threshold: number = 5000,
  approvedBy: string = 'SYSTEM_AUTO_APPROVAL'
): Promise<BulkClaimResult> {
  if (!approvedBy) {
    return { processed: 0, approved: 0, rejected: 0, failed: 0, errors: [{ claimId: 'AUTH', error: 'approvedBy is required for audit trail' }] };
  }
  const supabase = await createClient();

  try {
    // Get pending claims under threshold
    const { data: eligibleClaims } = await supabase
      .from('incentive_claims')
      .select('id')
      .eq('claim_status', 'pending')
      .lte('claimed_amount', threshold);

    if (!eligibleClaims || eligibleClaims.length === 0) {
      return {
        processed: 0,
        approved: 0,
        rejected: 0,
        failed: 0,
        errors: [],
      };
    }

    const claimIds = eligibleClaims.map((c: unknown) => c.id);

    return await bulkProcessClaims(
      claimIds,
      'approve',
      approvedBy,
      `Auto-approved: Amount under threshold (${threshold})`
    );
  } catch (error: unknown) {
    console.error('Error bulk auto-approving claims:', error);
    return {
      processed: 0,
      approved: 0,
      rejected: 0,
      failed: 0,
      errors: [{ claimId: 'BULK', error: error instanceof Error ? error.message : 'Unknown error' }],
    };
  }
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

/**
 * Calculate days until deadline
 */
export function daysUntilDeadline(deadline: Date): number {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date): boolean {
  return date < new Date();
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date): boolean {
  return date > new Date();
}

export default {
  detectIncentiveConflicts,
  resolveConflicts,
  calculateProration,
  applyProration,
  isWithinGracePeriod,
  calculateGracePeriodEnd,
  extendGracePeriod,
  escalateClaim,
  autoEscalateExpiringSLAs,
  bulkProcessClaims,
  bulkAutoApproveClaims,
};
