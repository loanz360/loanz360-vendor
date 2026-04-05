'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Search, Filter, RefreshCw } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import BDECard from './team-list/BDECard'
import BDEDetailsDialog from './team-list/BDEDetailsDialog'

interface TeamMember {
  bdeId: string
  bdeName: string
  bdeEmail: string
  loanType: string
  territory: string[]
  workload: {
    current: number
    max: number
    percentage: number
    status: string
  }
  performance: {
    conversions: number
    revenue: number
    conversionRate: number
    avgTAT: number
  }
  assignmentStatus: string
  isActive: boolean
  lastActivity: string
}

export default function TeamListTab() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([])
  const [selectedBDE, setSelectedBDE] = useState<TeamMember | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const { toast } = useToast()

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [loanTypeFilter, setLoanTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [workloadFilter, setWorkloadFilter] = useState<string>('all')

  // Fetch team data
  const fetchTeamData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const response = await fetch('/api/bdm/team-management/team-list')

      if (!response.ok) {
        throw new Error('Failed to fetch team data')
      }

      const result = await response.json()
      setTeamMembers(result.teamMembers || [])
      setFilteredMembers(result.teamMembers || [])

      if (isRefresh) {
        toast({
          title: 'Team data refreshed',
          description: 'Latest data loaded successfully',
        })
      }
    } catch (error: unknown) {
      console.error('Error fetching team data:', error)
      toast({
        title: 'Error',
        description: (error instanceof Error ? error.message : String(error)) || 'Failed to load team data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Apply filters
  useEffect(() => {
    let filtered = [...teamMembers]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        member =>
          member.bdeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          member.bdeEmail.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Loan type filter
    if (loanTypeFilter !== 'all') {
      filtered = filtered.filter(member => member.loanType === loanTypeFilter)
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        filtered = filtered.filter(member => member.isActive)
      } else {
        filtered = filtered.filter(member => !member.isActive)
      }
    }

    // Workload filter
    if (workloadFilter !== 'all') {
      filtered = filtered.filter(member => {
        const percentage = member.workload.percentage
        switch (workloadFilter) {
          case 'available':
            return percentage < 70
          case 'moderate':
            return percentage >= 70 && percentage < 90
          case 'high':
            return percentage >= 90
          default:
            return true
        }
      })
    }

    setFilteredMembers(filtered)
  }, [searchQuery, loanTypeFilter, statusFilter, workloadFilter, teamMembers])

  // Initial load
  useEffect(() => {
    fetchTeamData()
  }, [])

  const handleViewDetails = (member: TeamMember) => {
    setSelectedBDE(member)
    setDetailsOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading team data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Team</h2>
          <p className="text-sm text-muted-foreground">
            Manage your team of {teamMembers.length} BDEs
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchTeamData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Loan Type Filter */}
            <Select value={loanTypeFilter} onValueChange={setLoanTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Loan Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Loan Types</SelectItem>
                <SelectItem value="home_loan">Home Loan</SelectItem>
                <SelectItem value="personal_loan">Personal Loan</SelectItem>
                <SelectItem value="business_loan">Business Loan</SelectItem>
                <SelectItem value="car_loan">Car Loan</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {/* Workload Filter */}
            <Select value={workloadFilter} onValueChange={setWorkloadFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Workload" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workloads</SelectItem>
                <SelectItem value="available">Available (&lt;70%)</SelectItem>
                <SelectItem value="moderate">Moderate (70-90%)</SelectItem>
                <SelectItem value="high">High (&gt;90%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Showing {filteredMembers.length} of {teamMembers.length} team members
        </p>
        {(searchQuery || loanTypeFilter !== 'all' || statusFilter !== 'all' || workloadFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('')
              setLoanTypeFilter('all')
              setStatusFilter('all')
              setWorkloadFilter('all')
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Team Members Grid */}
      {filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <Filter className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No team members found</p>
              <Button variant="outline" size="sm" onClick={() => {
                setSearchQuery('')
                setLoanTypeFilter('all')
                setStatusFilter('all')
                setWorkloadFilter('all')
              }}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map(member => (
            <BDECard
              key={member.bdeId}
              member={member}
              onViewDetails={() => handleViewDetails(member)}
            />
          ))}
        </div>
      )}

      {/* Details Dialog */}
      {selectedBDE && (
        <BDEDetailsDialog
          bde={selectedBDE}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}
    </div>
  )
}
