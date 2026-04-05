'use client'

import React, { useState, useEffect } from 'react'
import { Clock, User, Calendar, Filter, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clientLogger } from '@/lib/utils/client-logger'

interface AuditLog {
  id: string
  fieldName: string
  oldValue: string | null
  newValue: string | null
  timestamp: string
  changedBy: string
}

interface AuditTrailTimelineProps {
  limit?: number
}

export default function AuditTrailTimeline({ limit = 20 }: AuditTrailTimelineProps) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalLogs, setTotalLogs] = useState(0)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    loadAuditLogs(0)
  }, [])

  const loadAuditLogs = async (currentOffset: number) => {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/employees/profile/audit-log?limit=${limit}&offset=${currentOffset}`)
      const result = await response.json()

      if (result.success && result.data) {
        if (currentOffset === 0) {
          setLogs(result.data.logs)
        } else {
          setLogs(prev => [...prev, ...result.data.logs])
        }

        setTotalLogs(result.data.pagination.total)
        setHasMore(result.data.pagination.hasMore)
        setOffset(currentOffset)
      }
    } catch (error) {
      clientLogger.error('Failed to load audit logs', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMore = () => {
    loadAuditLogs(offset + limit)
  }

  const formatFieldName = (fieldName: string): string => {
    const fieldMap: Record<string, string> = {
      'department': 'Department',
      'professional_mail': 'Professional Email',
      'location': 'Location',
      'languages_known': 'Languages Known',
      'reporting_manager': 'Reporting Manager',
      'reporting_manager_id': 'Reporting Manager',
      'reporting_manager_name': 'Reporting Manager Name',
      'avatar': 'Profile Photo',
      'avatar_url': 'Profile Photo',
      'mobile': 'Personal Mobile',
      'professional_mobile': 'Professional Mobile',
      'date_of_birth': 'Date of Birth',
      'gender': 'Gender',
      'blood_group': 'Blood Group',
      'pan_number': 'PAN Number',
      'aadhaar_number': 'Aadhaar Number',
      'emergency_contact_name': 'Emergency Contact Name',
      'emergency_contact_phone': 'Emergency Contact Phone',
      'emergency_contact_relationship': 'Emergency Contact Relationship',
      'reference1_name': 'Reference 1 Name',
      'reference1_contact': 'Reference 1 Contact',
      'reference1_relationship': 'Reference 1 Relationship',
      'reference2_name': 'Reference 2 Name',
      'reference2_contact': 'Reference 2 Contact',
      'reference2_relationship': 'Reference 2 Relationship',
      'bank_account_number': 'Bank Account Number',
      'bank_name': 'Bank Name',
      'bank_branch': 'Bank Branch',
      'bank_ifsc_code': 'IFSC Code',
      'bank_micr_code': 'MICR Code',
      'address_current': 'Current Address',
      'address_permanent': 'Permanent Address',
      'present_address_proof_url': 'Present Address Proof',
      'permanent_address_proof_url': 'Permanent Address Proof',
      'pan_card_copy_url': 'PAN Card Copy',
      'aadhaar_card_copy_url': 'Aadhaar Card Copy',
      'cancelled_cheque_url': 'Cancelled Cheque',
      'designation': 'Designation',
      'department_join_date': 'Department Join Date',
      'password_changed_at': 'Password Changed',
    }
    // Fallback: convert snake_case to Title Case
    return fieldMap[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 text-lg mb-2">No change history yet</p>
        <p className="text-gray-500 text-sm">
          Changes to your professional details will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2 font-poppins">
            <Clock className="w-5 h-5 text-orange-500" />
            Change History
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            {totalLogs} change{totalLogs !== 1 ? 's' : ''} recorded
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-800"></div>

        {/* Timeline Items */}
        <div className="space-y-6">
          {logs.map((log, index) => (
            <div key={log.id} className="relative pl-16">
              {/* Timeline Dot */}
              <div className="absolute left-4 top-1 w-4 h-4 rounded-full bg-orange-500 border-4 border-black"></div>

              {/* Content Card */}
              <div className="frosted-card p-4 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-sm font-poppins">
                      {formatFieldName(log.fieldName)}
                    </h4>
                    <p className="text-gray-400 text-xs flex items-center gap-1 mt-1">
                      <User className="w-3 h-3" />
                      Changed by {log.changedBy}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>

                {/* Value Changes */}
                <div className="mt-3 space-y-2">
                  {log.oldValue && (
                    <div className="text-xs">
                      <span className="text-gray-500">Previous: </span>
                      <span className="text-red-400 line-through">{log.oldValue}</span>
                    </div>
                  )}
                  <div className="text-xs">
                    <span className="text-gray-500">Updated to: </span>
                    <span className="text-green-400 font-medium">{log.newValue || 'Removed'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="text-center pt-4">
          <Button
            onClick={loadMore}
            disabled={isLoading}
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>Load More</>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
