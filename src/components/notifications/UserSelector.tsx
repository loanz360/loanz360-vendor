'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, X, Users, ChevronDown } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'

interface User {
  id: string
  name: string
  email: string
  role: string
  subrole?: string
  geography?: {
    state?: string
    city?: string
    branch?: string
  }
}

interface UserSelectorProps {
  selectedUsers: User[]
  onChange: (users: User[]) => void
  placeholder?: string
  maxSelections?: number
  roleFilter?: 'employee' | 'partner' | 'customer' | 'all'
  disabled?: boolean
}

export default function UserSelector({
  selectedUsers,
  onChange,
  placeholder = 'Search and select users...',
  maxSelections,
  roleFilter = 'all',
  disabled = false
}: UserSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(searchTerm, 300)

  // Fetch users based on search term
  const fetchUsers = useCallback(async (search: string) => {
    if (search.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ search, limit: '20' })
      if (roleFilter !== 'all') {
        params.append('role', roleFilter)
      }

      const response = await fetch(`/api/notifications/recipients?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users')
      }

      setResults(data.recipients || [])
    } catch (err: unknown) {
      console.error('Error fetching users:', err)
      setError(err instanceof Error ? err.message : String(err))
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [roleFilter])

  // Trigger search when debounced term changes
  useEffect(() => {
    if (debouncedSearch) {
      fetchUsers(debouncedSearch)
    } else {
      setResults([])
    }
  }, [debouncedSearch, fetchUsers])

  // Add user to selection
  const handleSelectUser = (user: User) => {
    if (disabled) return

    // Check if already selected
    if (selectedUsers.some(u => u.id === user.id)) return

    // Check max selections
    if (maxSelections && selectedUsers.length >= maxSelections) {
      setError(`Maximum ${maxSelections} users can be selected`)
      return
    }

    onChange([...selectedUsers, user])
    setSearchTerm('')
    setIsOpen(false)
    setResults([])
  }

  // Remove user from selection
  const handleRemoveUser = (userId: string) => {
    if (disabled) return
    onChange(selectedUsers.filter(u => u.id !== userId))
  }

  // Clear all selections
  const handleClearAll = () => {
    if (disabled) return
    onChange([])
  }

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <div className="flex items-center gap-2 bg-black/50 border border-white/10 rounded-lg px-4 py-3 focus-within:border-orange-500 transition-colors">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setIsOpen(true)
              setError(null)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('')
                setResults([])
                setIsOpen(false)
              }}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {/* Dropdown Results */}
        {isOpen && searchTerm.length >= 2 && (
          <div className="absolute z-50 w-full mt-2 bg-black/95 backdrop-blur-lg border border-white/10 rounded-lg shadow-2xl max-h-80 overflow-y-auto">
            {loading && (
              <div className="p-4 text-center text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-orange-500 border-t-transparent mx-auto"></div>
                <p className="mt-2 text-sm">Searching users...</p>
              </div>
            )}

            {!loading && error && (
              <div className="p-4 text-center text-red-400">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {!loading && !error && results.length === 0 && (
              <div className="p-4 text-center text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No users found</p>
                <p className="text-xs text-gray-500 mt-1">Try a different search term</p>
              </div>
            )}

            {!loading && !error && results.length > 0 && (
              <div className="py-2">
                {results.map((user) => {
                  const isSelected = selectedUsers.some(u => u.id === user.id)
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      disabled={isSelected}
                      className={`w-full px-4 py-3 text-left hover:bg-white/5 transition-colors ${
                        isSelected ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{user.name}</p>
                          <p className="text-sm text-gray-400 truncate">{user.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded">
                              {user.role}
                            </span>
                            {user.subrole && (
                              <span className="text-xs px-2 py-0.5 bg-white/10 text-gray-400 rounded">
                                {user.subrole}
                              </span>
                            )}
                          </div>
                          {user.geography && (
                            <p className="text-xs text-gray-500 mt-1">
                              {[user.geography.state, user.geography.city, user.geography.branch]
                                .filter(Boolean)
                                .join(' • ')}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <span className="text-xs text-green-400 whitespace-nowrap">Selected</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Users Display */}
      {selectedUsers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
              {maxSelections && ` (max: ${maxSelections})`}
            </p>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={disabled}
              className="text-xs text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50"
            >
              Clear all
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg group hover:border-orange-500/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveUser(user.id)}
                  disabled={disabled}
                  className="p-1 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                  title="Remove user"
                >
                  <X className="w-4 h-4 text-gray-400 group-hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && !isOpen && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
