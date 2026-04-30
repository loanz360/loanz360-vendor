
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * POST /api/partners/upload
 * Uploads files to Supabase Storage
 * Supports: profile pictures, address proofs, cancelled cheques
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a partner
    const { data: partner } = await supabase
      .from('partners')
      .select('id, partner_type')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Not authorized - partner profile not found' },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const field = formData.get('field') as string
    const partnerType = formData.get('partner_type') as string || 'BA'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!field) {
      return NextResponse.json(
        { success: false, error: 'Field name is required' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 5MB' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: JPG, PNG, PDF' },
        { status: 400 }
      )
    }

    // Determine bucket and folder based on field
    let bucket = 'partner-documents'
    let folder = 'documents'

    if (field === 'profile_picture_url') {
      bucket = 'partner-profile-pictures'
      folder = 'profile-pictures'
    } else if (field.includes('address_proof')) {
      folder = 'address-proofs'
    } else if (field === 'cancelled_cheque_url') {
      folder = 'cancelled-cheques'
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()
    const timestamp = Date.now()
    const filename = `${user.id}/${folder}/${field}_${timestamp}.${fileExtension}`

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: true, // Replace existing file
      })

    if (uploadError) {

      // If bucket doesn't exist, provide helpful error message
      if (uploadError.message.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Storage bucket not configured',
            message: `Please create the "${bucket}" bucket in Supabase Storage. See SUPABASE_STORAGE_SETUP.md for instructions.`,
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to upload file',
        },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filename)

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      url: publicUrl,
      filename: file.name,
      size: file.size,
      type: file.type,
      uploaded_at: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
