'use client'

import React from 'react'
import { Building2 } from 'lucide-react'
import {
  CooperativeStepProps,
  COOPERATIVE_TYPE_OPTIONS,
  REGISTRATION_TYPE_OPTIONS,
  AREA_OF_OPERATION_OPTIONS
} from '../../types/cooperative'
import { GST_STATUS_OPTIONS } from '../../types'

export default function SocietyDetailsStep({ data, errors, onUpdate }: CooperativeStepProps) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-orange-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Society Details</h2>
          <p className="text-gray-400 text-sm">Basic information about your Cooperative Society</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Society Name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Society Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={data.society_name}
            onChange={(e) => onUpdate({ society_name: e.target.value })}
            placeholder="Enter registered society name"
            className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
              errors.society_name ? 'border-red-500' : 'border-gray-700'
            }`}
          />
          {errors.society_name && <p className="text-red-400 text-sm mt-1">{errors.society_name}</p>}
        </div>

        {/* Registration Number */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Registration Number <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={data.registration_number}
            onChange={(e) => onUpdate({ registration_number: e.target.value.toUpperCase() })}
            placeholder="Society registration number"
            className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
              errors.registration_number ? 'border-red-500' : 'border-gray-700'
            }`}
          />
          {errors.registration_number && <p className="text-red-400 text-sm mt-1">{errors.registration_number}</p>}
        </div>

        {/* Date of Registration */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Date of Registration
          </label>
          <input
            type="date"
            value={data.date_of_registration}
            onChange={(e) => onUpdate({ date_of_registration: e.target.value })}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
        </div>

        {/* Registrar of Cooperatives */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Registrar of Cooperatives
          </label>
          <input
            type="text"
            value={data.registrar_of_cooperatives}
            onChange={(e) => onUpdate({ registrar_of_cooperatives: e.target.value })}
            placeholder="Name of registrar authority"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
        </div>

        {/* Registration Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Registration Type
          </label>
          <select
            value={data.registration_type}
            onChange={(e) => onUpdate({ registration_type: e.target.value as unknown })}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          >
            <option value="">Select registration type</option>
            {REGISTRATION_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Cooperative Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Cooperative Type <span className="text-red-400">*</span>
          </label>
          <select
            value={data.cooperative_type}
            onChange={(e) => onUpdate({ cooperative_type: e.target.value as unknown })}
            className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
              errors.cooperative_type ? 'border-red-500' : 'border-gray-700'
            }`}
          >
            <option value="">Select cooperative type</option>
            {COOPERATIVE_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errors.cooperative_type && <p className="text-red-400 text-sm mt-1">{errors.cooperative_type}</p>}
        </div>

        {/* Area of Operation */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Area of Operation
          </label>
          <select
            value={data.area_of_operation}
            onChange={(e) => onUpdate({ area_of_operation: e.target.value as unknown })}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          >
            <option value="">Select area of operation</option>
            {AREA_OF_OPERATION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Society PAN */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Society PAN <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={data.society_pan}
            onChange={(e) => onUpdate({ society_pan: e.target.value.toUpperCase() })}
            maxLength={10}
            placeholder="ABCDE1234F"
            className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
              errors.society_pan ? 'border-red-500' : 'border-gray-700'
            }`}
          />
          {errors.society_pan && <p className="text-red-400 text-sm mt-1">{errors.society_pan}</p>}
        </div>

        {/* Number of Members */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Number of Members
          </label>
          <input
            type="number"
            value={data.number_of_members || ''}
            onChange={(e) => onUpdate({ number_of_members: e.target.value ? parseInt(e.target.value) : null })}
            placeholder="Total members"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
        </div>

        {/* Authorized Share Capital */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Authorized Share Capital
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
            <input
              type="number"
              value={data.authorized_share_capital || ''}
              onChange={(e) => onUpdate({ authorized_share_capital: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="0"
              className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
          </div>
        </div>

        {/* Paid-up Share Capital */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Paid-up Share Capital
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
            <input
              type="number"
              value={data.paid_up_share_capital || ''}
              onChange={(e) => onUpdate({ paid_up_share_capital: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="0"
              className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
          </div>
        </div>

        {/* GST Registration Status */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            GST Registration Status
          </label>
          <select
            value={data.gst_registration_status}
            onChange={(e) => onUpdate({ gst_registration_status: e.target.value as unknown })}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          >
            <option value="">Select GST status</option>
            {GST_STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* GSTIN */}
        {data.gst_registration_status === 'REGISTERED' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              GSTIN <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={data.gstin}
              onChange={(e) => onUpdate({ gstin: e.target.value.toUpperCase() })}
              maxLength={15}
              placeholder="22AAAAA0000A1Z5"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                errors.gstin ? 'border-red-500' : 'border-gray-700'
              }`}
            />
            {errors.gstin && <p className="text-red-400 text-sm mt-1">{errors.gstin}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
