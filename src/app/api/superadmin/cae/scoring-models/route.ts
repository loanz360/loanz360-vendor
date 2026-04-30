
import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const { data, error } = await supabase.from('cae_scoring_models').select('*').order('created_at', { ascending: false })
    if (error) return NextResponse.json({ success: true, data: [] })
    return NextResponse.json({ success: true, data: data || [] })
  } catch {
    return NextResponse.json({ success: true, data: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { data, error } = await supabase.from('cae_scoring_models').insert({ ...body, created_by: user.id }).select().single()
    if (error) return NextResponse.json({ success: false, error: 'An unexpected error occurred' }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create model' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { id, ...updates } = body
    const { data, error } = await supabase.from('cae_scoring_models').update({ ...updates, updated_by: user.id, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) return NextResponse.json({ success: false, error: 'An unexpected error occurred' }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update model' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Missing model ID' }, { status: 400 })
    const { error } = await supabase.from('cae_scoring_models').update({ status: 'archived', updated_by: user.id }).eq('id', id)
    if (error) return NextResponse.json({ success: false, error: 'An unexpected error occurred' }, { status: 500 })
    return NextResponse.json({ success: true, message: 'Model archived' })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to archive model' }, { status: 500 })
  }
}
