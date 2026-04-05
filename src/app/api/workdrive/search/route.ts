export const dynamic = 'force-dynamic'

/**
 * WorkDrive Advanced Search API
 * GET - Search files with advanced filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSuperAdmin, isAdmin } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SearchFilters {
  query?: string
  fileTypes?: string[]
  fileCategories?: string[]
  dateFrom?: string
  dateTo?: string
  sizeMin?: number
  sizeMax?: number
  owner?: string
  workspaceId?: string
  folderId?: string
  hasComments?: boolean
  isShared?: boolean
  tags?: string[]
  sortBy?: 'name' | 'size' | 'date' | 'type'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

/**
 * GET /api/workdrive/search
 * Advanced file search with filters
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Parse filters from query params
    const filters: SearchFilters = {
      query: searchParams.get('query') || undefined,
      fileTypes: searchParams.get('fileTypes')?.split(',').filter(Boolean) || undefined,
      fileCategories: searchParams.get('fileCategories')?.split(',').filter(Boolean) || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      sizeMin: searchParams.get('sizeMin') ? parseInt(searchParams.get('sizeMin')!) : undefined,
      sizeMax: searchParams.get('sizeMax') ? parseInt(searchParams.get('sizeMax')!) : undefined,
      owner: searchParams.get('owner') || undefined,
      workspaceId: searchParams.get('workspaceId') || undefined,
      folderId: searchParams.get('folderId') || undefined,
      hasComments: searchParams.get('hasComments') === 'true' ? true :
                   searchParams.get('hasComments') === 'false' ? false : undefined,
      isShared: searchParams.get('isShared') === 'true' ? true :
                searchParams.get('isShared') === 'false' ? false : undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      sortBy: (searchParams.get('sortBy') as any) || 'date',
      sortOrder: (searchParams.get('sortOrder') as any) || 'desc',
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    }

    // Check if user is admin (can search all files)
    const isUserAdmin = await isAdmin(user.id) || await isSuperAdmin(user.id)

    // Build the query
    let query = supabase
      .from('workdrive_files')
      .select(`
        id,
        name,
        original_name,
        file_type,
        file_category,
        mime_type,
        file_size_bytes,
        workspace_id,
        folder_id,
        s3_key,
        thumbnail_s3_key,
        created_by,
        created_at,
        updated_at,
        tags,
        is_deleted,
        version_number,
        is_current_version,
        metadata,
        created_by_profile:profiles!workdrive_files_created_by_fkey(id, full_name, email, avatar_url),
        workspace:workdrive_workspaces!workdrive_files_workspace_id_fkey(id, name, type)
      `, { count: 'exact' })
      .eq('is_deleted', false)
      .eq('is_current_version', true)

    // Access control
    if (!isUserAdmin) {
      // Non-admin users can only see their own files or files in their workspaces
      // Using parameterized values to avoid SQL injection
      query = query.eq('created_by', user.id)
    }

    // Text search - use parameterized ILIKE to avoid SQL injection
    if (filters.query) {
      // Escape special LIKE characters in the search query
      const escapedQuery = filters.query
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
      query = query.or(`name.ilike.%${escapedQuery}%,original_name.ilike.%${escapedQuery}%`)
    }

    // File type filter
    if (filters.fileTypes && filters.fileTypes.length > 0) {
      query = query.in('file_type', filters.fileTypes)
    }

    // File category filter
    if (filters.fileCategories && filters.fileCategories.length > 0) {
      query = query.in('file_category', filters.fileCategories)
    }

    // Date range filter
    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom)
    }
    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo)
    }

    // Size range filter
    if (filters.sizeMin !== undefined) {
      query = query.gte('file_size_bytes', filters.sizeMin)
    }
    if (filters.sizeMax !== undefined) {
      query = query.lte('file_size_bytes', filters.sizeMax)
    }

    // Owner filter
    if (filters.owner) {
      query = query.eq('created_by', filters.owner)
    }

    // Workspace filter
    if (filters.workspaceId) {
      query = query.eq('workspace_id', filters.workspaceId)
    }

    // Folder filter
    if (filters.folderId) {
      query = query.eq('folder_id', filters.folderId)
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags)
    }

    // Sorting
    const sortColumn = filters.sortBy === 'name' ? 'name' :
                       filters.sortBy === 'size' ? 'file_size_bytes' :
                       filters.sortBy === 'type' ? 'file_type' :
                       'created_at'
    query = query.order(sortColumn, { ascending: filters.sortOrder === 'asc' })

    // Pagination
    const page = filters.page || 1
    const limit = Math.min(filters.limit || 20, 100)
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data: files, count, error: searchError } = await query

    if (searchError) {
      apiLogger.error('Search error', searchError)
      return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 })
    }

    // Get additional data for filters that need subqueries
    let filteredFiles = files || []

    // Filter by hasComments if specified
    if (filters.hasComments !== undefined) {
      const fileIds = filteredFiles.map(f => f.id)
      if (fileIds.length > 0) {
        const { data: filesWithComments } = await supabase
          .from('workdrive_comments')
          .select('file_id')
          .in('file_id', fileIds)
          .eq('is_deleted', false)

        const fileIdsWithComments = new Set(filesWithComments?.map(c => c.file_id) || [])

        if (filters.hasComments) {
          filteredFiles = filteredFiles.filter(f => fileIdsWithComments.has(f.id))
        } else {
          filteredFiles = filteredFiles.filter(f => !fileIdsWithComments.has(f.id))
        }
      }
    }

    // Filter by isShared if specified
    if (filters.isShared !== undefined) {
      const fileIds = filteredFiles.map(f => f.id)
      if (fileIds.length > 0) {
        const { data: sharedFiles } = await supabase
          .from('workdrive_shares')
          .select('file_id')
          .in('file_id', fileIds)
          .eq('is_active', true)

        const sharedFileIds = new Set(sharedFiles?.map(s => s.file_id) || [])

        if (filters.isShared) {
          filteredFiles = filteredFiles.filter(f => sharedFileIds.has(f.id))
        } else {
          filteredFiles = filteredFiles.filter(f => !sharedFileIds.has(f.id))
        }
      }
    }

    // Format results
    const results = filteredFiles.map((file: typeof filteredFiles[number]) => ({
      id: file.id,
      name: file.name,
      originalName: file.original_name,
      fileType: file.file_type,
      fileCategory: file.file_category,
      mimeType: file.mime_type,
      fileSizeBytes: file.file_size_bytes,
      workspaceId: file.workspace_id,
      workspaceName: file.workspace?.name,
      folderId: file.folder_id,
      s3Key: file.s3_key,
      thumbnailS3Key: file.thumbnail_s3_key,
      createdBy: file.created_by,
      createdByName: file.created_by_profile?.full_name || file.created_by_profile?.email,
      createdByAvatar: file.created_by_profile?.avatar_url,
      createdAt: file.created_at,
      updatedAt: file.updated_at,
      tags: file.tags || [],
      versionNumber: file.version_number,
      metadata: file.metadata,
    }))

    // Get available filters (for filter dropdowns)
    const availableFilters = await getAvailableFilters(user.id, isUserAdmin)

    return NextResponse.json({
      results,
      total: count || 0,
      page,
      limit,
      hasMore: (count || 0) > offset + limit,
      filters: availableFilters,
    })
  } catch (error) {
    apiLogger.error('Search error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

async function getAvailableFilters(userId: string, isAdmin: boolean) {
  try {
    // Get distinct file types
    const { data: fileTypes } = await supabase
      .from('workdrive_files')
      .select('file_type')
      .eq('is_deleted', false)
      .eq('is_current_version', true)
      .limit(100)

    const uniqueFileTypes = [...new Set(fileTypes?.map(f => f.file_type).filter(Boolean) || [])]

    // Get distinct categories
    const categories = ['document', 'image', 'video', 'audio', 'archive', 'code', 'spreadsheet', 'presentation', 'other']

    // Get workspaces
    let workspacesQuery = supabase
      .from('workdrive_workspaces')
      .select('id, name, type')
      .eq('is_active', true)

    if (!isAdmin) {
      workspacesQuery = workspacesQuery.or('type.eq.organization').eq('owner_id', userId)
    }

    const { data: workspaces } = await workspacesQuery

    // Get users who have uploaded files (for owner filter)
    const { data: owners } = await supabase
      .from('workdrive_files')
      .select('created_by, created_by_profile:profiles!workdrive_files_created_by_fkey(id, full_name, email)')
      .eq('is_deleted', false)
      .eq('is_current_version', true)
      .limit(100)

    const uniqueOwners = owners?.reduce((acc: { id: string; name: string }[], curr: typeof owners[number]) => {
      if (curr.created_by_profile && !acc.find(o => o.id === curr.created_by)) {
        acc.push({
          id: curr.created_by,
          name: curr.created_by_profile.full_name || curr.created_by_profile.email,
        })
      }
      return acc
    }, []) || []

    // Get all unique tags
    const { data: taggedFiles } = await supabase
      .from('workdrive_files')
      .select('tags')
      .eq('is_deleted', false)
      .eq('is_current_version', true)
      .not('tags', 'eq', '{}')
      .limit(100)

    const allTags = taggedFiles?.flatMap(f => f.tags || []) || []
    const uniqueTags = [...new Set(allTags)]

    return {
      fileTypes: uniqueFileTypes,
      categories,
      workspaces: workspaces || [],
      owners: uniqueOwners,
      tags: uniqueTags,
      sizeRanges: [
        { label: 'Less than 1 MB', min: 0, max: 1024 * 1024 },
        { label: '1 MB - 10 MB', min: 1024 * 1024, max: 10 * 1024 * 1024 },
        { label: '10 MB - 100 MB', min: 10 * 1024 * 1024, max: 100 * 1024 * 1024 },
        { label: '100 MB - 1 GB', min: 100 * 1024 * 1024, max: 1024 * 1024 * 1024 },
        { label: 'More than 1 GB', min: 1024 * 1024 * 1024, max: undefined },
      ],
    }
  } catch (error) {
    apiLogger.error('Error getting filters', error)
    return {
      fileTypes: [],
      categories: [],
      workspaces: [],
      owners: [],
      tags: [],
      sizeRanges: [],
    }
  }
}
