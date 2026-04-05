'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Tag,
  Search,
  Filter,
  X,
  Calendar,
  MapPin,
  Building2,
  Image as ImageIcon,
  Sparkles,
  ExternalLink
} from 'lucide-react'
import type { Offer } from '@/types/offers'
import { COMMON_BANKS_NBFCS } from '@/types/offers'

interface OffersViewPageProps {
  userRole?: string // Optional: to customize messaging
}

export default function OffersViewPage({ userRole }: OffersViewPageProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'expired'>('active')
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterBank, setFilterBank] = useState<string>('')
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)

  // Fetch offers
  const fetchOffers = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/offers?status=${activeTab}&forUser=true`)
      const data = await response.json()
      setOffers(data.offers || [])
    } catch (error) {
      console.error('Error fetching offers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOffers()
  }, [activeTab])

  // Record offer view
  const recordView = async (offerId: string) => {
    try {
      await fetch('/api/offers/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId })
      })
    } catch (error) {
      console.error('Error recording view:', error)
    }
  }

  // Filter offers
  const filteredOffers = offers.filter(offer => {
    const matchesSearch = offer.offer_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offer.rolled_out_by.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offer.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesBank = !filterBank || offer.rolled_out_by === filterBank

    return matchesSearch && matchesBank
  })

  const handleOfferClick = (offer: Offer) => {
    setSelectedOffer(offer)
    recordView(offer.id)
  }

  return (
    <div className="min-h-screen bg-black p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3 font-poppins">
          <Tag className="w-8 h-8 text-orange-500" />
          Offers to Customers
        </h1>
        <p className="text-gray-400">
          Explore exclusive offers from leading banks and NBFCs
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search offers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/50 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Filter by Bank */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterBank}
              onChange={(e) => setFilterBank(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Banks/NBFCs</option>
              {COMMON_BANKS_NBFCS.map(bank => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {(searchQuery || filterBank) && (
            <button
              onClick={() => {
                setSearchQuery('')
                setFilterBank('')
              }}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            activeTab === 'active'
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/50'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          Active Offers
        </button>
        <button
          onClick={() => setActiveTab('expired')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            activeTab === 'expired'
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/50'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          Expired Offers
        </button>
      </div>

      {/* Offers Grid */}
      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 mt-4">Loading offers...</p>
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="text-center py-20 bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg">
          <Tag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">
            {searchQuery || filterBank ? 'No offers match your filters' : `No ${activeTab} offers available`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                onClick={() => handleOfferClick(offer)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Offer Detail Modal */}
      {selectedOffer && (
        <OfferDetailModal
          offer={selectedOffer}
          onClose={() => setSelectedOffer(null)}
        />
      )}
    </div>
  )
}

// Offer Card Component
function OfferCard({
  offer,
  onClick
}: {
  offer: Offer
  onClick: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={onClick}
      className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg overflow-hidden hover:border-orange-500/50 transition-all group cursor-pointer"
    >
      {/* Image */}
      {offer.offer_image_url ? (
        <div className="relative h-48 overflow-hidden">
          <img
            src={offer.offer_image_url}
            alt={offer.offer_title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          {offer.image_source === 'ai-generated' && (
            <div className="absolute top-2 right-2 bg-purple-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI Generated
            </div>
          )}
          {offer.status === 'active' && (
            <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
              ACTIVE
            </div>
          )}
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-orange-500/20 to-purple-500/20 flex items-center justify-center">
          <ImageIcon className="w-16 h-16 text-white/30" />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-orange-400 transition-colors font-poppins">
          {offer.offer_title}
        </h3>

        <div className="flex items-center gap-2 text-sm text-orange-400 mb-3">
          <Building2 className="w-4 h-4" />
          {offer.rolled_out_by}
        </div>

        <p className="text-gray-400 text-sm mb-4 line-clamp-3">
          {offer.description}
        </p>

        {/* Meta Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar className="w-3 h-3" />
            Valid till {new Date(offer.end_date).toLocaleDateString()}
          </div>
          {offer.states_applicable && offer.states_applicable.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MapPin className="w-3 h-3" />
              {offer.states_applicable.slice(0, 2).join(', ')}
              {offer.states_applicable.length > 2 && ` +${offer.states_applicable.length - 2} more`}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-orange-400 font-medium">
          <span>View Details</span>
          <ExternalLink className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  )
}

// Offer Detail Modal
function OfferDetailModal({
  offer,
  onClose
}: {
  offer: Offer
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#1A1A1A] border border-white/10 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Image */}
        {offer.offer_image_url && (
          <div className="relative h-64 overflow-hidden rounded-t-lg">
            <img
              src={offer.offer_image_url}
              alt={offer.offer_title}
              className="w-full h-full object-cover"
            />
            {offer.status === 'active' && (
              <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                ACTIVE OFFER
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Title */}
          <h2 className="text-2xl font-bold mb-4 font-poppins">
            {offer.offer_title}
          </h2>

          {/* Bank */}
          <div className="flex items-center gap-2 text-orange-400 mb-6">
            <Building2 className="w-5 h-5" />
            <span className="text-lg font-semibold">{offer.rolled_out_by}</span>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2 font-poppins">Offer Details</h3>
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
              {offer.description}
            </p>
          </div>

          {/* Validity */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-white mb-2">
              <Calendar className="w-5 h-5 text-orange-400" />
              <span className="font-semibold">Validity Period</span>
            </div>
            <p className="text-gray-300 ml-7">
              {new Date(offer.start_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
              {' '}to{' '}
              {new Date(offer.end_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          {/* States */}
          {offer.states_applicable && offer.states_applicable.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-white mb-2">
                <MapPin className="w-5 h-5 text-orange-400" />
                <span className="font-semibold">Applicable States</span>
              </div>
              <div className="ml-7 flex flex-wrap gap-2">
                {offer.states_applicable.map(state => (
                  <span
                    key={state}
                    className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm"
                  >
                    {state}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  )
}
