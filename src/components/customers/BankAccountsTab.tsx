'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Building2,
  Plus,
  Trash2,
  Star,
  Loader2,
  CreditCard,
  X,
  Shield
} from 'lucide-react'
import { InlineLoading } from '@/components/ui/loading-spinner'
import { clientLogger } from '@/lib/utils/client-logger'
import { toast } from 'sonner'

interface BankAccount {
  id: string
  owner_type: string
  owner_id: string
  account_holder_name: string
  account_number: string
  bank_name: string
  branch_name: string | null
  ifsc_code: string
  account_type: string
  is_primary: boolean
  verification_status: string
  created_at: string
}

interface EntityMembership {
  id: string
  is_admin: boolean
  entity: {
    id: string
    unique_id: string
    entity_name: string
  }
}

const ACCOUNT_TYPES = [
  { value: 'SAVINGS', label: 'Savings Account' },
  { value: 'CURRENT', label: 'Current Account' },
  { value: 'OD', label: 'Overdraft Account' },
  { value: 'CC', label: 'Cash Credit Account' }
]

export default function BankAccountsTab() {
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [entities, setEntities] = useState<EntityMembership[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedOwner, setSelectedOwner] = useState<{ type: 'INDIVIDUAL' | 'ENTITY'; id: string } | null>(null)

  const [formData, setFormData] = useState({
    accountHolderName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    bankName: '',
    branchName: '',
    ifscCode: '',
    accountType: 'SAVINGS',
    isPrimary: false
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load profile to get entities
      const profileRes = await fetch('/api/customers/profile')
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        if (profileData.success && profileData.entities) {
          setEntities(profileData.entities)
        }
      }

      // Load bank accounts
      await loadAccounts()
    } catch (error) {
      clientLogger.error('Error loading data', { error })
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async (ownerType?: string, ownerId?: string) => {
    try {
      let url = '/api/customers/bank-accounts'
      if (ownerType && ownerId) {
        url += `?ownerType=${ownerType}&ownerId=${ownerId}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAccounts(data.accounts || [])
        }
      }
    } catch (error) {
      clientLogger.error('Error loading bank accounts', { error })
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData({
      accountHolderName: '',
      accountNumber: '',
      confirmAccountNumber: '',
      bankName: '',
      branchName: '',
      ifscCode: '',
      accountType: 'SAVINGS',
      isPrimary: false
    })
    setSelectedOwner(null)
  }

  const handleSubmit = async () => {
    // Validation
    if (!formData.accountHolderName.trim()) {
      toast.error('Account holder name is required')
      return
    }
    if (!formData.accountNumber.trim()) {
      toast.error('Account number is required')
      return
    }
    if (formData.accountNumber !== formData.confirmAccountNumber) {
      toast.error('Account numbers do not match')
      return
    }
    if (!formData.bankName.trim()) {
      toast.error('Bank name is required')
      return
    }
    if (!formData.ifscCode.trim() || formData.ifscCode.length !== 11) {
      toast.error('Valid IFSC code (11 characters) is required')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/customers/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerType: selectedOwner?.type || 'INDIVIDUAL',
          ownerId: selectedOwner?.id,
          accountHolderName: formData.accountHolderName,
          accountNumber: formData.accountNumber,
          bankName: formData.bankName,
          branchName: formData.branchName || null,
          ifscCode: formData.ifscCode,
          accountType: formData.accountType,
          isPrimary: formData.isPrimary
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Bank account added successfully')
        resetForm()
        setShowAddForm(false)
        loadAccounts()
      } else {
        toast.error(result.error || 'Failed to add bank account')
      }
    } catch (error) {
      clientLogger.error('Error adding bank account', error)
      toast.error('Failed to add bank account')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this bank account?')) {
      return
    }

    setDeletingId(accountId)

    try {
      const response = await fetch(`/api/customers/bank-accounts?accountId=${accountId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Bank account deleted successfully')
        loadAccounts()
      } else {
        toast.error(result.error || 'Failed to delete bank account')
      }
    } catch (error) {
      clientLogger.error('Error deleting bank account', error)
      toast.error('Failed to delete bank account')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSetPrimary = async (accountId: string) => {
    try {
      const response = await fetch('/api/customers/bank-accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          isPrimary: true
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Primary account updated')
        loadAccounts()
      } else {
        toast.error(result.error || 'Failed to update primary account')
      }
    } catch (error) {
      clientLogger.error('Error setting primary account', error)
      toast.error('Failed to update primary account')
    }
  }

  const getVerificationBadge = (status: string) => {
    const config: Record<string, { color: string; bgColor: string; label: string }> = {
      'PENDING': { color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', label: 'Pending' },
      'VERIFIED': { color: 'text-green-400', bgColor: 'bg-green-500/10', label: 'Verified' },
      'FAILED': { color: 'text-red-400', bgColor: 'bg-red-500/10', label: 'Failed' }
    }
    const cfg = config[status] || config['PENDING']
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.bgColor} ${cfg.color}`}>
        {cfg.label}
      </span>
    )
  }

  const maskAccountNumber = (accNum: string) => {
    if (accNum.length <= 4) return accNum
    return 'XXXX' + accNum.slice(-4)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <InlineLoading size="md" />
        <span className="ml-3 text-gray-400">Loading bank accounts...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">Manage your bank accounts for loan documentation</p>
        </div>
        {!showAddForm && (
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Account
          </Button>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-400 font-medium text-sm">Bank Account Security</p>
          <p className="text-blue-400/70 text-xs mt-1">
            Your bank account details are encrypted and securely stored. These details are used for loan documentation purposes.
          </p>
        </div>
      </div>

      {/* Add Account Form */}
      {showAddForm && (
        <Card className="content-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange-500" />
                Add New Bank Account
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false)
                  resetForm()
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Owner Selection (if user has entity memberships) */}
            {entities.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account For
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOwner(null)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                      !selectedOwner
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    Personal Account
                  </button>
                  {entities.filter(e => e.is_admin).map(entity => (
                    <button
                      key={entity.entity.id}
                      type="button"
                      onClick={() => setSelectedOwner({ type: 'ENTITY', id: entity.entity.id })}
                      className={`px-4 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${
                        selectedOwner?.id === entity.entity.id
                          ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      {entity.entity.entity_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account Holder Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.accountHolderName}
                  onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                  placeholder="As per bank records"
                  className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => handleInputChange('accountNumber', e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter account number"
                  className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm Account Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.confirmAccountNumber}
                  onChange={(e) => handleInputChange('confirmAccountNumber', e.target.value.replace(/\D/g, ''))}
                  placeholder="Re-enter account number"
                  className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bank Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => handleInputChange('bankName', e.target.value)}
                  placeholder="e.g., State Bank of India"
                  className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={formData.branchName}
                  onChange={(e) => handleInputChange('branchName', e.target.value)}
                  placeholder="e.g., Main Branch"
                  className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  IFSC Code <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.ifscCode}
                  onChange={(e) => handleInputChange('ifscCode', e.target.value.toUpperCase())}
                  placeholder="e.g., SBIN0001234"
                  maxLength={11}
                  className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account Type
                </label>
                <select
                  value={formData.accountType}
                  onChange={(e) => handleInputChange('accountType', e.target.value)}
                  className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {ACCOUNT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPrimary"
                checked={formData.isPrimary}
                onChange={(e) => handleInputChange('isPrimary', e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
              />
              <label htmlFor="isPrimary" className="text-sm text-gray-300">
                Set as primary account
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false)
                  resetForm()
                }}
                className="border-gray-700 text-gray-400"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Account'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accounts List */}
      {accounts.length === 0 && !showAddForm ? (
        <Card className="content-card">
          <CardContent className="py-12 text-center">
            <CreditCard className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-white font-medium text-lg mb-2">No Bank Accounts Added</h3>
            <p className="text-gray-400 text-sm mb-4">
              Add your bank account details for loan documentation
            </p>
            <Button
              onClick={() => setShowAddForm(true)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className={`content-card ${
                account.is_primary ? 'ring-2 ring-orange-500/30' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-medium">{account.bank_name}</h3>
                        {account.is_primary && (
                          <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            Primary
                          </span>
                        )}
                        {getVerificationBadge(account.verification_status)}
                      </div>
                      <p className="text-gray-400 text-sm mt-1">
                        {account.account_holder_name}
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        A/C: {maskAccountNumber(account.account_number)} | {account.ifsc_code}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {ACCOUNT_TYPES.find(t => t.value === account.account_type)?.label || account.account_type}
                        {account.branch_name && ` | ${account.branch_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!account.is_primary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPrimary(account.id)}
                        className="border-gray-700 text-gray-400 hover:text-white"
                      >
                        <Star className="w-4 h-4 mr-1" />
                        Set Primary
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(account.id)}
                      disabled={deletingId === account.id}
                      className="border-red-800 text-red-400 hover:bg-red-500/10"
                    >
                      {deletingId === account.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
