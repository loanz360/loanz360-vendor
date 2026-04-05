'use client'

import { useState, useEffect } from 'react'
import { MapPin, ChevronDown, X } from 'lucide-react'

interface State {
  id: string
  state_code: string
  state_name: string
}

interface City {
  id: string
  city_name: string
  state_id: string
  state?: {
    state_name: string
  }
}

interface Branch {
  id: string
  branch_name: string
  branch_code: string
  city_id: string
  state_id: string
  city?: {
    city_name: string
  }
  state?: {
    state_name: string
  }
}

export interface GeographySelection {
  state_ids: string[]
  city_ids: string[]
  branch_ids: string[]
}

interface GeographyFilterProps {
  value: GeographySelection
  onChange: (selection: GeographySelection) => void
  disabled?: boolean
  showBranches?: boolean
}

export default function GeographyFilter({
  value,
  onChange,
  disabled = false,
  showBranches = true
}: GeographyFilterProps) {
  const [states, setStates] = useState<State[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [branches, setBranches] = useState<Branch[]>([])

  const [selectedStates, setSelectedStates] = useState<State[]>([])
  const [selectedCities, setSelectedCities] = useState<City[]>([])
  const [selectedBranches, setSelectedBranches] = useState<Branch[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch all states on mount
  useEffect(() => {
    fetchStates()
  }, [])

  // Fetch cities when states change
  useEffect(() => {
    if (value.state_ids.length > 0) {
      fetchCities(value.state_ids)
    } else {
      setCities([])
      setSelectedCities([])
    }
  }, [value.state_ids])

  // Fetch branches when cities change
  useEffect(() => {
    if (showBranches && value.city_ids.length > 0) {
      fetchBranches(value.city_ids)
    } else {
      setBranches([])
      setSelectedBranches([])
    }
  }, [value.city_ids, showBranches])

  const fetchStates = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/geography/states?active_only=true')
      const data = await response.json()
      if (data.success) {
        setStates(data.states || [])
      } else {
        throw new Error(data.error || 'Failed to fetch states')
      }
    } catch (err: unknown) {
      console.error('Error fetching states:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const fetchCities = async (stateIds: string[]) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      stateIds.forEach(id => params.append('state_id', id))
      params.append('active_only', 'true')

      const response = await fetch(`/api/geography/cities?${params}`)
      const data = await response.json()
      if (data.success) {
        setCities(data.cities || [])
      } else {
        throw new Error(data.error || 'Failed to fetch cities')
      }
    } catch (err: unknown) {
      console.error('Error fetching cities:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const fetchBranches = async (cityIds: string[]) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      cityIds.forEach(id => params.append('city_id', id))
      params.append('active_only', 'true')

      const response = await fetch(`/api/geography/branches?${params}`)
      const data = await response.json()
      if (data.success) {
        setBranches(data.branches || [])
      } else {
        throw new Error(data.error || 'Failed to fetch branches')
      }
    } catch (err: unknown) {
      console.error('Error fetching branches:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleStateChange = (stateId: string) => {
    if (disabled) return

    const newStateIds = value.state_ids.includes(stateId)
      ? value.state_ids.filter(id => id !== stateId)
      : [...value.state_ids, stateId]

    // Update selected states display
    const state = states.find(s => s.id === stateId)
    if (state) {
      setSelectedStates(
        newStateIds.includes(stateId)
          ? [...selectedStates, state]
          : selectedStates.filter(s => s.id !== stateId)
      )
    }

    onChange({
      state_ids: newStateIds,
      city_ids: [], // Reset cities when states change
      branch_ids: [] // Reset branches when states change
    })
  }

  const handleCityChange = (cityId: string) => {
    if (disabled) return

    const newCityIds = value.city_ids.includes(cityId)
      ? value.city_ids.filter(id => id !== cityId)
      : [...value.city_ids, cityId]

    // Update selected cities display
    const city = cities.find(c => c.id === cityId)
    if (city) {
      setSelectedCities(
        newCityIds.includes(cityId)
          ? [...selectedCities, city]
          : selectedCities.filter(c => c.id !== cityId)
      )
    }

    onChange({
      ...value,
      city_ids: newCityIds,
      branch_ids: [] // Reset branches when cities change
    })
  }

  const handleBranchChange = (branchId: string) => {
    if (disabled) return

    const newBranchIds = value.branch_ids.includes(branchId)
      ? value.branch_ids.filter(id => id !== branchId)
      : [...value.branch_ids, branchId]

    // Update selected branches display
    const branch = branches.find(b => b.id === branchId)
    if (branch) {
      setSelectedBranches(
        newBranchIds.includes(branchId)
          ? [...selectedBranches, branch]
          : selectedBranches.filter(b => b.id !== branchId)
      )
    }

    onChange({
      ...value,
      branch_ids: newBranchIds
    })
  }

  const handleClearAll = () => {
    if (disabled) return
    setSelectedStates([])
    setSelectedCities([])
    setSelectedBranches([])
    onChange({ state_ids: [], city_ids: [], branch_ids: [] })
  }

  const totalSelections = value.state_ids.length + value.city_ids.length + value.branch_ids.length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-orange-400" />
          <h3 className="font-medium font-poppins">Geography Filter</h3>
          {totalSelections > 0 && (
            <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded">
              {totalSelections} selected
            </span>
          )}
        </div>
        {totalSelections > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            disabled={disabled}
            className="text-xs text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50"
          >
            Clear all
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* State Selection */}
      <div className="space-y-2">
        <label className="block text-sm text-gray-400">Select State(s)</label>
        <div className="relative">
          <select
            multiple
            value={value.state_ids}
            onChange={(e) => {
              const selectedOptions = Array.from(e.target.selectedOptions, option => option.value)
              const newStateId = selectedOptions[selectedOptions.length - 1]
              if (newStateId) handleStateChange(newStateId)
            }}
            disabled={disabled || loading}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none disabled:opacity-50 min-h-[120px]"
          >
            {states.map(state => (
              <option
                key={state.id}
                value={state.id}
                className="py-2"
              >
                {state.state_name} ({state.state_code})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">Hold Ctrl/Cmd to select multiple states</p>
        </div>

        {selectedStates.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedStates.map(state => (
              <span
                key={state.id}
                className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm"
              >
                {state.state_name}
                <button
                  type="button"
                  onClick={() => handleStateChange(state.id)}
                  disabled={disabled}
                  className="hover:bg-orange-500/30 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* City Selection */}
      {value.state_ids.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm text-gray-400">Select City/Cities</label>
          <div className="relative">
            <select
              multiple
              value={value.city_ids}
              onChange={(e) => {
                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value)
                const newCityId = selectedOptions[selectedOptions.length - 1]
                if (newCityId) handleCityChange(newCityId)
              }}
              disabled={disabled || loading || cities.length === 0}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none disabled:opacity-50 min-h-[120px]"
            >
              {cities.length === 0 ? (
                <option disabled>No cities available for selected states</option>
              ) : (
                cities.map(city => (
                  <option
                    key={city.id}
                    value={city.id}
                    className="py-2"
                  >
                    {city.city_name}
                    {city.state?.state_name && ` (${city.state.state_name})`}
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-xs text-gray-500">Optional: Narrow down to specific cities</p>
          </div>

          {selectedCities.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedCities.map(city => (
                <span
                  key={city.id}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm"
                >
                  {city.city_name}
                  <button
                    type="button"
                    onClick={() => handleCityChange(city.id)}
                    disabled={disabled}
                    className="hover:bg-blue-500/30 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Branch Selection */}
      {showBranches && value.city_ids.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm text-gray-400">Select Branch(es)</label>
          <div className="relative">
            <select
              multiple
              value={value.branch_ids}
              onChange={(e) => {
                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value)
                const newBranchId = selectedOptions[selectedOptions.length - 1]
                if (newBranchId) handleBranchChange(newBranchId)
              }}
              disabled={disabled || loading || branches.length === 0}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none disabled:opacity-50 min-h-[120px]"
            >
              {branches.length === 0 ? (
                <option disabled>No branches available for selected cities</option>
              ) : (
                branches.map(branch => (
                  <option
                    key={branch.id}
                    value={branch.id}
                    className="py-2"
                  >
                    {branch.branch_name} ({branch.branch_code})
                    {branch.city?.city_name && ` - ${branch.city.city_name}`}
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-xs text-gray-500">Optional: Narrow down to specific branches</p>
          </div>

          {selectedBranches.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedBranches.map(branch => (
                <span
                  key={branch.id}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm"
                >
                  {branch.branch_name}
                  <button
                    type="button"
                    onClick={() => handleBranchChange(branch.id)}
                    disabled={disabled}
                    className="hover:bg-green-500/30 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {totalSelections > 0 && (
        <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-sm text-gray-400">
            Targeting: {value.state_ids.length} state(s)
            {value.city_ids.length > 0 && `, ${value.city_ids.length} city/cities`}
            {value.branch_ids.length > 0 && `, ${value.branch_ids.length} branch(es)`}
          </p>
        </div>
      )}
    </div>
  )
}
