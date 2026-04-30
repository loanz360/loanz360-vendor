'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  Send,
  Users,
  Building2,
  Briefcase,
  UserCheck,
  FileText,
  Folder,
  Calendar,
  Bell,
  CheckSquare,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  Search,
  X,
  AlertCircle,
  Eye,
  RefreshCw,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Progress } from '@/components/ui/progress'

type DistributionScope = 'organization' | 'department' | 'role' | 'selected_users'

interface FileDistributionProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileId?: string
  folderId?: string
  fileName?: string
  onDistributed?: () => void
}

interface Department {
  id: string
  name: string
  user_count: number
}

interface Role {
  id: string
  name: string
  user_count: number
}

interface User {
  id: string
  full_name: string
  email: string
  department?: string
  role?: string
}

export function FileDistribution({
  open,
  onOpenChange,
  fileId,
  folderId,
  fileName,
  onDistributed,
}: FileDistributionProps) {
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(false)
  const [distributing, setDistributing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [scope, setScope] = useState<DistributionScope>('organization')
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [notifyUsers, setNotifyUsers] = useState(true)
  const [requireAcknowledgment, setRequireAcknowledgment] = useState(false)
  const [dueDate, setDueDate] = useState<Date | undefined>()

  // Data
  const [departments, setDepartments] = useState<Department[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [estimatedRecipients, setEstimatedRecipients] = useState(0)

  // Fetch available departments, roles, and users
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      try {
        // Fetch departments with user counts
        const { data: deptData } = await supabase
          .from('profiles')
          .select('department')
          .not('department', 'is', null)

        const deptCounts: Record<string, number> = {}
        deptData?.forEach((p: unknown) => {
          if (p.department) {
            deptCounts[p.department] = (deptCounts[p.department] || 0) + 1
          }
        })

        setDepartments(
          Object.entries(deptCounts).map(([name, count]) => ({
            id: name,
            name,
            user_count: count,
          }))
        )

        // Fetch roles with user counts
        const { data: roleData } = await supabase
          .from('profiles')
          .select('role')
          .not('role', 'is', null)

        const roleCounts: Record<string, number> = {}
        roleData?.forEach((p: unknown) => {
          if (p.role) {
            roleCounts[p.role] = (roleCounts[p.role] || 0) + 1
          }
        })

        setRoles(
          Object.entries(roleCounts).map(([name, count]) => ({
            id: name,
            name,
            user_count: count,
          }))
        )

        // Fetch all users
        const { data: usersData } = await supabase
          .from('profiles')
          .select('id, full_name, email, department, role')
          .eq('is_active', true)
          .order('full_name')

        setUsers(usersData || [])

        // Get total user count for organization scope
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)

        if (scope === 'organization') {
          setEstimatedRecipients(count || 0)
        }
      } catch (err) {
        console.error('Error fetching data:', err)
      } finally {
        setLoading(false)
      }
    }

    if (open) {
      fetchData()
    }
  }, [open, supabase])

  // Update estimated recipients when scope or selections change
  useEffect(() => {
    const calculateRecipients = async () => {
      let count = 0

      if (scope === 'organization') {
        count = users.length
      } else if (scope === 'department') {
        count = users.filter(u => u.department && selectedDepartments.includes(u.department)).length
      } else if (scope === 'role') {
        count = users.filter(u => u.role && selectedRoles.includes(u.role)).length
      } else if (scope === 'selected_users') {
        count = selectedUsers.length
      }

      setEstimatedRecipients(count)
    }

    calculateRecipients()
  }, [scope, selectedDepartments, selectedRoles, selectedUsers, users])

  const handleDistribute = async () => {
    if (!fileId && !folderId) {
      setError('No file or folder selected')
      return
    }

    if (estimatedRecipients === 0) {
      setError('No recipients selected')
      return
    }

    setDistributing(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const response = await fetch('/api/workdrive/distribution', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          folderId,
          scope,
          targetDepartments: scope === 'department' ? selectedDepartments : undefined,
          targetRoles: scope === 'role' ? selectedRoles : undefined,
          targetUsers: scope === 'selected_users' ? selectedUsers : undefined,
          message,
          notifyUsers,
          requireAcknowledgment,
          dueDate: dueDate?.toISOString(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to distribute file')
      }

      const data = await response.json()
      setSuccess(data.message)

      // Reset form
      setTimeout(() => {
        onOpenChange(false)
        onDistributed?.()
      }, 2000)
    } catch (err) {
      console.error('Distribution error:', err)
      setError(err instanceof Error ? err.message : 'Failed to distribute file')
    } finally {
      setDistributing(false)
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase())
  )

  const getScopeIcon = (s: DistributionScope) => {
    switch (s) {
      case 'organization':
        return <Building2 className="h-4 w-4" />
      case 'department':
        return <Users className="h-4 w-4" />
      case 'role':
        return <Briefcase className="h-4 w-4" />
      case 'selected_users':
        return <UserCheck className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-500" />
            Distribute File
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {fileId ? <FileText className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
            {fileName}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Scope Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Distribution Scope</Label>
              <RadioGroup
                value={scope}
                onValueChange={(v) => setScope(v as DistributionScope)}
                className="grid grid-cols-2 gap-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="organization" id="organization" />
                  <Label
                    htmlFor="organization"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Building2 className="h-4 w-4" />
                    Entire Organization
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="department" id="department" />
                  <Label
                    htmlFor="department"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Users className="h-4 w-4" />
                    By Department
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="role" id="role" />
                  <Label htmlFor="role" className="flex items-center gap-2 cursor-pointer">
                    <Briefcase className="h-4 w-4" />
                    By Role
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected_users" id="selected_users" />
                  <Label
                    htmlFor="selected_users"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <UserCheck className="h-4 w-4" />
                    Select Users
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Department Selection */}
            {scope === 'department' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Select Departments</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {departments.map((dept) => (
                    <div key={dept.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`dept-${dept.id}`}
                        checked={selectedDepartments.includes(dept.id)}
                        onCheckedChange={(checked) => {
                          setSelectedDepartments(
                            checked
                              ? [...selectedDepartments, dept.id]
                              : selectedDepartments.filter((d) => d !== dept.id)
                          )
                        }}
                      />
                      <label
                        htmlFor={`dept-${dept.id}`}
                        className="text-sm cursor-pointer flex items-center gap-2"
                      >
                        {dept.name}
                        <Badge variant="secondary" className="text-xs">
                          {dept.user_count}
                        </Badge>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Role Selection */}
            {scope === 'role' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Select Roles</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={selectedRoles.includes(role.id)}
                        onCheckedChange={(checked) => {
                          setSelectedRoles(
                            checked
                              ? [...selectedRoles, role.id]
                              : selectedRoles.filter((r) => r !== role.id)
                          )
                        }}
                      />
                      <label
                        htmlFor={`role-${role.id}`}
                        className="text-sm cursor-pointer flex items-center gap-2"
                      >
                        {role.name}
                        <Badge variant="secondary" className="text-xs">
                          {role.user_count}
                        </Badge>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User Selection */}
            {scope === 'selected_users' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Select Users</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    className="pl-10"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-48 border rounded-lg p-2">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted rounded"
                    >
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={(checked) => {
                          setSelectedUsers(
                            checked
                              ? [...selectedUsers, user.id]
                              : selectedUsers.filter((u) => u !== user.id)
                          )
                        }}
                      />
                      <label
                        htmlFor={`user-${user.id}`}
                        className="flex-1 cursor-pointer min-w-0"
                      >
                        <p className="text-sm font-medium truncate">
                          {user.full_name || user.email}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.department && `${user.department} · `}
                          {user.role}
                        </p>
                      </label>
                    </div>
                  ))}
                </ScrollArea>
                {selectedUsers.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedUsers([])}
                    >
                      Clear all
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Message */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Message (Optional)</Label>
              <Textarea
                placeholder="Add a message to include with the distribution..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>

            {/* Options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notify Recipients
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Send a notification to all recipients
                  </p>
                </div>
                <Switch checked={notifyUsers} onCheckedChange={setNotifyUsers} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Require Acknowledgment
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Recipients must acknowledge receipt of the file
                  </p>
                </div>
                <Switch
                  checked={requireAcknowledgment}
                  onCheckedChange={setRequireAcknowledgment}
                />
              </div>

              {requireAcknowledgment && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Acknowledgment Due Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        {dueDate ? dueDate.toLocaleDateString() : 'Select due date (optional)'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getScopeIcon(scope)}
                  <span className="font-medium capitalize">{scope.replace(/_/g, ' ')}</span>
                </div>
                <Badge variant="secondary" className="text-lg">
                  {estimatedRecipients} recipient{estimatedRecipients !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>

            {/* Messages */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-300 text-sm">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                {success}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDistribute}
            disabled={distributing || estimatedRecipients === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {distributing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Distributing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Distribute to {estimatedRecipients} user{estimatedRecipients !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default FileDistribution
