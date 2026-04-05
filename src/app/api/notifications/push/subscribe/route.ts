export const dynamic = 'force-dynamic'

// Push Notification Subscription API
// POST: Subscribe to push notifications
// DELETE: Unsubscribe from push notifications

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateSubscription, getPublicVAPIDKey } from '@/lib/push/push-service'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  // Return public VAPID key for client-side subscription
  const publicKey = getPublicVAPIDKey()

  if (!publicKey) {
    return NextResponse.json(
      { error: 'Push notifications not configured' },
      { status: 503 }
    )
  }

  return NextResponse.json({ publicKey })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subscription, device_name, device_type } = body

    if (!subscription || !validateSubscription(subscription)) {
      return NextResponse.json(
        { error: 'Invalid subscription object' },
        { status: 400 }
      )
    }

    // Check for existing subscription with same endpoint
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('endpoint', subscription.endpoint)
      .maybeSingle()

    if (existing) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({
          subscription,
          is_active: true,
          device_name,
          device_type,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Failed to update subscription' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Subscription updated',
        subscription_id: existing.id
      })
    }

    // Create new subscription
    const { data: newSub, error: insertError } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        subscription,
        device_name: device_name || 'Unknown Device',
        device_type: device_type || 'web',
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select('id')
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Subscription insert error', insertError)
      return NextResponse.json({ success: false, error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to push notifications',
      subscription_id: newSub.id
    })

  } catch (error: unknown) {
    apiLogger.error('Subscribe error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get('endpoint')
    const subscriptionId = searchParams.get('id')

    let query = supabase
      .from('push_subscriptions')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)

    if (subscriptionId) {
      query = query.eq('id', subscriptionId)
    } else if (endpoint) {
      query = query.eq('endpoint', endpoint)
    } else {
      // Deactivate all subscriptions for user
    }

    const { error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to unsubscribe' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed from push notifications'
    })

  } catch (error: unknown) {
    apiLogger.error('Unsubscribe error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
