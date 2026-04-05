export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import logger from '@/lib/monitoring/logger'
import { AI_IMAGE_CONFIG, CONTEST_UPLOAD_CONFIG } from '@/lib/constants/contest-config'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is super admin
    const { data: superAdmin, error: superAdminError } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (superAdminError || !superAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden - Super Admin access required' }, { status: 403 })
    }

    // Get the prompt from request body
    const body = await request.json()
    const { prompt, contestTitle } = body

    if (!prompt && !contestTitle) {
      return NextResponse.json({ success: false, error: 'Either prompt or contest title is required' }, { status: 400 })
    }

    // Create AI prompt
    const aiPrompt = prompt || `Professional business contest banner for "${contestTitle}". Modern, clean design with trophies, success symbols, and professional aesthetic. Corporate style, vibrant colors, motivational theme.`

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to environment variables.' },
        { status: 500 }
      )
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Generate image with DALL-E
    const response = await openai.images.generate({
      model: AI_IMAGE_CONFIG.MODEL,
      prompt: aiPrompt,
      n: AI_IMAGE_CONFIG.IMAGE_COUNT,
      size: AI_IMAGE_CONFIG.SIZE,
      quality: AI_IMAGE_CONFIG.QUALITY,
      style: AI_IMAGE_CONFIG.STYLE,
    })

    const imageUrl = response.data[0]?.url

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: 'Failed to generate image' }, { status: 500 })
    }

    // Download the generated image
    const imageResponse = await fetch(imageUrl)
    const imageBuffer = await imageResponse.arrayBuffer()

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(7)
    const filename = `contest-ai-${timestamp}-${randomString}.png`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(CONTEST_UPLOAD_CONFIG.STORAGE_BUCKET)
      .upload(filename, imageBuffer, {
        contentType: 'image/png',
        cacheControl: CONTEST_UPLOAD_CONFIG.CACHE_CONTROL_SECONDS,
        upsert: false,
      })

    if (uploadError) {
      logger.error('AI generated image upload failed', { error: uploadError, userId: user.id })
      // Return the temporary OpenAI URL if upload fails
      return NextResponse.json({
        success: true,
        url: imageUrl,
        isTemporary: true,
        message: 'Image generated but failed to upload to storage. Using temporary URL.',
      })
    }

    // Get public URL from Supabase
    const { data: urlData } = supabase.storage.from(CONTEST_UPLOAD_CONFIG.STORAGE_BUCKET).getPublicUrl(filename)

    if (!urlData?.publicUrl) {
      logger.error('Failed to get public URL for uploaded image', { filename, userId: user.id })
      // Fallback to temporary OpenAI URL
      return NextResponse.json({
        success: true,
        url: imageUrl,
        isTemporary: true,
        message: 'Image uploaded but failed to get public URL. Using temporary URL.',
      })
    }

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      filename: filename,
      prompt: aiPrompt,
    })
  } catch (error) {
    logger.error('AI image generation failed', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
