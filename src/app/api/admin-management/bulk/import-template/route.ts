
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateImportTemplate } from '@/lib/utils/bulk-operations'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/bulk/import-template
 * Generate and download CSV template for bulk import
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const template = generateImportTemplate()
    const filename = 'admin_bulk_import_template.csv'

    return new NextResponse(template, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': template.length.toString()
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Import Template API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
