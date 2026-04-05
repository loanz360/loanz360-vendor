'use client'

import React, { useState, useCallback, useMemo } from 'react'
import DOMPurify from 'dompurify'
import { FileText, Plus, Eye, Code, Copy, Check, X, ChevronDown } from 'lucide-react'

interface TemplateVariable {
  key: string
  label: string
  sampleValue: string
  category: string
}

const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // Employee
  { key: '{{employee_name}}', label: 'Employee Name', sampleValue: 'Rahul Sharma', category: 'Employee' },
  { key: '{{employee_id}}', label: 'Employee ID', sampleValue: 'EMP001', category: 'Employee' },
  { key: '{{designation}}', label: 'Designation', sampleValue: 'Senior Developer', category: 'Employee' },
  { key: '{{department}}', label: 'Department', sampleValue: 'Engineering', category: 'Employee' },
  { key: '{{date_of_joining}}', label: 'Date of Joining', sampleValue: '15 Jan 2024', category: 'Employee' },
  { key: '{{date_of_birth}}', label: 'Date of Birth', sampleValue: '10 Mar 1990', category: 'Employee' },
  { key: '{{email}}', label: 'Email', sampleValue: 'rahul@company.com', category: 'Employee' },
  { key: '{{phone}}', label: 'Phone', sampleValue: '+91 9876543210', category: 'Employee' },
  // Company
  { key: '{{company_name}}', label: 'Company Name', sampleValue: 'Loanz 360 Pvt Ltd', category: 'Company' },
  { key: '{{company_address}}', label: 'Company Address', sampleValue: 'HSR Layout, Bengaluru', category: 'Company' },
  { key: '{{hr_name}}', label: 'HR Name', sampleValue: 'Priya Nair', category: 'Company' },
  { key: '{{hr_designation}}', label: 'HR Designation', sampleValue: 'HR Manager', category: 'Company' },
  // Dates
  { key: '{{current_date}}', label: 'Current Date', sampleValue: '28 Feb 2026', category: 'Dates' },
  { key: '{{effective_date}}', label: 'Effective Date', sampleValue: '01 Mar 2026', category: 'Dates' },
  { key: '{{last_working_day}}', label: 'Last Working Day', sampleValue: '31 Mar 2026', category: 'Dates' },
  // Salary
  { key: '{{basic_salary}}', label: 'Basic Salary', sampleValue: '50,000', category: 'Salary' },
  { key: '{{gross_salary}}', label: 'Gross Salary', sampleValue: '85,000', category: 'Salary' },
  { key: '{{ctc}}', label: 'CTC', sampleValue: '12,00,000', category: 'Salary' },
]

interface DocumentTemplateEditorProps {
  initialContent?: string
  templateName?: string
  onSave?: (content: string, name: string) => void
  readOnly?: boolean
}

export default function DocumentTemplateEditor({ initialContent = '', templateName = '', onSave, readOnly = false }: DocumentTemplateEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [name, setName] = useState(templateName)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [showVariables, setShowVariables] = useState(true)
  const [copiedVar, setCopiedVar] = useState<string | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string>('Employee')

  const previewContent = useMemo(() => {
    let preview = content
    for (const v of TEMPLATE_VARIABLES) {
      preview = preview.replaceAll(v.key, `<span class="bg-[#FF6700]/20 text-[#FF6700] px-1 rounded">${v.sampleValue}</span>`)
    }
    return preview
  }, [content])

  const variablesByCategory = useMemo(() => {
    const groups: Record<string, TemplateVariable[]> = {}
    for (const v of TEMPLATE_VARIABLES) {
      if (!groups[v.category]) groups[v.category] = []
      groups[v.category].push(v)
    }
    return groups
  }, [])

  const usedVariables = useMemo(() => {
    return TEMPLATE_VARIABLES.filter(v => content.includes(v.key))
  }, [content])

  const handleCopyVariable = useCallback((key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedVar(key)
    setTimeout(() => setCopiedVar(null), 1500)
  }, [])

  const handleInsertVariable = useCallback((key: string) => {
    setContent(prev => prev + key)
  }, [])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-[#FF6700]" />
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Template name..."
          disabled={readOnly}
          className="flex-1 bg-transparent text-white text-lg font-medium placeholder-gray-500 outline-none border-b border-transparent focus:border-[#FF6700]/50"
        />
        <div className="flex items-center bg-white/5 rounded-lg p-0.5">
          <button
            onClick={() => setMode('edit')}
            className={`px-3 py-1 text-xs rounded ${mode === 'edit' ? 'bg-[#FF6700] text-white' : 'text-gray-400'}`}
          >
            <Code className="w-3 h-3 inline mr-1" />Edit
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`px-3 py-1 text-xs rounded ${mode === 'preview' ? 'bg-[#FF6700] text-white' : 'text-gray-400'}`}
          >
            <Eye className="w-3 h-3 inline mr-1" />Preview
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Editor / Preview */}
        <div className="flex-1">
          {mode === 'edit' ? (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              disabled={readOnly}
              placeholder="Start typing your template content... Use {{variable}} placeholders for dynamic data."
              className="w-full h-[400px] bg-white/5 border border-white/10 rounded-lg p-4 text-sm text-gray-200 font-mono placeholder-gray-600 outline-none focus:border-[#FF6700]/50 resize-none"
            />
          ) : (
            <div
              className="w-full h-[400px] bg-white border border-white/10 rounded-lg p-6 text-sm text-gray-800 overflow-y-auto prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewContent.replace(/\n/g, '<br />')) }}
            />
          )}

          {/* Used variables count */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">{usedVariables.length} variables used</span>
            {onSave && !readOnly && (
              <button
                onClick={() => onSave(content, name)}
                className="px-4 py-1.5 bg-[#FF6700] text-white text-sm rounded-lg hover:bg-[#FF6700]/90 transition-colors"
              >
                Save Template
              </button>
            )}
          </div>
        </div>

        {/* Variables Panel */}
        {showVariables && mode === 'edit' && !readOnly && (
          <div className="w-56 bg-white/5 border border-white/10 rounded-lg p-3 h-[400px] overflow-y-auto">
            <p className="text-xs font-medium text-gray-400 mb-2">Available Variables</p>
            {Object.entries(variablesByCategory).map(([category, vars]) => (
              <div key={category} className="mb-2">
                <button
                  onClick={() => setExpandedCategory(expandedCategory === category ? '' : category)}
                  className="flex items-center gap-1 w-full text-xs font-medium text-gray-300 hover:text-white py-1"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${expandedCategory === category ? 'rotate-0' : '-rotate-90'}`} />
                  {category}
                </button>
                {expandedCategory === category && (
                  <div className="space-y-1 ml-3">
                    {vars.map(v => (
                      <div key={v.key} className="flex items-center gap-1 group">
                        <button
                          onClick={() => handleInsertVariable(v.key)}
                          className="flex-1 text-left text-[10px] text-gray-400 hover:text-[#FF6700] transition-colors py-0.5"
                          title={`Insert ${v.key}`}
                        >
                          {v.label}
                        </button>
                        <button
                          onClick={() => handleCopyVariable(v.key)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Copy ${v.label} variable`}
                        >
                          {copiedVar === v.key ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-500 hover:text-gray-300" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export { TEMPLATE_VARIABLES }
export type { TemplateVariable }
