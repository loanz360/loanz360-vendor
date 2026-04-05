'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Mail,
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Eye,
  Save,
  X,
  Send,
  Search,
  MoreVertical,
  Variable,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  Tag as TagIcon,
  Filter
} from 'lucide-react'

interface Template {
  id: string
  name: string
  type: 'email' | 'sms'
  category: string
  subject?: string
  content: string
  variables: string[]
  status: 'active' | 'draft' | 'archived'
  usageCount: number
  lastUsed?: string
  createdAt: string
  updatedAt: string
  createdBy: string
}

interface TemplateEditorProps {
  type?: 'email' | 'sms' | 'all'
  onSelect?: (template: Template) => void
  selectionMode?: boolean
}

const availableVariables = [
  { key: 'name', label: 'Customer Name', example: 'Rajesh Kumar' },
  { key: 'first_name', label: 'First Name', example: 'Rajesh' },
  { key: 'email', label: 'Email', example: 'rajesh@example.com' },
  { key: 'phone', label: 'Phone', example: '9876543210' },
  { key: 'loan_type', label: 'Loan Type', example: 'Home Loan' },
  { key: 'loan_amount', label: 'Loan Amount', example: '₹50,00,000' },
  { key: 'agent_name', label: 'Agent Name', example: 'Suresh Kumar' },
  { key: 'agent_phone', label: 'Agent Phone', example: '9876543211' },
  { key: 'company_name', label: 'Company Name', example: 'Loanz360' },
  { key: 'lead_id', label: 'Lead ID', example: 'LD-12345' },
  { key: 'next_followup', label: 'Next Follow-up Date', example: '15 Jan 2024' },
  { key: 'document_list', label: 'Pending Documents', example: 'PAN Card, Salary Slip' },
]

const templateCategories = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'document', label: 'Document Request' },
  { id: 'reminder', label: 'Reminder' },
  { id: 'offer', label: 'Offers & Promotions' },
  { id: 'status', label: 'Status Update' },
  { id: 'thank_you', label: 'Thank You' },
  { id: 'custom', label: 'Custom' },
]

const mockTemplates: Template[] = [
  {
    id: 'tpl-001',
    name: 'Welcome Email',
    type: 'email',
    category: 'welcome',
    subject: 'Welcome to Loanz360 - Your Loan Journey Begins!',
    content: `Dear {{name}},

Welcome to Loanz360! We're excited to have you on board.

Thank you for expressing interest in our {{loan_type}} services. Our dedicated team is here to help you every step of the way.

Your dedicated loan advisor {{agent_name}} will contact you within 24 hours to discuss your requirements and guide you through the process.

In the meantime, feel free to reach out to us at {{agent_phone}} if you have any questions.

Best Regards,
Team Loanz360`,
    variables: ['name', 'loan_type', 'agent_name', 'agent_phone'],
    status: 'active',
    usageCount: 245,
    lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Admin'
  },
  {
    id: 'tpl-002',
    name: 'Document Request',
    type: 'email',
    category: 'document',
    subject: 'Documents Required - {{loan_type}} Application',
    content: `Dear {{name}},

We hope this email finds you well. To proceed with your {{loan_type}} application, we require the following documents:

{{document_list}}

Please upload these documents through our secure portal or share them with your loan advisor.

For any assistance, contact {{agent_name}} at {{agent_phone}}.

Best Regards,
Team Loanz360`,
    variables: ['name', 'loan_type', 'document_list', 'agent_name', 'agent_phone'],
    status: 'active',
    usageCount: 189,
    lastUsed: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Admin'
  },
  {
    id: 'tpl-003',
    name: 'Welcome SMS',
    type: 'sms',
    category: 'welcome',
    content: 'Welcome to Loanz360, {{first_name}}! Your loan advisor {{agent_name}} will contact you shortly. Ref: {{lead_id}}',
    variables: ['first_name', 'agent_name', 'lead_id'],
    status: 'active',
    usageCount: 512,
    lastUsed: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Admin'
  },
  {
    id: 'tpl-004',
    name: 'Follow-up Reminder SMS',
    type: 'sms',
    category: 'reminder',
    content: 'Hi {{first_name}}, this is a reminder about your {{loan_type}} application. Our team is ready to assist. Call: {{agent_phone}}',
    variables: ['first_name', 'loan_type', 'agent_phone'],
    status: 'active',
    usageCount: 328,
    lastUsed: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Admin'
  },
  {
    id: 'tpl-005',
    name: 'Document Reminder SMS',
    type: 'sms',
    category: 'document',
    content: 'Hi {{first_name}}, please submit pending documents for your loan: {{document_list}}. Upload via app or contact {{agent_phone}}',
    variables: ['first_name', 'document_list', 'agent_phone'],
    status: 'draft',
    usageCount: 0,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Admin'
  }
]

export function TemplateEditor({ type = 'all', onSelect, selectionMode = false }: TemplateEditorProps) {
  const [templates, setTemplates] = useState<Template[]>(mockTemplates)
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>(mockTemplates)
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>(type === 'sms' ? 'sms' : 'email')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)

  // Editor state
  const [editorName, setEditorName] = useState('')
  const [editorSubject, setEditorSubject] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [editorCategory, setEditorCategory] = useState('custom')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    filterTemplates()
  }, [searchQuery, categoryFilter, statusFilter, activeTab, templates])

  const filterTemplates = () => {
    let filtered = templates.filter(t => t.type === activeTab)

    if (type !== 'all') {
      filtered = filtered.filter(t => t.type === type)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.content.toLowerCase().includes(query) ||
        (t.subject && t.subject.toLowerCase().includes(query))
      )
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === categoryFilter)
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter)
    }

    setFilteredTemplates(filtered)
  }

  const openNewTemplate = () => {
    setEditingTemplate(null)
    setEditorName('')
    setEditorSubject('')
    setEditorContent('')
    setEditorCategory('custom')
    setIsEditorOpen(true)
  }

  const openEditTemplate = (template: Template) => {
    setEditingTemplate(template)
    setEditorName(template.name)
    setEditorSubject(template.subject || '')
    setEditorContent(template.content)
    setEditorCategory(template.category)
    setIsEditorOpen(true)
  }

  const insertVariable = (variable: string) => {
    const placeholder = `{{${variable}}}`
    setEditorContent(prev => prev + placeholder)
  }

  const handleSave = async (saveAsDraft: boolean = false) => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1000))

    const extractVariables = (content: string): string[] => {
      const matches = content.match(/\{\{(\w+)\}\}/g) || []
      return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))]
    }

    const newTemplate: Template = {
      id: editingTemplate?.id || `tpl-${Date.now()}`,
      name: editorName,
      type: activeTab,
      category: editorCategory,
      subject: activeTab === 'email' ? editorSubject : undefined,
      content: editorContent,
      variables: extractVariables(editorContent),
      status: saveAsDraft ? 'draft' : 'active',
      usageCount: editingTemplate?.usageCount || 0,
      lastUsed: editingTemplate?.lastUsed,
      createdAt: editingTemplate?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: editingTemplate?.createdBy || 'Current User'
    }

    if (editingTemplate) {
      setTemplates(templates.map(t => t.id === editingTemplate.id ? newTemplate : t))
    } else {
      setTemplates([newTemplate, ...templates])
    }

    setIsSaving(false)
    setIsEditorOpen(false)
  }

  const handleDelete = async (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      setTemplates(templates.filter(t => t.id !== templateId))
    }
  }

  const handleDuplicate = (template: Template) => {
    const duplicate: Template = {
      ...template,
      id: `tpl-${Date.now()}`,
      name: `${template.name} (Copy)`,
      status: 'draft',
      usageCount: 0,
      lastUsed: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setTemplates([duplicate, ...templates])
  }

  const getPreviewContent = (template: Template) => {
    let content = template.content
    availableVariables.forEach(v => {
      content = content.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), v.example)
    })
    return content
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800">Draft</Badge>
      case 'archived':
        return <Badge className="bg-gray-100 text-gray-800">Archived</Badge>
      default:
        return null
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Template Editor</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage email and SMS templates for lead communication
          </p>
        </div>
        <Button onClick={openNewTemplate}>
          <Plus className="h-4 w-4 mr-1" /> New Template
        </Button>
      </div>

      {/* Tabs & Filters */}
      {type === 'all' && (
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'email' | 'sms')}>
          <TabsList>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" /> Email Templates
            </TabsTrigger>
            <TabsTrigger value="sms" className="gap-2">
              <MessageSquare className="h-4 w-4" /> SMS Templates
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {templateCategories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Template List */}
      <div className="grid gap-4">
        {filteredTemplates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
              <p className="text-muted-foreground">No templates found</p>
              <Button variant="outline" className="mt-4" onClick={openNewTemplate}>
                <Plus className="h-4 w-4 mr-1" /> Create Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredTemplates.map(template => (
            <Card
              key={template.id}
              className={`hover:shadow-md transition-shadow ${selectionMode ? 'cursor-pointer' : ''}`}
              onClick={() => selectionMode && onSelect && onSelect(template)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {template.type === 'email' ? (
                        <Mail className="h-4 w-4 text-blue-600" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-green-600" />
                      )}
                      <h3 className="font-medium">{template.name}</h3>
                      {getStatusBadge(template.status)}
                      <Badge variant="outline" className="text-xs">
                        {templateCategories.find(c => c.id === template.category)?.label}
                      </Badge>
                    </div>
                    {template.subject && (
                      <p className="text-sm text-muted-foreground mb-1">
                        <strong>Subject:</strong> {template.subject}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.content}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>Used {template.usageCount} times</span>
                      {template.lastUsed && (
                        <span>Last used: {formatDate(template.lastUsed)}</span>
                      )}
                      <span>Variables: {template.variables.length}</span>
                    </div>
                  </div>
                  {!selectionMode && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setPreviewTemplate(template); setIsPreviewOpen(true) }}>
                          <Eye className="h-4 w-4 mr-2" /> Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditTemplate(template)}>
                          <Edit2 className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                          <Copy className="h-4 w-4 mr-2" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : `New ${activeTab === 'email' ? 'Email' : 'SMS'} Template`}
            </DialogTitle>
            <DialogDescription>
              Create or modify your communication template
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Template Name</Label>
                <Input
                  value={editorName}
                  onChange={(e) => setEditorName(e.target.value)}
                  placeholder="e.g., Welcome Email"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={editorCategory} onValueChange={setEditorCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activeTab === 'email' && (
              <div>
                <Label>Subject Line</Label>
                <Input
                  value={editorSubject}
                  onChange={(e) => setEditorSubject(e.target.value)}
                  placeholder="e.g., Welcome to Loanz360!"
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Content</Label>
                <span className="text-xs text-muted-foreground">
                  {activeTab === 'sms' && `${editorContent.length}/160 characters`}
                </span>
              </div>
              <Textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                placeholder={activeTab === 'email'
                  ? "Dear {{name}},\n\nYour email content here..."
                  : "Hi {{first_name}}, your SMS message here..."
                }
                rows={activeTab === 'email' ? 12 : 4}
                className="font-mono text-sm"
              />
            </div>

            {/* Variables */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Variable className="h-4 w-4" /> Available Variables
              </Label>
              <div className="flex flex-wrap gap-2">
                {availableVariables.map(variable => (
                  <Button
                    key={variable.key}
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(variable.key)}
                    className="text-xs"
                  >
                    {`{{${variable.key}}}`}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Click a variable to insert it at the end of your content
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSave(true)}
              disabled={!editorName || !editorContent || isSaving}
            >
              <Clock className="h-4 w-4 mr-1" /> Save as Draft
            </Button>
            <Button
              onClick={() => handleSave(false)}
              disabled={!editorName || !editorContent || isSaving}
            >
              {isSaving ? (
                <><span className="animate-spin mr-1">◌</span> Saving...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-1" /> Save & Activate</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" /> Template Preview
            </DialogTitle>
            <DialogDescription>
              Preview with sample data
            </DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="py-4">
              {previewTemplate.type === 'email' ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted p-3 border-b">
                    <p className="text-sm"><strong>Subject:</strong> {previewTemplate.subject?.replace(/\{\{(\w+)\}\}/g, (_, key) => {
                      const variable = availableVariables.find(v => v.key === key)
                      return variable?.example || key
                    })}</p>
                  </div>
                  <div className="p-4 bg-white">
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {getPreviewContent(previewTemplate)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-green-500 rounded-full p-2">
                      <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{getPreviewContent(previewTemplate)}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {previewTemplate.content.length} characters
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <Label className="text-sm text-muted-foreground">Variables used:</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {previewTemplate.variables.map(v => (
                    <Badge key={v} variant="secondary">{v}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Close</Button>
            {previewTemplate && (
              <Button onClick={() => { setIsPreviewOpen(false); openEditTemplate(previewTemplate) }}>
                <Edit2 className="h-4 w-4 mr-1" /> Edit Template
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TemplateEditor
