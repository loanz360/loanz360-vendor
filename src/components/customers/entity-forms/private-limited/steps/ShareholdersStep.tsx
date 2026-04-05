'use client'

import React from 'react'
import { PieChart, Plus, Trash2, User, Building2, Percent } from 'lucide-react'
import { PrivateLimitedStepProps, ShareholderData, SHAREHOLDER_TYPE_OPTIONS, createEmptyShareholder } from '../../types/private-limited'

export default function ShareholdersStep({ data, errors, onUpdate }: PrivateLimitedStepProps) {
  // Defensive: ensure shareholders array exists
  const shareholders = data.shareholders || []

  const addShareholder = () => {
    if (shareholders.length >= 200) return
    onUpdate({ shareholders: [...shareholders, createEmptyShareholder()] })
  }

  const removeShareholder = (index: number) => {
    if (shareholders.length <= 2) return
    onUpdate({ shareholders: shareholders.filter((_, i) => i !== index) })
  }

  const updateShareholder = (index: number, updates: Partial<ShareholderData>) => {
    const newShareholders = [...shareholders]
    newShareholders[index] = { ...newShareholders[index], ...updates }
    // Recalculate shareholding percent
    const totalShares = newShareholders.reduce((sum, s) => sum + (s.number_of_shares || 0), 0)
    if (totalShares > 0) {
      newShareholders[index].shareholding_percent = ((newShareholders[index].number_of_shares || 0) / totalShares) * 100
    }
    onUpdate({ shareholders: newShareholders })
  }

  const totalShares = shareholders.reduce((sum, s) => sum + (s.number_of_shares || 0), 0)
  const totalHolding = shareholders.reduce((sum, s) => sum + (s.shareholding_percent || 0), 0)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Shareholders</h2>
          <p className="text-gray-400">Add shareholders (Min: 2, Max: 200)</p>
        </div>
        <button onClick={addShareholder} disabled={shareholders.length >= 200}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 text-white rounded-lg">
          <Plus className="w-4 h-4" /> Add Shareholder
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1"><PieChart className="w-4 h-4 text-orange-400" /><span className="text-sm text-gray-400">Shareholders</span></div>
          <p className="text-2xl font-bold text-white">{shareholders.length}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1"><span className="text-sm text-gray-400">Total Shares</span></div>
          <p className="text-2xl font-bold text-white">{totalShares.toLocaleString()}</p>
        </div>
        <div className={`border rounded-lg p-4 ${Math.abs(totalHolding - 100) < 0.01 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-gray-800 border-gray-700'}`}>
          <div className="flex items-center gap-2 mb-1"><Percent className="w-4 h-4 text-orange-400" /><span className="text-sm text-gray-400">Total Holding</span></div>
          <p className={`text-2xl font-bold ${Math.abs(totalHolding - 100) < 0.01 ? 'text-orange-400' : 'text-white'}`}>{totalHolding.toFixed(2)}%</p>
        </div>
      </div>

      {errors.shareholders && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg"><p className="text-sm text-red-400">{errors.shareholders}</p></div>}

      <div className="space-y-4">
        {shareholders.map((shareholder, index) => (
          <div key={shareholder.id} className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${shareholder.shareholder_type === 'BODY_CORPORATE' ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-700 text-gray-400'}`}>
                  {shareholder.shareholder_type === 'BODY_CORPORATE' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <h4 className="font-medium text-white">{shareholder.name || `Shareholder ${index + 1}`}</h4>
              </div>
              {shareholders.length > 2 && <button onClick={() => removeShareholder(index)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                <select value={shareholder.shareholder_type} onChange={(e) => updateShareholder(index, { shareholder_type: e.target.value as ShareholderData['shareholder_type'] })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                  <option value="">Select</option>
                  {SHAREHOLDER_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                <input type="text" value={shareholder.name} onChange={(e) => updateShareholder(index, { name: e.target.value })} placeholder="Name"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">PAN</label>
                <input type="text" value={shareholder.pan_number} onChange={(e) => updateShareholder(index, { pan_number: e.target.value.toUpperCase() })} placeholder="PAN" maxLength={10}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">No. of Shares</label>
                <input type="number" value={shareholder.number_of_shares || ''} onChange={(e) => updateShareholder(index, { number_of_shares: parseInt(e.target.value) || null })} placeholder="0"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Holding %</label>
                <input type="text" value={(shareholder.shareholding_percent || 0).toFixed(2)} readOnly
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 text-sm" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {shareholders.length < 200 && (
        <button onClick={addShareholder} className="w-full py-3 border-2 border-dashed border-gray-700 hover:border-orange-500 rounded-xl text-gray-400 hover:text-orange-400 transition-colors flex items-center justify-center gap-2">
          <Plus className="w-5 h-5" /> Add Shareholder
        </button>
      )}
    </div>
  )
}
