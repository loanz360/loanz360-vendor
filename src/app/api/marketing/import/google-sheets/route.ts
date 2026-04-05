export const dynamic = 'force-dynamic'

import { apiLogger } from '@/lib/utils/logger'
import { NextRequest, NextResponse } from 'next/server'

// Google Sheets API endpoint for public spreadsheets
const GOOGLE_SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

export async function POST(request: NextRequest) {
  try {
    const { sheetUrl, sheetName } = await request.json()

    if (!sheetUrl) {
      return NextResponse.json({ success: false, error: 'Google Sheet URL is required' }, { status: 400 })
    }

    // Extract sheet ID from URL
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!match) {
      return NextResponse.json({ success: false, error: 'Invalid Google Sheet URL' }, { status: 400 })
    }

    const spreadsheetId = match[1]
    const apiKey = process.env.GOOGLE_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google API key not configured. Please add GOOGLE_API_KEY to environment variables.' },
        { status: 500 }
      )
    }

    // First, get spreadsheet metadata to find sheet names
    const metadataUrl = `${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}?key=${apiKey}&fields=sheets.properties`
    const metadataResponse = await fetch(metadataUrl)

    if (!metadataResponse.ok) {
      const errorData = await metadataResponse.json().catch(() => ({}))
      apiLogger.error('Google Sheets metadata error', errorData)

      if (metadataResponse.status === 403) {
        return NextResponse.json(
          { error: 'Access denied. Make sure the spreadsheet is shared publicly or with "Anyone with the link can view".' },
          { status: 403 }
        )
      }
      if (metadataResponse.status === 404) {
        return NextResponse.json(
          { error: 'Spreadsheet not found. Please check the URL.' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to access Google Sheet' },
        { status: metadataResponse.status }
      )
    }

    const metadata = await metadataResponse.json()
    const sheets = metadata.sheets || []

    if (sheets.length === 0) {
      return NextResponse.json({ success: false, error: 'No sheets found in the spreadsheet' }, { status: 400 })
    }

    // Use specified sheet or first sheet
    const targetSheet = sheetName || sheets[0]?.properties?.title || 'Sheet1'

    // Fetch the sheet data
    const dataUrl = `${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(targetSheet)}?key=${apiKey}&valueRenderOption=FORMATTED_VALUE`
    const dataResponse = await fetch(dataUrl)

    if (!dataResponse.ok) {
      const errorData = await dataResponse.json().catch(() => ({}))
      apiLogger.error('Google Sheets data error', errorData)
      return NextResponse.json(
        { error: `Failed to fetch sheet data: ${errorData.error?.message || 'Unknown error'}` },
        { status: dataResponse.status }
      )
    }

    const data = await dataResponse.json()
    const values = data.values || []

    if (values.length < 2) {
      return NextResponse.json(
        { error: 'Sheet must have at least a header row and one data row' },
        { status: 400 }
      )
    }

    // Parse headers and rows
    const headers = values[0].map((h: any) => String(h || '').trim())
    const rows = values.slice(1).map((row: any[]) => {
      const obj: Record<string, string> = {}
      headers.forEach((header: string, i: number) => {
        obj[header] = String(row[i] || '').trim()
      })
      return obj
    }).filter((row: Record<string, string>) => Object.values(row).some(v => v)) // Filter empty rows

    // Get available sheets for response
    const availableSheets = sheets.map((s: any) => s.properties?.title).filter(Boolean)

    return NextResponse.json({
      success: true,
      spreadsheetId,
      sheetName: targetSheet,
      availableSheets,
      headers,
      rows,
      totalRows: rows.length,
    })
  } catch (error: unknown) {
    apiLogger.error('Google Sheets import error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch available sheets from a spreadsheet
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sheetUrl = searchParams.get('url')

    if (!sheetUrl) {
      return NextResponse.json({ success: false, error: 'Google Sheet URL is required' }, { status: 400 })
    }

    // Extract sheet ID from URL
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!match) {
      return NextResponse.json({ success: false, error: 'Invalid Google Sheet URL' }, { status: 400 })
    }

    const spreadsheetId = match[1]
    const apiKey = process.env.GOOGLE_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google API key not configured' },
        { status: 500 }
      )
    }

    // Get spreadsheet metadata
    const metadataUrl = `${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}?key=${apiKey}&fields=properties.title,sheets.properties`
    const response = await fetch(metadataUrl)

    if (!response.ok) {
      if (response.status === 403) {
        return NextResponse.json(
          { error: 'Access denied. Make sure the spreadsheet is shared publicly.' },
          { status: 403 }
        )
      }
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Spreadsheet not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to access Google Sheet' },
        { status: response.status }
      )
    }

    const metadata = await response.json()
    const sheets = metadata.sheets?.map((s: any) => ({
      title: s.properties?.title,
      index: s.properties?.index,
      rowCount: s.properties?.gridProperties?.rowCount,
      columnCount: s.properties?.gridProperties?.columnCount,
    })) || []

    return NextResponse.json({
      success: true,
      spreadsheetTitle: metadata.properties?.title,
      spreadsheetId,
      sheets,
    })
  } catch (error: unknown) {
    apiLogger.error('Google Sheets metadata error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
