'use client'

import React from 'react'
import { MapPin } from 'lucide-react'
import { CooperativeStepProps } from '../../types/cooperative'
import { INDIAN_STATES } from '../../types'

export default function AddressStep({ data, errors, onUpdate }: CooperativeStepProps) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <MapPin className="w-6 h-6 text-orange-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Registered Office Address</h2>
          <p className="text-gray-400 text-sm">Address of the Cooperative Society's registered office</p>
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
            placeholder="Building name, Street address"
            className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
              errors.registered_address_line1 ? 'border-red-500' : 'border-gray-700'
            }`}
          />
          {errors.registered_address_line1 && (
            <p className="text-red-400 text-sm mt-1">{errors.registered_address_line1}</p>
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
            placeholder="Area, Landmark (optional)"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
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
            placeholder="Enter city"
            className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
              errors.registered_city ? 'border-red-500' : 'border-gray-700'
            }`}
          />
          {errors.registered_city && (
            <p className="text-red-400 text-sm mt-1">{errors.registered_city}</p>
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
            className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
              errors.registered_state ? 'border-red-500' : 'border-gray-700'
            }`}
          >
            <option value="">Select state</option>
            {INDIAN_STATES.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          {errors.registered_state && (
            <p className="text-red-400 text-sm mt-1">{errors.registered_state}</p>
          )}
        </div>

        {/* Pincode */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Pincode <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={data.registered_pincode}
            onChange={(e) => onUpdate({ registered_pincode: e.target.value.replace(/\D/g, '') })}
            maxLength={6}
            placeholder="Enter 6-digit pincode"
            className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
              errors.registered_pincode ? 'border-red-500' : 'border-gray-700'
            }`}
          />
          {errors.registered_pincode && (
            <p className="text-red-400 text-sm mt-1">{errors.registered_pincode}</p>
          )}
        </div>
      </div>
    </div>
  )
}
