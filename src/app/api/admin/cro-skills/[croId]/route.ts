import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * CRO Skills Detail API
 * Get, update CRO skills by CRO ID
 * Admin access only
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

async function verifyAdmin(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const adminId = payload.sub as string

    if (!adminId) {
      throw new Error('Invalid token payload')
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminId)
      .maybeSingle()

    if (userError || !user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return null
    }

    return adminId
  } catch (error) {
    return null
  }
}

// GET: Get CRO skills by CRO ID
export async function GET(
  request: NextRequest,
  { params }: { params: { croId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const adminId = await verifyAdmin(token)
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 403 }
      )
    }

    const { data: skills, error } = await supabase
      .from('cro_skills')
      .select('*')
      .eq('cro_id', params.croId)
      .maybeSingle()

    if (error || !skills) {
      return NextResponse.json(
        { success: false, error: 'CRO skills not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      skills
    })

  } catch (error) {
    apiLogger.error('Error in GET /api/admin/cro-skills/[croId]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: Update CRO skills completely
export async function PUT(
  request: NextRequest,
  { params }: { params: { croId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const adminId = await verifyAdmin(token)
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 403 }
      )
    }

    const bodySchema = z.object({


      loan_types: z.string().optional(),


      languages: z.string().optional(),


      min_loan_amount: z.string().optional(),


      max_loan_amount: z.string().optional(),


      max_leads_per_day: z.string().optional(),


      max_pending_leads: z.string().optional(),


      geography_coverage: z.string().optional(),


      is_available: z.boolean().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      loan_types,
      languages,
      min_loan_amount,
      max_loan_amount,
      max_leads_per_day,
      max_pending_leads,
      geography_coverage,
      is_available
    } = body

    // Validate required fields
    if (!loan_types || !languages) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data: updatedSkills, error } = await supabase
      .from('cro_skills')
      .update({
        loan_types,
        languages,
        min_loan_amount: min_loan_amount || null,
        max_loan_amount: max_loan_amount || null,
        max_leads_per_day: max_leads_per_day || 20,
        max_pending_leads: max_pending_leads || 50,
        geography_coverage: geography_coverage || [],
        is_available: is_available !== undefined ? is_available : true,
        updated_at: new Date().toISOString()
      })
      .eq('cro_id', params.croId)
      .select()
      .maybeSingle()

    if (error || !updatedSkills) {
      apiLogger.error('Error updating CRO skills', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update CRO skills' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      skills: updatedSkills
    })

  } catch (error) {
    apiLogger.error('Error in PUT /api/admin/cro-skills/[croId]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: Partially update CRO skills
export async function PATCH(
  request: NextRequest,
  { params }: { params: { croId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const adminId = await verifyAdmin(token)
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2

    const { data: updatedSkills, error } = await supabase
      .from('cro_skills')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('cro_id', params.croId)
      .select()
      .maybeSingle()

    if (error || !updatedSkills) {
      apiLogger.error('Error updating CRO skills', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update CRO skills' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      skills: updatedSkills
    })

  } catch (error) {
    apiLogger.error('Error in PATCH /api/admin/cro-skills/[croId]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: Remove CRO skills
export async function DELETE(
  request: NextRequest,
  { params }: { params: { croId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const adminId = await verifyAdmin(token)
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('cro_skills')
      .delete()
      .eq('cro_id', params.croId)

    if (error) {
      apiLogger.error('Error deleting CRO skills', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete CRO skills' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'CRO skills deleted successfully'
    })

  } catch (error) {
    apiLogger.error('Error in DELETE /api/admin/cro-skills/[croId]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
