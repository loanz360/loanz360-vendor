'use client'

import React, { useState, useEffect } from 'react'
import { Award, Heart, Star, TrendingUp, Users, Plus, ThumbsUp } from 'lucide-react'

interface Recognition {
  id: string
  recognition_type: string
  recognition_category: string
  title: string
  description: string
  specific_achievement: string
  has_monetary_reward: boolean
  reward_amount: number
  status: string
  created_at: string
  employee: {
    full_name: string
    work_email: string
    profile_photo_url?: string
  }
  given_by_user: {
    full_name: string
  }
  likes_count: number
}

export default function RecognitionWall() {
  const [loading, setLoading] = useState(true)
  const [recognitions, setRecognitions] = useState<Recognition[]>([])
  const [stats, setStats] = useState<any>(null)
  const [filter, setFilter] = useState('public')
  const [showGiveRecognition, setShowGiveRecognition] = useState(false)

  const [newRecognition, setNewRecognition] = useState({
    employee_id: '',
    recognition_type: 'PEER_APPRECIATION',
    recognition_category: 'TEAMWORK',
    title: '',
    description: '',
    specific_achievement: ''
  })

  useEffect(() => {
    fetchRecognitions()
  }, [filter])

  const fetchRecognitions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/employees/recognition?filter=${filter}&limit=50`)
      const result = await response.json()

      if (result.success) {
        setRecognitions(result.data.recognitions || [])
        setStats(result.data.stats)
      }
    } catch (error) {
      console.error('Error fetching recognitions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGiveRecognition = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/employees/recognition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecognition)
      })

      if (response.ok) {
        setShowGiveRecognition(false)
        fetchRecognitions()
        setNewRecognition({
          employee_id: '',
          recognition_type: 'PEER_APPRECIATION',
          recognition_category: 'TEAMWORK',
          title: '',
          description: '',
          specific_achievement: ''
        })
      }
    } catch (error) {
      console.error('Error giving recognition:', error)
    }
  }

  const getRecognitionIcon = (type: string) => {
    switch (type) {
      case 'SPOT_AWARD': return <Award className="w-6 h-6 text-yellow-500" />
      case 'MONTHLY_STAR': return <Star className="w-6 h-6 text-orange-500" />
      case 'PEER_APPRECIATION': return <Heart className="w-6 h-6 text-red-500" />
      case 'CUSTOMER_DELIGHT': return <ThumbsUp className="w-6 h-6 text-blue-500" />
      case 'INNOVATION': return <TrendingUp className="w-6 h-6 text-purple-500" />
      default: return <Award className="w-6 h-6 text-gray-500" />
    }
  }

  const getRecognitionColor = (type: string) => {
    switch (type) {
      case 'SPOT_AWARD': return 'border-yellow-500/30 bg-yellow-500/10'
      case 'MONTHLY_STAR': return 'border-orange-500/30 bg-orange-500/10'
      case 'PEER_APPRECIATION': return 'border-red-500/30 bg-red-500/10'
      case 'CUSTOMER_DELIGHT': return 'border-blue-500/30 bg-blue-500/10'
      case 'INNOVATION': return 'border-purple-500/30 bg-purple-500/10'
      default: return 'border-gray-500/30 bg-gray-500/10'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-7 h-7 text-orange-500" />
            Recognition Wall
          </h2>
          <p className="text-gray-400 mt-1">Celebrate achievements and great work</p>
        </div>
        <button
          onClick={() => setShowGiveRecognition(true)}
          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="w-5 h-5" />
          Give Recognition
        </button>
      </div>

      {/* Stats (for my_recognitions filter) */}
      {stats && filter === 'my_recognitions' && (
        <div className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-500/30 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-gray-400 text-sm">Total Recognitions</div>
              <div className="text-3xl font-bold mt-1">{stats.total_recognitions}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Total Rewards</div>
              <div className="text-3xl font-bold mt-1">₹{stats.total_reward_amount?.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Most Common</div>
              <div className="text-lg font-semibold mt-1">
                {Object.keys(stats.by_type || {}).length > 0
                  ? Object.entries(stats.by_type).sort((a: unknown, b: unknown) => b[1] - a[1])[0][0]
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { value: 'public', label: 'Public Feed' },
          { value: 'my_recognitions', label: 'My Recognitions' },
          { value: 'given_by_me', label: 'Given by Me' },
          { value: 'featured', label: 'Featured' }
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 rounded-lg transition ${
              filter === tab.value
                ? 'bg-orange-500 text-white'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Recognition Cards */}
      <div className="space-y-4">
        {recognitions.length === 0 ? (
          <div className="text-center py-12 content-card">
            <Award className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No recognitions yet</p>
            <button
              onClick={() => setShowGiveRecognition(true)}
              className="mt-4 text-orange-500 hover:underline"
            >
              Be the first to recognize someone!
            </button>
          </div>
        ) : (
          recognitions.map((recognition) => (
            <div
              key={recognition.id}
              className={`bg-gray-900 border rounded-lg p-6 hover:shadow-lg transition ${getRecognitionColor(recognition.recognition_type)}`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0">
                  {getRecognitionIcon(recognition.recognition_type)}
                </div>

                {/* Content */}
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-lg">{recognition.employee.full_name}</span>
                        <span className="px-2 py-0.5 text-xs bg-gray-800 rounded">
                          {recognition.recognition_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        Recognized by {recognition.given_by_user.full_name} • {new Date(recognition.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {recognition.has_monetary_reward && (
                      <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg font-semibold">
                        ₹{recognition.reward_amount?.toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl font-semibold mb-2">{recognition.title}</h3>
                  <p className="text-gray-300 mb-3">{recognition.description}</p>

                  {recognition.specific_achievement && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-3">
                      <div className="text-sm text-gray-400 mb-1">Achievement:</div>
                      <div className="text-sm">{recognition.specific_achievement}</div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-4 text-sm">
                    <button className="flex items-center gap-1 text-gray-400 hover:text-orange-500 transition">
                      <ThumbsUp className="w-4 h-4" />
                      <span>{recognition.likes_count || 0}</span>
                    </button>
                    <span className="text-gray-600">•</span>
                    <span className="text-gray-400">{recognition.recognition_category}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Give Recognition Modal */}
      {showGiveRecognition && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 max-w-2xl w-full">
            <h3 className="text-xl font-bold mb-4">Give Recognition</h3>
            <form onSubmit={handleGiveRecognition} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Employee ID *</label>
                <input
                  type="text"
                  required
                  value={newRecognition.employee_id}
                  onChange={(e) => setNewRecognition({ ...newRecognition, employee_id: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                  placeholder="UUID of employee"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Recognition Type *</label>
                  <select
                    value={newRecognition.recognition_type}
                    onChange={(e) => setNewRecognition({ ...newRecognition, recognition_type: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                  >
                    <option value="PEER_APPRECIATION">Peer Appreciation</option>
                    <option value="SPOT_AWARD">Spot Award</option>
                    <option value="MONTHLY_STAR">Monthly Star</option>
                    <option value="CUSTOMER_DELIGHT">Customer Delight</option>
                    <option value="INNOVATION">Innovation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Category *</label>
                  <select
                    value={newRecognition.recognition_category}
                    onChange={(e) => setNewRecognition({ ...newRecognition, recognition_category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                  >
                    <option value="TEAMWORK">Teamwork</option>
                    <option value="LEADERSHIP">Leadership</option>
                    <option value="INNOVATION">Innovation</option>
                    <option value="CUSTOMER_SERVICE">Customer Service</option>
                    <option value="PROBLEM_SOLVING">Problem Solving</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <input
                  type="text"
                  required
                  value={newRecognition.title}
                  onChange={(e) => setNewRecognition({ ...newRecognition, title: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                  placeholder="e.g., Outstanding Team Player"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description *</label>
                <textarea
                  required
                  value={newRecognition.description}
                  onChange={(e) => setNewRecognition({ ...newRecognition, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                  rows={4}
                  placeholder="Describe why you're recognizing this person..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Specific Achievement</label>
                <textarea
                  value={newRecognition.specific_achievement}
                  onChange={(e) => setNewRecognition({ ...newRecognition, specific_achievement: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none"
                  rows={3}
                  placeholder="Optional: Specific examples of what they achieved..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg hover:opacity-90"
                >
                  Submit Recognition
                </button>
                <button
                  type="button"
                  onClick={() => setShowGiveRecognition(false)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
