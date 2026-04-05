'use client'

import { toast } from 'sonner'

import React, { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clientLogger } from '@/lib/utils/client-logger'

interface ValidationError {
  row: number
  email: string
  errors: string[]
}

interface ImportResult {
  totalRows: number
  successful: number
  failed: number
  errors: { email: string; error: string }[]
}

export default function CSVBulkImport() {
  const [file, setFile] = useState<File | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [step, setStep] = useState<'upload' | 'validate' | 'import' | 'complete'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile)
      setValidationErrors([])
      setImportResult(null)
      setStep('upload')
    } else {
      toast.error('Please select a valid CSV file')
    }
  }

  const handleValidate = async () => {
    if (!file) return

    setIsValidating(true)
    setValidationErrors([])

    try {
      const formData = new FormData()
      formData.append('csv', file)
      formData.append('validateOnly', 'true')

      const response = await fetch('/api/employees/bulk-import', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        // Validation passed
        setStep('validate')
        clientLogger.info('CSV validation passed', result.stats)
      } else if (result.validationErrors) {
        // Validation failed
        setValidationErrors(result.validationErrors)
        setStep('validate')
      } else {
        toast.error(result.error || 'Validation failed')
      }
    } catch (error) {
      clientLogger.error('Error validating CSV', error)
      toast.error('Failed to validate CSV. Please try again.')
    } finally {
      setIsValidating(false)
    }
  }

  const handleImport = async () => {
    if (!file) return

    if (!confirm(`Are you sure you want to import data for all valid rows?`)) {
      return
    }

    setIsImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('csv', file)
      formData.append('validateOnly', 'false')

      const response = await fetch('/api/employees/bulk-import', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success && result.results) {
        setImportResult(result.results)
        setStep('complete')
        clientLogger.info('CSV import completed', result.results)
      } else {
        toast.error(result.error || 'Import failed')
      }
    } catch (error) {
      clientLogger.error('Error importing CSV', error)
      toast.error('Failed to import CSV. Please try again.')
    } finally {
      setIsImporting(false)
    }
  }

  const downloadTemplate = () => {
    const csvContent = 'email,department,professional_mail,location,languages_known,reporting_manager\njohn@example.com,Sales,john@company.com,Hyderabad,"English;Hindi;Telugu",manager@example.com\n'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'employee_import_template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const resetImport = () => {
    setFile(null)
    setValidationErrors([])
    setImportResult(null)
    setStep('upload')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2 font-poppins">
            <Upload className="w-5 h-5 text-orange-500" />
            Bulk Import Employee Data
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            Import professional details for multiple employees via CSV
          </p>
        </div>

        <Button
          onClick={downloadTemplate}
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          <Download className="w-4 h-4 mr-2" />
          Download Template
        </Button>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center gap-4">
        {['Upload', 'Validate', 'Import', 'Complete'].map((label, index) => (
          <React.Fragment key={label}>
            <div className={`flex items-center gap-2 ${
              step === label.toLowerCase() ? 'text-orange-500' :
              index < ['upload', 'validate', 'import', 'complete'].indexOf(step) ? 'text-green-500' :
              'text-gray-600'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                step === label.toLowerCase() ? 'border-orange-500 bg-orange-500/20' :
                index < ['upload', 'validate', 'import', 'complete'].indexOf(step) ? 'border-green-500 bg-green-500/20' :
                'border-gray-600'
              }`}>
                {index < ['upload', 'validate', 'import', 'complete'].indexOf(step) ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-bold">{index + 1}</span>
                )}
              </div>
              <span className="text-sm font-medium">{label}</span>
            </div>
            {index < 3 && <div className="flex-1 h-0.5 bg-gray-700"></div>}
          </React.Fragment>
        ))}
      </div>

      {/* Upload Section */}
      {step === 'upload' && (
        <div className="frosted-card p-8 rounded-lg text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!file ? (
            <div>
              <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-300 text-lg mb-2">Upload CSV File</p>
              <p className="text-gray-500 text-sm mb-6">
                Select a CSV file containing employee professional details
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose File
              </Button>
            </div>
          ) : (
            <div>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-white text-lg mb-2">{file.name}</p>
              <p className="text-gray-400 text-sm mb-6">
                {(file.size / 1024).toFixed(2)} KB
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={handleValidate}
                  disabled={isValidating}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {isValidating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Validating...</>
                  ) : (
                    <>Validate File</>
                  )}
                </Button>
                <Button
                  onClick={() => setFile(null)}
                  variant="outline"
                  className="border-gray-700 text-gray-300"
                >
                  Change File
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Validation Results */}
      {step === 'validate' && (
        <div className="space-y-4">
          {validationErrors.length === 0 ? (
            <div className="frosted-card p-6 rounded-lg">
              <div className="flex items-start gap-4">
                <CheckCircle className="w-12 h-12 text-green-500 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-lg mb-2 font-poppins">Validation Passed!</h4>
                  <p className="text-gray-400 mb-4">
                    All rows in the CSV file are valid and ready to import.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleImport}
                      disabled={isImporting}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      {isImporting ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
                      ) : (
                        <>Proceed with Import</>
                      )}
                    </Button>
                    <Button
                      onClick={resetImport}
                      variant="outline"
                      className="border-gray-700 text-gray-300"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="frosted-card p-6 rounded-lg">
              <div className="flex items-start gap-4 mb-4">
                <XCircle className="w-12 h-12 text-red-500 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-lg mb-2 font-poppins">Validation Failed</h4>
                  <p className="text-gray-400 mb-2">
                    {validationErrors.length} row(s) have validation errors. Please fix these errors and try again.
                  </p>
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {validationErrors.map((error) => (
                  <div key={error.row} className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 font-semibold text-sm">
                        Row {error.row}: {error.email}
                      </span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-xs text-red-300">
                      {error.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <Button
                  onClick={resetImport}
                  variant="outline"
                  className="border-gray-700 text-gray-300"
                >
                  Upload Different File
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Complete */}
      {step === 'complete' && importResult && (
        <div className="frosted-card p-6 rounded-lg">
          <div className="flex items-start gap-4 mb-6">
            <CheckCircle className="w-12 h-12 text-green-500 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-lg mb-2 font-poppins">Import Complete!</h4>
              <p className="text-gray-400">
                Successfully processed {importResult.totalRows} rows
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-green-500/10 rounded-lg">
              <div className="text-3xl font-bold text-green-500">{importResult.successful}</div>
              <div className="text-sm text-gray-400 mt-1">Successful</div>
            </div>
            <div className="text-center p-4 bg-red-500/10 rounded-lg">
              <div className="text-3xl font-bold text-red-500">{importResult.failed}</div>
              <div className="text-sm text-gray-400 mt-1">Failed</div>
            </div>
            <div className="text-center p-4 bg-gray-800 rounded-lg">
              <div className="text-3xl font-bold text-white">{importResult.totalRows}</div>
              <div className="text-sm text-gray-400 mt-1">Total</div>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="mb-6">
              <h5 className="font-semibold mb-3 font-poppins">Failed Imports:</h5>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {importResult.errors.map((err, idx) => (
                  <div key={idx} className="bg-red-500/10 border border-red-500/30 rounded p-3 text-sm">
                    <span className="text-red-400 font-medium">{err.email}:</span>
                    <span className="text-red-300 ml-2">{err.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={resetImport}
            className="bg-orange-500 hover:bg-orange-600"
          >
            Import Another File
          </Button>
        </div>
      )}
    </div>
  )
}
