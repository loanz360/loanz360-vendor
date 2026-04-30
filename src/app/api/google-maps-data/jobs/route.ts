import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const lambda = new LambdaClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

// GET - Fetch all jobs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('google_maps_jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, count, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total: count,
        limit,
        offset
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching jobs', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create and start a new scraping job
export async function POST(request: NextRequest) {
  try {
    const bodySchema = z.object({

      action: z.string().optional(),

      job_id: z.string().uuid(),

      processed_keywords: z.string().optional(),

      total_businesses: z.string().optional(),

      successful_scrapes: z.string().optional(),

      failed_scrapes: z.string().optional(),

      status: z.string().optional(),

      error_log: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { action, job_id } = body

    if (action === 'start') {
      // Get pending keywords
      const { data: pendingKeywords, error: keywordsError } = await supabase
        .from('google_maps_keywords')
        .select('*')
        .eq('status', 'pending')

      if (keywordsError) throw keywordsError

      if (!pendingKeywords || pendingKeywords.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No pending keywords to scrape' },
          { status: 400 }
        )
      }

      // Create a new job
      const { data: job, error: jobError } = await supabase
        .from('google_maps_jobs')
        .insert({
          job_name: `Scraping Job - ${new Date().toLocaleString()}`,
          job_type: 'manual',
          status: 'running',
          total_keywords: pendingKeywords.length,
          processed_keywords: 0,
          total_businesses: 0,
          successful_scrapes: 0,
          failed_scrapes: 0,
          started_at: new Date().toISOString(),
          settings: {
            batch_size: 50,
            delay_min: 3000,
            delay_max: 10000
          }
        })
        .select()
        .maybeSingle()

      if (jobError) throw jobError

      // Update keywords to queued status
      const keywordIds = pendingKeywords.map(k => k.id)
      await supabase
        .from('google_maps_keywords')
        .update({ status: 'queued' })
        .in('id', keywordIds)

      // Trigger Lambda function (if deployed)
      try {
        const command = new InvokeCommand({
          FunctionName: 'google-maps-scraper',
          InvocationType: 'Event', // Async invocation
          Payload: JSON.stringify({
            job_id: job.id,
            keywords: pendingKeywords.slice(0, 10), // Start with first 10
            supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
            supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY
          })
        })

        await lambda.send(command)
      } catch (lambdaError: unknown) {
        // Don't fail the request - job is created, Lambda can be triggered later
      }

      return NextResponse.json({
        success: true,
        data: job,
        message: 'Scraping job started'
      })
    } else if (action === 'pause' && job_id) {
      const { error } = await supabase
        .from('google_maps_jobs')
        .update({ status: 'paused' })
        .eq('id', job_id)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Job paused'
      })
    } else if (action === 'resume' && job_id) {
      const { error } = await supabase
        .from('google_maps_jobs')
        .update({ status: 'running' })
        .eq('id', job_id)

      if (error) throw error

      // Re-trigger Lambda
      try {
        const command = new InvokeCommand({
          FunctionName: 'google-maps-scraper',
          InvocationType: 'Event',
          Payload: JSON.stringify({
            job_id,
            resume: true,
            supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
            supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY
          })
        })

        await lambda.send(command)
      } catch (lambdaError: unknown) {
      }

      return NextResponse.json({
        success: true,
        message: 'Job resumed'
      })
    } else if (action === 'cancel' && job_id) {
      const { error } = await supabase
        .from('google_maps_jobs')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', job_id)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Job cancelled'
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: unknown) {
    apiLogger.error('Error managing job', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update job progress (called by Lambda)
export async function PATCH(request: NextRequest) {
  try {
    const bodySchema2 = z.object({

      error_log: z.string().optional(),

      total_businesses: z.string().optional(),

      failed_scrapes: z.string().optional(),

      successful_scrapes: z.string().optional(),

      status: z.string().optional(),

      processed_keywords: z.string().optional(),

      job_id: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const {
      job_id,
      processed_keywords,
      total_businesses,
      successful_scrapes,
      failed_scrapes,
      status,
      error_log
    } = body

    if (!job_id) {
      return NextResponse.json(
        { success: false, error: 'job_id is required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}

    if (processed_keywords !== undefined) updateData.processed_keywords = processed_keywords
    if (total_businesses !== undefined) updateData.total_businesses = total_businesses
    if (successful_scrapes !== undefined) updateData.successful_scrapes = successful_scrapes
    if (failed_scrapes !== undefined) updateData.failed_scrapes = failed_scrapes
    if (status) {
      updateData.status = status
      if (status === 'completed' || status === 'failed') {
        updateData.completed_at = new Date().toISOString()
      }
    }
    if (error_log) {
      // Append to error log
      const { data: currentJob } = await supabase
        .from('google_maps_jobs')
        .select('error_log')
        .eq('id', job_id)
        .maybeSingle()

      const existingLog = currentJob?.error_log || []
      updateData.error_log = [...existingLog, ...error_log]
    }

    const { data, error } = await supabase
      .from('google_maps_jobs')
      .update(updateData)
      .eq('id', job_id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: unknown) {
    apiLogger.error('Error updating job', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
