'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, Briefcase, MapPin, Languages, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'

const LOAN_TYPES = [
  'Home Loan', 'Personal Loan', 'Business Loan', 'Car Loan', 'Education Loan',
  'Gold Loan', 'Loan Against Property', 'Working Capital', 'MSME Loan',
  'Bill Discounting', 'Construction Finance', 'Overdraft', 'Credit Card',
  'Two Wheeler Loan', 'Consumer Durable', 'Balance Transfer'
]

const LOCATIONS = [
  'Hyderabad', 'Bangalore', 'Delhi', 'Mumbai', 'Chennai',
  'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow'
]

const LANGUAGES = [
  'English', 'Hindi', 'Telugu', 'Tamil', 'Kannada',
  'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu'
]

const SKILL_LEVELS = [
  { value: 'junior', label: 'Junior', color: 'text-gray-400' },
  { value: 'mid', label: 'Mid', color: 'text-blue-400' },
  { value: 'senior', label: 'Senior', color: 'text-purple-400' },
  { value: 'star', label: 'Star', color: 'text-yellow-400' },
  { value: 'champion', label: 'Champion', color: 'text-orange-400' },
]

interface CROCategoryData {
  loan_type_expertise: string[]
  locations: string[]
  languages: string[]
  skill_level: string
  max_daily_contacts: number
  max_active_leads: number
  preferred_call_times: string
  is_on_leave: boolean
}

export default function CROSpecializationSection({ userId }: { userId: string }) {
  const [data, setData] = useState<CROCategoryData>({
    loan_type_expertise: [],
    locations: [],
    languages: [],
    skill_level: 'junior',
    max_daily_contacts: 50,
    max_active_leads: 100,
    preferred_call_times: '9am-6pm',
    is_on_leave: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [userId])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/cro/profile/categories')
      const result = await res.json()
      if (result.success && result.data) {
        setData({
          loan_type_expertise: result.data.loan_type_expertise || [],
          locations: result.data.locations || [],
          languages: result.data.languages || [],
          skill_level: result.data.skill_level || 'junior',
          max_daily_contacts: result.data.max_daily_contacts || 50,
          max_active_leads: result.data.max_active_leads || 100,
          preferred_call_times: result.data.preferred_call_times || '9am-6pm',
          is_on_leave: result.data.is_on_leave || false,
        })
      }
    } catch {
      // No categories yet - use defaults
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const res = await fetch('/api/cro/profile/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanTypeExpertise: data.loan_type_expertise,
          locations: data.locations,
          languages: data.languages,
          preferredCallTimes: data.preferred_call_times,
          maxDailyContacts: data.max_daily_contacts,
          maxActiveLeads: data.max_active_leads,
        }),
      })
      const result = await res.json()
      if (result.success) {
        setSaveMessage({ type: 'success', text: 'CRO specialization saved successfully' })
      } else {
        setSaveMessage({ type: 'error', text: result.error || 'Failed to save' })
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save specialization' })
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  const toggleArrayItem = (field: 'loan_type_expertise' | 'locations' | 'languages', item: string) => {
    setData(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item]
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Save Message */}
      {saveMessage && (
        <div className={`p-4 rounded-lg border ${saveMessage.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {saveMessage.text}
        </div>
      )}

      {/* Skill Level */}
      <div className="bg-[var(--customer-card-bg)] rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Target className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Skill Level</h3>
            <p className="text-sm text-gray-400">Your current performance level (set by admin)</p>
          </div>
        </div>
        <div className="flex gap-3">
          {SKILL_LEVELS.map(level => (
            <div
              key={level.value}
              className={`px-4 py-2 rounded-lg border text-sm font-medium cursor-default select-none ${
                data.skill_level === level.value
                  ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                  : 'border-gray-700 text-gray-500 opacity-50'
              }`}
            >
              {level.label}
            </div>
          ))}
        </div>
      </div>

      {/* Loan Type Expertise */}
      <div className="bg-[var(--customer-card-bg)] rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Briefcase className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Loan Type Expertise</h3>
            <p className="text-sm text-gray-400">Select the loan types you specialize in</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {LOAN_TYPES.map(type => (
            <button
              key={type}
              onClick={() => toggleArrayItem('loan_type_expertise', type)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                data.loan_type_expertise.includes(type)
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                  : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-blue-500/30'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Locations */}
      <div className="bg-[var(--customer-card-bg)] rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <MapPin className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Locations</h3>
            <p className="text-sm text-gray-400">Cities you can service</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {LOCATIONS.map(loc => (
            <button
              key={loc}
              onClick={() => toggleArrayItem('locations', loc)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                data.locations.includes(loc)
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-green-500/30'
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div className="bg-[var(--customer-card-bg)] rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Languages className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Languages</h3>
            <p className="text-sm text-gray-400">Languages you can communicate in</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(lang => (
            <button
              key={lang}
              onClick={() => toggleArrayItem('languages', lang)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                data.languages.includes(lang)
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                  : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-purple-500/30'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Capacity Settings */}
      <div className="bg-[var(--customer-card-bg)] rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Capacity Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Daily Contacts</label>
            <input
              type="number"
              value={data.max_daily_contacts}
              min={1}
              max={500}
              onChange={e => setData(prev => ({ ...prev, max_daily_contacts: Math.max(1, Math.min(500, parseInt(e.target.value) || 1)) }))}
              className="w-full bg-[var(--customer-card-bg)] border border-gray-700/50 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Active Leads</label>
            <input
              type="number"
              value={data.max_active_leads}
              min={1}
              max={1000}
              onChange={e => setData(prev => ({ ...prev, max_active_leads: Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)) }))}
              className="w-full bg-[var(--customer-card-bg)] border border-gray-700/50 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Preferred Call Times</label>
            <input
              type="text"
              value={data.preferred_call_times}
              onChange={e => setData(prev => ({ ...prev, preferred_call_times: e.target.value }))}
              placeholder="e.g., 9am-6pm"
              className="w-full bg-[var(--customer-card-bg)] border border-gray-700/50 rounded-lg px-3 py-2 text-white"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-orange-500 text-white px-8 py-3 flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {isSaving ? 'Saving...' : 'Save CRO Specialization'}
        </Button>
      </div>
    </div>
  )
}
