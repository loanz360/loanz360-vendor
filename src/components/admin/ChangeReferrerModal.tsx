/**
 * Change Referrer Modal Component
 * Allows Super Admin to change the referral ID for a lead with proper validation and audit trail
 */

'use client'

import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition, Listbox } from '@headlessui/react'
import {
  XMarkIcon,
  CheckIcon,
  ChevronUpDownIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

interface ChangeReferrerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  leadId: string
  leadLeadId: string
  currentReferralId: string
  currentReferralName: string
  currentReferralType: string
}

interface ReferralOption {
  id: string
  name: string
  type: 'BP' | 'CP' | 'EMPLOYEE' | 'CUSTOMER'
  email?: string
  phone?: string
}

const REFERRAL_TYPES = [
  { value: 'BP', label: 'Business Partner' },
  { value: 'CP', label: 'Channel Partner' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'CUSTOMER', label: 'Direct (LOANZ360)' },
]

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function ChangeReferrerModal({
  isOpen,
  onClose,
  onSuccess,
  leadId,
  leadLeadId,
  currentReferralId,
  currentReferralName,
  currentReferralType,
}: ChangeReferrerModalProps) {
  const [selectedType, setSelectedType] = useState<string>('BP')
  const [referralOptions, setReferralOptions] = useState<ReferralOption[]>([])
  const [selectedReferral, setSelectedReferral] = useState<ReferralOption | null>(null)
  const [reason, setReason] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Fetch referral options when type changes
  useEffect(() => {
    if (isOpen && selectedType) {
      fetchReferralOptions()
    }
  }, [selectedType, isOpen])

  const fetchReferralOptions = async () => {
    try {
      setLoadingOptions(true)
      setError(null)

      if (selectedType === 'CUSTOMER') {
        // Direct application - no need to fetch options
        setReferralOptions([
          {
            id: 'LOANZ360',
            name: 'LOANZ360 (Direct Application)',
            type: 'CUSTOMER',
          },
        ])
        setSelectedReferral({
          id: 'LOANZ360',
          name: 'LOANZ360 (Direct Application)',
          type: 'CUSTOMER',
        })
        return
      }

      const response = await fetch(`/api/admin/referrals/list?type=${selectedType}`)

      if (!response.ok) {
        throw new Error('Failed to fetch referral options')
      }

      const data = await response.json()
      setReferralOptions(data.referrals || [])
      setSelectedReferral(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load referral options')
    } finally {
      setLoadingOptions(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate inputs
    if (!selectedReferral) {
      setError('Please select a new referral')
      return
    }

    if (selectedReferral.id === currentReferralId) {
      setError('Please select a different referral (cannot be the same as current)')
      return
    }

    if (reason.trim().length < 20) {
      setError('Reason must be at least 20 characters long')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/admin/leads/change-referrer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lead_id: leadId,
          new_referral_id: selectedReferral.id,
          new_referral_type: selectedReferral.type,
          reason: reason.trim(),
          admin_notes: adminNotes.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to change referrer')
      }

      const result = await response.json()
      setSuccess(true)

      // Show success message briefly, then close and refresh
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change referrer')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    // Reset form
    setSelectedType('BP')
    setSelectedReferral(null)
    setReason('')
    setAdminNotes('')
    setSearchTerm('')
    setError(null)
    setSuccess(false)
    onClose()
  }

  const filteredReferrals = referralOptions.filter((referral) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      referral.name.toLowerCase().includes(searchLower) ||
      referral.id.toLowerCase().includes(searchLower) ||
      referral.email?.toLowerCase().includes(searchLower) ||
      referral.phone?.includes(searchTerm)
    )
  })

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                {/* Header */}
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                    onClick={handleClose}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                      Change Referrer
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-500">Lead ID: {leadLeadId}</p>
                  </div>
                </div>

                {success ? (
                  <div className="mt-6 rounded-md bg-green-50 p-4">
                    <div className="flex">
                      <CheckIcon className="h-5 w-5 text-green-400" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-green-800">Success!</h3>
                        <p className="mt-2 text-sm text-green-700">
                          Referrer changed successfully. Refreshing...
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                    {/* Current Referrer (Read-only) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Current Referrer
                      </label>
                      <div className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">
                        <div className="font-medium">{currentReferralName}</div>
                        <div className="text-xs text-gray-500">
                          {currentReferralId} ({currentReferralType})
                        </div>
                      </div>
                    </div>

                    {/* Referral Type Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        New Referrer Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedType}
                        onChange={(e) => {
                          setSelectedType(e.target.value)
                          setSelectedReferral(null)
                        }}
                        className="mt-2 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        {REFERRAL_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Referral Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        New Referrer <span className="text-red-500">*</span>
                      </label>

                      {loadingOptions ? (
                        <div className="mt-2 flex items-center justify-center rounded-md border border-gray-300 py-8">
                          <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent"></div>
                        </div>
                      ) : selectedType === 'CUSTOMER' ? (
                        <div className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">
                          LOANZ360 (Direct Application)
                        </div>
                      ) : (
                        <>
                          {/* Search Box */}
                          <div className="relative mt-2">
                            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search by name, ID, email, or phone..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="block w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                          </div>

                          {/* Referral List */}
                          <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-gray-300">
                            {filteredReferrals.length === 0 ? (
                              <div className="py-8 text-center text-sm text-gray-500">
                                No referrals found
                              </div>
                            ) : (
                              <ul className="divide-y divide-gray-200">
                                {filteredReferrals.map((referral) => (
                                  <li
                                    key={referral.id}
                                    className={classNames(
                                      'cursor-pointer px-4 py-3 hover:bg-gray-50',
                                      selectedReferral?.id === referral.id
                                        ? 'bg-orange-50'
                                        : ''
                                    )}
                                    onClick={() => setSelectedReferral(referral)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900">
                                          {referral.name}
                                        </p>
                                        <p className="text-xs text-gray-500">{referral.id}</p>
                                        {referral.email && (
                                          <p className="text-xs text-gray-500">{referral.email}</p>
                                        )}
                                        {referral.phone && (
                                          <p className="text-xs text-gray-500">{referral.phone}</p>
                                        )}
                                      </div>
                                      {selectedReferral?.id === referral.id && (
                                        <CheckIcon className="h-5 w-5 text-orange-600" />
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Reason for Change <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="Provide a detailed reason for changing the referrer (minimum 20 characters)"
                        className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {reason.length}/20 characters minimum
                      </p>
                    </div>

                    {/* Admin Notes (Optional) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Admin Notes (Optional)
                      </label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={2}
                        placeholder="Additional notes or context for internal records"
                        className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="rounded-md bg-red-50 p-4">
                        <div className="flex">
                          <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Error</h3>
                            <p className="mt-2 text-sm text-red-700">{error}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Warning Message */}
                    <div className="rounded-md bg-yellow-50 p-4">
                      <div className="flex">
                        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">Important</h3>
                          <p className="mt-2 text-sm text-yellow-700">
                            Changing the referrer will:
                          </p>
                          <ul className="mt-1 list-disc pl-5 text-sm text-yellow-700">
                            <li>Update the referral tracking for this lead</li>
                            <li>Create an audit trail entry with your details</li>
                            <li>Move the lead from old referral's "Active" to "Old" customers</li>
                            <li>Add the lead to new referral's "Active" customers</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse sm:gap-3">
                      <button
                        type="submit"
                        disabled={loading || !selectedReferral || reason.trim().length < 20}
                        className="inline-flex w-full justify-center rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 disabled:bg-gray-300 disabled:cursor-not-allowed sm:w-auto"
                      >
                        {loading ? (
                          <>
                            <div className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                            Changing...
                          </>
                        ) : (
                          'Change Referrer'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                        className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed sm:mt-0 sm:w-auto"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
