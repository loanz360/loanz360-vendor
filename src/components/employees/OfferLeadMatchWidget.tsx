'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Target, Loader2, ArrowRight, Building2, MapPin,
  Clock, Zap, User, RefreshCw, Tag
} from 'lucide-react'

interface OfferMatch {
  offer_id: string
  offer_title: string
  bank: string
  lead_id: string
  lead_name: string
  match_score: number
  match_reasons: string[]
}

interface MatchSummary {
  total_matches: number
  top_offer: { id: string; title: string; match_count: number } | null
  active_offers: number
  active_leads: number
}

export default function OfferLeadMatchWidget() {
  const [matches, setMatches] = useState<OfferMatch[]>([])
  const [summary, setSummary] = useState<MatchSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMatches = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/offers/matches')
      if (!response.ok) throw new Error('Failed to fetch matches')
      const data = await response.json()
      setMatches(data.matches || [])
      setSummary(data.summary || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMatches() }, [])

  if (loading) {
    return (
      <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-5 h-5 text-orange-500" />
          <h3 className="font-bold text-white font-poppins">Offer-Lead Matches</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-orange-500" />
          <h3 className="font-bold text-white font-poppins">Offer-Lead Matches</h3>
          {summary && (
            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-xs font-semibold">
              {summary.total_matches} matches
            </span>
          )}
        </div>
        <button
          onClick={fetchMatches}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Refresh matches"
        >
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-black/30 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-orange-400">{summary.active_offers}</p>
            <p className="text-xs text-gray-500">Active Offers</p>
          </div>
          <div className="bg-black/30 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-blue-400">{summary.active_leads}</p>
            <p className="text-xs text-gray-500">Your Leads</p>
          </div>
          <div className="bg-black/30 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-green-400">{summary.total_matches}</p>
            <p className="text-xs text-gray-500">Matches</p>
          </div>
        </div>
      )}

      {/* Top Offer Alert */}
      {summary?.top_offer && (
        <div className="bg-gradient-to-r from-orange-500/10 to-orange-600/5 border border-orange-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-400 font-semibold">Top Match</span>
          </div>
          <p className="text-sm text-white mt-1">
            &ldquo;{summary.top_offer.title}&rdquo; matches {summary.top_offer.match_count} of your leads
          </p>
        </div>
      )}

      {/* Match List */}
      {matches.length === 0 && !error ? (
        <div className="text-center py-6">
          <Tag className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No offer-lead matches found</p>
          <p className="text-gray-600 text-xs mt-1">Matches appear when offers align with your leads</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {matches.slice(0, 10).map((match, idx) => (
            <div
              key={`${match.offer_id}-${match.lead_id}-${idx}`}
              className="bg-black/20 rounded-lg p-3 hover:bg-black/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{match.offer_title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Building2 className="w-3 h-3 text-orange-400" />
                    <span className="text-xs text-orange-400">{match.bank}</span>
                    <span className="text-gray-600">&rarr;</span>
                    <User className="w-3 h-3 text-blue-400" />
                    <span className="text-xs text-blue-400">{match.lead_name}</span>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {match.match_reasons.map(reason => (
                      <span key={reason} className="px-2 py-0.5 bg-white/5 text-gray-400 rounded text-[10px]">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="ml-3 flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                    match.match_score >= 70 ? 'bg-green-500/20 text-green-400' :
                    match.match_score >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {match.match_score}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {matches.length > 10 && (
        <Link
          href="/offers"
          className="mt-4 flex items-center justify-center gap-2 text-sm text-orange-400 hover:text-orange-300 py-2"
        >
          View all {matches.length} matches
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}

      {error && (
        <div className="text-center py-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={fetchMatches} className="text-orange-400 text-sm mt-2 hover:underline">Retry</button>
        </div>
      )}
    </div>
  )
}
