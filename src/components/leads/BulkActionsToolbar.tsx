'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  X,
  UserPlus,
  Tag,
  Trash2,
  Mail,
  MessageSquare,
  Download,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Users,
  Zap,
  Calendar,
  Flag,
  Archive,
  MoreHorizontal
} from 'lucide-react'

interface BulkActionsToolbarProps {
  selectedCount: number
  selectedIds: string[]
  onClearSelection: () => void
  onAction: (action: string, data?: Record<string, unknown>) => void
}

interface ConfirmDialogState {
  isOpen: boolean
  title: string
  description: string
  action: string
  variant: 'default' | 'destructive'
}

export function BulkActionsToolbar({
  selectedCount,
  selectedIds,
  onClearSelection,
  onAction
}: BulkActionsToolbarProps) {
  const [assignDialog, setAssignDialog] = useState(false)
  const [stageDialog, setStageDialog] = useState(false)
  const [tagDialog, setTagDialog] = useState(false)
  const [emailDialog, setEmailDialog] = useState(false)
  const [smsDialog, setSmsDialog] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    description: '',
    action: '',
    variant: 'default'
  })

  const [selectedAgent, setSelectedAgent] = useState('')
  const [selectedStage, setSelectedStage] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [emailTemplate, setEmailTemplate] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [smsTemplate, setSmsTemplate] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const agents = [
    { id: 'agent-001', name: 'Suresh Kumar' },
    { id: 'agent-002', name: 'Meera Joshi' },
    { id: 'agent-003', name: 'Arun Nair' },
    { id: 'agent-004', name: 'Kavita Singh' },
  ]

  const stages = [
    { id: 'new', name: 'New Lead' },
    { id: 'contacted', name: 'Contacted' },
    { id: 'qualified', name: 'Qualified' },
    { id: 'proposal', name: 'Proposal Sent' },
    { id: 'negotiation', name: 'Negotiation' },
    { id: 'documentation', name: 'Documentation' },
    { id: 'converted', name: 'Converted' },
  ]

  const availableTags = [
    'Premium', 'First-time Buyer', 'Pre-approved', 'VIP',
    'Urgent', 'Follow-up Required', 'Hot Lead', 'Referred'
  ]

  const priorities = [
    { id: 'low', name: 'Low', color: 'text-gray-600' },
    { id: 'medium', name: 'Medium', color: 'text-blue-600' },
    { id: 'high', name: 'High', color: 'text-orange-600' },
    { id: 'urgent', name: 'Urgent', color: 'text-red-600' },
  ]

  const emailTemplates = [
    { id: 'welcome', name: 'Welcome Email', subject: 'Welcome to Loanz360!' },
    { id: 'followup', name: 'Follow-up Email', subject: 'Following up on your loan inquiry' },
    { id: 'document_request', name: 'Document Request', subject: 'Documents Required for Your Loan Application' },
    { id: 'offer', name: 'Special Offer', subject: 'Exclusive Loan Offer for You!' },
  ]

  const smsTemplates = [
    { id: 'welcome', name: 'Welcome SMS', content: 'Welcome to Loanz360! Our executive will contact you shortly. Ref: {lead_id}' },
    { id: 'reminder', name: 'Follow-up Reminder', content: 'Hi {name}, this is a reminder about your loan application. Call us: 1800-XXX-XXXX' },
    { id: 'document', name: 'Document Reminder', content: 'Hi {name}, please submit your pending documents for faster processing.' },
  ]

  const handleConfirmAction = () => {
    setIsProcessing(true)
    setTimeout(() => {
      onAction(confirmDialog.action, { ids: selectedIds })
      setIsProcessing(false)
      setConfirmDialog({ ...confirmDialog, isOpen: false })
      onClearSelection()
    }, 1000)
  }

  const handleAssign = () => {
    if (!selectedAgent) return
    setIsProcessing(true)
    setTimeout(() => {
      onAction('assign', { ids: selectedIds, agentId: selectedAgent })
      setIsProcessing(false)
      setAssignDialog(false)
      setSelectedAgent('')
      onClearSelection()
    }, 1000)
  }

  const handleStageChange = () => {
    if (!selectedStage) return
    setIsProcessing(true)
    setTimeout(() => {
      onAction('change_stage', { ids: selectedIds, stage: selectedStage })
      setIsProcessing(false)
      setStageDialog(false)
      setSelectedStage('')
      onClearSelection()
    }, 1000)
  }

  const handleTagUpdate = () => {
    if (selectedTags.length === 0) return
    setIsProcessing(true)
    setTimeout(() => {
      onAction('add_tags', { ids: selectedIds, tags: selectedTags })
      setIsProcessing(false)
      setTagDialog(false)
      setSelectedTags([])
      onClearSelection()
    }, 1000)
  }

  const handleSendEmail = () => {
    if (!emailTemplate) return
    setIsProcessing(true)
    setTimeout(() => {
      onAction('send_email', { ids: selectedIds, templateId: emailTemplate, subject: emailSubject })
      setIsProcessing(false)
      setEmailDialog(false)
      setEmailTemplate('')
      setEmailSubject('')
      onClearSelection()
    }, 1000)
  }

  const handleSendSms = () => {
    if (!smsTemplate) return
    setIsProcessing(true)
    setTimeout(() => {
      onAction('send_sms', { ids: selectedIds, templateId: smsTemplate })
      setIsProcessing(false)
      setSmsDialog(false)
      setSmsTemplate('')
      onClearSelection()
    }, 1000)
  }

  const showConfirm = (action: string, title: string, description: string, variant: 'default' | 'destructive' = 'default') => {
    setConfirmDialog({ isOpen: true, title, description, action, variant })
  }

  if (selectedCount === 0) return null

  return (
    <>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-white border shadow-lg rounded-lg px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {selectedCount} selected
            </Badge>
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Assign */}
          <Button variant="outline" size="sm" onClick={() => setAssignDialog(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Assign
          </Button>

          {/* Change Stage */}
          <Button variant="outline" size="sm" onClick={() => setStageDialog(true)}>
            <ArrowRight className="h-4 w-4 mr-1" /> Move Stage
          </Button>

          {/* Priority Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Flag className="h-4 w-4 mr-1" /> Priority
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Set Priority</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {priorities.map(priority => (
                <DropdownMenuItem
                  key={priority.id}
                  onClick={() => onAction('set_priority', { ids: selectedIds, priority: priority.id })}
                >
                  <span className={priority.color}>{priority.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tags */}
          <Button variant="outline" size="sm" onClick={() => setTagDialog(true)}>
            <Tag className="h-4 w-4 mr-1" /> Tags
          </Button>

          {/* Communication */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Mail className="h-4 w-4 mr-1" /> Communicate
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setEmailDialog(true)}>
                <Mail className="h-4 w-4 mr-2" /> Send Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSmsDialog(true)}>
                <MessageSquare className="h-4 w-4 mr-2" /> Send SMS
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAction('export', { ids: selectedIds })}>
                <Download className="h-4 w-4 mr-2" /> Export Selected
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction('schedule_followup', { ids: selectedIds })}>
                <Calendar className="h-4 w-4 mr-2" /> Schedule Follow-up
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction('add_to_campaign', { ids: selectedIds })}>
                <Zap className="h-4 w-4 mr-2" /> Add to Campaign
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => showConfirm(
                  'archive',
                  'Archive Leads',
                  `Are you sure you want to archive ${selectedCount} leads? They will be moved to the archive.`,
                  'default'
                )}
              >
                <Archive className="h-4 w-4 mr-2" /> Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => showConfirm(
                  'delete',
                  'Delete Leads',
                  `Are you sure you want to delete ${selectedCount} leads? This action cannot be undone.`,
                  'destructive'
                )}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Assign Leads
            </DialogTitle>
            <DialogDescription>
              Assign {selectedCount} selected leads to a team member
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Agent</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!selectedAgent || isProcessing}>
              {isProcessing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Change Dialog */}
      <Dialog open={stageDialog} onOpenChange={setStageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" /> Move to Stage
            </DialogTitle>
            <DialogDescription>
              Move {selectedCount} selected leads to a new pipeline stage
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Stage</Label>
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map(stage => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialog(false)}>Cancel</Button>
            <Button onClick={handleStageChange} disabled={!selectedStage || isProcessing}>
              {isProcessing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-1" />}
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tags Dialog */}
      <Dialog open={tagDialog} onOpenChange={setTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" /> Add Tags
            </DialogTitle>
            <DialogDescription>
              Add tags to {selectedCount} selected leads
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Tags</Label>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {availableTags.map(tag => (
                <div key={tag} className="flex items-center space-x-2">
                  <Checkbox
                    id={tag}
                    checked={selectedTags.includes(tag)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTags([...selectedTags, tag])
                      } else {
                        setSelectedTags(selectedTags.filter(t => t !== tag))
                      }
                    }}
                  />
                  <label htmlFor={tag} className="text-sm cursor-pointer">{tag}</label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialog(false)}>Cancel</Button>
            <Button onClick={handleTagUpdate} disabled={selectedTags.length === 0 || isProcessing}>
              {isProcessing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Tag className="h-4 w-4 mr-1" />}
              Add Tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={emailDialog} onOpenChange={setEmailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> Send Email
            </DialogTitle>
            <DialogDescription>
              Send email to {selectedCount} selected leads
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Email Template</Label>
              <Select
                value={emailTemplate}
                onValueChange={(val) => {
                  setEmailTemplate(val)
                  const template = emailTemplates.find(t => t.id === val)
                  if (template) setEmailSubject(template.subject)
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {emailTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <input
                type="text"
                className="w-full mt-2 px-3 py-2 border rounded-md"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialog(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={!emailTemplate || isProcessing}>
              {isProcessing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS Dialog */}
      <Dialog open={smsDialog} onOpenChange={setSmsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Send SMS
            </DialogTitle>
            <DialogDescription>
              Send SMS to {selectedCount} selected leads
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>SMS Template</Label>
            <Select value={smsTemplate} onValueChange={setSmsTemplate}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {smsTemplates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {smsTemplate && (
              <div className="mt-3 p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">Preview:</p>
                <p className="text-sm mt-1">
                  {smsTemplates.find(t => t.id === smsTemplate)?.content}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsDialog(false)}>Cancel</Button>
            <Button onClick={handleSendSms} disabled={!smsTemplate || isProcessing}>
              {isProcessing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-1" />}
              Send SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, isOpen: open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog.variant === 'destructive' ? (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              {confirmDialog.title}
            </DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}>
              Cancel
            </Button>
            <Button
              variant={confirmDialog.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={handleConfirmAction}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default BulkActionsToolbar
