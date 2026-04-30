
/**
 * Customer Categories API
 * Returns category hierarchy for customers based on their employment type
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
  icon_name: string | null
  color_code: string | null
  parent_id: string | null
  employment_type: string | null
  children: CategoryNode[]
}

/**
 * GET /api/customers/categories
 * Returns hierarchical category list filtered by employment type
 * Query params:
 *  - employment_type: SALARIED | SELF_EMPLOYED | OTHER (optional)
 *  - primary_category: string (optional - to get sub-categories)
 *  - sub_category: string (optional - to get specific profiles)
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
    const employmentType = searchParams.get('employment_type')
    const primaryCategory = searchParams.get('primary_category')
    const subCategory = searchParams.get('sub_category')
    const level = searchParams.get('level') ? Number(searchParams.get('level')) : null

    // Build query for categories
    let query = supabase
      .from('customer_category_definitions')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Filter by level if specified
    if (level) {
      query = query.eq('level', level)
    }

    // Filter by employment type (include categories with BOTH or matching type)
    if (employmentType) {
      query = query.or(`employment_type.eq.BOTH,employment_type.eq.${employmentType},employment_type.is.null`)
    }

    // Filter by parent category
    if (subCategory) {
      // Looking for level 3 (specific profiles)
      query = query.eq('sub_category_key', subCategory)
    } else if (primaryCategory) {
      // Looking for level 2 (sub-categories)
      query = query.eq('primary_category_key', primaryCategory)
    }

    const { data: categories, error } = await query

    if (error) {
      apiLogger.error('Error fetching categories', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch categories' },
        { status: 500 }
      )
    }

    // If specific level requested, return flat list
    if (level) {
      return NextResponse.json({
        success: true,
        data: categories,
        count: categories?.length || 0
      })
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
        icon_name: cat.icon_name,
        color_code: cat.color_code,
        parent_id: cat.parent_id,
        employment_type: cat.employment_type || null, // Handle missing column gracefully
        children: []
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
      nodes.sort((a, b) => {
        const aOrder = categories?.find(c => c.id === a.id)?.display_order || 0
        const bOrder = categories?.find(c => c.id === b.id)?.display_order || 0
        return aOrder - bOrder
      })
      nodes.forEach(node => {
        if (node.children.length > 0) {
          sortChildren(node.children)
        }
      })
    }
    sortChildren(rootCategories)

    return NextResponse.json({
      success: true,
      data: rootCategories,
      count: categories?.length || 0
    })

  } catch (error) {
    apiLogger.error('Categories API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
