import { Workbook } from 'exceljs'
import * as Papa from 'papaparse'
import { Contact } from '../supabase/types'
import { logger } from '../utils/logger'

interface ParsedContact {
  full_name?: string
  email?: string
  phone?: string
  company?: string
  location?: string
}

// Extract contact information from text (for TXT files)
function extractContactsFromText(text: string): ParsedContact[] {
  const lines = text.split('\n').filter(line => line.trim())
  const contacts: ParsedContact[] = []

  for (const line of lines) {
    const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
    const phoneMatch = line.match(/(\+91|91)?[\s-]?[6-9]\d{9}|\+?\d{10,13}/g)

    // Try to extract name (first part before comma or email)
    const parts = line.split(/[,;]/)
    const name = parts[0]?.trim()

    if (emailMatch || phoneMatch) {
      contacts.push({
        full_name: name || undefined,
        email: emailMatch?.[0] || undefined,
        phone: phoneMatch?.[0]?.replace(/[\s-]/g, '') || undefined
      })
    }
  }

  return contacts
}

// Normalize contact data
function normalizeContact(data: any): ParsedContact {
  return {
    full_name: data.name || data.full_name || data.Name || data['Full Name'] || data['Customer Name'] || undefined,
    email: data.email || data.Email || data['Email Address'] || undefined,
    phone: data.phone || data.mobile || data.Mobile || data.Phone || data['Phone Number'] || data['Mobile Number'] || undefined,
    company: data.company || data.Company || data.Organization || data['Company Name'] || undefined,
    location: data.location || data.Location || data.City || data.city || undefined
  }
}

// Parse CSV file
async function parseCSV(buffer: Buffer): Promise<ParsedContact[]> {
  const text = buffer.toString('utf-8')

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const contacts = results.data.map((row: any) => normalizeContact(row))
        resolve(contacts.filter(c => c.email || c.phone))
      },
      error: (error) => reject(error)
    })
  })
}

// Parse Excel file (XLSX, XLS)
// SECURITY NOTE: Migrated from xlsx to exceljs@^4.4.0 to address CVE vulnerabilities
// Security measures:
// 1. File validation via magic bytes before parsing (src/lib/security/file-validation.ts)
// 2. File size limits enforced (10MB max)
// 3. Using exceljs which doesn't execute formulas by default
async function parseExcel(buffer: Buffer): Promise<ParsedContact[]> {
  const MAX_EXCEL_SIZE = 10 * 1024 * 1024 // 10MB
  if (buffer.length > MAX_EXCEL_SIZE) {
    throw new Error('Excel file too large (max 10MB)')
  }

  const workbook = new Workbook()
  await workbook.xlsx.load(buffer as any)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new Error('Excel file contains no worksheets')
  }

  const contacts: ParsedContact[] = []
  const headers: string[] = []

  // Read headers from first row
  const firstRow = worksheet.getRow(1)
  firstRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = cell.text || cell.value?.toString() || ''
  })

  // Read data rows (skip header row)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    const rowData: any = {}
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1]
      if (header) {
        rowData[header] = cell.text || cell.value?.toString() || ''
      }
    })

    const contact = normalizeContact(rowData)
    if (contact.email || contact.phone) {
      contacts.push(contact)
    }
  })

  return contacts
}

// Parse TXT file
async function parseTXT(buffer: Buffer): Promise<ParsedContact[]> {
  const text = buffer.toString('utf-8')
  return extractContactsFromText(text)
}

// Main parser function
export async function parseFile(
  buffer: Buffer,
  fileName: string
): Promise<ParsedContact[]> {
  const ext = fileName.toLowerCase().split('.').pop()

  try {
    switch (ext) {
      case 'csv':
        return await parseCSV(buffer)
      case 'xlsx':
      case 'xls':
        return await parseExcel(buffer)
      case 'txt':
        return await parseTXT(buffer)
      case 'pdf':
        // PDF parsing temporarily disabled due to build issues with pdf-parse
        // Will be re-enabled in a future update with a compatible PDF library
        throw new Error('PDF file parsing is currently not supported. Please convert to CSV, Excel, or TXT format.')
      default:
        throw new Error(`Unsupported file type: ${ext}. Supported formats: CSV, Excel (XLSX/XLS), TXT`)
    }
  } catch (error) {
    logger.error(`Error parsing ${fileName}`, error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}

// Generate dedupe key for contact
export function generateDedupeKey(contact: ParsedContact): string {
  const email = contact.email?.toLowerCase().trim() || ''
  const phone = contact.phone?.replace(/[\s-+]/g, '') || ''
  return `${email}-${phone}`
}

// Validate and clean contact data
export function validateContact(contact: ParsedContact): boolean {
  // At minimum, contact should have either email or phone
  if (!contact.email && !contact.phone) return false

  // Validate email format
  if (contact.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(contact.email)) return false
  }

  // Validate phone format (10-13 digits)
  if (contact.phone) {
    const phoneDigits = contact.phone.replace(/\D/g, '')
    if (phoneDigits.length < 10 || phoneDigits.length > 13) return false
  }

  return true
}
