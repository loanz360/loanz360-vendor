'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Loader2, Send, Calendar, AlertCircle, Plus, Trash2
} from 'lucide-react'
import { SpeechToTextInput } from '@/components/common/SpeechToTextInput'
import type {
  DealStage, DealStatus, ActivityType, InteractionWith,
  InteractionMode, SupportedLanguage, PendingItem, CreateDealUpdateRequest
} from '@/types/ai-crm'

// Stage configuration
const stageOptions: { value: DealStage; label: string }[] = [
  { value: 'docs_collected', label: 'Documents Collected' },
  { value: 'finalized_bank', label: 'Bank Finalized' },
  { value: 'login_complete', label: 'Login Completed' },
  { value: 'post_login_pending_cleared', label: 'Pendings Cleared' },
  { value: 'process_started_at_bank', label: 'Bank Processing' },
  { value: 'case_assessed_by_banker', label: 'Case Assessed' },
  { value: 'pd_complete', label: 'PD Complete' },
  { value: 'sanctioned', label: 'Sanctioned' },
  { value: 'disbursed', label: 'Disbursed' },
  { value: 'dropped', label: 'Dropped' }
]

const activityOptions: { value: ActivityType; label: string }[] = [
  { value: 'customer_call', label: 'Customer Call' },
  { value: 'bank_visit', label: 'Bank Visit' },
  { value: 'document_collection', label: 'Document Collection' },
  { value: 'document_submission', label: 'Document Submission' },
  { value: 'internal_review', label: 'Internal Review' },
  { value: 'customer_meeting', label: 'Customer Meeting' },
  { value: 'banker_meeting', label: 'Banker Meeting' },
  { value: 'verification_call', label: 'Verification Call' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'status_check', label: 'Status Check' },
  { value: 'other', label: 'Other' }
]

const interactionWithOptions: { value: InteractionWith; label: string }[] = [
  { value: 'customer', label: 'Customer' },
  { value: 'banker', label: 'Banker' },
  { value: 'internal', label: 'Internal' },
  { value: 'verifier', label: 'Verifier' },
  { value: 'lawyer', label: 'Lawyer' },
  { value: 'other', label: 'Other' }
]

const interactionModeOptions: { value: InteractionMode; label: string }[] = [
  { value: 'call', label: 'Phone Call' },
  { value: 'meeting', label: 'In-Person Meeting' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'in_person', label: 'In Person' },
  { value: 'sms', label: 'SMS' }
]

interface DealUpdateFormProps {
  dealId: string
  customerName: string
  loanType: string
  currentStage: DealStage
  currentStatus: DealStatus
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  source?: 'manual' | 'reminder_popup'
}

export function DealUpdateForm({
  dealId,
  customerName,
  loanType,
  currentStage,
  currentStatus,
  isOpen,
  onClose,
  onSuccess,
  source = 'manual'
}: DealUpdateFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('notes')

  // Form state
  const [notes, setNotes] = useState('')
  const [language, setLanguage] = useState<SupportedLanguage>('en')
  const [newStage, setNewStage] = useState<DealStage | ''>('')
  const [activityType, setActivityType] = useState<ActivityType | ''>('')
  const [interactionWith, setInteractionWith] = useState<InteractionWith | ''>('')
  const [interactionMode, setInteractionMode] = useState<InteractionMode | ''>('')
  const [interactionSummary, setInteractionSummary] = useState('')
  const [customerResponse, setCustomerResponse] = useState('')
  const [bankerFeedback, setBankerFeedback] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [nextActionDate, setNextActionDate] = useState('')
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [newPendingItem, setNewPendingItem] = useState('')

  // Financial fields (for sanctioned/disbursed)
  const [sanctionedAmount, setSanctionedAmount] = useState('')
  const [disbursedAmount, setDisbursedAmount] = useState('')
  const [dropReason, setDropReason] = useState('')

  const resetForm = () => {
    setNotes('')
    setLanguage('en')
    setNewStage('')
    setActivityType('')
    setInteractionWith('')
    setInteractionMode('')
    setInteractionSummary('')
    setCustomerResponse('')
    setBankerFeedback('')
    setNextAction('')
    setNextActionDate('')
    setPendingItems([])
    setNewPendingItem('')
    setSanctionedAmount('')
    setDisbursedAmount('')
    setDropReason('')
    setError(null)
    setActiveTab('notes')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const addPendingItem = () => {
    if (!newPendingItem.trim()) return
    const item: PendingItem = {
      id: Date.now().toString(),
      item: newPendingItem.trim(),
      priority: 'normal',
      completed: false
    }
    setPendingItems([...pendingItems, item])
    setNewPendingItem('')
  }

  const removePendingItem = (id: string) => {
    setPendingItems(pendingItems.filter(item => item.id !== id))
  }

  const togglePendingItemPriority = (id: string) => {
    setPendingItems(pendingItems.map(item => {
      if (item.id === id) {
        const priorities: PendingItem['priority'][] = ['low', 'normal', 'high', 'critical']
        const currentIndex = priorities.indexOf(item.priority)
        const nextIndex = (currentIndex + 1) % priorities.length
        return { ...item, priority: priorities[nextIndex] }
      }
      return item
    }))
  }

  const handleSubmit = async () => {
    if (!notes.trim()) {
      setError('Please provide update notes')
      return
    }

    // Validate required fields for specific stages
    if (newStage === 'sanctioned' && !sanctionedAmount) {
      setError('Please enter the sanctioned amount')
      return
    }
    if (newStage === 'disbursed' && !disbursedAmount) {
      setError('Please enter the disbursed amount')
      return
    }
    if (newStage === 'dropped' && !dropReason.trim()) {
      setError('Please provide a reason for dropping the deal')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const requestBody: CreateDealUpdateRequest = {
        deal_id: dealId,
        notes: notes.trim(),
        original_language: language,
        update_source: source,
        ...(newStage && { new_stage: newStage }),
        ...(activityType && { activity_type: activityType }),
        ...(interactionWith && { interaction_with: interactionWith }),
        ...(interactionMode && { interaction_mode: interactionMode }),
        ...(interactionSummary && { interaction_summary: interactionSummary }),
        ...(customerResponse && { customer_response: customerResponse }),
        ...(bankerFeedback && { banker_feedback: bankerFeedback }),
        ...(nextAction && { next_action: nextAction }),
        ...(nextActionDate && { next_action_date: nextActionDate }),
        ...(pendingItems.length > 0 && { pending_items: pendingItems }),
        ...(sanctionedAmount && { sanctioned_amount: parseFloat(sanctionedAmount) }),
        ...(disbursedAmount && { disbursed_amount: parseFloat(disbursedAmount) }),
        ...(dropReason && { drop_reason: dropReason })
      }

      const response = await fetch(`/api/ai-crm/bde/deals/${dealId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (data.success) {
        resetForm()
        onSuccess()
        onClose()
      } else {
        setError(data.message || 'Failed to submit update')
      }
    } catch (err) {
      console.error('Error submitting update:', err)
      setError('Failed to submit update. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: PendingItem['priority']) => {
    switch (priority) {
      case 'critical': return 'border-red-500 text-red-400'
      case 'high': return 'border-orange-500 text-orange-400'
      case 'normal': return 'border-blue-500 text-blue-400'
      case 'low': return 'border-gray-500 text-gray-400'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-white">Add Deal Update</DialogTitle>
          <DialogDescription>
            <span className="text-orange-400">{customerName}</span>
            <span className="text-gray-500"> • </span>
            <span className="text-gray-400">{loanType}</span>
            <Badge className="ml-2 bg-gray-800 text-gray-300">
              {stageOptions.find(s => s.value === currentStage)?.label}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-gray-800 w-full grid grid-cols-4">
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="pending">Pending Items</TabsTrigger>
            <TabsTrigger value="stage">Stage Update</TabsTrigger>
          </TabsList>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-4 mt-4">
            <SpeechToTextInput
              value={notes}
              onChange={setNotes}
              language={language}
              onLanguageChange={setLanguage}
              placeholder="Describe what happened, any updates, customer/banker discussions..."
              label="Update Notes"
              required
              minRows={4}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Response</Label>
                <Textarea
                  value={customerResponse}
                  onChange={(e) => setCustomerResponse(e.target.value)}
                  placeholder="What did the customer say?"
                  className="bg-gray-800 border-gray-700"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Banker Feedback</Label>
                <Textarea
                  value={bankerFeedback}
                  onChange={(e) => setBankerFeedback(e.target.value)}
                  placeholder="Any feedback from the bank?"
                  className="bg-gray-800 border-gray-700"
                  rows={2}
                />
              </div>
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Activity Type</Label>
                <Select value={activityType} onValueChange={(val) => setActivityType(val as ActivityType)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Select activity" />
                  </SelectTrigger>
                  <SelectContent>
                    {activityOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Interaction With</Label>
                <Select value={interactionWith} onValueChange={(val) => setInteractionWith(val as InteractionWith)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    {interactionWithOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mode of Interaction</Label>
                <Select value={interactionMode} onValueChange={(val) => setInteractionMode(val as InteractionMode)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {interactionModeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Interaction Summary</Label>
              <Textarea
                value={interactionSummary}
                onChange={(e) => setInteractionSummary(e.target.value)}
                placeholder="Brief summary of the interaction..."
                className="bg-gray-800 border-gray-700"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Next Action</Label>
                <Input
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="What's the next step?"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Next Action Date</Label>
                <Input
                  type="date"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
            </div>
          </TabsContent>

          {/* Pending Items Tab */}
          <TabsContent value="pending" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input
                value={newPendingItem}
                onChange={(e) => setNewPendingItem(e.target.value)}
                placeholder="Add a pending item..."
                className="bg-gray-800 border-gray-700"
                onKeyDown={(e) => e.key === 'Enter' && addPendingItem()}
              />
              <Button onClick={addPendingItem} variant="secondary">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {pendingItems.length > 0 ? (
              <div className="space-y-2">
                {pendingItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
                  >
                    <button
                      onClick={() => togglePendingItemPriority(item.id)}
                      className={`px-2 py-1 text-xs border rounded ${getPriorityColor(item.priority)}`}
                    >
                      {item.priority}
                    </button>
                    <span className="flex-1 text-gray-300">{item.item}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePendingItem(item.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">No pending items added</p>
            )}
          </TabsContent>

          {/* Stage Update Tab */}
          <TabsContent value="stage" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Update Stage (Optional)</Label>
              <Select value={newStage} onValueChange={(val) => setNewStage(val as DealStage)}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue placeholder="Keep current stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keep Current Stage</SelectItem>
                  {stageOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newStage === 'sanctioned' && (
              <div className="space-y-2 p-4 bg-emerald-900/20 rounded-lg border border-emerald-800">
                <Label className="text-emerald-400">Sanctioned Amount *</Label>
                <Input
                  type="number"
                  value={sanctionedAmount}
                  onChange={(e) => setSanctionedAmount(e.target.value)}
                  placeholder="Enter sanctioned amount"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
            )}

            {newStage === 'disbursed' && (
              <div className="space-y-2 p-4 bg-green-900/20 rounded-lg border border-green-800">
                <Label className="text-green-400">Disbursed Amount *</Label>
                <Input
                  type="number"
                  value={disbursedAmount}
                  onChange={(e) => setDisbursedAmount(e.target.value)}
                  placeholder="Enter disbursed amount"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
            )}

            {newStage === 'dropped' && (
              <div className="space-y-2 p-4 bg-red-900/20 rounded-lg border border-red-800">
                <Label className="text-red-400">Drop Reason *</Label>
                <Textarea
                  value={dropReason}
                  onChange={(e) => setDropReason(e.target.value)}
                  placeholder="Why is this deal being dropped?"
                  className="bg-gray-800 border-gray-700"
                  rows={3}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !notes.trim()}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Update
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DealUpdateForm
