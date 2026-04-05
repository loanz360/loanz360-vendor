'use client'

import React from 'react'
import { MapPin, Building2 } from 'lucide-react'
import { PartnershipStepProps } from '../../types/partnership'
import { INDIAN_STATES } from '../../types'

export default function AddressStep({ data, errors, onUpdate }: PartnershipStepProps) {
  // Handle same as registered checkbox
  const handleSameAsRegistered = (checked: boolean) => {
    if (checked) {
      onUpdate({
        business_same_as_registered: true,
        business_address_line1: data.registered_address_line1,
        business_address_line2: data.registered_address_line2,
        business_city: data.registered_city,
        business_state: data.registered_state,
        business_pincode: data.registered_pincode
      })
    } else {
      onUpdate({
        business_same_as_registered: false,
        business_address_line1: '',
        business_address_line2: '',
        business_city: '',
        business_state: '',
        business_pincode: ''
      })
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Address Details</h2>
        <p className="text-gray-400">Enter the registered office and business addresses</p>
      </div>

      {/* Registered Office Address */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Registered Office Address</h3>
            <p className="text-sm text-gray-500">As per partnership deed</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Address Line 1 */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Address Line 1 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={data.registered_address_line1}
              onChange={(e) => onUpdate({ registered_address_line1: e.target.value })}
              placeholder="Building/Flat No., Street Name"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                errors.registered_address_line1 ? 'border-red-500' : 'border-gray-700'
              }`}
            />
            {errors.registered_address_line1 && (
              <p className="mt-1 text-sm text-red-400">{errors.registered_address_line1}</p>
            )}
          </div>

          {/* Address Line 2 */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Address Line 2
            </label>
            <input
              type="text"
              value={data.registered_address_line2}
              onChange={(e) => onUpdate({ registered_address_line2: e.target.value })}
              placeholder="Area, Landmark"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
          </div>

          {/* Pincode */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Pincode <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={data.registered_pincode}
              onChange={(e) => onUpdate({ registered_pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              placeholder="6-digit pincode"
              maxLength={6}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                errors.registered_pincode ? 'border-red-500' : 'border-gray-700'
              }`}
            />
            {errors.registered_pincode && (
              <p className="mt-1 text-sm text-red-400">{errors.registered_pincode}</p>
            )}
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              City <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={data.registered_city}
              onChange={(e) => onUpdate({ registered_city: e.target.value })}
              placeholder="City name"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                errors.registered_city ? 'border-red-500' : 'border-gray-700'
              }`}
            />
            {errors.registered_city && (
              <p className="mt-1 text-sm text-red-400">{errors.registered_city}</p>
            )}
          </div>

          {/* State */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              State <span className="text-red-400">*</span>
            </label>
            <select
              value={data.registered_state}
              onChange={(e) => onUpdate({ registered_state: e.target.value })}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                errors.registered_state ? 'border-red-500' : 'border-gray-700'
              }`}
            >
              <option value="">Select state</option>
              {INDIAN_STATES.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            {errors.registered_state && (
              <p className="mt-1 text-sm text-red-400">{errors.registered_state}</p>
            )}
          </div>
        </div>
      </div>

      {/* Business Address */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Business Address</h3>
              <p className="text-sm text-gray-500">Primary place of business operations</p>
            </div>
          </div>
        </div>

        {/* Same as Registered Checkbox */}
        <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
          <input
            type="checkbox"
            checked={data.business_same_as_registered}
            onChange={(e) => handleSameAsRegistered(e.target.checked)}
            className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50"
          />
          <span className="text-gray-300">Same as Registered Office Address</span>
        </label>

        {!data.business_same_as_registered && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Address Line 1 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Address Line 1
              </label>
              <input
                type="text"
                value={data.business_address_line1}
                onChange={(e) => onUpdate({ business_address_line1: e.target.value })}
                placeholder="Building/Flat No., Street Name"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>

            {/* Address Line 2 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Address Line 2
              </label>
              <input
                type="text"
                value={data.business_address_line2}
                onChange={(e) => onUpdate({ business_address_line2: e.target.value })}
                placeholder="Area, Landmark"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>

            {/* Pincode */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Pincode
              </label>
              <input
                type="text"
                value={data.business_pincode}
                onChange={(e) => onUpdate({ business_pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                placeholder="6-digit pincode"
                maxLength={6}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                City
              </label>
              <input
                type="text"
                value={data.business_city}
                onChange={(e) => onUpdate({ business_city: e.target.value })}
                placeholder="City name"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>

            {/* State */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                State
              </label>
              <select
                value={data.business_state}
                onChange={(e) => onUpdate({ business_state: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              >
                <option value="">Select state</option>
                {INDIAN_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
