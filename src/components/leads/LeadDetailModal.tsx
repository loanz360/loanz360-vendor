'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Calendar,
  Clock,
  FileText,
  MessageSquare,
  History,
  CheckCircle2,
  AlertCircle,
  Star,
  Edit2,
  X,
  PhoneCall,
  Send,
  Video,
  Plus,
  Download,
  Upload,
  Trash2,
  MoreVertical,
  IndianRupee,
  Briefcase,
  CreditCard,
  Target,
  TrendingUp,
  Users
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/cn'

interface LeadDetailModalProps {
  isOpen: boolean
  onClose: () => void
  leadId: string | null
}

interface LeadDetail {
  id: string
  name: string
  email: string
  phone: string
  alternatePhone?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  status: string
  priority: string
  source: string
  loanType: string
  loanAmount: number
  propertyValue?: number
  monthlyIncome: number
  employmentType: string
  companyName?: string
  experience?: number
  creditScore?: number
  existingLoans?: number
  assignedTo: string
  assignedToName: string
  stage: string
  stageProgress: number
  conversionProbability: number
  nextFollowUp?: string
  lastContactedAt?: string
  createdAt: string
  updatedAt: string
  tags: string[]
  score: number
}

interface Communication {
  id: string
  type: 'call' | 'email' | 'sms' | 'meeting'
  direction: 'inbound' | 'outbound'
  subject?: string
  content?: string
  duration?: number
  outcome?: string
  createdAt: string
  createdByName: string
}

interface Activity {
  id: string
  type: string
  description: string
  createdAt: string
  createdByName: string
}

interface Task {
  id: string
  title: string
  dueDate: string
  status: 'pending' | 'completed' | 'overdue'
  priority: 'low' | 'medium' | 'high'
  assignedTo: string
}

interface Document {
  id: string
  name: string
  type: string
  size: number
  uploadedAt: string
  uploadedBy: string
}

export function LeadDetailModal({ isOpen, onClose, leadId }: LeadDetailModalProps) {
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [communications, setCommunications] = useState<Communication[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [newNote, setNewNote] = useState('')

  useEffect(() => {
    if (leadId && isOpen) {
      fetchLeadDetails()
    }
  }, [leadId, isOpen])

  const fetchLeadDetails = async () => {
    setLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))

    // Mock data
    setLead({
      id: leadId || 'lead-001',
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@example.com',
      phone: '+91 98765 43210',
      alternatePhone: '+91 98765 43211',
      address: '123, MG Road, Andheri West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400058',
      status: 'qualified',
      priority: 'high',
      source: 'Website',
      loanType: 'Home Loan',
      loanAmount: 5000000,
      propertyValue: 7500000,
      monthlyIncome: 150000,
      employmentType: 'Salaried',
      companyName: 'TCS',
      experience: 8,
      creditScore: 750,
      existingLoans: 1,
      assignedTo: 'agent-001',
      assignedToName: 'Suresh Kumar',
      stage: 'Document Collection',
      stageProgress: 60,
      conversionProbability: 75,
      nextFollowUp: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      lastContactedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      tags: ['Premium', 'First-time Buyer', 'Pre-approved'],
      score: 85
    })

    setCommunications([
      { id: 'comm-1', type: 'call', direction: 'outbound', duration: 320, outcome: 'Positive - Document pending', createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), createdByName: 'Suresh Kumar' },
      { id: 'comm-2', type: 'email', direction: 'outbound', subject: 'Document Checklist', content: 'Please find attached the list of required documents...', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), createdByName: 'Suresh Kumar' },
      { id: 'comm-3', type: 'call', direction: 'inbound', duration: 180, outcome: 'Query about interest rates', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), createdByName: 'System' },
      { id: 'comm-4', type: 'sms', direction: 'outbound', content: 'Thank you for your interest. Our executive will call you shortly.', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), createdByName: 'System' }
    ])

    setActivities([
      { id: 'act-1', type: 'stage_change', description: 'Stage changed from "Verification" to "Document Collection"', createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), createdByName: 'Suresh Kumar' },
      { id: 'act-2', type: 'document_upload', description: 'PAN Card uploaded', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), createdByName: 'Rajesh Kumar' },
      { id: 'act-3', type: 'note_added', description: 'Customer prefers lower EMI with longer tenure', createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), createdByName: 'Suresh Kumar' },
      { id: 'act-4', type: 'assignment', description: 'Lead assigned to Suresh Kumar', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), createdByName: 'System' },
      { id: 'act-5', type: 'created', description: 'Lead created from Website form', createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), createdByName: 'System' }
    ])

    setTasks([
      { id: 'task-1', title: 'Collect Salary Slips', dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending', priority: 'high', assignedTo: 'Suresh Kumar' },
      { id: 'task-2', title: 'Verify Property Documents', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending', priority: 'medium', assignedTo: 'Suresh Kumar' },
      { id: 'task-3', title: 'Initial Documentation Check', dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed', priority: 'high', assignedTo: 'Suresh Kumar' }
    ])

    setDocuments([
      { id: 'doc-1', name: 'PAN_Card.pdf', type: 'Identity', size: 245000, uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), uploadedBy: 'Rajesh Kumar' },
      { id: 'doc-2', name: 'Aadhaar_Card.pdf', type: 'Identity', size: 312000, uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), uploadedBy: 'Rajesh Kumar' },
      { id: 'doc-3', name: 'Salary_Slip_Dec.pdf', type: 'Income', size: 156000, uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), uploadedBy: 'Rajesh Kumar' }
    ])

    setLoading(false)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      contacted: 'bg-yellow-100 text-yellow-800',
      qualified: 'bg-green-100 text-green-800',
      proposal: 'bg-purple-100 text-purple-800',
      negotiation: 'bg-orange-100 text-orange-800',
      converted: 'bg-emerald-100 text-emerald-800',
      lost: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    }
    return colors[priority] || 'bg-gray-100 text-gray-800'
  }

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'overdue': return <AlertCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getCommunicationIcon = (type: string) => {
    switch (type) {
      case 'call': return <PhoneCall className="h-4 w-4" />
      case 'email': return <Mail className="h-4 w-4" />
      case 'sms': return <MessageSquare className="h-4 w-4" />
      case 'meeting': return <Video className="h-4 w-4" />
      default: return <MessageSquare className="h-4 w-4" />
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-blue-100 text-blue-600 text-lg">
                  {lead?.name?.split(' ').map(n => n[0]).join('') || 'L'}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-xl">{lead?.name || 'Loading...'}</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  {lead && (
                    <>
                      <Badge className={getStatusColor(lead.status)}>{lead.status}</Badge>
                      <Badge className={getPriorityColor(lead.priority)}>{lead.priority} priority</Badge>
                      <Badge variant="outline">{lead.source}</Badge>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Edit2 className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : lead ? (
          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid grid-cols-6 w-full flex-shrink-0">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="communications">Communications</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto mt-4">
                <TabsContent value="overview" className="m-0">
                  <div className="grid grid-cols-3 gap-4">
                    {/* Lead Score & Conversion */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Target className="h-4 w-4" /> Lead Score
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4">
                          <div className="relative h-20 w-20">
                            <svg className="h-20 w-20 -rotate-90">
                              <circle cx="40" cy="40" r="35" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                              <circle
                                cx="40" cy="40" r="35" fill="none" stroke="#3b82f6" strokeWidth="6"
                                strokeDasharray={`${lead.score * 2.2} 220`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">
                              {lead.score}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground">Conversion Probability</p>
                            <p className="text-2xl font-bold text-green-600">{lead.conversionProbability}%</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Pipeline Stage */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" /> Pipeline Stage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-lg font-semibold mb-2">{lead.stage}</p>
                        <Progress value={lead.stageProgress} className="h-2 mb-2" />
                        <p className="text-sm text-muted-foreground">{lead.stageProgress}% complete</p>
                      </CardContent>
                    </Card>

                    {/* Assigned Agent */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Users className="h-4 w-4" /> Assigned To
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>{lead.assignedToName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{lead.assignedToName}</p>
                            <p className="text-sm text-muted-foreground">Sales Executive</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Contact Information */}
                    <Card className="col-span-2">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <User className="h-4 w-4" /> Contact Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{lead.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{lead.email}</span>
                          </div>
                          {lead.alternatePhone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>{lead.alternatePhone} (Alt)</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{lead.city}, {lead.state}</span>
                          </div>
                        </div>
                        {lead.address && (
                          <p className="mt-3 text-sm text-muted-foreground">
                            {lead.address}, {lead.city} - {lead.pincode}
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="justify-start">
                          <PhoneCall className="h-4 w-4 mr-2" /> Call
                        </Button>
                        <Button variant="outline" size="sm" className="justify-start">
                          <Mail className="h-4 w-4 mr-2" /> Email
                        </Button>
                        <Button variant="outline" size="sm" className="justify-start">
                          <MessageSquare className="h-4 w-4 mr-2" /> SMS
                        </Button>
                        <Button variant="outline" size="sm" className="justify-start">
                          <Video className="h-4 w-4 mr-2" /> Meeting
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Loan Details */}
                    <Card className="col-span-2">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <IndianRupee className="h-4 w-4" /> Loan Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Loan Type</p>
                            <p className="font-medium">{lead.loanType}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Loan Amount</p>
                            <p className="font-medium text-lg">{formatCurrency(lead.loanAmount)}</p>
                          </div>
                          {lead.propertyValue && (
                            <div>
                              <p className="text-sm text-muted-foreground">Property Value</p>
                              <p className="font-medium">{formatCurrency(lead.propertyValue)}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Financial Profile */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <CreditCard className="h-4 w-4" /> Financial Profile
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Monthly Income</span>
                            <span className="font-medium">{formatCurrency(lead.monthlyIncome)}</span>
                          </div>
                          {lead.creditScore && (
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Credit Score</span>
                              <span className="font-medium">{lead.creditScore}</span>
                            </div>
                          )}
                          {lead.existingLoans !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Existing Loans</span>
                              <span className="font-medium">{lead.existingLoans}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Employment Details */}
                    <Card className="col-span-2">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Briefcase className="h-4 w-4" /> Employment Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Employment Type</p>
                            <p className="font-medium">{lead.employmentType}</p>
                          </div>
                          {lead.companyName && (
                            <div>
                              <p className="text-sm text-muted-foreground">Company</p>
                              <p className="font-medium">{lead.companyName}</p>
                            </div>
                          )}
                          {lead.experience && (
                            <div>
                              <p className="text-sm text-muted-foreground">Experience</p>
                              <p className="font-medium">{lead.experience} years</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Tags */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Star className="h-4 w-4" /> Tags
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {lead.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary">{tag}</Badge>
                          ))}
                          <Button variant="ghost" size="sm" className="h-6 px-2">
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Important Dates */}
                    <Card className="col-span-3">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" /> Important Dates
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Created</p>
                            <p className="font-medium">{formatDate(lead.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Last Updated</p>
                            <p className="font-medium">{formatDate(lead.updatedAt)}</p>
                          </div>
                          {lead.lastContactedAt && (
                            <div>
                              <p className="text-sm text-muted-foreground">Last Contacted</p>
                              <p className="font-medium">{formatDate(lead.lastContactedAt)}</p>
                            </div>
                          )}
                          {lead.nextFollowUp && (
                            <div>
                              <p className="text-sm text-muted-foreground">Next Follow-up</p>
                              <p className="font-medium text-blue-600">{formatDate(lead.nextFollowUp)}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="communications" className="m-0">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">Communication History</h3>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" /> Log Communication
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {communications.map(comm => (
                        <Card key={comm.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-full ${comm.direction === 'inbound' ? 'bg-green-100' : 'bg-blue-100'}`}>
                                {getCommunicationIcon(comm.type)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium capitalize">{comm.type}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {comm.direction}
                                  </Badge>
                                  {comm.duration && (
                                    <span className="text-sm text-muted-foreground">
                                      {formatDuration(comm.duration)}
                                    </span>
                                  )}
                                </div>
                                {comm.subject && <p className="font-medium">{comm.subject}</p>}
                                {comm.content && <p className="text-sm text-muted-foreground">{comm.content}</p>}
                                {comm.outcome && <p className="text-sm mt-1"><strong>Outcome:</strong> {comm.outcome}</p>}
                                <p className="text-xs text-muted-foreground mt-2">
                                  {formatDate(comm.createdAt)} at {formatTime(comm.createdAt)} by {comm.createdByName}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="m-0">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">Documents ({documents.length})</h3>
                      <Button size="sm">
                        <Upload className="h-4 w-4 mr-1" /> Upload Document
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {documents.map(doc => (
                        <Card key={doc.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded">
                                <FileText className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{doc.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {doc.type} • {formatFileSize(doc.size)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Uploaded {formatDate(doc.uploadedAt)} by {doc.uploadedBy}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm">
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="tasks" className="m-0">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">Tasks ({tasks.length})</h3>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" /> Add Task
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {tasks.map(task => (
                        <Card key={task.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              {getTaskStatusIcon(task.status)}
                              <div className="flex-1">
                                <p className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                                  {task.title}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Due: {formatDate(task.dueDate)} • Assigned to: {task.assignedTo}
                                </p>
                              </div>
                              <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="m-0">
                  <div className="space-y-4">
                    <h3 className="font-medium">Activity Timeline</h3>
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-4">
                        {activities.map(activity => (
                          <div key={activity.id} className="relative pl-10">
                            <div className="absolute left-2 w-4 h-4 rounded-full bg-blue-100 border-2 border-blue-600" />
                            <Card>
                              <CardContent className="p-3">
                                <p className="text-sm">{activity.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDate(activity.createdAt)} at {formatTime(activity.createdAt)} by {activity.createdByName}
                                </p>
                              </CardContent>
                            </Card>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="m-0">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">Add Note</h3>
                      <Textarea
                        placeholder="Write a note about this lead..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        rows={3}
                      />
                      <div className="flex justify-end mt-2">
                        <Button size="sm" disabled={!newNote.trim()}>
                          <Send className="h-4 w-4 mr-1" /> Add Note
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-medium">Previous Notes</h3>
                      {activities.filter(a => a.type === 'note_added').map(note => (
                        <Card key={note.id}>
                          <CardContent className="p-4">
                            <p className="text-sm">{note.description}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {formatDate(note.createdAt)} by {note.createdByName}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export default LeadDetailModal
