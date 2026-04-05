'use client'

import React from 'react'
import { UserPlus, Edit2, Trash2, Mail, Phone, CreditCard, CheckCircle, User } from 'lucide-react'

export interface MemberData {
  id: string
  full_name: string
  mobile: string
  email: string
  pan_number: string
  aadhaar_number?: string
  role: string
  designation?: string
  capital_contribution_percent?: number
  profit_sharing_percent?: number
  photo_url?: string
  is_signatory?: boolean
  can_apply_loan?: boolean
  can_edit_profile?: boolean
  can_view_financials?: boolean
  can_add_members?: boolean
  is_admin?: boolean
  is_filled: boolean
}

interface MemberCardProps {
  member: MemberData | null
  index: number
  viewMode: 'grid' | 'list'
  onAdd: () => void
  onEdit: () => void
  onDelete?: () => void
  entityType: 'PARTNERSHIP' | 'LLP' | 'PRIVATE_LIMITED' | 'PUBLIC_LIMITED' | 'OPC' | 'TRUST' | 'SOCIETY' | 'HUF'
}

export default function MemberCard({
  member,
  index,
  viewMode,
  onAdd,
  onEdit,
  onDelete,
  entityType
}: MemberCardProps) {
  // Get member type label based on entity
  const getMemberTypeLabel = () => {
    switch (entityType) {
      case 'PARTNERSHIP':
        return 'Partner'
      case 'LLP':
        return 'Partner'
      case 'PRIVATE_LIMITED':
      case 'PUBLIC_LIMITED':
        return 'Director'
      case 'OPC':
        return 'Director'
      case 'TRUST':
        return 'Trustee'
      case 'SOCIETY':
        return 'Member'
      case 'HUF':
        return 'Coparcener'
      default:
        return 'Member'
    }
  }

  // Empty/Placeholder Card
  if (!member || !member.is_filled) {
    if (viewMode === 'grid') {
      return (
        <button
          onClick={onAdd}
          className="group relative h-48 p-6 bg-gray-800/50 border-2 border-dashed border-gray-700 rounded-xl hover:border-orange-500 hover:bg-gray-800 transition-all flex flex-col items-center justify-center gap-3"
        >
          <div className="w-16 h-16 rounded-full bg-gray-700/50 group-hover:bg-orange-500/20 flex items-center justify-center transition-colors">
            <UserPlus className="w-8 h-8 text-gray-500 group-hover:text-orange-400 transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-gray-400 group-hover:text-orange-400 font-medium transition-colors">
              Add {getMemberTypeLabel()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {getMemberTypeLabel()} #{index + 1}
            </p>
          </div>
        </button>
      )
    } else {
      return (
        <button
          onClick={onAdd}
          className="group relative p-4 bg-gray-800/50 border-2 border-dashed border-gray-700 rounded-xl hover:border-orange-500 hover:bg-gray-800 transition-all flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-full bg-gray-700/50 group-hover:bg-orange-500/20 flex items-center justify-center transition-colors flex-shrink-0">
            <UserPlus className="w-6 h-6 text-gray-500 group-hover:text-orange-400 transition-colors" />
          </div>
          <div className="text-left flex-1">
            <p className="text-gray-400 group-hover:text-orange-400 font-medium transition-colors">
              Add {getMemberTypeLabel()} #{index + 1}
            </p>
            <p className="text-xs text-gray-500">Click to add details</p>
          </div>
        </button>
      )
    }
  }

  // Filled Card - Grid View
  if (viewMode === 'grid') {
    return (
      <div className="group relative h-48 p-5 bg-gradient-to-br from-gray-800 to-gray-800/50 border border-gray-700 rounded-xl hover:border-orange-500/50 transition-all">
        {/* Status Badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/30 rounded-full">
          <CheckCircle className="w-3 h-3 text-green-400" />
          <span className="text-xs text-green-400 font-medium">Complete</span>
        </div>

        <div className="flex flex-col items-center text-center h-full">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-3 relative overflow-hidden">
            {member.photo_url ? (
              <img
                src={member.photo_url}
                alt={member.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-white" />
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-h-0">
            <h4 className="text-white font-semibold text-sm mb-1 truncate w-full">
              {member.full_name}
            </h4>
            <p className="text-orange-400 text-xs font-medium mb-2">
              {member.role}
            </p>

            <div className="space-y-1 text-xs text-gray-400">
              <div className="flex items-center justify-center gap-1">
                <Phone className="w-3 h-3" />
                <span className="truncate">{member.mobile}</span>
              </div>
              {member.capital_contribution_percent && (
                <div className="text-orange-400">
                  {member.capital_contribution_percent}% stake
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-700 w-full">
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors text-xs"
            >
              <Edit2 className="w-3 h-3" />
              Edit
            </button>
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Filled Card - List View
  return (
    <div className="group relative p-4 bg-gradient-to-r from-gray-800 to-gray-800/50 border border-gray-700 rounded-xl hover:border-orange-500/50 transition-all">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center relative overflow-hidden flex-shrink-0">
          {member.photo_url ? (
            <img
              src={member.photo_url}
              alt={member.full_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-7 h-7 text-white" />
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-white font-semibold truncate">
              {member.full_name}
            </h4>
            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full font-medium flex-shrink-0">
              {member.role}
            </span>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/30 rounded-full flex-shrink-0">
              <CheckCircle className="w-3 h-3 text-green-400" />
              <span className="text-xs text-green-400 font-medium">Complete</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              <span>{member.mobile}</span>
            </div>
            <div className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              <span className="truncate">{member.email}</span>
            </div>
            <div className="flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              <span>{member.pan_number}</span>
            </div>
            {member.capital_contribution_percent && (
              <div className="text-orange-400 font-medium">
                {member.capital_contribution_percent}% stake
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors text-sm"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
