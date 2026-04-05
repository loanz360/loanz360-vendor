'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import {
  User,
  Calendar,
  Clock,
  Shield,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Building,
  IndianRupee,
  FileText,
  Copy,
} from 'lucide-react'
import { cn, formatCurrency} from '@/lib/utils/cn'
import {
  AccountStatus,
  OnboardingStatus as OnboardingStatusIndicator,
  ProfileCompletion,
} from '@/components/partners/shared/StatusIndicator'
import type {
  CPAccountOverview as CPAccountOverviewType,
  CPStatus,
  OnboardingStatus,
} from '@/types/cp-profile'
import {
  PARTNER_NATURE_LABELS,
  RISK_CATEGORY_LABELS,
} from '@/types/cp-profile'
import { toast } from 'sonner'

interface CPAccountOverviewProps {
  account: CPAccountOverviewType
  profileImage: string | null
  fullName: string
  email: string
  mobile: string
  onImageClick?: () => void
}

export default function CPAccountOverview({
  account,
  profileImage,
  fullName,
  email,
  mobile,
  onImageClick,
}: CPAccountOverviewProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusForIndicator = (
    status: CPStatus
  ): 'active' | 'inactive' | 'suspended' | 'terminated' | 'on_hold' | 'pending' => {
    const mapping: Record<
      CPStatus,
      'active' | 'inactive' | 'suspended' | 'terminated' | 'on_hold' | 'pending'
    > = {
      ACTIVE: 'active',
      ON_HOLD: 'on_hold',
      SUSPENDED: 'suspended',
      TERMINATED: 'terminated',
      PENDING_VERIFICATION: 'pending',
      UNDER_REVIEW: 'pending',
    }
    return mapping[status] || 'inactive'
  }

  const getOnboardingStatusForIndicator = (
    status: OnboardingStatus
  ): 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' => {
    const mapping: Record<
      OnboardingStatus,
      'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected'
    > = {
      DRAFT: 'draft',
      SUBMITTED: 'submitted',
      COMPLIANCE_REVIEW: 'under_review',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      RESUBMISSION_REQUIRED: 'rejected',
    }
    return mapping[status] || 'draft'
  }

  const getVerificationIcon = (verified: boolean) => {
    return verified ? (
      <CheckCircle2 className="w-4 h-4 text-green-400" />
    ) : (
      <XCircle className="w-4 h-4 text-red-400" />
    )
  }

  const getRiskBadgeColor = (category: string) => {
    switch (category) {
      case 'LOW':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'MEDIUM':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'HIGH':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  return (
    <Card className="border-gray-700/50 bg-gradient-to-br from-gray-900/80 to-gray-800/50 backdrop-blur-sm">
      <CardContent className="p-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Profile Picture Section */}
          <div className="flex-shrink-0">
            <div className="text-center">
              {/* Profile Image */}
              <div
                className="relative w-36 h-36 mx-auto mb-4 rounded-full overflow-hidden border-4 border-brand-primary/30 cursor-pointer hover:border-brand-primary transition-all"
                onClick={onImageClick}
              >
                {profileImage ? (
                  <Image
                    src={profileImage}
                    alt="Profile"
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-brand-primary/20 to-brand-primary/10 flex items-center justify-center">
                    <User className="w-16 h-16 text-brand-primary" />
                  </div>
                )}
              </div>

              {/* Partner ID Badge */}
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <p className="text-gray-400 text-xs mb-1">Channel Partner ID</p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-brand-primary text-xl font-bold font-mono">
                    {account.cp_id || 'Pending'}
                  </p>
                  {account.cp_id && (
                    <button
                      onClick={() => copyToClipboard(account.cp_id)}
                      className="p-1 hover:bg-gray-700 rounded transition-colors"
                      title="Copy Partner ID"
                    >
                      <Copy className="w-4 h-4 text-gray-400 hover:text-brand-primary" />
                    </button>
                  )}
                </div>

                {/* Partner Status */}
                <div className="mt-3">
                  <AccountStatus
                    status={getStatusForIndicator(account.registration_status)}
                    size="md"
                  />
                </div>

                {/* Risk Category */}
                <div className="mt-3">
                  <Badge className={cn('text-xs', getRiskBadgeColor(account.risk_category))}>
                    {RISK_CATEGORY_LABELS[account.risk_category]} Risk
                  </Badge>
                </div>
              </div>

              {/* Profile Completion */}
              <div className="mt-4 p-3 bg-gray-800/30 rounded-lg">
                <ProfileCompletion
                  percentage={account.profile_completion_percentage}
                  size="md"
                />
              </div>
            </div>
          </div>

          {/* Partner Info Section */}
          <div className="flex-1">
            {/* Name and Type */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white font-poppins mb-1">
                  {fullName || 'Channel Partner'}
                </h2>
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge className="bg-brand-primary/20 text-brand-primary border-brand-primary/30">
                    {PARTNER_NATURE_LABELS[account.partner_nature]}
                  </Badge>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    Channel Partner
                  </Badge>
                </div>
              </div>
              <OnboardingStatusIndicator
                status={getOnboardingStatusForIndicator(account.onboarding_status)}
                size="md"
              />
            </div>

            {/* Quick Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Email */}
              <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                <div className="p-2 rounded-lg bg-gray-700/50">
                  <Mail className="w-5 h-5 text-brand-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-500 text-xs">Email</p>
                  <p className="text-white text-sm truncate">{email || 'Not provided'}</p>
                </div>
                {getVerificationIcon(account.is_email_verified)}
              </div>

              {/* Mobile */}
              <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                <div className="p-2 rounded-lg bg-gray-700/50">
                  <Phone className="w-5 h-5 text-brand-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-500 text-xs">Mobile</p>
                  <p className="text-white text-sm">{mobile || 'Not provided'}</p>
                </div>
                {getVerificationIcon(account.is_mobile_verified)}
              </div>

              {/* Linked Banks */}
              <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                <div className="p-2 rounded-lg bg-gray-700/50">
                  <Building className="w-5 h-5 text-brand-primary" />
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Linked Banks/NBFCs</p>
                  <p className="text-white text-sm font-semibold">
                    {account.linked_banks_count}
                  </p>
                </div>
              </div>

              {/* Total Disbursements */}
              <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                <div className="p-2 rounded-lg bg-gray-700/50">
                  <IndianRupee className="w-5 h-5 text-brand-primary" />
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Total Disbursements</p>
                  <p className="text-white text-sm font-semibold">
                    {formatCurrency(account.total_disbursement_value)}
                  </p>
                </div>
              </div>

              {/* Disbursement Count */}
              <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                <div className="p-2 rounded-lg bg-gray-700/50">
                  <FileText className="w-5 h-5 text-brand-primary" />
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Cases Reported</p>
                  <p className="text-white text-sm font-semibold">
                    {account.total_disbursement_count.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Registration Date */}
              <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                <div className="p-2 rounded-lg bg-gray-700/50">
                  <Calendar className="w-5 h-5 text-brand-primary" />
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Registered On</p>
                  <p className="text-white text-sm">
                    {formatDate(account.date_of_registration)}
                  </p>
                </div>
              </div>
            </div>

            {/* Verification Status Row */}
            <div className="border-t border-gray-700/50 pt-4">
              <p className="text-gray-400 text-xs mb-3">Verification Status</p>
              <div className="flex flex-wrap gap-3">
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border',
                    account.is_email_verified
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  )}
                >
                  <Mail
                    className={cn(
                      'w-4 h-4',
                      account.is_email_verified ? 'text-green-400' : 'text-red-400'
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm',
                      account.is_email_verified ? 'text-green-400' : 'text-red-400'
                    )}
                  >
                    Email {account.is_email_verified ? 'Verified' : 'Not Verified'}
                  </span>
                </div>

                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border',
                    account.is_mobile_verified
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  )}
                >
                  <Phone
                    className={cn(
                      'w-4 h-4',
                      account.is_mobile_verified ? 'text-green-400' : 'text-red-400'
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm',
                      account.is_mobile_verified ? 'text-green-400' : 'text-red-400'
                    )}
                  >
                    Mobile {account.is_mobile_verified ? 'Verified' : 'Not Verified'}
                  </span>
                </div>

                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border',
                    account.is_kyc_verified
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-yellow-500/10 border-yellow-500/30'
                  )}
                >
                  <Shield
                    className={cn(
                      'w-4 h-4',
                      account.is_kyc_verified ? 'text-green-400' : 'text-yellow-400'
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm',
                      account.is_kyc_verified ? 'text-green-400' : 'text-yellow-400'
                    )}
                  >
                    KYC {account.is_kyc_verified ? 'Verified' : 'Pending'}
                  </span>
                </div>

                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border',
                    account.is_bank_verified
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-yellow-500/10 border-yellow-500/30'
                  )}
                >
                  <Building
                    className={cn(
                      'w-4 h-4',
                      account.is_bank_verified ? 'text-green-400' : 'text-yellow-400'
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm',
                      account.is_bank_verified ? 'text-green-400' : 'text-yellow-400'
                    )}
                  >
                    Bank {account.is_bank_verified ? 'Verified' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>

            {/* Last Updated */}
            <div className="mt-4 flex items-center gap-2 text-gray-500 text-xs">
              <Clock className="w-3 h-3" />
              <span>Last updated: {formatDate(account.last_profile_update)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
