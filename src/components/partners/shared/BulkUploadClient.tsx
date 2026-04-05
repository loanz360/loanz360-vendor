'use client'

import { useState, useCallback } from 'react'
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Trash2 } from 'lucide-react'

interface ParsedRow {
  customer_name: string
  customer_mobile: string
  customer_email: string
  customer_city: string
  customer_pincode: string
  loan_type: string
  estimated_amount: string
}

interface UploadResult {
  row: number
  status: 'success' | 'error'
  message: string
  lead_id?: string
}

interface BulkUploadClientProps {
  partnerType: 'BA' | 'BP'
}

const HEADERS = ['customer_name', 'customer_mobile', 'customer_email', 'customer_city', 'customer_pincode', 'loan_type', 'estimated_amount']

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        values.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  values.push(current.trim())
  return values
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ''))
  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const values = parseCSVLine(lines[i])
    if (values.length < 3) continue

    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })

    rows.push({
      customer_name: row.customer_name || '',
      customer_mobile: row.customer_mobile || '',
      customer_email: row.customer_email || '',
      customer_city: row.customer_city || '',
      customer_pincode: row.customer_pincode || '',
      loan_type: row.loan_type || '',
      estimated_amount: row.estimated_amount || '',
    })
  }

  return rows
}

export function BulkUploadClient({ partnerType }: BulkUploadClientProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<{ total: number; success: number; failed: number; results: UploadResult[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const apiBase = `/api/partners/${partnerType.toLowerCase()}/leads/bulk-upload`

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setResults(null)
    setError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      if (rows.length === 0) {
        setError('No valid data rows found. Please check your CSV format.')
        return
      }
      setParsedRows(rows)
    }
    reader.readAsText(f)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.txt'))) {
      handleFile(f)
    } else {
      setError('Please upload a CSV file')
    }
  }, [handleFile])

  const handleUpload = async () => {
    if (parsedRows.length === 0) return
    setUploading(true)
    setError(null)
    setResults(null)

    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows }),
      })
      const result = await res.json()
      if (result.success) {
        setResults(result.data)
      } else {
        setError(result.error || 'Upload failed')
      }
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleClear = () => {
    setFile(null)
    setParsedRows([])
    setResults(null)
    setError(null)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
            <Upload className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-poppins">Bulk Lead Upload</h1>
            <p className="text-sm text-gray-400">Upload multiple leads at once via CSV file</p>
          </div>
        </div>
        <a
          href={apiBase}
          download
          className="px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download Template
        </a>
      </div>

      {/* Instructions */}
      <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
        <h3 className="text-sm font-medium text-blue-400 mb-2">How to upload:</h3>
        <ol className="text-xs text-blue-300/80 space-y-1 list-decimal list-inside">
          <li>Download the CSV template using the button above</li>
          <li>Fill in customer details (name, mobile, loan type are required)</li>
          <li>Save and upload the CSV file below</li>
          <li>Review the preview, then click &ldquo;Upload Leads&rdquo;</li>
        </ol>
      </div>

      {/* Drop Zone */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-orange-500 bg-orange-500/5' : 'border-gray-700/50 hover:border-gray-600'
          }`}
          onClick={() => document.getElementById('csv-input')?.click()}
        >
          <FileSpreadsheet className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-sm text-gray-300">Drag & drop your CSV file here</p>
          <p className="text-xs text-gray-500 mt-1">or click to browse (max 100 rows)</p>
          <input
            id="csv-input"
            type="file"
            accept=".csv,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
            className="hidden"
          />
        </div>
      )}

      {/* File Info + Clear */}
      {file && !results && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-800/30 border border-gray-700/30">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-orange-400" />
            <div>
              <p className="text-sm text-white">{file.name}</p>
              <p className="text-xs text-gray-500">{parsedRows.length} rows parsed</p>
            </div>
          </div>
          <button onClick={handleClear} className="p-2 text-gray-400 hover:text-red-400 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Preview Table */}
      {parsedRows.length > 0 && !results && (
        <div className="rounded-xl border border-gray-800/50 overflow-hidden">
          <div className="p-3 bg-gray-800/30 border-b border-gray-700/30">
            <p className="text-xs text-gray-400">Preview (showing first {Math.min(parsedRows.length, 5)} of {parsedRows.length} rows)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-800/20">
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">#</th>
                  {HEADERS.map(h => (
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">
                      {h.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-gray-800/30">
                    <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                    <td className="px-3 py-2 text-white">{row.customer_name}</td>
                    <td className="px-3 py-2 text-gray-300">{row.customer_mobile}</td>
                    <td className="px-3 py-2 text-gray-300">{row.customer_email}</td>
                    <td className="px-3 py-2 text-gray-300">{row.customer_city}</td>
                    <td className="px-3 py-2 text-gray-300">{row.customer_pincode}</td>
                    <td className="px-3 py-2 text-orange-400">{row.loan_type}</td>
                    <td className="px-3 py-2 text-gray-300">{row.estimated_amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Button */}
      {parsedRows.length > 0 && !results && (
        <div className="flex justify-end">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading {parsedRows.length} leads...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload {parsedRows.length} Leads
              </>
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/30 text-center">
              <p className="text-2xl font-bold text-white">{results.total}</p>
              <p className="text-xs text-gray-400">Total Rows</p>
            </div>
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
              <p className="text-2xl font-bold text-green-400">{results.success}</p>
              <p className="text-xs text-gray-400">Successful</p>
            </div>
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
              <p className="text-2xl font-bold text-red-400">{results.failed}</p>
              <p className="text-xs text-gray-400">Failed</p>
            </div>
          </div>

          {/* Detailed Results */}
          {results.results.filter(r => r.status === 'error').length > 0 && (
            <div className="rounded-xl border border-red-500/20 overflow-hidden">
              <div className="p-3 bg-red-500/5 border-b border-red-500/10">
                <p className="text-xs text-red-400 font-medium">Failed Rows</p>
              </div>
              <div className="divide-y divide-gray-800/30">
                {results.results.filter(r => r.status === 'error').map((r) => (
                  <div key={r.row} className="px-4 py-2 flex items-center gap-3">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="text-xs text-gray-400">Row {r.row}:</span>
                    <span className="text-xs text-red-300">{r.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload More */}
          <div className="flex justify-center">
            <button
              onClick={handleClear}
              className="px-4 py-2 rounded-lg text-sm text-orange-400 hover:text-orange-300 border border-orange-500/30 hover:border-orange-500/50 transition-colors"
            >
              Upload Another File
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
