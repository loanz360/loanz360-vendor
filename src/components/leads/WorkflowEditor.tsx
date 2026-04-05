'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  Zap,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Play,
  Pause,
  MoreVertical,
  ArrowRight,
  Clock,
  Mail,
  MessageSquare,
  UserPlus,
  Bell,
  Tag,
  Filter,
  CheckCircle2,
  AlertCircle,
  GitBranch,
  Timer,
  Target,
  Settings2,
  ChevronDown,
  ChevronRight,
  X,
  GripVertical
} from 'lucide-react'

interface WorkflowTrigger {
  type: 'lead_created' | 'status_changed' | 'stage_changed' | 'no_activity' | 'custom_field' | 'scheduled'
  conditions?: Record<string, unknown>
}

interface WorkflowAction {
  id: string
  type: 'send_email' | 'send_sms' | 'assign_lead' | 'change_status' | 'change_stage' | 'add_tag' | 'create_task' | 'notify' | 'wait'
  config: Record<string, unknown>
  order: number
}

interface Workflow {
  id: string
  name: string
  description: string
  trigger: WorkflowTrigger
  actions: WorkflowAction[]
  isActive: boolean
  runCount: number
  lastRun?: string
  createdAt: string
  updatedAt: string
}

const triggerTypes = [
  { id: 'lead_created', label: 'New Lead Created', icon: Plus, description: 'Triggers when a new lead is added' },
  { id: 'status_changed', label: 'Status Changed', icon: GitBranch, description: 'Triggers when lead status changes' },
  { id: 'stage_changed', label: 'Stage Changed', icon: ArrowRight, description: 'Triggers when pipeline stage changes' },
  { id: 'no_activity', label: 'No Activity', icon: Clock, description: 'Triggers after period of inactivity' },
  { id: 'custom_field', label: 'Field Updated', icon: Edit2, description: 'Triggers when specific field is updated' },
  { id: 'scheduled', label: 'Scheduled', icon: Timer, description: 'Triggers at scheduled time' },
]

const actionTypes = [
  { id: 'send_email', label: 'Send Email', icon: Mail, color: 'text-blue-600 bg-blue-100' },
  { id: 'send_sms', label: 'Send SMS', icon: MessageSquare, color: 'text-green-600 bg-green-100' },
  { id: 'assign_lead', label: 'Assign Lead', icon: UserPlus, color: 'text-purple-600 bg-purple-100' },
  { id: 'change_status', label: 'Change Status', icon: GitBranch, color: 'text-orange-600 bg-orange-100' },
  { id: 'change_stage', label: 'Move Stage', icon: ArrowRight, color: 'text-teal-600 bg-teal-100' },
  { id: 'add_tag', label: 'Add Tag', icon: Tag, color: 'text-pink-600 bg-pink-100' },
  { id: 'create_task', label: 'Create Task', icon: CheckCircle2, color: 'text-indigo-600 bg-indigo-100' },
  { id: 'notify', label: 'Send Notification', icon: Bell, color: 'text-yellow-600 bg-yellow-100' },
  { id: 'wait', label: 'Wait/Delay', icon: Timer, color: 'text-gray-600 bg-gray-100' },
]

const mockWorkflows: Workflow[] = [
  {
    id: 'wf-001',
    name: 'Welcome New Leads',
    description: 'Send welcome email and SMS to new leads, then assign to available agent',
    trigger: { type: 'lead_created' },
    actions: [
      { id: 'act-1', type: 'send_email', config: { templateId: 'tpl-001', templateName: 'Welcome Email' }, order: 1 },
      { id: 'act-2', type: 'send_sms', config: { templateId: 'tpl-003', templateName: 'Welcome SMS' }, order: 2 },
      { id: 'act-3', type: 'assign_lead', config: { strategy: 'round_robin', teamId: 'team-001' }, order: 3 },
      { id: 'act-4', type: 'create_task', config: { title: 'Initial call to new lead', dueInHours: 2 }, order: 4 },
    ],
    isActive: true,
    runCount: 1250,
    lastRun: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'wf-002',
    name: 'Follow-up Reminder',
    description: 'Send reminder after 3 days of no activity',
    trigger: { type: 'no_activity', conditions: { days: 3 } },
    actions: [
      { id: 'act-1', type: 'send_sms', config: { templateId: 'tpl-004', templateName: 'Follow-up Reminder' }, order: 1 },
      { id: 'act-2', type: 'notify', config: { recipientType: 'assigned_agent', message: 'Lead needs follow-up' }, order: 2 },
      { id: 'act-3', type: 'add_tag', config: { tag: 'Follow-up Required' }, order: 3 },
    ],
    isActive: true,
    runCount: 856,
    lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'wf-003',
    name: 'Document Collection',
    description: 'Trigger document request when lead moves to documentation stage',
    trigger: { type: 'stage_changed', conditions: { toStage: 'documentation' } },
    actions: [
      { id: 'act-1', type: 'send_email', config: { templateId: 'tpl-002', templateName: 'Document Request' }, order: 1 },
      { id: 'act-2', type: 'wait', config: { hours: 48 }, order: 2 },
      { id: 'act-3', type: 'send_sms', config: { templateId: 'tpl-005', templateName: 'Document Reminder' }, order: 3 },
    ],
    isActive: false,
    runCount: 432,
    lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  }
]

export function WorkflowEditor() {
  const [workflows, setWorkflows] = useState<Workflow[]>(mockWorkflows)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
  const [expandedWorkflows, setExpandedWorkflows] = useState<string[]>([])

  // Editor state
  const [editorName, setEditorName] = useState('')
  const [editorDescription, setEditorDescription] = useState('')
  const [editorTrigger, setEditorTrigger] = useState<WorkflowTrigger>({ type: 'lead_created' })
  const [editorActions, setEditorActions] = useState<WorkflowAction[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const toggleWorkflowExpand = (workflowId: string) => {
    setExpandedWorkflows(prev =>
      prev.includes(workflowId)
        ? prev.filter(id => id !== workflowId)
        : [...prev, workflowId]
    )
  }

  const toggleWorkflowActive = (workflowId: string) => {
    setWorkflows(workflows.map(wf =>
      wf.id === workflowId ? { ...wf, isActive: !wf.isActive } : wf
    ))
  }

  const openNewWorkflow = () => {
    setEditingWorkflow(null)
    setEditorName('')
    setEditorDescription('')
    setEditorTrigger({ type: 'lead_created' })
    setEditorActions([])
    setIsEditorOpen(true)
  }

  const openEditWorkflow = (workflow: Workflow) => {
    setEditingWorkflow(workflow)
    setEditorName(workflow.name)
    setEditorDescription(workflow.description)
    setEditorTrigger(workflow.trigger)
    setEditorActions([...workflow.actions])
    setIsEditorOpen(true)
  }

  const addAction = (type: string) => {
    const newAction: WorkflowAction = {
      id: `act-${Date.now()}`,
      type: type as WorkflowAction['type'],
      config: {},
      order: editorActions.length + 1
    }
    setEditorActions([...editorActions, newAction])
  }

  const removeAction = (actionId: string) => {
    setEditorActions(editorActions.filter(a => a.id !== actionId))
  }

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1000))

    const newWorkflow: Workflow = {
      id: editingWorkflow?.id || `wf-${Date.now()}`,
      name: editorName,
      description: editorDescription,
      trigger: editorTrigger,
      actions: editorActions,
      isActive: editingWorkflow?.isActive ?? false,
      runCount: editingWorkflow?.runCount || 0,
      lastRun: editingWorkflow?.lastRun,
      createdAt: editingWorkflow?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    if (editingWorkflow) {
      setWorkflows(workflows.map(wf => wf.id === editingWorkflow.id ? newWorkflow : wf))
    } else {
      setWorkflows([newWorkflow, ...workflows])
    }

    setIsSaving(false)
    setIsEditorOpen(false)
  }

  const handleDelete = (workflowId: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      setWorkflows(workflows.filter(wf => wf.id !== workflowId))
    }
  }

  const handleDuplicate = (workflow: Workflow) => {
    const duplicate: Workflow = {
      ...workflow,
      id: `wf-${Date.now()}`,
      name: `${workflow.name} (Copy)`,
      isActive: false,
      runCount: 0,
      lastRun: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setWorkflows([duplicate, ...workflows])
  }

  const getTriggerInfo = (trigger: WorkflowTrigger) => {
    return triggerTypes.find(t => t.id === trigger.type)
  }

  const getActionInfo = (type: string) => {
    return actionTypes.find(a => a.id === type)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" /> Workflow Automation
          </h2>
          <p className="text-sm text-muted-foreground">
            Create automated workflows to streamline lead management
          </p>
        </div>
        <Button onClick={openNewWorkflow}>
          <Plus className="h-4 w-4 mr-1" /> New Workflow
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workflows.length}</p>
                <p className="text-sm text-muted-foreground">Total Workflows</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Play className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workflows.filter(w => w.isActive).length}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {workflows.reduce((sum, w) => sum + w.runCount, 0).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Total Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Timer className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {workflows.filter(w => w.lastRun && new Date(w.lastRun) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length}
                </p>
                <p className="text-sm text-muted-foreground">Ran Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow List */}
      <div className="space-y-3">
        {workflows.map(workflow => {
          const triggerInfo = getTriggerInfo(workflow.trigger)
          const isExpanded = expandedWorkflows.includes(workflow.id)

          return (
            <Card key={workflow.id} className={workflow.isActive ? 'border-green-200' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-6 w-6"
                      onClick={() => toggleWorkflowExpand(workflow.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <div className={`p-2 rounded-lg ${workflow.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Zap className={`h-5 w-5 ${workflow.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{workflow.name}</h3>
                        <Badge variant={workflow.isActive ? 'default' : 'secondary'}>
                          {workflow.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{workflow.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p className="font-medium">{workflow.runCount.toLocaleString()} runs</p>
                      {workflow.lastRun && (
                        <p className="text-muted-foreground">Last: {formatDate(workflow.lastRun)}</p>
                      )}
                    </div>
                    <Switch
                      checked={workflow.isActive}
                      onCheckedChange={() => toggleWorkflowActive(workflow.id)}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditWorkflow(workflow)}>
                          <Edit2 className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(workflow)}>
                          <Copy className="h-4 w-4 mr-2" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDelete(workflow.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Expanded View */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-start gap-8">
                      {/* Trigger */}
                      <div className="flex-shrink-0">
                        <Label className="text-xs text-muted-foreground mb-2 block">TRIGGER</Label>
                        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          {triggerInfo && <triggerInfo.icon className="h-4 w-4 text-yellow-600" />}
                          <span className="font-medium text-sm">{triggerInfo?.label}</span>
                        </div>
                      </div>

                      <ArrowRight className="h-5 w-5 text-muted-foreground mt-8" />

                      {/* Actions */}
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground mb-2 block">ACTIONS</Label>
                        <div className="flex items-center gap-2 flex-wrap">
                          {workflow.actions.map((action, index) => {
                            const actionInfo = getActionInfo(action.type)
                            return (
                              <div key={action.id} className="flex items-center gap-2">
                                <div className={`flex items-center gap-2 p-2 rounded-lg ${actionInfo?.color}`}>
                                  {actionInfo && <actionInfo.icon className="h-4 w-4" />}
                                  <span className="text-sm font-medium">{actionInfo?.label}</span>
                                  {action.config.templateName && (
                                    <span className="text-xs opacity-75">({action.config.templateName as string})</span>
                                  )}
                                  {action.config.hours && (
                                    <span className="text-xs opacity-75">({action.config.hours as number}h)</span>
                                  )}
                                </div>
                                {index < workflow.actions.length - 1 && (
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingWorkflow ? 'Edit Workflow' : 'Create New Workflow'}
            </DialogTitle>
            <DialogDescription>
              Define trigger conditions and actions for your workflow
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Workflow Name</Label>
                <Input
                  value={editorName}
                  onChange={(e) => setEditorName(e.target.value)}
                  placeholder="e.g., Welcome New Leads"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={editorDescription}
                  onChange={(e) => setEditorDescription(e.target.value)}
                  placeholder="Describe what this workflow does..."
                  className="mt-1"
                />
              </div>
            </div>

            {/* Trigger */}
            <div>
              <Label className="text-base font-medium">Trigger</Label>
              <p className="text-sm text-muted-foreground mb-3">When should this workflow run?</p>
              <div className="grid grid-cols-3 gap-3">
                {triggerTypes.map(trigger => (
                  <Card
                    key={trigger.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      editorTrigger.type === trigger.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setEditorTrigger({ type: trigger.id as WorkflowTrigger['type'] })}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                          <trigger.icon className="h-4 w-4 text-yellow-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{trigger.label}</p>
                          <p className="text-xs text-muted-foreground">{trigger.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label className="text-base font-medium">Actions</Label>
                  <p className="text-sm text-muted-foreground">What should happen when triggered?</p>
                </div>
              </div>

              {/* Action List */}
              {editorActions.length > 0 && (
                <div className="space-y-2 mb-4">
                  {editorActions.map((action, index) => {
                    const actionInfo = getActionInfo(action.type)
                    return (
                      <div
                        key={action.id}
                        className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                        <div className="flex items-center gap-2 flex-1">
                          <Badge variant="outline">{index + 1}</Badge>
                          <div className={`p-1.5 rounded ${actionInfo?.color}`}>
                            {actionInfo && <actionInfo.icon className="h-4 w-4" />}
                          </div>
                          <span className="font-medium text-sm">{actionInfo?.label}</span>
                          <Button variant="ghost" size="sm" className="ml-auto">
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAction(action.id)}
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add Action */}
              <div className="grid grid-cols-3 gap-2">
                {actionTypes.map(action => (
                  <Button
                    key={action.id}
                    variant="outline"
                    className="justify-start h-auto py-3"
                    onClick={() => addAction(action.id)}
                  >
                    <div className={`p-1.5 rounded mr-2 ${action.color}`}>
                      <action.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm">{action.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!editorName || editorActions.length === 0 || isSaving}
            >
              {isSaving ? (
                <><span className="animate-spin mr-1">◌</span> Saving...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-1" /> Save Workflow</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default WorkflowEditor
