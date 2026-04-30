
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'

/**
 * GET /api/admin-management/existing-contacts
 * Get all existing emails and phone numbers for duplicate detection
 *
 * Used by import functionality to check for duplicates before import
 */

export async function GET(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()

    // Fetch all non-deleted admin emails and phones
    const { data: admins, error } = await supabase
      .from('admins')
      .select('email, phone')
      .eq('is_deleted', false)

    if (error) {
      throw error
    }

    // Extract unique emails and phones
    const emails = new Set<string>()
    const phones = new Set<string>()

    admins?.forEach((admin) => {
      if (admin.email) {
        emails.add(admin.email.toLowerCase())
      }
      if (admin.phone) {
        // Normalize phone (remove non-digits)
        const normalizedPhone = admin.phone.replace(/\D/g, '')
        if (normalizedPhone) {
          phones.add(normalizedPhone)
        }
      }
    })

    return NextResponse.json(
      {
        success: true,
        emails: Array.from(emails),
        phones: Array.from(phones),
      },
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error, 'fetch existing contacts')
  }
}
