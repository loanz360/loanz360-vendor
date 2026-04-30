import { parseBody } from '@/lib/utils/parse-body'

/**
 * Email Templates API
 * CRUD for email templates used by DSE team
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import DOMPurify from 'isomorphic-dompurify'
import { z } from 'zod'

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['customer', 'partner', 'internal', 'general']),
  subject: z.string().min(1).max(255),
  body_html: z.string().min(1),
  body_text: z.string().optional(),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
  })).optional().default([]),
})

// GET - List all active templates
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    let query = supabase
      .from('email_templates')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: false })

    if (category) {
      query = query.eq('category', category)
    }

    const { data: templates, error } = await query

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, data: [] })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data: templates || []
    })
  } catch (error) {
    apiLogger.error('Get email templates error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a custom template
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      action: z.string().optional(),


      template_id: z.string().uuid().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Handle "use template" action - increment usage count
    if (body.action === 'use' && body.template_id) {
      await supabase
        .from('email_templates')
        .update({ usage_count: supabase.rpc ? undefined : 0 }) // Will use RPC if available
        .eq('id', body.template_id)

      // Increment via raw update
      const { error: updateError } = await supabase.rpc('increment_template_usage', {
        p_template_id: body.template_id
      }).catch(() => {
        // Fallback if RPC doesn't exist
        return supabase
          .from('email_templates')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', body.template_id)
      })

      return NextResponse.json({ success: true })
    }

    const parsed = createTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Validation failed'
      }, { status: 400 })
    }

    // Sanitize HTML body
    const sanitizedHtml = DOMPurify.sanitize(parsed.data.body_html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'span', 'div', 'table', 'tr', 'td', 'th', 'thead', 'tbody'],
      ALLOWED_ATTR: ['href', 'style', 'class'],
    })

    const { data: template, error: insertError } = await supabase
      .from('email_templates')
      .insert({
        name: parsed.data.name,
        category: parsed.data.category,
        subject: parsed.data.subject,
        body_html: sanitizedHtml,
        body_text: parsed.data.body_text || '',
        variables: parsed.data.variables,
        is_system: false,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      if (insertError.code === '42P01') {
        return NextResponse.json({
          success: false,
          error: 'Email templates not configured yet',
        }, { status: 503 })
      }
      throw insertError
    }

    return NextResponse.json({
      success: true,
      data: template,
      message: 'Template created successfully'
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Create email template error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a custom template (not system templates)
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('id')

    if (!templateId) {
      return NextResponse.json({ success: false, error: 'Template ID required' }, { status: 400 })
    }

    // Verify ownership and not system template
    const { data: template } = await supabase
      .from('email_templates')
      .select('id, is_system, created_by')
      .eq('id', templateId)
      .maybeSingle()

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    if (template.is_system) {
      return NextResponse.json({ success: false, error: 'Cannot delete system templates' }, { status: 400 })
    }

    if (template.created_by !== user.id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', templateId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true, message: 'Template deleted' })
  } catch (error) {
    apiLogger.error('Delete email template error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
