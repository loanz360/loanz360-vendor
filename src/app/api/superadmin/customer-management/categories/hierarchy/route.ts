
/**
 * Customer Category Hierarchy API
 * Returns complete hierarchical tree structure of all categories
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

interface CategoryNode {
  id: string
  level: number
  category_key: string
  category_name: string
  category_description: string | null
  display_order: number
  icon_name: string | null
  color_code: string | null
  is_active: boolean
  required_documents: string[]
  additional_fields: any[]
  parent_id: string | null
  primary_category_key: string | null
  sub_category_key: string | null
  children: CategoryNode[]
  customerCount?: number
}

/**
 * GET /api/superadmin/customer-management/categories/hierarchy
 * Returns complete hierarchical tree of all categories
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('include_inactive') === 'true'
    const includeCounts = searchParams.get('include_counts') === 'true'

    // Fetch all categories
    let query = supabase
      .from('customer_category_definitions')
      .select('*')
      .order('level', { ascending: true })
      .order('display_order', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data: categories, error } = await query

    if (error) {
      apiLogger.error('Error fetching categories', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch categories' },
        { status: 500 }
      )
    }

    // Get customer counts if requested
    let customerCounts: Record<string, number> = {}
    if (includeCounts) {
      // Get counts by primary_category
      const { data: primaryCounts } = await supabase
        .from('customer_profiles')
        .select('primary_category')

      if (primaryCounts) {
        primaryCounts.forEach(p => {
          if (p.primary_category) {
            customerCounts[p.primary_category] = (customerCounts[p.primary_category] || 0) + 1
          }
        })
      }

      // Get counts by sub_category
      const { data: subCounts } = await supabase
        .from('customer_profiles')
        .select('sub_category')

      if (subCounts) {
        subCounts.forEach(s => {
          if (s.sub_category) {
            customerCounts[s.sub_category] = (customerCounts[s.sub_category] || 0) + 1
          }
        })
      }

      // Get counts by specific_profile
      const { data: specificCounts } = await supabase
        .from('customer_profiles')
        .select('specific_profile')

      if (specificCounts) {
        specificCounts.forEach(s => {
          if (s.specific_profile) {
            customerCounts[s.specific_profile] = (customerCounts[s.specific_profile] || 0) + 1
          }
        })
      }
    }

    // Build hierarchical tree
    const categoryMap = new Map<string, CategoryNode>()
    const rootCategories: CategoryNode[] = []

    // First pass: Create all nodes
    categories?.forEach(cat => {
      const node: CategoryNode = {
        id: cat.id,
        level: cat.level,
        category_key: cat.category_key,
        category_name: cat.category_name,
        category_description: cat.category_description,
        display_order: cat.display_order,
        icon_name: cat.icon_name,
        color_code: cat.color_code,
        is_active: cat.is_active,
        required_documents: cat.required_documents || [],
        additional_fields: cat.additional_fields || [],
        parent_id: cat.parent_id,
        primary_category_key: cat.primary_category_key,
        sub_category_key: cat.sub_category_key,
        children: [],
        customerCount: includeCounts ? (customerCounts[cat.category_key] || 0) : undefined
      }
      categoryMap.set(cat.id, node)
    })

    // Second pass: Build tree structure
    categoryMap.forEach(node => {
      if (node.parent_id && categoryMap.has(node.parent_id)) {
        const parent = categoryMap.get(node.parent_id)!
        parent.children.push(node)
      } else if (node.level === 1) {
        rootCategories.push(node)
      }
    })

    // Sort children by display_order
    const sortChildren = (nodes: CategoryNode[]) => {
      nodes.sort((a, b) => a.display_order - b.display_order)
      nodes.forEach(node => {
        if (node.children.length > 0) {
          sortChildren(node.children)
        }
      })
    }
    sortChildren(rootCategories)

    // Calculate total counts
    const counts = {
      level1: categories?.filter(c => c.level === 1).length || 0,
      level2: categories?.filter(c => c.level === 2).length || 0,
      level3: categories?.filter(c => c.level === 3).length || 0,
      total: categories?.length || 0,
      active: categories?.filter(c => c.is_active).length || 0,
      inactive: categories?.filter(c => !c.is_active).length || 0
    }

    return NextResponse.json({
      success: true,
      data: rootCategories,
      counts,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    apiLogger.error('Category hierarchy error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
