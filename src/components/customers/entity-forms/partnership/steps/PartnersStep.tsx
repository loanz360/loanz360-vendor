'use client'

import React from 'react'
import { Users, Plus, Trash2, UserCheck, Percent, Phone, Mail, Calendar, User } from 'lucide-react'
import {
  PartnershipStepProps,
  PartnerData,
  PARTNER_TYPE_OPTIONS,
  createEmptyPartner
} from '../../types/partnership'
import { GENDER_OPTIONS } from '../../types'

export default function PartnersStep({ data, errors, onUpdate }: PartnershipStepProps) {
  // Defensive: ensure partners array exists
  const partners = data.partners || []

  const addPartner = () => {
    if (partners.length >= 50) {
      return // Max 50 partners for partnership
    }
    onUpdate({ partners: [...partners, createEmptyPartner()] })
  }

  const removePartner = (index: number) => {
    if (partners.length <= 2) {
      return // Min 2 partners required
    }
    const newPartners = partners.filter((_, i) => i !== index)
    onUpdate({ partners: newPartners })
  }

  const updatePartner = (index: number, updates: Partial<PartnerData>) => {
    const newPartners = [...partners]
    newPartners[index] = { ...newPartners[index], ...updates }
    onUpdate({ partners: newPartners })
  }

  // Calculate totals
  const totalCapital = partners.reduce((sum, p) => sum + (p.capital_contribution_percent || 0), 0)
  const totalProfit = partners.reduce((sum, p) => sum + (p.profit_sharing_percent || 0), 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Partners Details</h2>
          <p className="text-gray-400">Add all partners with their capital and profit sharing details</p>
        </div>
        <button
          onClick={addPartner}
          disabled={partners.length >= 50}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Partner
        </button>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-400">Total Partners</span>
          </div>
          <p className="text-2xl font-bold text-white">{partners.length}</p>
          <p className="text-xs text-gray-500">Min: 2, Max: 50</p>
        </div>
        <div className={`border rounded-lg p-4 ${
          totalCapital === 100 ? 'bg-orange-500/10 border-orange-500/30' :
          totalCapital > 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-gray-800 border-gray-700'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Percent className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-gray-400">Capital Contribution</span>
          </div>
          <p className={`text-2xl font-bold ${totalCapital === 100 ? 'text-orange-400' : 'text-white'}`}>
            {totalCapital}%
          </p>
          <p className="text-xs text-gray-500">Must equal 100%</p>
        </div>
        <div className={`border rounded-lg p-4 ${
          totalProfit === 100 ? 'bg-orange-500/10 border-orange-500/30' :
          totalProfit > 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-gray-800 border-gray-700'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Percent className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-gray-400">Profit Sharing</span>
          </div>
          <p className={`text-2xl font-bold ${totalProfit === 100 ? 'text-orange-400' : 'text-white'}`}>
            {totalProfit}%
          </p>
          <p className="text-xs text-gray-500">Must equal 100%</p>
        </div>
      </div>

      {/* Error Messages */}
      {(errors.partners || errors.managing_partner || errors.capital_total || errors.profit_total) && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <ul className="text-sm text-red-400 space-y-1">
            {errors.partners && <li>{errors.partners}</li>}
            {errors.managing_partner && <li>{errors.managing_partner}</li>}
            {errors.capital_total && <li>{errors.capital_total}</li>}
            {errors.profit_total && <li>{errors.profit_total}</li>}
          </ul>
        </div>
      )}

      {/* Partners List */}
      <div className="space-y-6">
        {partners.map((partner, index) => (
          <div
            key={partner.id}
            className="bg-gray-800/50 rounded-xl border border-gray-700 p-6"
          >
            {/* Partner Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  partner.partner_type === 'MANAGING_PARTNER'
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {partner.partner_type === 'MANAGING_PARTNER' ? (
                    <UserCheck className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-white">
                    Partner {index + 1}
                    {partner.partner_type === 'MANAGING_PARTNER' && (
                      <span className="ml-2 text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                        Managing
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {partner.full_name || 'Enter partner details below'}
                  </p>
                </div>
              </div>
              {partners.length > 2 && (
                <button
                  onClick={() => removePartner(index)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Partner Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Partner Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Partner Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={partner.partner_type}
                  onChange={(e) => updatePartner(index, { partner_type: e.target.value as PartnerData['partner_type'] })}
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                    errors[`partner_${index}_type`] ? 'border-red-500' : 'border-gray-700'
                  }`}
                >
                  <option value="">Select type</option>
                  {PARTNER_TYPE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={partner.full_name}
                  onChange={(e) => updatePartner(index, { full_name: e.target.value })}
                  placeholder="As per PAN card"
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                    errors[`partner_${index}_name`] ? 'border-red-500' : 'border-gray-700'
                  }`}
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={partner.date_of_birth}
                  onChange={(e) => updatePartner(index, { date_of_birth: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Gender
                </label>
                <select
                  value={partner.gender}
                  onChange={(e) => updatePartner(index, { gender: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                >
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {/* PAN Number */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  PAN Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={partner.pan_number}
                  onChange={(e) => updatePartner(index, { pan_number: e.target.value.toUpperCase() })}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 uppercase ${
                    errors[`partner_${index}_pan`] ? 'border-red-500' : 'border-gray-700'
                  }`}
                />
              </div>

              {/* Aadhaar Number */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Aadhaar Number
                </label>
                <input
                  type="text"
                  value={partner.aadhaar_number}
                  onChange={(e) => updatePartner(index, { aadhaar_number: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                  placeholder="XXXX XXXX XXXX"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Mobile */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="tel"
                    value={partner.mobile}
                    onChange={(e) => updatePartner(index, { mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="10-digit mobile"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    value={partner.email}
                    onChange={(e) => updatePartner(index, { email: e.target.value })}
                    placeholder="partner@email.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>

              {/* Capital Contribution */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Capital Contribution (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={partner.capital_contribution_percent || ''}
                  onChange={(e) => updatePartner(index, { capital_contribution_percent: parseFloat(e.target.value) || null })}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Profit Sharing */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Profit Sharing (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={partner.profit_sharing_percent || ''}
                  onChange={(e) => updatePartner(index, { profit_sharing_percent: parseFloat(e.target.value) || null })}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Authorized Signatory */}
              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={partner.is_authorized_signatory}
                    onChange={(e) => updatePartner(index, { is_authorized_signatory: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50"
                  />
                  <span className="text-sm text-gray-300">Authorized Signatory</span>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Partner Button (bottom) */}
      {partners.length < 50 && (
        <button
          onClick={addPartner}
          className="w-full py-4 border-2 border-dashed border-gray-700 hover:border-orange-500 rounded-xl text-gray-400 hover:text-orange-400 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Another Partner
        </button>
      )}
    </div>
  )
}
