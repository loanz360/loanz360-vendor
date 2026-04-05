'use client'

/**
 * Admin Import/Export Component
 *
 * Features:
 * - File upload with drag & drop
 * - CSV and Excel support
 * - Real-time validation preview
 * - Bulk import with progress tracking
 * - Export with filtering options
 * - Error reporting with row-level details
 */

import { useState, useRef, useCallback } from 'react'
import {
  parseImportFile,
  validateImportRecords,
  exportAdmins,
  type ImportValidationResult,
  type ExportFormat,
  type ExportOptions,
} from '@/lib/import-export/admin-import'

// ============================================================================
// TYPES
// ============================================================================

type Tab = 'import' | 'export'

interface ImportState {
  file: File | null
  parsing: boolean
  validating: boolean
  importing: boolean
  validation: ImportValidationResult | null
  progress: number
  error: string | null
  success: boolean
}

interface ExportState {
  exporting: boolean
  format: ExportFormat
  includeIds: boolean
  includeDates: boolean
  error: string | null
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AdminImportExport() {
  const [activeTab, setActiveTab] = useState<Tab>('import')

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('import')}
            className={`${
              activeTab === 'import'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Import Admins
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`${
              activeTab === 'export'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Export Admins
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'import' ? <ImportTab /> : <ExportTab />}
    </div>
  )
}

// ============================================================================
// IMPORT TAB
// ============================================================================

function ImportTab() {
  const [state, setState] = useState<ImportState>({
    file: null,
    parsing: false,
    validating: false,
    importing: false,
    validation: null,
    progress: 0,
    error: null,
    success: false,
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (file: File) => {
    setState((prev) => ({
      ...prev,
      file,
      parsing: true,
      error: null,
      validation: null,
      success: false,
    }))

    try {
      // Parse file
      const records = await parseImportFile(file)

      setState((prev) => ({ ...prev, parsing: false, validating: true }))

      // Fetch existing emails/phones for duplicate detection
      const response = await fetch('/api/admin-management/existing-contacts')
      const { emails, phones } = await response.json()

      // Validate records
      const validation = validateImportRecords(
        records,
        new Set(emails),
        new Set(phones)
      )

      setState((prev) => ({
        ...prev,
        validating: false,
        validation,
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        parsing: false,
        validating: false,
        error: (error as Error).message,
      }))
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect]
  )

  const handleImport = async () => {
    if (!state.validation || state.validation.valid.length === 0) return

    setState((prev) => ({ ...prev, importing: true, progress: 0, error: null }))

    try {
      const response = await fetch('/api/admin-management/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admins: state.validation.valid }),
      })

      if (!response.ok) {
        throw new Error('Import failed')
      }

      const result = await response.json()

      setState((prev) => ({
        ...prev,
        importing: false,
        progress: 100,
        success: true,
      }))

      // Reset after 3 seconds
      setTimeout(() => {
        setState({
          file: null,
          parsing: false,
          validating: false,
          importing: false,
          validation: null,
          progress: 0,
          error: null,
          success: false,
        })
      }, 3000)
    } catch (error) {
      setState((prev) => ({
        ...prev,
        importing: false,
        error: (error as Error).message,
      }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      {!state.validation && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
            className="hidden"
          />
          <div className="space-y-4">
            <div className="text-6xl">📁</div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                Drop your file here or click to browse
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Supports CSV and Excel (.xlsx) files
              </p>
            </div>
            {state.file && (
              <p className="text-sm text-blue-600 font-medium">
                Selected: {state.file.name}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading States */}
      {(state.parsing || state.validating) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-900 font-medium">
            {state.parsing ? 'Parsing file...' : 'Validating records...'}
          </p>
        </div>
      )}

      {/* Validation Results */}
      {state.validation && !state.success && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total" value={state.validation.stats.totalRows} color="gray" />
            <StatCard
              label="Valid"
              value={state.validation.stats.validRows}
              color="green"
            />
            <StatCard
              label="Invalid"
              value={state.validation.stats.invalidRows}
              color="red"
            />
            <StatCard
              label="Duplicates"
              value={state.validation.stats.duplicateRows}
              color="yellow"
            />
          </div>

          {/* Success Rate */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Success Rate</span>
              <span className="text-sm font-bold text-gray-900">
                {state.validation.stats.successRate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${state.validation.stats.successRate}%` }}
              ></div>
            </div>
          </div>

          {/* Invalid Records */}
          {state.validation.invalid.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-medium text-red-900 mb-3">
                Invalid Records ({state.validation.invalid.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {state.validation.invalid.map((record, index) => (
                  <div
                    key={index}
                    className="bg-white border border-red-200 rounded p-3 text-sm"
                  >
                    <p className="font-medium text-red-900 mb-1">
                      Row {record.row}
                    </p>
                    <ul className="list-disc list-inside text-red-700 space-y-1">
                      {record.errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duplicate Records */}
          {state.validation.duplicates.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-medium text-yellow-900 mb-3">
                Duplicate Records ({state.validation.duplicates.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {state.validation.duplicates.map((record, index) => (
                  <div
                    key={index}
                    className="bg-white border border-yellow-200 rounded p-3 text-sm"
                  >
                    <p className="font-medium text-yellow-900">
                      Row {record.row}: {record.data.email}
                    </p>
                    <p className="text-yellow-700">
                      Duplicate {record.duplicateType}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Button */}
          <div className="flex justify-between items-center">
            <button
              onClick={() =>
                setState({
                  file: null,
                  parsing: false,
                  validating: false,
                  importing: false,
                  validation: null,
                  progress: 0,
                  error: null,
                  success: false,
                })
              }
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={
                state.validation.valid.length === 0 || state.importing
              }
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.importing
                ? 'Importing...'
                : `Import ${state.validation.valid.length} Admin${
                    state.validation.valid.length !== 1 ? 's' : ''
                  }`}
            </button>
          </div>
        </div>
      )}

      {/* Success Message */}
      {state.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-lg font-medium text-green-900">
            Import Successful!
          </p>
          <p className="text-sm text-green-700 mt-1">
            {state.validation?.valid.length} admin(s) imported successfully
          </p>
        </div>
      )}

      {/* Error Message */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-900 font-medium">Error: {state.error}</p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EXPORT TAB
// ============================================================================

function ExportTab() {
  const [state, setState] = useState<ExportState>({
    exporting: false,
    format: 'xlsx',
    includeIds: false,
    includeDates: true,
    error: null,
  })

  const handleExport = async () => {
    setState((prev) => ({ ...prev, exporting: true, error: null }))

    try {
      const options: ExportOptions = {
        format: state.format,
        includeIds: state.includeIds,
        includeDates: state.includeDates,
      }

      const response = await fetch('/api/admin-management/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const admins = await response.json()

      // Generate and download file
      exportAdmins(admins, options)

      setState((prev) => ({ ...prev, exporting: false }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        exporting: false,
        error: (error as Error).message,
      }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Format Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Export Format
        </label>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="xlsx"
              checked={state.format === 'xlsx'}
              onChange={(e) =>
                setState((prev) => ({ ...prev, format: e.target.value as ExportFormat }))
              }
              className="mr-2"
            />
            <span className="text-sm">Excel (.xlsx)</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="csv"
              checked={state.format === 'csv'}
              onChange={(e) =>
                setState((prev) => ({ ...prev, format: e.target.value as ExportFormat }))
              }
              className="mr-2"
            />
            <span className="text-sm">CSV (.csv)</span>
          </label>
        </div>
      </div>

      {/* Options */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Include
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={state.includeIds}
              onChange={(e) =>
                setState((prev) => ({ ...prev, includeIds: e.target.checked }))
              }
              className="mr-2"
            />
            <span className="text-sm">Admin IDs</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={state.includeDates}
              onChange={(e) =>
                setState((prev) => ({ ...prev, includeDates: e.target.checked }))
              }
              className="mr-2"
            />
            <span className="text-sm">Timestamps (Created, Updated, Last Login)</span>
          </label>
        </div>
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={state.exporting}
        className="w-full px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state.exporting ? 'Exporting...' : 'Export Admins'}
      </button>

      {/* Error Message */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-900 font-medium">Error: {state.error}</p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'gray' | 'green' | 'red' | 'yellow'
}) {
  const colors = {
    gray: 'bg-gray-50 border-gray-200 text-gray-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  }

  return (
    <div className={`${colors[color]} border rounded-lg p-4 text-center`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  )
}
