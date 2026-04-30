
/**
 * PIN Code Lookup API
 * Fetches city, state, and district information based on Indian PIN code
 * Uses India Post API for accurate postal data
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'

interface PincodeData {
  city: string
  district: string
  state: string
  country: string
  postOffices?: Array<{
    name: string
    branchType: string
    deliveryStatus: string
  }>
}

interface IndiaPostResponse {
  Message: string
  Status: string
  PostOffice: Array<{
    Name: string
    Description: string | null
    BranchType: string
    DeliveryStatus: string
    Circle: string
    District: string
    Division: string
    Region: string
    Block: string
    State: string
    Country: string
    Pincode: string
  }> | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pincode: string }> }
) {
  const { pincode } = await params

  // Validate PIN code format (6 digits, first digit 1-9)
  if (!pincode || !/^[1-9][0-9]{5}$/.test(pincode)) {
    return NextResponse.json(
      { success: false, error: 'Invalid PIN code format. Must be 6 digits.' },
      { status: 400 }
    )
  }

  try {
    // Fetch from India Post API
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      headers: {
        'Accept': 'application/json',
      },
      // Cache for 24 hours as PIN code data doesn't change often
      next: { revalidate: 86400 }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch from postal service')
    }

    const data: IndiaPostResponse[] = await response.json()

    if (!data || data.length === 0 || data[0].Status !== 'Success' || !data[0].PostOffice || data[0].PostOffice.length === 0) {
      return NextResponse.json(
        { success: false, error: 'PIN code not found' },
        { status: 404 }
      )
    }

    const postOffices = data[0].PostOffice
    const firstOffice = postOffices[0]

    // Return the data
    const result: PincodeData = {
      city: firstOffice.Block || firstOffice.District,
      district: firstOffice.District,
      state: firstOffice.State,
      country: firstOffice.Country,
      postOffices: postOffices.map(po => ({
        name: po.Name,
        branchType: po.BranchType,
        deliveryStatus: po.DeliveryStatus
      }))
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    // Log error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Fallback: Try alternative API or return generic error
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to fetch PIN code data. Please try again or enter city/state manually.',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
