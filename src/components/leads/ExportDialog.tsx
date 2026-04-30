'use client'

import { toast } from 'sonner'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Download,
  FileSpreadsheet,
  FileText,
  File,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Calendar,
  Filter,
  Settings2
} from 'lucide-react'

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedIds?: string[]
  totalRecords?: number
}

interface ExportField {
  id: string
  label: string
  category: string
  selected: boolean
}

interface ExportJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  format: string
  totalRecords: number
  processedRecords: number
  downloadUrl?: string
  createdAt: string
  error?: string
}

const defaultFields: ExportField[] = [
  // Basic
  { id: 'name', label: 'Customer Name', category: 'basic', selected: true },
  { id: 'email', label: 'Email Address', category: 'basic', selected: true },
  { id: 'phone', label: 'Phone Number', category: 'basic', selected: true },
  { id: 'status', label: 'Lead Status', category: 'basic', selected: true },
  { id: 'source', label: 'Lead Source', category: 'basic', selected: true },
  // Loan
  { id: 'loanType', label: 'Loan Type', category: 'loan', selected: true },
  { id: 'loanAmount', label: 'Loan Amount', category: 'loan', selected: true },
  { id: 'propertyValue', label: 'Property Value', category: 'loan', selected: false },
  // Financial
  { id: 'employmentType', label: 'Employment Type', category: 'financial', selected: false },
  { id: 'monthlyIncome', label: 'Monthly Income', category: 'financial', selected: false },
  { id: 'creditScore', label: 'Credit Score', category: 'financial', selected: false },
  // Pipeline
  { id: 'assignedTo', label: 'Assigned Agent', category: 'pipeline', selected: true },
  { id: 'stage', label: 'Pipeline Stage', category: 'pipeline', selected: true },
  { id: 'priority', label: 'Priority', category: 'pipeline', selected: false },
  // Dates
  { id: 'createdAt', label: 'Created Date', category: 'dates', selected: true },
  { id: 'updatedAt', label: 'Last Updated', category: 'dates', selected: false },
  { id: 'lastContactedAt', label: 'Last Contacted', category: 'dates', selected: false },
  { id: 'nextFollowUp', label: 'Next Follow-up', category: 'dates', selected: false },
  // Analytics
  { id: 'conversionProbability', label: 'Conversion Probability', category: 'analytics', selected: false },
  { id: 'totalCommunications', label: 'Total Communications', category: 'analytics', selected: false },
  // Additional
  { id: 'notes', label: 'Notes', category: 'additional', selected: false },
  { id: 'tags', label: 'Tags', category: 'additional', selected: false },
]

const categories = [
  { id: 'basic', label: 'Basic Information' },
  { id: 'loan', label: 'Loan Details' },
  { id: 'financial', label: 'Financial Profile' },
  { id: 'pipeline', label: 'Pipeline & Assignment' },
  { id: 'dates', label: 'Important Dates' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'additional', label: 'Additional Fields' },
]

export function ExportDialog({ isOpen, onClose, selectedIds, totalRecords }: ExportDialogProps) {
  const [activeTab, setActiveTab] = useState('new')
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('xlsx')
  const [fields, setFields] = useState<ExportField[]>(defaultFields)
  const [includeAnalytics, setIncludeAnalytics] = useState(false)
  const [includeCommunications, setIncludeCommunications] = useState(false)
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all')
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [currentJob, setCurrentJob] = useState<ExportJob | null>(null)
  const [exportHistory, setExportHistory] = useState<ExportJob[]>([])

  useEffect(() => {
    if (isOpen) {
      fetchExportHistory()
    }
  }, [isOpen])

  const fetchExportHistory = async () => {
    // Mock history data
    setExportHistory([
      {
        id: 'export-001',
        status: 'completed',
        format: 'xlsx',
        totalRecords: 1250,
        processedRecords: 1250,
        downloadUrl: '/exports/leads-2024-01-15.xlsx',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'export-002',
        status: 'completed',
        format: 'pdf',
        totalRecords: 500,
        processedRecords: 500,
        downloadUrl: '/exports/leads-report-2024-01-14.pdf',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'export-003',
        status: 'failed',
        format: 'csv',
        totalRecords: 5000,
        processedRecords: 2340,
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        error: 'Export timeout'
      }
    ])
  }

  const toggleField = (fieldId: string) => {
    setFields(fields.map(f =>
      f.id === fieldId ? { ...f, selected: !f.selected } : f
    ))
  }

  const toggleCategory = (categoryId: string, selected: boolean) => {
    setFields(fields.map(f =>
      f.category === categoryId ? { ...f, selected } : f
    ))
  }

  const selectAllFields = () => {
    setFields(fields.map(f => ({ ...f, selected: true })))
  }

  const deselectAllFields = () => {
    setFields(fields.map(f => ({ ...f, selected: false })))
  }

  const getSelectedFieldCount = () => fields.filter(f => f.selected).length

  const handleExport = async () => {
    setIsExporting(true)
    setExportProgress(0)

    const selectedFields = fields.filter(f => f.selected).map(f => f.id)
    const recordCount = selectedIds?.length || totalRecords || 1000

    // Simulate export progress
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + Math.random() * 15
      })
    }, 300)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 3000))

    clearInterval(interval)
    setExportProgress(100)

    const newJob: ExportJob = {
      id: `export-${Date.now()}`,
      status: 'completed',
      format,
      totalRecords: recordCount,
      processedRecords: recordCount,
      downloadUrl: `/exports/leads-${new Date().toISOString().split('T')[0]}.${format}`,
      createdAt: new Date().toISOString()
    }

    setCurrentJob(newJob)
    setExportHistory([newJob, ...exportHistory])

    setTimeout(() => {
      setIsExporting(false)
    }, 500)
  }

  const handleDownload = (job: ExportJob) => {
    // Simulate download
    toast.info(`Downloading ${job.downloadUrl}`)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'xlsx': return <FileSpreadsheet className="h-4 w-4 text-green-600" />
      case 'csv': return <File className="h-4 w-4 text-blue-600" />
      case 'pdf': return <FileText className="h-4 w-4 text-red-600" />
      default: return <File className="h-4 w-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" /> Completed</Badge>
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800"><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Processing</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" /> Failed</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> Export Leads
          </DialogTitle>
          <DialogDescription>
            {selectedIds?.length
              ? `Export ${selectedIds.length} selected leads`
              : `Export ${totalRecords || 'all'} leads from your database`
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="new">New Export</TabsTrigger>
            <TabsTrigger value="history">Export History</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="new" className="m-0 space-y-6">
              {/* Format Selection */}
              <div>
                <Label className="text-base font-medium">Export Format</Label>
                <RadioGroup
                  value={format}
                  onValueChange={(val) => setFormat(val as 'csv' | 'xlsx' | 'pdf')}
                  className="grid grid-cols-3 gap-4 mt-3"
                >
                  <div>
                    <RadioGroupItem value="xlsx" id="xlsx" className="peer sr-only" />
                    <Label
                      htmlFor="xlsx"
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <FileSpreadsheet className="h-8 w-8 text-green-600 mb-2" />
                      <span className="font-medium">Excel (.xlsx)</span>
                      <span className="text-xs text-muted-foreground mt-1">Best for data analysis</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="csv" id="csv" className="peer sr-only" />
                    <Label
                      htmlFor="csv"
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <File className="h-8 w-8 text-blue-600 mb-2" />
                      <span className="font-medium">CSV</span>
                      <span className="text-xs text-muted-foreground mt-1">Universal format</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="pdf" id="pdf" className="peer sr-only" />
                    <Label
                      htmlFor="pdf"
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <FileText className="h-8 w-8 text-red-600 mb-2" />
                      <span className="font-medium">PDF Report</span>
                      <span className="text-xs text-muted-foreground mt-1">With charts & summary</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Field Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-medium">
                    Fields to Export ({getSelectedFieldCount()} selected)
                  </Label>
                  <div className="space-x-2">
                    <Button variant="ghost" size="sm" onClick={selectAllFields}>Select All</Button>
                    <Button variant="ghost" size="sm" onClick={deselectAllFields}>Clear All</Button>
                  </div>
                </div>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  {categories.map(category => {
                    const categoryFields = fields.filter(f => f.category === category.id)
                    const allSelected = categoryFields.every(f => f.selected)
                    const someSelected = categoryFields.some(f => f.selected) && !allSelected

                    return (
                      <div key={category.id} className="mb-4 last:mb-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <Checkbox
                            id={`cat-${category.id}`}
                            checked={allSelected}
                            ref={(el) => {
                              if (el) {
                                (el as HTMLButtonElement).dataset.state = someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'
                              }
                            }}
                            onCheckedChange={(checked) => toggleCategory(category.id, checked as boolean)}
                          />
                          <label htmlFor={`cat-${category.id}`} className="font-medium text-sm cursor-pointer">
                            {category.label}
                          </label>
                        </div>
                        <div className="grid grid-cols-3 gap-2 ml-6">
                          {categoryFields.map(field => (
                            <div key={field.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={field.id}
                                checked={field.selected}
                                onCheckedChange={() => toggleField(field.id)}
                              />
                              <label htmlFor={field.id} className="text-sm cursor-pointer">
                                {field.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Additional Options */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-base font-medium mb-3 block">Date Range</Label>
                  <Select value={dateRange} onValueChange={(val) => setDateRange(val as typeof dateRange)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-base font-medium mb-3 block">Additional Data</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="analytics"
                        checked={includeAnalytics}
                        onCheckedChange={(checked) => setIncludeAnalytics(checked as boolean)}
                      />
                      <label htmlFor="analytics" className="text-sm cursor-pointer">
                        Include Analytics Summary
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="communications"
                        checked={includeCommunications}
                        onCheckedChange={(checked) => setIncludeCommunications(checked as boolean)}
                      />
                      <label htmlFor="communications" className="text-sm cursor-pointer">
                        Include Communication History
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Export Progress */}
              {isExporting && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                      <span className="font-medium">Exporting...</span>
                    </div>
                    <Progress value={exportProgress} className="h-2" />
                    <p className="text-sm text-muted-foreground mt-2">
                      {Math.round(exportProgress)}% complete
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Completed Export */}
              {currentJob && currentJob.status === 'completed' && !isExporting && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">Export Complete!</p>
                          <p className="text-sm text-green-600">
                            {currentJob.totalRecords} records exported successfully
                          </p>
                        </div>
                      </div>
                      <Button onClick={() => handleDownload(currentJob)}>
                        <Download className="h-4 w-4 mr-1" /> Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="m-0">
              <div className="space-y-3">
                {exportHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Download className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No export history yet</p>
                  </div>
                ) : (
                  exportHistory.map(job => (
                    <Card key={job.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getFormatIcon(job.format)}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{job.totalRecords} leads</span>
                                {getStatusBadge(job.status)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(job.createdAt)}
                              </p>
                              {job.error && (
                                <p className="text-sm text-red-600">{job.error}</p>
                              )}
                            </div>
                          </div>
                          {job.status === 'completed' && job.downloadUrl && (
                            <Button variant="outline" size="sm" onClick={() => handleDownload(job)}>
                              <Download className="h-4 w-4 mr-1" /> Download
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {activeTab === 'new' && (
            <Button onClick={handleExport} disabled={isExporting || getSelectedFieldCount() === 0}>
              {isExporting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-1" /> Export {format.toUpperCase()}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ExportDialog
