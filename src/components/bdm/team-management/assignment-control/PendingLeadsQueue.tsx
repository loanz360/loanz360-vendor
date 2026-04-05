'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Clock, AlertCircle, CheckCircle, User, UserPlus } from 'lucide-react'

interface PendingLead {
  id: string
  customer_name: string
  loan_type: string
  requested_amount: number
  pincode: string
  lead_source: string
  created_at: string
  leadAge: {
    days: number
    hours: number
    formatted: string
  }
  priority: 'urgent' | 'high' | 'medium' | 'low'
  assignability: {
    status: 'assignable' | 'partially_assignable' | 'not_assignable'
    reason: string
    matchingBDEs: number
  }
  suggestedBDEs: Array<{
    id: string
    name: string
    utilizationPercentage: number
  }>
}

interface PendingLeadsQueueProps {
  leads: PendingLead[]
  onManualAssign: (leadId: string) => void
  onBulkSelect: (selectedIds: string[]) => void
}

export default function PendingLeadsQueue({
  leads,
  onManualAssign,
  onBulkSelect,
}: PendingLeadsQueueProps) {
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterAssignability, setFilterAssignability] = useState<string>('all')

  const getPriorityBadge = (priority: string) => {
    const variants = {
      urgent: { variant: 'destructive' as const, icon: AlertCircle, text: 'Urgent' },
      high: { variant: 'default' as const, icon: Clock, text: 'High' },
      medium: { variant: 'secondary' as const, icon: Clock, text: 'Medium' },
      low: { variant: 'outline' as const, icon: CheckCircle, text: 'Low' },
    }
    const config = variants[priority as keyof typeof variants] || variants.medium
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    )
  }

  const getAssignabilityBadge = (status: string) => {
    switch (status) {
      case 'assignable':
        return <Badge variant="default" className="bg-green-600">Assignable</Badge>
      case 'partially_assignable':
        return <Badge variant="secondary" className="bg-yellow-600 text-white">Partial</Badge>
      case 'not_assignable':
        return <Badge variant="destructive">Not Assignable</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const assignableLeads = filteredLeads
        .filter(l => l.assignability.status === 'assignable')
        .map(l => l.id)
      setSelectedLeads(assignableLeads)
      onBulkSelect(assignableLeads)
    } else {
      setSelectedLeads([])
      onBulkSelect([])
    }
  }

  const handleSelectLead = (leadId: string, checked: boolean) => {
    const newSelected = checked
      ? [...selectedLeads, leadId]
      : selectedLeads.filter(id => id !== leadId)
    setSelectedLeads(newSelected)
    onBulkSelect(newSelected)
  }

  const formatLoanType = (loanType: string) => {
    return loanType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatAmount = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)}Cr`
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`
    } else {
      return `₹${(amount / 1000).toFixed(0)}K`
    }
  }

  // Apply filters
  const filteredLeads = leads.filter(lead => {
    if (filterPriority !== 'all' && lead.priority !== filterPriority) return false
    if (filterAssignability !== 'all' && lead.assignability.status !== filterAssignability) return false
    return true
  })

  const assignableCount = filteredLeads.filter(l => l.assignability.status === 'assignable').length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pending Leads Queue</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredLeads.length} unassigned leads • {assignableCount} ready to assign
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterAssignability} onValueChange={setFilterAssignability}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Assignability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leads</SelectItem>
                <SelectItem value="assignable">Assignable</SelectItem>
                <SelectItem value="partially_assignable">Partial</SelectItem>
                <SelectItem value="not_assignable">Not Assignable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredLeads.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-center">
            <div className="space-y-2">
              <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
              <p className="text-lg font-medium">No pending leads</p>
              <p className="text-sm text-muted-foreground">
                All leads have been assigned
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedLeads.length === assignableCount && assignableCount > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Loan Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Suggested BDEs</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map(lead => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedLeads.includes(lead.id)}
                        onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                        disabled={lead.assignability.status !== 'assignable'}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {lead.customer_name}
                      <div className="text-xs text-muted-foreground">{lead.lead_source}</div>
                    </TableCell>
                    <TableCell>{formatLoanType(lead.loan_type)}</TableCell>
                    <TableCell>{formatAmount(lead.requested_amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{lead.pincode}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {lead.leadAge.formatted}
                      <div className="text-muted-foreground">
                        {lead.leadAge.hours}h
                      </div>
                    </TableCell>
                    <TableCell>{getPriorityBadge(lead.priority)}</TableCell>
                    <TableCell>
                      {getAssignabilityBadge(lead.assignability.status)}
                      <div className="text-xs text-muted-foreground mt-1">
                        {lead.assignability.reason}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lead.suggestedBDEs.length > 0 ? (
                        <div className="space-y-1">
                          {lead.suggestedBDEs.slice(0, 2).map(bde => (
                            <div key={bde.id} className="flex items-center gap-2 text-xs">
                              <User className="h-3 w-3" />
                              <span className="truncate max-w-24">{bde.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {bde.utilizationPercentage}%
                              </Badge>
                            </div>
                          ))}
                          {lead.suggestedBDEs.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{lead.suggestedBDEs.length - 2} more
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No matches</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onManualAssign(lead.id)}
                        disabled={lead.assignability.status === 'not_assignable'}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Assign
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {selectedLeads.length > 0 && (
          <div className="flex items-center justify-between mt-4 p-4 bg-muted rounded-lg">
            <span className="text-sm font-medium">
              {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected
            </span>
            <Button variant="default" size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Bulk Assign
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
