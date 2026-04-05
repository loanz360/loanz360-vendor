/**
 * Unified Upload Service
 * Handles all contact uploads for Database Management
 * Supports: Email Database, SMS Database
 */

import { createClient } from '@/lib/supabase/client'
import { parseFile, validateContact, generateDedupeKey } from '@/lib/parsers/fileParser'

export type DatabaseType = 'email' | 'sms' | 'general' | 'mixed'
export type DeduplicationStrategy = 'skip' | 'update' | 'merge'

export interface UploadOptions {
  databaseType: DatabaseType
  destinationFolder?: string
  deduplicationStrategy: DeduplicationStrategy
  validateOnly?: boolean
  source?: string
  sourceReferenceId?: string
  sourceReferenceType?: string
}

export interface UploadResult {
  success: boolean
  importId: string
  fileName: string
  totalRows: number
  processedRows: number
  importedCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  duplicateCount: number
  errors: Array<{
    row: number
    data: any
    error: string
    fieldName?: string
  }>
  estimatedTime?: number
}

export interface ContactData {
  // Email fields
  email?: string
  first_name?: string
  last_name?: string
  name?: string

  // SMS fields
  mobile_number?: string
  phone?: string
  country_code?: string

  // Common fields
  company?: string
  designation?: string
  location_city?: string
  location_state?: string
  website?: string
  linkedin_url?: string
  notes?: string
  tags?: string[]
  custom_fields?: Record<string, any>
}

class UnifiedUploadService {
  private supabase = createClient()

  /**
   * Upload and process a file
   */
  async uploadFile(
    file: File,
    options: UploadOptions
  ): Promise<UploadResult> {
    const startTime = Date.now()

    try {
      // Step 1: Validate file
      this.validateFile(file)

      // Step 2: Parse file
      const buffer = await file.arrayBuffer()
      const parsedData = await parseFile(Buffer.from(buffer), file.name)

      if (!parsedData || parsedData.length === 0) {
        throw new Error('No valid data found in file')
      }

      // Step 3: Create import record
      const importRecord = await this.createImportRecord(file, options, parsedData.length)

      // Step 4: Upload file to storage
      const storagePath = await this.uploadToStorage(file, importRecord.id)

      // Step 5: Process contacts based on database type
      const result = await this.processContacts(
        parsedData,
        options,
        importRecord.id,
        storagePath
      )

      // Step 6: Update import record with results
      await this.updateImportRecord(importRecord.id, result, 'completed')

      const estimatedTime = Date.now() - startTime

      return {
        ...result,
        success: true,
        importId: importRecord.id,
        fileName: file.name,
        estimatedTime
      }
    } catch (error) {
      console.error('Upload error:', error)
      throw error
    }
  }

  /**
   * Validate file before processing
   */
  private validateFile(file: File): void {
    const maxSize = 50 * 1024 * 1024 // 50MB
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ]

    if (file.size > maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`)
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not supported`)
    }
  }

  /**
   * Create import tracking record
   */
  private async createImportRecord(
    file: File,
    options: UploadOptions,
    totalRows: number
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('marketing_database_imports')
      .insert({
        database_type: options.databaseType,
        filename: file.name,
        file_type: this.getFileExtension(file.name),
        file_size_bytes: file.size,
        total_rows: totalRows,
        status: 'processing',
        destination_table: this.getDestinationTable(options.databaseType),
        import_type: options.databaseType
      })
      .select()
      .maybeSingle()

    if (error) throw new Error(`Failed to create import record: ${error instanceof Error ? error.message : String(error)}`)
    return data
  }

  /**
   * Upload file to Supabase storage
   */
  private async uploadToStorage(file: File, importId: string): Promise<string> {
    const fileName = `${importId}/${Date.now()}-${file.name}`

    const { data, error } = await this.supabase.storage
      .from('database-files')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      })

    if (error) throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : String(error)}`)
    return data.path
  }

  /**
   * Process contacts and insert into appropriate table
   */
  private async processContacts(
    contacts: any[],
    options: UploadOptions,
    importId: string,
    storagePath: string
  ): Promise<Omit<UploadResult, 'success' | 'importId' | 'fileName' | 'estimatedTime'>> {
    const errors: UploadResult['errors'] = []
    let importedCount = 0
    let updatedCount = 0
    let skippedCount = 0
    let failedCount = 0
    let duplicateCount = 0

    for (let i = 0; i < contacts.length; i++) {
      try {
        const contact = this.normalizeContact(contacts[i], options.databaseType)

        // Validate contact
        const validation = this.validateContactForDatabase(contact, options.databaseType)
        if (!validation.valid) {
          errors.push({
            row: i + 1,
            data: contact,
            error: validation.error || 'Validation failed',
            fieldName: validation.field
          })
          failedCount++
          continue
        }

        // Insert or update contact
        const result = await this.insertContact(contact, options, importId, storagePath)

        if (result.inserted) {
          importedCount++
        } else if (result.updated) {
          updatedCount++
        } else if (result.duplicate) {
          duplicateCount++
          skippedCount++
        } else {
          skippedCount++
        }
      } catch (error: unknown) {
        errors.push({
          row: i + 1,
          data: contacts[i],
          error: (error instanceof Error ? error.message : String(error)) || 'Unknown error'
        })
        failedCount++
      }
    }

    // Also log detailed errors to database
    if (errors.length > 0) {
      await this.logImportErrors(importId, errors)
    }

    return {
      totalRows: contacts.length,
      processedRows: contacts.length,
      importedCount,
      updatedCount,
      skippedCount,
      failedCount,
      duplicateCount,
      errors
    }
  }

  /**
   * Normalize contact data for specific database type
   */
  private normalizeContact(data: any, databaseType: DatabaseType): ContactData {
    const normalized: ContactData = {
      company: data.company || data.organization,
      designation: data.designation || data.title || data.job_title,
      location_city: data.location_city || data.city,
      location_state: data.location_state || data.state,
      website: data.website || data.company_website,
      linkedin_url: data.linkedin_url || data.linkedin,
      notes: data.notes || data.comments
    }

    if (databaseType === 'email' || databaseType === 'general' || databaseType === 'mixed') {
      normalized.email = (data.email || data.email_address || '').toLowerCase().trim()
      normalized.first_name = data.first_name || data.firstname
      normalized.last_name = data.last_name || data.lastname
      normalized.name = data.name || data.full_name ||
                       `${normalized.first_name || ''} ${normalized.last_name || ''}`.trim()
    }

    if (databaseType === 'sms' || databaseType === 'general' || databaseType === 'mixed') {
      const phone = data.phone || data.mobile || data.mobile_number || data.cell
      normalized.mobile_number = phone ? phone.replace(/[^0-9]/g, '') : undefined
      normalized.country_code = data.country_code || '+91'
    }

    // Handle tags
    if (data.tags) {
      normalized.tags = Array.isArray(data.tags)
        ? data.tags
        : data.tags.split(',').map((t: string) => t.trim())
    }

    // Handle custom fields
    const knownFields = ['email', 'name', 'phone', 'company', 'designation', 'location_city',
                         'location_state', 'website', 'linkedin_url', 'notes', 'tags']
    const customFields: Record<string, any> = {}

    Object.keys(data).forEach(key => {
      if (!knownFields.includes(key) && data[key]) {
        customFields[key] = data[key]
      }
    })

    if (Object.keys(customFields).length > 0) {
      normalized.custom_fields = customFields
    }

    return normalized
  }

  /**
   * Validate contact for specific database type
   */
  private validateContactForDatabase(
    contact: ContactData,
    databaseType: DatabaseType
  ): { valid: boolean; error?: string; field?: string } {
    if (databaseType === 'email') {
      if (!contact.email) {
        return { valid: false, error: 'Email is required', field: 'email' }
      }
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
      if (!emailRegex.test(contact.email)) {
        return { valid: false, error: 'Invalid email format', field: 'email' }
      }
    }

    if (databaseType === 'sms') {
      if (!contact.mobile_number) {
        return { valid: false, error: 'Mobile number is required', field: 'mobile_number' }
      }
      if (contact.mobile_number.length < 10) {
        return { valid: false, error: 'Invalid mobile number (minimum 10 digits)', field: 'mobile_number' }
      }
    }

    if (databaseType === 'general' || databaseType === 'mixed') {
      if (!contact.email && !contact.mobile_number) {
        return { valid: false, error: 'Either email or mobile number is required' }
      }
    }

    return { valid: true }
  }

  /**
   * Insert contact into appropriate database
   */
  private async insertContact(
    contact: ContactData,
    options: UploadOptions,
    importId: string,
    storagePath: string
  ): Promise<{ inserted: boolean; updated: boolean; duplicate: boolean }> {
    const { databaseType, deduplicationStrategy, source, sourceReferenceId, sourceReferenceType } = options

    if (databaseType === 'email') {
      return await this.insertEmailContact(contact, deduplicationStrategy, {
        source: source || 'file_upload',
        sourceReferenceId: sourceReferenceId || importId,
        sourceReferenceType: sourceReferenceType || 'import',
        importBatchId: importId
      })
    }

    if (databaseType === 'sms') {
      return await this.insertSmsContact(contact, deduplicationStrategy, {
        source: source || 'file_upload',
        sourceReferenceId: sourceReferenceId || importId,
        sourceReferenceType: sourceReferenceType || 'import',
        importBatchId: importId
      })
    }

    // For general/mixed, try both
    const results = { inserted: false, updated: false, duplicate: false }

    if (contact.email) {
      const emailResult = await this.insertEmailContact(contact, deduplicationStrategy, {
        source: source || 'file_upload',
        sourceReferenceId: sourceReferenceId || importId,
        sourceReferenceType: sourceReferenceType || 'import',
        importBatchId: importId
      })
      results.inserted = results.inserted || emailResult.inserted
      results.updated = results.updated || emailResult.updated
    }

    if (contact.mobile_number) {
      const smsResult = await this.insertSmsContact(contact, deduplicationStrategy, {
        source: source || 'file_upload',
        sourceReferenceId: sourceReferenceId || importId,
        sourceReferenceType: sourceReferenceType || 'import',
        importBatchId: importId
      })
      results.inserted = results.inserted || smsResult.inserted
      results.updated = results.updated || smsResult.updated
    }

    return results
  }

  /**
   * Insert email contact
   */
  private async insertEmailContact(
    contact: ContactData,
    strategy: DeduplicationStrategy,
    metadata: any
  ): Promise<{ inserted: boolean; updated: boolean; duplicate: boolean }> {
    if (!contact.email) {
      return { inserted: false, updated: false, duplicate: false }
    }

    // Check if exists
    const { data: existing } = await this.supabase
      .from('email_database_contacts')
      .select('id')
      .eq('email', contact.email)
      .maybeSingle()

    if (existing) {
      if (strategy === 'skip') {
        return { inserted: false, updated: false, duplicate: true }
      }

      if (strategy === 'update' || strategy === 'merge') {
        const { error } = await this.supabase
          .from('email_database_contacts')
          .update({
            name: contact.name || undefined,
            first_name: contact.first_name || undefined,
            last_name: contact.last_name || undefined,
            phone: contact.mobile_number || undefined,
            company: contact.company || undefined,
            designation: contact.designation || undefined,
            location_city: contact.location_city || undefined,
            location_state: contact.location_state || undefined,
            website: contact.website || undefined,
            linkedin_url: contact.linkedin_url || undefined,
            notes: contact.notes || undefined,
            tags: contact.tags || undefined,
            custom_fields: contact.custom_fields || undefined,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)

        if (error) throw error
        return { inserted: false, updated: true, duplicate: false }
      }
    }

    // Insert new contact
    const { error } = await this.supabase
      .from('email_database_contacts')
      .insert({
        email: contact.email,
        name: contact.name,
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone: contact.mobile_number,
        company: contact.company,
        designation: contact.designation,
        location_city: contact.location_city,
        location_state: contact.location_state,
        website: contact.website,
        linkedin_url: contact.linkedin_url,
        notes: contact.notes,
        tags: contact.tags,
        custom_fields: contact.custom_fields,
        ...metadata
      })

    if (error) {
      if (error.code === '23505') { // Unique violation
        return { inserted: false, updated: false, duplicate: true }
      }
      throw error
    }

    return { inserted: true, updated: false, duplicate: false }
  }

  /**
   * Insert SMS contact
   */
  private async insertSmsContact(
    contact: ContactData,
    strategy: DeduplicationStrategy,
    metadata: any
  ): Promise<{ inserted: boolean; updated: boolean; duplicate: boolean }> {
    if (!contact.mobile_number) {
      return { inserted: false, updated: false, duplicate: false }
    }

    // Check if exists
    const { data: existing } = await this.supabase
      .from('sms_database_contacts')
      .select('id')
      .eq('mobile_number', contact.mobile_number)
      .maybeSingle()

    if (existing) {
      if (strategy === 'skip') {
        return { inserted: false, updated: false, duplicate: true }
      }

      if (strategy === 'update' || strategy === 'merge') {
        const { error } = await this.supabase
          .from('sms_database_contacts')
          .update({
            name: contact.name || undefined,
            company: contact.company || undefined,
            designation: contact.designation || undefined,
            location_city: contact.location_city || undefined,
            location_state: contact.location_state || undefined,
            notes: contact.notes || undefined,
            tags: contact.tags || undefined,
            custom_fields: contact.custom_fields || undefined,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)

        if (error) throw error
        return { inserted: false, updated: true, duplicate: false }
      }
    }

    // Insert new contact
    const { error } = await this.supabase
      .from('sms_database_contacts')
      .insert({
        mobile_number: contact.mobile_number,
        country_code: contact.country_code || '+91',
        name: contact.name,
        company: contact.company,
        designation: contact.designation,
        location_city: contact.location_city,
        location_state: contact.location_state,
        notes: contact.notes,
        tags: contact.tags,
        custom_fields: contact.custom_fields,
        ...metadata
      })

    if (error) {
      if (error.code === '23505') { // Unique violation
        return { inserted: false, updated: false, duplicate: true }
      }
      throw error
    }

    return { inserted: true, updated: false, duplicate: false }
  }

  /**
   * Update import record with final results
   */
  private async updateImportRecord(
    importId: string,
    result: Omit<UploadResult, 'success' | 'importId' | 'fileName' | 'estimatedTime'>,
    status: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('marketing_database_imports')
      .update({
        processed_rows: result.processedRows,
        imported_count: result.importedCount,
        updated_count: result.updatedCount,
        skipped_count: result.skippedCount,
        failed_count: result.failedCount,
        duplicate_count: result.duplicateCount,
        status,
        completed_at: new Date().toISOString()
      })
      .eq('id', importId)

    if (error) {
      console.error('Failed to update import record:', error)
    }
  }

  /**
   * Log import errors to database
   */
  private async logImportErrors(importId: string, errors: UploadResult['errors']): Promise<void> {
    const errorRecords = errors.map(err => ({
      import_id: importId,
      row_number: err.row,
      original_data: err.data,
      error_type: this.categorizeError(err.error),
      error_message: err.error,
      field_name: err.fieldName
    }))

    const { error } = await this.supabase
      .from('marketing_database_import_errors')
      .insert(errorRecords)

    if (error) {
      console.error('Failed to log import errors:', error)
    }
  }

  /**
   * Categorize error for tracking
   */
  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('email') || errorMessage.includes('Email')) {
      return 'invalid_format'
    }
    if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
      return 'duplicate'
    }
    if (errorMessage.includes('required')) {
      return 'missing_required'
    }
    return 'validation_failed'
  }

  /**
   * Get file extension
   */
  private getFileExtension(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase()
    return ext === 'xlsx' || ext === 'xls' ? 'xlsx' : ext === 'csv' ? 'csv' : 'txt'
  }

  /**
   * Get destination table based on database type
   */
  private getDestinationTable(databaseType: DatabaseType): string {
    switch (databaseType) {
      case 'email':
        return 'email_database_contacts'
      case 'sms':
        return 'sms_database_contacts'
      case 'general':
      case 'mixed':
        return 'email_database_contacts,sms_database_contacts'
      default:
        return 'unknown'
    }
  }
}

export const unifiedUploadService = new UnifiedUploadService()
