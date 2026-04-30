
/**
 * Customer Password Setup API
 * Allows customers to set their password after registration
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { jwtVerify } from 'jose'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function POST(request: NextRequest) {
  try {
    const { customer_id, password } = await request.json()

    // Validate
    if (!customer_id || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer ID and password are required',
        },
        { status: 400 }
      )
    }

    // Verify token from cookie
    const token = request.cookies.get('customer_token')?.value
    if (token) {
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET)
        if (payload.customerId !== customer_id) {
          return NextResponse.json(
            {
              success: false,
              error: 'Unauthorized',
            },
            { status: 401 }
          )
        }
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid token',
          },
          { status: 401 }
        )
      }
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password must be at least 8 characters long',
        },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Update customer
    const { error } = await supabase
      .from('customers')
      .update({
        password_hash: passwordHash,
        password_set_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', customer_id)

    if (error) {
      apiLogger.error('Password setup error', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to set password',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password set successfully',
    })
  } catch (error) {
    apiLogger.error('Set Password Error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
