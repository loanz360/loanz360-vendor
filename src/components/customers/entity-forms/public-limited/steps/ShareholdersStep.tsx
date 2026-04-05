'use client'

import React from 'react'
import { PieChart, Plus, Trash2, Building2, User } from 'lucide-react'
import { PublicLimitedStepProps, PublicShareholderData, createEmptyPublicShareholder } from '../../types/public-limited'

const SHAREHOLDER_TYPE_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'BODY_CORPORATE', label: 'Body Corporate' },
  { value: 'FII', label: 'Foreign Institutional Investor' },
  { value: 'MUTUAL_FUND', label: 'Mutual Fund' }
]

export default function ShareholdersStep({ data, errors, onUpdate }: PublicLimitedStepProps) {
  const shareholders = data.shareholders || []

  const addShareholder = () => {
    if (shareholders.length >= 20) return
    onUpdate({ shareholders: [...shareholders, createEmptyPublicShareholder()] })
  }

  const removeShareholder = (index: number) => {
    onUpdate({ shareholders: shareholders.filter((_, i) => i !== index) })
  }

  const updateShareholder = (index: number, updates: Partial<PublicShareholderData>) => {
    const newShareholders = [...shareholders]
    newShareholders[index] = { ...newShareholders[index], ...updates }
    onUpdate({ shareholders: newShareholders })
  }

  const totalShares = shareholders.reduce((sum, s) => sum + (s.shareholding_percent || 0), 0)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Major Shareholders</h2>
          <p className="text-gray-400">Add top 10-20 shareholders with significant holdings</p>
        </div>
        <button onClick={addShareholder} disabled={shareholders.length >= 20}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 text-white rounded-lg">
          <Plus className="w-4 h-4" /> Add Shareholder
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1"><PieChart className="w-4 h-4 text-orange-400" /><span className="text-sm text-gray-400">Total Shareholders</span></div>
          <p className="text-2xl font-bold text-white">{shareholders.length}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1"><User className="w-4 h-4 text-orange-400" /><span className="text-sm text-gray-400">Individuals</span></div>
          <p className="text-2xl font-bold text-white">{shareholders.filter(s => s.shareholder_type === 'INDIVIDUAL').length}</p>
        </div>
        <div className={`border rounded-lg p-4 ${totalShares > 100 ? 'bg-red-500/10 border-red-500/30' : 'bg-gray-800 border-gray-700'}`}>
          <div className="flex items-center gap-2 mb-1"><span className="text-sm text-gray-400">Total %</span></div>
          <p className={`text-2xl font-bold ${totalShares > 100 ? 'text-red-400' : 'text-white'}`}>{totalShares.toFixed(2)}%</p>
        </div>
      </div>

      {errors.shareholders && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg"><p className="text-sm text-red-400">{errors.shareholders}</p></div>}

      <div className="space-y-4">
        {shareholders.map((shareholder, index) => (
          <div key={shareholder.id} className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${shareholder.shareholder_type === 'INDIVIDUAL' ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-500/20 text-orange-400'}`}>
                  {shareholder.shareholder_type === 'INDIVIDUAL' ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-semibold text-white">Shareholder {index + 1}</h4>
                  <p className="text-sm text-gray-500">{shareholder.name || 'Enter details'}</p>
                </div>
              </div>
              <button onClick={() => removeShareholder(index)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Shareholder Type</label>
                <select value={shareholder.shareholder_type} onChange={(e) => updateShareholder(index, { shareholder_type: e.target.value as PublicShareholderData['shareholder_type'] })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                  <option value="">Select type</option>
                  {SHAREHOLDER_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">Name <span className="text-red-400">*</span></label>
                <input type="text" value={shareholder.name} onChange={(e) => updateShareholder(index, { name: e.target.value })} placeholder="Shareholder name"
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors[`shareholder_${index}_name`] ? 'border-red-500' : 'border-gray-700'}`} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">PAN Number</label>
                <input type="text" value={shareholder.pan_number} onChange={(e) => updateShareholder(index, { pan_number: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Number of Shares</label>
                <input type="number" value={shareholder.number_of_shares || ''} onChange={(e) => updateShareholder(index, { number_of_shares: parseInt(e.target.value) || null })} placeholder="Enter shares"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Shareholding %</label>
                <input type="number" step="0.01" value={shareholder.shareholding_percent || ''} onChange={(e) => updateShareholder(index, { shareholding_percent: parseFloat(e.target.value) || null })} placeholder="e.g., 5.25"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {shareholders.length === 0 && (
        <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
          <PieChart className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No Shareholders Added</h3>
          <p className="text-gray-500 mb-4">Add major shareholders with significant holdings</p>
          <button onClick={addShareholder} className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg">
            <Plus className="w-4 h-4" /> Add First Shareholder
          </button>
        </div>
      )}

      {shareholders.length > 0 && shareholders.length < 20 && (
        <button onClick={addShareholder} className="w-full py-4 border-2 border-dashed border-gray-700 hover:border-orange-500 rounded-xl text-gray-400 hover:text-orange-400 transition-colors flex items-center justify-center gap-2">
          <Plus className="w-5 h-5" /> Add Another Shareholder
        </button>
      )}
    </div>
  )
}
