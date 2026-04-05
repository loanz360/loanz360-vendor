'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  User,
  DollarSign,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileText,
  MessageSquare,
  Clock,
  Download,
  Upload,
  Send,
  AlertCircle,
  CheckCircle,
  Eye,
  Edit2,
  Save,
  Trash2,
} from 'lucide-react'

interface LeadDetail {
  id: string
  customerName: string
  customerEmail: string | null
  customerPhone: string
  customerAddress: string | null
  loanType: string
  loanTypeLabel: string
  loanAmount: number
  formattedAmount: string
  currentStage: string
  currentStageLabel: string
  stageColor: string
  priority: string
  priorityLabel: string
  priorityColor: string
  bdeName: string
  bdeAvatar: string | null
  bdeEmail: string
  bdePhone: string
  bankName: string | null
  bankLogo: string | null
  daysInStage: number
  isStale: boolean
  isUrgent: boolean
  createdAt: string
  createdAtFormatted: string
  lastActivity: string
  lastActivityFormatted: string
  notes: string | null
}

interface TimelineEvent {
  id: string
  type: string
  typeLabel: string
  icon: string
  color: string
  title: string
  description: string
  userName: string
  userAvatar: string | null
  timestamp: string
  timestampFormatted: string
  metadata: Record<string, any> | null
}

interface Document {
  id: string
  name: string
  type: string
  size: number
  formattedSize: string
  uploadedBy: string
  uploadedAt: string
  uploadedAtFormatted: string
  url: string
  status: 'pending' | 'verified' | 'rejected'
}

interface Communication {
  id: string
  type: 'email' | 'phone' | 'sms' | 'whatsapp'
  direction: 'inbound' | 'outbound'
  subject: string | null
  message: string
  from: string
  to: string
  timestamp: string
  timestampFormatted: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
}

interface LeadDetailModalProps {
  leadId: string
  isOpen: boolean
  onClose: () => void
}

export function LeadDetailModal({ leadId, isOpen, onClose }: LeadDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'documents' | 'communications'>('overview')
  const [isEditing, setIsEditing] = useState(false)
  const [newNote, setNewNote] = useState('')
  const queryClient = useQueryClient()

  // Fetch lead details
  const { data, isLoading, error } = useQuery({
    queryKey: ['lead-detail', leadId],
    queryFn: async () => {
      const res = await fetch(`/api/bdm/team-pipeline/stages/lead-detail?leadId=${leadId}`)
      if (!res.ok) throw new Error('Failed to fetch lead details')
      return res.json()
    },
    enabled: isOpen && !!leadId,
  })

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const res = await fetch('/api/bdm/team-pipeline/stages/update-lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, action: 'add_note', note }),
      })
      if (!res.ok) throw new Error('Failed to add note')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-detail', leadId] })
      setNewNote('')
    },
  })

  const lead: LeadDetail | undefined = data?.data?.lead
  const timeline: TimelineEvent[] = data?.data?.timeline || []
  const documents: Document[] = data?.data?.documents || []
  const communications: Communication[] = data?.data?.communications || []

  if (!isOpen) return null

  const getEventIcon = (icon: string) => {
    const icons: Record<string, any> = {
      user: User,
      edit: Edit2,
      phone: Phone,
      mail: Mail,
      file: FileText,
      message: MessageSquare,
      check: CheckCircle,
      alert: AlertCircle,
      clock: Clock,
    }
    const IconComponent = icons[icon] || Clock
    return <IconComponent className="w-4 h-4" />
  }

  const getCommunicationIcon = (type: string) => {
    const icons = {
      email: Mail,
      phone: Phone,
      sms: MessageSquare,
      whatsapp: MessageSquare,
    }
    const IconComponent = icons[type as keyof typeof icons] || MessageSquare
    return <IconComponent className="w-4 h-4" />
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Lead Details</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {isLoading ? (
              <div className="h-16 bg-blue-700 rounded animate-pulse" />
            ) : lead && (
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-blue-700 text-2xl font-bold">
                  {lead.customerName.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{lead.customerName}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm opacity-90">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {lead.customerPhone}
                    </span>
                    {lead.customerEmail && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {lead.customerEmail}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Loan Amount</p>
                  <p className="text-2xl font-bold">{lead.formattedAmount}</p>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex">
              {[
                { id: 'overview', label: 'Overview', icon: Eye },
                { id: 'timeline', label: 'Timeline', icon: Clock, badge: timeline.length },
                { id: 'documents', label: 'Documents', icon: FileText, badge: documents.length },
                { id: 'communications', label: 'Communications', icon: MessageSquare, badge: communications.length },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.badge !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
                <p className="text-lg font-medium">Failed to load lead details</p>
                <p className="text-sm">Please try again later</p>
              </div>
            ) : (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && lead && (
                  <div className="space-y-6">
                    {/* Key Information */}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">Lead Information</h3>

                        <div>
                          <label className="text-sm text-gray-600">Current Stage</label>
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                              style={{
                                backgroundColor: `${lead.stageColor}20`,
                                color: lead.stageColor,
                              }}
                            >
                              {lead.currentStageLabel}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm text-gray-600">Priority</label>
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                              style={{
                                backgroundColor: `${lead.priorityColor}20`,
                                color: lead.priorityColor,
                              }}
                            >
                              {lead.priorityLabel}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm text-gray-600">Loan Type</label>
                          <p className="mt-1 text-sm font-medium text-gray-900">{lead.loanTypeLabel}</p>
                        </div>

                        {lead.bankName && (
                          <div>
                            <label className="text-sm text-gray-600">Bank</label>
                            <p className="mt-1 text-sm font-medium text-gray-900">🏦 {lead.bankName}</p>
                          </div>
                        )}

                        {lead.customerAddress && (
                          <div>
                            <label className="text-sm text-gray-600">Address</label>
                            <p className="mt-1 text-sm text-gray-900">{lead.customerAddress}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">Assigned BDE</h3>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-lg font-bold">
                              {lead.bdeName.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{lead.bdeName}</p>
                              <p className="text-xs text-gray-600">Business Development Executive</p>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-gray-700">
                              <Phone className="w-4 h-4 text-gray-400" />
                              {lead.bdePhone}
                            </div>
                            <div className="flex items-center gap-2 text-gray-700">
                              <Mail className="w-4 h-4 text-gray-400" />
                              {lead.bdeEmail}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-600">Days in Stage</p>
                            <p className={`text-2xl font-bold ${
                              lead.daysInStage > 7 ? 'text-orange-600' : 'text-gray-900'
                            }`}>
                              {lead.daysInStage}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-600">Created</p>
                            <p className="text-sm font-medium text-gray-900">{lead.createdAtFormatted}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notes Section */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>

                      {lead.notes ? (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-3">
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">{lead.notes}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 mb-3">No notes added yet</p>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Add a note..."
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={() => addNoteMutation.mutate(newNote)}
                          disabled={!newNote.trim() || addNoteMutation.isPending}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeline Tab */}
                {activeTab === 'timeline' && (
                  <div className="space-y-4">
                    {timeline.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No timeline events yet</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
                        {timeline.map(event => (
                          <div key={event.id} className="relative flex gap-4 pb-6">
                            <div
                              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                              style={{ backgroundColor: `${event.color}20`, color: event.color }}
                            >
                              {getEventIcon(event.icon)}
                            </div>
                            <div className="flex-1 bg-gray-50 rounded-lg p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-semibold text-gray-900">{event.title}</h4>
                                  <p className="text-sm text-gray-600">{event.description}</p>
                                </div>
                                <span className="text-xs text-gray-500">{event.timestampFormatted}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <User className="w-3 h-3" />
                                {event.userName}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Documents Tab */}
                {activeTab === 'documents' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Documents ({documents.length})</h3>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Upload
                      </button>
                    </div>

                    {documents.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No documents uploaded yet</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {documents.map(doc => (
                          <div key={doc.id} className="bg-gray-50 rounded-lg p-4 flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center">
                              <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{doc.name}</p>
                              <p className="text-xs text-gray-600">
                                {doc.formattedSize} • Uploaded by {doc.uploadedBy} • {doc.uploadedAtFormatted}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                doc.status === 'verified' ? 'bg-green-100 text-green-700' :
                                doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {doc.status}
                              </span>
                              <button className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Communications Tab */}
                {activeTab === 'communications' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Communications ({communications.length})</h3>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                        <Send className="w-4 h-4" />
                        New Message
                      </button>
                    </div>

                    {communications.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No communications yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {communications.map(comm => (
                          <div key={comm.id} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                comm.direction === 'outbound' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                              }`}>
                                {getCommunicationIcon(comm.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    comm.type === 'email' ? 'bg-purple-100 text-purple-700' :
                                    comm.type === 'phone' ? 'bg-blue-100 text-blue-700' :
                                    'bg-green-100 text-green-700'
                                  }`}>
                                    {comm.type.toUpperCase()}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    comm.direction === 'outbound' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                  }`}>
                                    {comm.direction === 'outbound' ? 'Sent' : 'Received'}
                                  </span>
                                  <span className="text-xs text-gray-500">{comm.timestampFormatted}</span>
                                </div>
                                {comm.subject && (
                                  <p className="font-medium text-gray-900 mb-1">{comm.subject}</p>
                                )}
                                <p className="text-sm text-gray-700 line-clamp-2">{comm.message}</p>
                                <p className="text-xs text-gray-600 mt-2">
                                  From: {comm.from} • To: {comm.to}
                                </p>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                comm.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                comm.status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {comm.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Close
            </button>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Edit2 className="w-4 h-4" />
                Edit Lead
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
