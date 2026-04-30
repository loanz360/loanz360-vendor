import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'


// GET - Export payout grid data
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams

    // Get partner profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, sub_role, full_name')
      .eq('id', auth.userId)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    // Map sub_role to partner type
    const partnerTypeMap: Record<string, string> = {
      'BUSINESS_ASSOCIATE': 'BA',
      'BUSINESS_PARTNER': 'BP',
      'CHANNEL_PARTNER': 'CP'
    }
    const partnerType = partnerTypeMap[profile.sub_role || ''] || (profile.role === 'PARTNER' ? 'BA' : null)

    if (!partnerType && !auth.isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Invalid partner type' }, { status: 400 })
    }

    // Get export type
    const exportType = searchParams.get('type') || 'grid' // grid, analytics, forecast
    const format = searchParams.get('format') || 'csv' // csv, json

    let data: unknown[] = []
    let filename = ''

    if (exportType === 'grid') {
      // Export payout grid
      const tableName = `payout_${partnerType.toLowerCase()}_percentages`
      const { data: rates, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('is_current', true)
        .order('bank_name', { ascending: true })
        .order('location', { ascending: true })
        .order('loan_type', { ascending: true })

      if (error) {
        throw new Error('Failed to fetch payout grid data')
      }

      data = (rates || []).map(rate => ({
        'Bank/NBFC': rate.bank_name,
        'Location': rate.location,
        'Loan Type': rate.loan_type,
        'Commission %': rate.commission_percentage,
        'Effective From': rate.effective_from || 'N/A',
        'Conditions': rate.conditions ? rate.conditions.join('; ') : '',
        'Specific Conditions': rate.specific_conditions || ''
      }))

      filename = `payout_grid_${partnerType}_${new Date().toISOString().split('T')[0]}`
    } else if (exportType === 'analytics') {
      // Export analytics summary
      // This would typically query the disbursements table
      // For now, return sample data structure
      data = [{
        'Metric': 'Total Disbursements',
        'Value': 'N/A - Configure disbursements table'
      }, {
        'Metric': 'Total Commission',
        'Value': 'N/A - Configure disbursements table'
      }]

      filename = `commission_analytics_${partnerType}_${new Date().toISOString().split('T')[0]}`
    } else if (exportType === 'rates_by_bank') {
      // Export rates grouped by bank
      const tableName = `payout_${partnerType.toLowerCase()}_percentages`
      const { data: rates } = await supabase
        .from(tableName)
        .select('*')
        .eq('is_current', true)
        .order('bank_name', { ascending: true })

      const bankGroups = new Map<string, any[]>()
      rates?.forEach(rate => {
        const existing = bankGroups.get(rate.bank_name) || []
        existing.push(rate)
        bankGroups.set(rate.bank_name, existing)
      })

      data = []
      bankGroups.forEach((bankRates, bankName) => {
        bankRates.forEach(rate => {
          data.push({
            'Bank/NBFC': rate.bank_name,
            'Location': rate.location,
            'Loan Type': rate.loan_type,
            'Commission %': rate.commission_percentage,
            'Effective From': rate.effective_from || 'N/A'
          })
        })
      })

      filename = `rates_by_bank_${partnerType}_${new Date().toISOString().split('T')[0]}`
    }

    // Generate output based on format
    if (format === 'json') {
      return NextResponse.json({
        data,
        exported_at: new Date().toISOString(),
        exported_by: profile.full_name,
        partner_type: partnerType,
        record_count: data.length
      })
    } else {
      // CSV format
      if (data.length === 0) {
        return new NextResponse('No data to export', {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${filename}.csv"`
          }
        })
      }

      const headers = Object.keys(data[0])
      const csvRows = [
        headers.join(','), // Header row
        ...data.map(row =>
          headers.map(header => {
            const value = row[header]
            // Escape values with commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`
            }
            return value ?? ''
          }).join(',')
        )
      ]

      const csv = csvRows.join('\n')

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`
        }
      })
    }
  } catch (error: unknown) {
    apiLogger.error('Error in export API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
