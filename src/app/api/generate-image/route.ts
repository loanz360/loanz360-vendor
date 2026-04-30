import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { GoogleGenerativeAI } from '@google/generative-ai'

// POST - Generate AI image using Google Gemini Imagen
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userData?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const bodySchema = z.object({

      prompt: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { prompt } = body

    // Validate prompt
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      )
    }

    // Validate prompt length (min 10 chars, max 1000 chars)
    if (prompt.trim().length < 10 || prompt.length > 1000) {
      return NextResponse.json(
        { error: 'Prompt must be between 10 and 1000 characters' },
        { status: 400 }
      )
    }

    // Check if Gemini API key is configured
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'Google Gemini API key not configured. Please set GEMINI_API_KEY in environment variables.' },
        { status: 500 }
      )
    }

    // Enhanced prompt for banner-specific requirements
    const enhancedPrompt = `Create a professional, high-quality banner image in landscape orientation (wide format, suitable for 1200x300 web banner). Theme: ${prompt}. Style: Clean, modern financial services aesthetic suitable for a loan management platform (Loanz360). Use professional colors, subtle gradients, and leave space for text overlay. No text in the image.`

    // Use Google Gemini for image generation via Imagen
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    // Generate image description and then use Imagen
    // Gemini 2.0 flash can generate images inline
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: `Generate a banner image: ${enhancedPrompt}` }]
      }],
      generationConfig: {
        responseModalities: ['image', 'text'] as unknown as undefined,
      } as Record<string, unknown>,
    })

    const response = result.response
    let imageBuffer: Buffer | null = null

    // Extract image from response parts
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      const inlineData = (part as Record<string, unknown>).inlineData as { mimeType: string; data: string } | undefined
      if (inlineData?.mimeType?.startsWith('image/')) {
        imageBuffer = Buffer.from(inlineData.data, 'base64')
        break
      }
    }

    if (!imageBuffer) {
      // Fallback: Use Imagen API directly if Gemini inline image not available
      const imagenResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: enhancedPrompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: '16:9',
              safetyFilterLevel: 'block_few',
            }
          })
        }
      )

      if (!imagenResponse.ok) {
        const errData = await imagenResponse.json().catch(() => ({}))
        apiLogger.error('Imagen API error', errData)
        throw new Error((errData as Record<string, unknown>)?.error?.toString() || 'Failed to generate image with Imagen')
      }

      const imagenData = await imagenResponse.json() as {
        predictions?: Array<{ bytesBase64Encoded: string; mimeType: string }>
      }
      const base64Image = imagenData.predictions?.[0]?.bytesBase64Encoded

      if (!base64Image) {
        throw new Error('No image returned from Google Imagen API')
      }

      imageBuffer = Buffer.from(base64Image, 'base64')
    }

    // Generate unique filename
    const filename = `banner-ai-${Date.now()}-${Math.random().toString(36).substring(7)}.png`
    const filePath = `banners/${filename}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from('public')
      .upload(filePath, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      apiLogger.error('Upload error', uploadError)
      throw new Error('Failed to upload image to storage')
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('public')
      .getPublicUrl(filePath)

    return NextResponse.json({
      url: publicUrl,
      filename,
      success: true
    })

  } catch (error: unknown) {
    apiLogger.error('Error generating AI image', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
