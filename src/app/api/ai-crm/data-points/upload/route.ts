
/**
 * Data Points Upload API
 * Super Admin uploads CSV/Excel files with customer data
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// API Route Runtime: Node.js (for file processing)
export const runtime = 'nodejs'

// Validation schema for contact data
const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number'),
  alternate_phone: z.string().regex(/^[6-9]\d{9}$/).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  location: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  loan_type: z.string().optional(),
  loan_amount: z.number().optional().or(z.string().transform(val => parseFloat(val) || undefined)),
  business_name: z.string().optional(),
  business_type: z.string().optional(),
})

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPLOAD)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = createSupabaseAdmin()

    // Check if user is Super Admin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Access denied. Super Admin only.' },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const category = formData.get('category') as string
    const loan_type = formData.get('loan_type') as string
    const location = formData.get('location') as string
    const notes = formData.get('notes') as string

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const fileName = file.name
    const fileExtension = fileName.split('.').pop()?.toLowerCase()

    if (!['csv', 'xlsx', 'xls'].includes(fileExtension || '')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only CSV and Excel files are allowed.' },
        { status: 400 }
      )
    }

    // Read file buffer
    const buffer = await file.arrayBuffer()

    // Parse file based on type
    const workbook = new ExcelJS.Workbook()
    let rawData: unknown[] = []

    if (fileExtension === 'csv') {
      await workbook.csv.read(Buffer.from(buffer))
    } else {
      await workbook.xlsx.load(buffer)
    }

    // Get first worksheet
    const worksheet = workbook.worksheets[0]

    // Convert to JSON
    const headers: string[] = []
    worksheet.getRow(1).eachCell((cell) => {
      headers.push(cell.value?.toString() || '')
    })

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip header row
      const rowData: Record<string, unknown> = {}
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1]
        if (header) {
          rowData[header] = cell.value
        }
      })
      if (Object.keys(rowData).length > 0) {
        rawData.push(rowData)
      }
    })

    if (rawData.length === 0) {
      return NextResponse.json(
        { error: 'File is empty or has no valid data' },
        { status: 400 }
      )
    }

    // Normalize column names (handle variations)
    const normalizedData = rawData.map((row) => {
      const normalized: Record<string, unknown> = {}

      Object.keys(row).forEach((key) => {
        const lowerKey = key.toLowerCase().trim()

        if (lowerKey.includes('name') && !lowerKey.includes('business')) {
          normalized.name = row[key]
        } else if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('contact')) {
          if (!normalized.phone) {
            normalized.phone = row[key]
          } else {
            normalized.alternate_phone = row[key]
          }
        } else if (lowerKey.includes('email')) {
          normalized.email = row[key]
        } else if (lowerKey.includes('city')) {
          normalized.city = row[key]
        } else if (lowerKey.includes('state')) {
          normalized.state = row[key]
        } else if (lowerKey.includes('location') || lowerKey.includes('address')) {
          normalized.location = row[key]
        } else if (lowerKey.includes('loan') && (lowerKey.includes('type') || lowerKey.includes('category'))) {
          normalized.loan_type = row[key]
        } else if (lowerKey.includes('amount') || lowerKey.includes('loan')) {
          normalized.loan_amount = row[key]
        } else if (lowerKey.includes('business') && lowerKey.includes('name')) {
          normalized.business_name = row[key]
        } else if (lowerKey.includes('business') && lowerKey.includes('type')) {
          normalized.business_type = row[key]
        }
      })

      return normalized
    })

    // Validate and clean data
    const validContacts: unknown[] = []
    const invalidContacts: unknown[] = []
    const duplicatePhones = new Set<string>()
    const seenPhones = new Set<string>()

    for (const row of normalizedData) {
      try {
        // Clean phone number
        if (row.phone) {
          row.phone = String(row.phone).replace(/\D/g, '').slice(-10)
        }
        if (row.alternate_phone) {
          row.alternate_phone = String(row.alternate_phone).replace(/\D/g, '').slice(-10)
        }

        // Validate
        const validated = contactSchema.parse(row)

        // Check for duplicates within file
        if (seenPhones.has(validated.phone)) {
          duplicatePhones.add(validated.phone)
          invalidContacts.push({ row, reason: 'Duplicate phone in file' })
          continue
        }

        seenPhones.add(validated.phone)
        validContacts.push(validated)
      } catch (error) {
        invalidContacts.push({
          row,
          reason: error instanceof Error ? error.message : 'Validation failed',
        })
      }
    }

    if (validContacts.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid contacts found in file',
          invalid_count: invalidContacts.length,
          invalid_samples: invalidContacts.slice(0, 5),
        },
        { status: 400 }
      )
    }

    // Check for duplicates in database
    const phones = validContacts.map((c) => c.phone)
    const { data: existingContacts } = await supabase
      .from('crm_contacts')
      .select('phone')
      .in('phone', phones)

    const existingPhones = new Set(existingContacts?.map((c) => c.phone) || [])

    // Filter out existing contacts
    const newContacts = validContacts.filter((c) => !existingPhones.has(c.phone))
    const alreadyExists = validContacts.filter((c) => existingPhones.has(c.phone))

    if (newContacts.length === 0) {
      return NextResponse.json(
        {
          error: 'All contacts already exist in database',
          total_records: rawData.length,
          already_exists: alreadyExists.length,
        },
        { status: 400 }
      )
    }

    // Create data point record
    const { data: dataPoint, error: dataPointError } = await supabase
      .from('data_points')
      .insert({
        file_name: fileName,
        uploaded_by: user.id,
        total_records: newContacts.length,
        assigned_records: 0,
        unassigned_records: newContacts.length,
        category: category || loan_type || 'General',
        loan_type: loan_type || undefined,
        location: location || undefined,
        status: 'active',
        notes: notes || undefined,
      })
      .select()
      .maybeSingle()

    if (dataPointError) {
      throw dataPointError
    }

    // Insert contacts
    const contactsToInsert = newContacts.map((contact) => ({
      data_point_id: dataPoint.id,
      ...contact,
      status: 'new',
      call_count: 0,
    }))

    const { error: insertError } = await supabase
      .from('crm_contacts')
      .insert(contactsToInsert)

    if (insertError) {
      // Rollback data point if contact insert fails
      await supabase.from('data_points').delete().eq('id', dataPoint.id)
      throw insertError
    }

    return NextResponse.json({
      success: true,
      data: {
        data_point_id: dataPoint.id,
        file_name: fileName,
        total_uploaded: newContacts.length,
        total_in_file: rawData.length,
        already_exists: alreadyExists.length,
        invalid: invalidContacts.length,
        duplicates_in_file: duplicatePhones.size,
      },
      message: `Successfully uploaded ${newContacts.length} contacts`,
    })
  } catch (error) {
    apiLogger.error('Upload error', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
