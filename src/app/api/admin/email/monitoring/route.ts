import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Email Monitoring API Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getMonitoringService } from '@/lib/email/monitoring';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin/email/monitoring
 * Get monitoring data
 * Query params:
 *   - type: 'overview' | 'providers' | 'delivery' | 'activity' | 'alerts' | 'trends'
 *   - period: for delivery metrics ('hour' | 'day' | 'week' | 'month')
 *   - days: for trends (default 7)
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = createSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'overview';
    const period = searchParams.get('period') as 'hour' | 'day' | 'week' | 'month' || 'day';
    const days = parseInt(searchParams.get('days') || '7');

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const monitoringService = getMonitoringService();

    switch (type) {
      case 'overview': {
        const overview = await monitoringService.getSystemOverview();
        return NextResponse.json({ overview });
      }

      case 'providers': {
        const providers = await monitoringService.getProviderHealthMetrics();
        return NextResponse.json({ providers });
      }

      case 'delivery': {
        const metrics = await monitoringService.getDeliveryMetrics(period);
        return NextResponse.json({ metrics });
      }

      case 'trends': {
        const trends = await monitoringService.getDeliveryTrends(days);
        return NextResponse.json({ trends });
      }

      case 'activity': {
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const { logs, total } = await monitoringService.getActivityLogs({ limit, offset });
        return NextResponse.json({ logs, total });
      }

      case 'alerts': {
        const alerts = await monitoringService.getActiveAlerts();
        return NextResponse.json({ alerts });
      }

      case 'top-senders': {
        const topSenders = await monitoringService.getTopSenders();
        return NextResponse.json({ topSenders });
      }

      case 'errors': {
        const errors = await monitoringService.getAccountsWithErrors();
        return NextResponse.json({ errors });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    apiLogger.error('[Monitoring API] GET error', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitoring data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/monitoring
 * Perform actions like health checks
 * Body: { action: 'health_check', providerId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = createSupabaseAdmin();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: userData } = await supabase
      .from('user')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData || !['super_admin', 'admin', 'email_admin'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const bodySchema = z.object({


      action: z.string().optional(),


      providerId: z.string().uuid(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
    const { action, providerId } = body;

    const monitoringService = getMonitoringService();

    switch (action) {
      case 'health_check': {
        if (!providerId) {
          return NextResponse.json({ success: false, error: 'Provider ID required' }, { status: 400 });
        }
        const result = await monitoringService.performHealthCheck(providerId);
        return NextResponse.json({ result });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    apiLogger.error('[Monitoring API] POST error', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
