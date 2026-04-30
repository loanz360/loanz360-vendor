import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
/**
 * API Route: ULI Sandbox Tester
 * POST /api/superadmin/uli-hub/sandbox — Execute a test call to a ULI service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiLogger } from '@/lib/utils/logger'


// Mock response templates for sandbox testing
const MOCK_RESPONSES: Record<string, Record<string, unknown>> = {
  PAN_VERIFY: {
    status: 'valid',
    name: 'RAJESH KUMAR',
    pan: 'ABCDE1234F',
    category: 'Individual',
    aadhaar_linked: true,
  },
  AADHAAR_VERIFY: {
    status: 'valid',
    name: 'RAJESH KUMAR',
    aadhaar_last_4: '1234',
    gender: 'M',
    state: 'Karnataka',
    age_range: '30-40',
  },
  CIBIL_SCORE: {
    score: 745,
    range: '300-900',
    grade: 'Good',
    accounts: 8,
    defaults: 0,
    enquiries_last_6m: 2,
    report_date: new Date().toISOString().slice(0, 10),
  },
  GSTN_VERIFY: {
    gstin: '29ABCDE1234F1Z5',
    legal_name: 'ABC ENTERPRISES',
    trade_name: 'ABC TECH',
    status: 'Active',
    state: 'Karnataka',
    registration_date: '2018-07-01',
    business_type: 'Private Limited Company',
  },
  BANK_STATEMENT_ANALYSIS: {
    account_holder: 'RAJESH KUMAR',
    bank: 'State Bank of India',
    avg_monthly_balance: 125000,
    avg_monthly_credit: 285000,
    avg_monthly_debit: 230000,
    emi_detected: 3,
    salary_detected: true,
    bounced_cheques: 0,
    analysis_period: '6 months',
  },
  ITR_PULL: {
    pan: 'ABCDE1234F',
    assessment_year: '2025-26',
    gross_income: 1200000,
    total_tax_paid: 145000,
    filing_date: '2025-07-31',
    itr_form: 'ITR-1',
    verification_status: 'e-Verified',
  },
}

export async function POST(request: NextRequest) {
  try {
    const bodySchema = z.object({

      service_code: z.string(),

      payload: z.record(z.unknown()).optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { service_code, payload } = body

    if (!service_code) {
      return NextResponse.json(
        { success: false, error: 'service_code is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Look up the service
    const { data: service, error: svcError } = await supabase
      .from('uli_services')
      .select('*')
      .eq('service_code', service_code)
      .maybeSingle()

    if (svcError || !service) {
      return NextResponse.json(
        { success: false, error: `Service ${service_code} not found` },
        { status: 404 }
      )
    }

    // Simulate API call delay
    const simulatedDelay = 200 + Math.floor(Math.random() * 800)
    await new Promise(r => setTimeout(r, simulatedDelay))

    // Get mock response or generate generic one
    const mockResponse = MOCK_RESPONSES[service_code] || {
      status: 'success',
      service: service_code,
      message: `Sandbox response for ${service.service_name}`,
      mock_data: true,
      timestamp: new Date().toISOString(),
    }

    // Log the sandbox call
    await supabase.from('uli_api_logs').insert({
      service_id: service.id,
      service_code: service.service_code,
      category: service.category,
      environment: 'SANDBOX',
      request_url: `https://sandbox.rbih.org.in${service.uli_api_path || ''}`,
      request_method: service.uli_api_method,
      request_payload: payload || {},
      request_timestamp: new Date().toISOString(),
      response_payload: mockResponse,
      response_timestamp: new Date().toISOString(),
      response_time_ms: simulatedDelay,
      http_status_code: 200,
      is_success: true,
      triggered_by_module: 'SANDBOX_TESTER',
      cost: 0,
    })

    return NextResponse.json({
      success: true,
      data: {
        service_code,
        service_name: service.service_name,
        environment: 'SANDBOX',
        response_time_ms: simulatedDelay,
        response: mockResponse,
        request: payload || {},
      },
    })
  } catch (error) {
    apiLogger.error('ULI sandbox test error', error)
    return NextResponse.json(
      { success: false, error: 'Sandbox test failed' },
      { status: 500 }
    )
  }
}
