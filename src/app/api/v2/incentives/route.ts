export const dynamic = 'force-dynamic'

/**
 * Incentives API v2.0
 * Enterprise-grade API with:
 * - Comprehensive security
 * - Caching layer
 * - Transaction support
 * - Event emission
 * - Audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { securityMiddleware } from '@/lib/security/api-security';
import { getCache, CacheKeys, CacheTags, CacheTTL } from '@/lib/cache/redis-cache';
import { z } from 'zod';
import { apiLogger } from '@/lib/utils/logger'

// ===================================
// VALIDATION SCHEMAS
// ===================================

const CreateIncentiveSchemaV2 = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  incentive_type: z.enum([
    'bonus',
    'commission',
    'reward',
    'cash',
    'voucher',
    'gift',
    'travel',
    'other',
  ]),
  reward_amount: z.number().positive().max(100000000),
  currency: z.string().length(3).default('INR'),
  reward_calculation_type: z
    .enum(['fixed', 'percentage', 'tiered', 'proportional'])
    .default('fixed'),
  tiered_rewards: z.array(z.any()).optional(),
  performance_criteria: z.object({
    metric: z.string(),
    target: z.number().positive(),
    period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  }),
  start_date: z.string().transform((val) => new Date(val)),
  end_date: z.string().transform((val) => new Date(val)),
  target_all_employees: z.boolean().default(false),
  target_subrole_codes: z.array(z.string()).optional(),
  minimum_achievement_percentage: z.number().min(0).max(100).default(100),
  allow_partial_rewards: z.boolean().default(false),
  notify_on_launch: z.boolean().default(true),
  auto_approve_claims_under: z.number().optional(),
  image_url: z.string().url().optional(),
  terms_and_conditions: z.string().optional(),
  metadata: z.record(z.any()).optional(),
}).refine(
  (data) => data.end_date > data.start_date,
  {
    message: 'End date must be after start date',
    path: ['end_date'],
  }
).refine(
  (data) => data.target_all_employees || (data.target_subrole_codes && data.target_subrole_codes.length > 0),
  {
    message: 'Must target all employees OR specify target subrole codes',
    path: ['target_subrole_codes'],
  }
);

// ===================================
// HELPER FUNCTIONS
// ===================================

/**
 * Check user permissions
 */
async function checkPermissions(supabase: any): Promise<{
  user: any;
  isSuperAdmin: boolean;
  isHR: boolean;
  error?: NextResponse;
}> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      user: null,
      isSuperAdmin: false,
      isHR: false,
      error: NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      ),
    };
  }

  // Check if user is SuperAdmin or HR
  const { data: profile } = await supabase
    .from('employee_profile')
    .select('role, sub_role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const isSuperAdmin = profile?.role === 'superadmin';
  const isHR =
    isSuperAdmin ||
    ['hr_executive', 'hr_manager', 'admin_executive', 'admin_manager'].includes(
      profile?.sub_role?.toLowerCase()
    );

  if (!isHR) {
    return {
      user,
      isSuperAdmin,
      isHR,
      error: NextResponse.json(
        {
          error: 'Forbidden: Only SuperAdmin or HR can manage incentives',
          code: 'PERMISSION_DENIED',
        },
        { status: 403 }
      ),
    };
  }

  return { user, isSuperAdmin, isHR };
}

/**
 * Emit event to event stream
 */
async function emitEvent(
  supabase: any,
  eventType: string,
  aggregateId: string,
  eventData: any,
  userId: string
): Promise<void> {
  try {
    await supabase.from('incentive_events').insert({
      event_type: eventType,
      aggregate_id: aggregateId,
      aggregate_type: 'incentive',
      event_data: eventData,
      user_id: userId,
      correlation_id: crypto.randomUUID(),
    });
  } catch (error) {
    apiLogger.error('Failed to emit event', error);
  }
}

/**
 * Create allocations for eligible employees
 */
async function createAllocations(
  supabase: any,
  incentiveId: string,
  targetAll: boolean,
  targetSubroles: string[],
  startDate: Date,
  endDate: Date
): Promise<{ count: number; error?: string }> {
  try {
    let query = supabase
      .from('employee_profile')
      .select('user_id, sub_role')
      .eq('status', 'active');

    if (!targetAll && targetSubroles.length > 0) {
      query = query.in('sub_role', targetSubroles);
    }

    const { data: employees, error: fetchError } = await query;

    if (fetchError) {
      return { count: 0, error: fetchError.message };
    }

    if (!employees || employees.length === 0) {
      return { count: 0 };
    }

    // Create allocations
    const allocations = employees.map((emp: any) => {
      const joinDate = new Date(); // Should get actual join date
      const prorationFactor = calculateProration(startDate, endDate, joinDate);

      return {
        incentive_id: incentiveId,
        user_id: emp.user_id,
        is_eligible: true,
        allocation_status: 'eligible',
        progress_percentage: 0,
        earned_amount: 0,
        prorated: prorationFactor < 1,
        proration_factor: prorationFactor,
        joined_on: joinDate,
        eligibility_checked_at: new Date().toISOString(),
      };
    });

    const { error: insertError } = await supabase
      .from('incentive_allocations')
      .insert(allocations);

    if (insertError) {
      return { count: 0, error: insertError.message };
    }

    return { count: allocations.length };
  } catch (error: unknown) {
    return { count: 0, error: 'Operation failed' };
  }
}

/**
 * Calculate proration factor
 */
function calculateProration(
  startDate: Date,
  endDate: Date,
  joinDate: Date
): number {
  const totalDays =
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  const remainingDays =
    (endDate.getTime() - Math.max(joinDate.getTime(), startDate.getTime())) /
    (1000 * 60 * 60 * 24);

  return Math.min(1.0, remainingDays / totalDays);
}

// ===================================
// GET /api/v2/incentives
// ===================================

export async function GET(request: NextRequest) {
  try {
    // Apply security middleware
    const { error: securityError } = await securityMiddleware(request, {
      enableCSRF: false, // GET request
      enableRateLimit: true,
      rateLimitConfig: { max: 100, window: 60 },
    });

    if (securityError) return securityError;

    const supabase = createClient();

    // Check permissions
    const { user, isHR, error: permError } = await checkPermissions(supabase);
    if (permError) return permError;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const subrole = searchParams.get('subrole');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const useCache = searchParams.get('cache') !== 'false';

    // Try cache first
    const cache = getCache();
    const cacheKey = CacheKeys.allIncentives() + `:${status}:${subrole}:${page}:${limit}`;

    if (useCache) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return NextResponse.json(cached, {
          headers: {
            'X-Cache': 'HIT',
            'X-Cache-Age': 'redis',
          },
        });
      }
    }

    // Build query
    let query = supabase
      .from('incentives')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (subrole) {
      query = query.contains('target_subrole_codes', [subrole]);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch incentives',
          code: 'FETCH_FAILED',
          },
        { status: 500 }
      );
    }

    const response = {
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };

    // Cache the response
    if (useCache) {
      await cache.set(cacheKey, response, {
        ttl: CacheTTL.MEDIUM,
        tags: [CacheTags.analytics],
      });
    }

    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
      },
    });
  } catch (error: unknown) {
    apiLogger.error('GET /api/v2/incentives error', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        },
      { status: 500 }
    );
  }
}

// ===================================
// POST /api/v2/incentives
// ===================================

export async function POST(request: NextRequest) {
  try {
    // Apply security middleware
    const { error: securityError, sanitizedBody } = await securityMiddleware(
      request,
      {
        enableCSRF: true,
        enableRateLimit: true,
        enableSanitization: true,
        rateLimitConfig: { max: 20, window: 60 },
      }
    );

    if (securityError) return securityError;

    const supabase = createClient();

    // Check permissions
    const { user, error: permError } = await checkPermissions(supabase);
    if (permError) return permError;

    // Validate input
    const validation = CreateIncentiveSchemaV2.safeParse(sanitizedBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Start transaction (using Supabase RPC)
    const { data: incentive, error: createError } = await supabase.rpc(
      'create_incentive_with_allocations',
      {
        p_incentive_data: {
          title: data.title,
          description: data.description,
          incentive_type: data.incentive_type,
          reward_amount: data.reward_amount,
          currency: data.currency,
          reward_calculation_type: data.reward_calculation_type,
          tiered_rewards: data.tiered_rewards,
          performance_criteria: data.performance_criteria,
          start_date: data.start_date.toISOString(),
          end_date: data.end_date.toISOString(),
          target_all_employees: data.target_all_employees,
          target_subrole_codes: data.target_subrole_codes,
          minimum_achievement_percentage: data.minimum_achievement_percentage,
          allow_partial_rewards: data.allow_partial_rewards,
          notify_on_launch: data.notify_on_launch,
          auto_approve_claims_under: data.auto_approve_claims_under,
          image_url: data.image_url,
          terms_and_conditions: data.terms_and_conditions,
          metadata: data.metadata,
          status: 'draft',
          created_by: user.id,
        },
      }
    );

    if (createError) {
      return NextResponse.json(
        {
          error: 'Failed to create incentive',
          code: 'CREATE_FAILED',
          },
        { status: 500 }
      );
    }

    // Emit event
    await emitEvent(
      supabase,
      'incentive_created',
      incentive.id,
      { incentive },
      user.id
    );

    // Invalidate cache
    const cache = getCache();
    await cache.deleteByTag(CacheTags.analytics);

    return NextResponse.json(
      {
        success: true,
        data: incentive,
        message: 'Incentive created successfully',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    apiLogger.error('POST /api/v2/incentives error', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        },
      { status: 500 }
    );
  }
}

// ===================================
// PUT /api/v2/incentives
// ===================================

export async function PUT(request: NextRequest) {
  try {
    // Apply security middleware
    const { error: securityError, sanitizedBody } = await securityMiddleware(
      request,
      {
        enableCSRF: true,
        enableRateLimit: true,
        enableSanitization: true,
        rateLimitConfig: { max: 50, window: 60 },
      }
    );

    if (securityError) return securityError;

    const supabase = createClient();

    // Check permissions
    const { user, error: permError } = await checkPermissions(supabase);
    if (permError) return permError;

    const { id, version, ...updates } = sanitizedBody;

    if (!id) {
      return NextResponse.json(
        { error: 'Incentive ID required', code: 'ID_REQUIRED' },
        { status: 400 }
      );
    }

    // Optimistic locking check
    const { data: current, error: fetchError } = await supabase
      .from('incentives')
      .select('version, status')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError || !current) {
      return NextResponse.json(
        { error: 'Incentive not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (version && current.version !== version) {
      return NextResponse.json(
        {
          error: 'Version mismatch - data was modified by another user',
          code: 'VERSION_MISMATCH',
          currentVersion: current.version,
        },
        { status: 409 }
      );
    }

    // Update with version increment
    const { data: updated, error: updateError } = await supabase
      .from('incentives')
      .update({
        ...updates,
        version: current.version + 1,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('version', current.version)
      .select()
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        {
          error: 'Failed to update incentive',
          code: 'UPDATE_FAILED',
          },
        { status: 500 }
      );
    }

    // Emit event
    await emitEvent(
      supabase,
      'incentive_updated',
      id,
      { old: current, new: updated },
      user.id
    );

    // Invalidate cache
    const cache = getCache();
    await cache.delete(CacheKeys.incentive(id));
    await cache.deleteByTag(CacheTags.incentive(id));

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Incentive updated successfully',
    });
  } catch (error: unknown) {
    apiLogger.error('PUT /api/v2/incentives error', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        },
      { status: 500 }
    );
  }
}

// ===================================
// DELETE /api/v2/incentives
// ===================================

export async function DELETE(request: NextRequest) {
  try {
    // Apply security middleware
    const { error: securityError } = await securityMiddleware(request, {
      enableCSRF: true,
      enableRateLimit: true,
      rateLimitConfig: { max: 20, window: 60 },
    });

    if (securityError) return securityError;

    const supabase = createClient();

    // Check permissions
    const { user, isSuperAdmin, error: permError } = await checkPermissions(
      supabase
    );
    if (permError) return permError;

    if (!isSuperAdmin) {
      return NextResponse.json(
        {
          error: 'Forbidden: Only SuperAdmin can delete incentives',
          code: 'PERMISSION_DENIED',
        },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Incentive ID required', code: 'ID_REQUIRED' },
        { status: 400 }
      );
    }

    // Soft delete (trigger will handle this)
    const { error: deleteError } = await supabase
      .from('incentives')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq('id', id)
      .is('deleted_at', null);

    if (deleteError) {
      return NextResponse.json(
        {
          error: 'Failed to delete incentive',
          code: 'DELETE_FAILED',
          },
        { status: 500 }
      );
    }

    // Emit event
    await emitEvent(supabase, 'incentive_deleted', id, {}, user.id);

    // Invalidate cache
    const cache = getCache();
    await cache.delete(CacheKeys.incentive(id));
    await cache.deleteByTag(CacheTags.incentive(id));

    return NextResponse.json({
      success: true,
      message: 'Incentive deleted successfully',
    });
  } catch (error: unknown) {
    apiLogger.error('DELETE /api/v2/incentives error', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        },
      { status: 500 }
    );
  }
}
