import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { apiLogger } from '@/lib/utils/logger'
import { NextRequest, NextResponse } from 'next/server'

// Reading history type definitions
interface ReadHistoryEntry {
  id: string
  userId: string
  contentId: string
  contentType: 'faq' | 'glossary' | 'category'
  title: string
  readAt: string
  readCount: number
}

// In-memory storage (in production, this would be a database)
const historyStore: Map<string, ReadHistoryEntry[]> = new Map()

const MAX_HISTORY_ITEMS = 50 // Limit history per user

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const contentType = searchParams.get('contentType')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required',
        data: null
      }, { status: 400 })
    }

    let userHistory = historyStore.get(userId) || []

    // Filter by content type if specified
    if (contentType && ['faq', 'glossary', 'category'].includes(contentType)) {
      userHistory = userHistory.filter(h => h.contentType === contentType)
    }

    // Sort by most recent first
    userHistory.sort((a, b) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime())

    // Apply limit
    const limitedHistory = userHistory.slice(0, Math.min(limit, MAX_HISTORY_ITEMS))

    return NextResponse.json({
      success: true,
      data: {
        history: limitedHistory,
        total: userHistory.length
      }
    })
  } catch (error) {
    apiLogger.error('Knowledge base history error', error)
    return NextResponse.json({
      success: false,
      error: 'An error occurred while fetching reading history',
      data: null
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      userId: z.string().uuid(),

      contentId: z.string().uuid().optional(),

      contentType: z.string().optional(),

      title: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Validate required fields
    if (!body.userId || !body.contentId || !body.contentType || !body.title) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId, contentId, contentType, and title are required',
        data: null
      }, { status: 400 })
    }

    // Validate content type
    if (!['faq', 'glossary', 'category'].includes(body.contentType)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid content type',
        data: null
      }, { status: 400 })
    }

    const userHistory = historyStore.get(body.userId) || []

    // Check if already in history
    const existingIndex = userHistory.findIndex(
      h => h.contentId === body.contentId && h.contentType === body.contentType
    )

    let entry: ReadHistoryEntry

    if (existingIndex >= 0) {
      // Update existing entry
      entry = userHistory[existingIndex]
      entry.readAt = new Date().toISOString()
      entry.readCount += 1

      // Move to front of history
      userHistory.splice(existingIndex, 1)
      userHistory.unshift(entry)
    } else {
      // Create new entry
      entry = {
        id: `rh_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        userId: body.userId,
        contentId: body.contentId,
        contentType: body.contentType,
        title: body.title,
        readAt: new Date().toISOString(),
        readCount: 1
      }

      userHistory.unshift(entry)

      // Trim history if exceeds max
      if (userHistory.length > MAX_HISTORY_ITEMS) {
        userHistory.pop()
      }
    }

    historyStore.set(body.userId, userHistory)

    return NextResponse.json({
      success: true,
      message: 'Reading history updated',
      data: entry
    })
  } catch (error) {
    apiLogger.error('Knowledge base history create error', error)
    return NextResponse.json({
      success: false,
      error: 'An error occurred while updating reading history',
      data: null
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const clearAll = searchParams.get('clearAll') === 'true'
    const entryId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required',
        data: null
      }, { status: 400 })
    }

    // Clear all history for user
    if (clearAll) {
      historyStore.set(userId, [])
      return NextResponse.json({
        success: true,
        message: 'Reading history cleared',
        data: null
      })
    }

    // Remove specific entry
    if (entryId) {
      const userHistory = historyStore.get(userId) || []
      const index = userHistory.findIndex(h => h.id === entryId)

      if (index < 0) {
        return NextResponse.json({
          success: false,
          error: 'History entry not found',
          data: null
        }, { status: 404 })
      }

      const removed = userHistory.splice(index, 1)[0]
      historyStore.set(userId, userHistory)

      return NextResponse.json({
        success: true,
        message: 'History entry removed',
        data: removed
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Either clearAll=true or id is required',
      data: null
    }, { status: 400 })
  } catch (error) {
    apiLogger.error('Knowledge base history delete error', error)
    return NextResponse.json({
      success: false,
      error: 'An error occurred while deleting reading history',
      data: null
    }, { status: 500 })
  }
}
