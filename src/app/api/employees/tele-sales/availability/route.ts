import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get agent availability status
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date().toISOString().split('T')[0]

    // Get today's availability
    let { data: availability, error } = await supabase
      .from('ts_agent_availability')
      .select('*')
      .eq('sales_executive_id', user.id)
      .eq('shift_date', today)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    // Create default availability if not exists
    if (!availability) {
      const { data: newAvailability, error: createError } = await supabase
        .from('ts_agent_availability')
        .insert({
          sales_executive_id: user.id,
          status: 'OFFLINE',
          shift_date: today,
          shift_start_time: '09:00:00',
          shift_end_time: '18:00:00',
          skills: [],
          languages: ['ENGLISH', 'HINDI']
        })
        .select()
        .maybeSingle()

      if (createError) throw createError
      availability = newAvailability
    }

    // Calculate time on status
    const statusChangedAt = new Date(availability.status_changed_at)
    const timeOnStatusMinutes = Math.round((Date.now() - statusChangedAt.getTime()) / 60000)

    // Calculate utilization
    const shiftStartTime = new Date(`${today}T${availability.shift_start_time}`)
    const now = new Date()
    const shiftMinutesElapsed = Math.max(0, (now.getTime() - shiftStartTime.getTime()) / 60000)
    const availableMinutes = shiftMinutesElapsed - availability.total_break_minutes
    const utilizationRate = availableMinutes > 0 ? (availability.avg_handle_time_today * availability.calls_handled_today) / availableMinutes * 100 : 0

    return NextResponse.json({
      success: true,
      data: {
        ...availability,
        time_on_status_minutes: timeOnStatusMinutes,
        utilization_rate: Math.round(utilizationRate * 10) / 10,
        shift_progress: {
          shift_start: availability.shift_start_time,
          shift_end: availability.shift_end_time,
          current_time: now.toTimeString().split(' ')[0],
          minutes_elapsed: Math.round(shiftMinutesElapsed),
          break_minutes_remaining: Math.max(0, availability.allowed_break_minutes - availability.total_break_minutes)
        }
      }
    })
  } catch (error) {
    apiLogger.error('Get availability error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}

// POST - Clock in / Start shift
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const bodySchema = z.object({

      shift_start_time: z.string().optional().default('09:00:00'),

      shift_end_time: z.string().optional().default('18:00:00'),

      skills: z.array(z.unknown()).optional().default([]),

      languages: z.string().optional(),

      status: z.string(),

      status_reason: z.string().optional(),

      break_type: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date().toISOString().split('T')[0]
    const now = new Date()

    const {
      shift_start_time = '09:00:00',
      shift_end_time = '18:00:00',
      skills = [],
      languages = ['ENGLISH', 'HINDI']
    } = body

    // Upsert availability record
    const { data: availability, error } = await supabase
      .from('ts_agent_availability')
      .upsert({
        sales_executive_id: user.id,
        shift_date: today,
        shift_start_time,
        shift_end_time,
        actual_login_time: now.toISOString(),
        status: 'AVAILABLE',
        status_changed_at: now.toISOString(),
        skills,
        languages
      }, {
        onConflict: 'sales_executive_id,shift_date'
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: availability,
      message: 'Shift started successfully'
    })
  } catch (error) {
    apiLogger.error('Start shift error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to start shift' },
      { status: 500 }
    )
  }
}

// PUT - Update status (Available, Break, etc.)
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const bodySchema2 = z.object({

      status: z.string().optional(),

      status_reason: z.string().optional(),

      break_type: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date().toISOString().split('T')[0]
    const now = new Date()

    const { status, status_reason, break_type } = body

    if (!status) {
      return NextResponse.json({
        success: false,
        error: 'Status is required'
      }, { status: 400 })
    }

    // Get current availability
    const { data: current } = await supabase
      .from('ts_agent_availability')
      .select('*')
      .eq('sales_executive_id', user.id)
      .eq('shift_date', today)
      .maybeSingle()

    if (!current) {
      return NextResponse.json({
        success: false,
        error: 'No active shift found. Please clock in first.'
      }, { status: 400 })
    }

    const updates: Record<string, unknown> = {
      status,
      status_reason,
      status_changed_at: now.toISOString(),
      updated_at: now.toISOString()
    }

    // Handle break tracking
    if (['BREAK', 'LUNCH'].includes(status) && !current.current_break_type) {
      updates.current_break_type = break_type || (status === 'LUNCH' ? 'LUNCH' : 'SHORT_BREAK')
      updates.break_start_time = now.toISOString()
    } else if (!['BREAK', 'LUNCH'].includes(status) && current.current_break_type) {
      // Ending break - calculate duration
      const breakStart = new Date(current.break_start_time)
      const breakMinutes = Math.round((now.getTime() - breakStart.getTime()) / 60000)
      updates.total_break_minutes = current.total_break_minutes + breakMinutes
      updates.current_break_type = null
      updates.break_start_time = null
    }

    // Handle logout
    if (status === 'OFFLINE') {
      updates.actual_logout_time = now.toISOString()
    }

    const { data: availability, error } = await supabase
      .from('ts_agent_availability')
      .update(updates)
      .eq('sales_executive_id', user.id)
      .eq('shift_date', today)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: availability
    })
  } catch (error) {
    apiLogger.error('Update status error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update status' },
      { status: 500 }
    )
  }
}
