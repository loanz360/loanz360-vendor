'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const activityFeed = [
  { type: 'Pending', name: 'Rajesh Kumar', amount: '₹5,50,000', time: '3 minutes ago', color: 'bg-orange-500' },
  { type: 'Approved', name: 'Priya Sharma', amount: '₹3,25,000', time: '7 minutes ago', color: 'bg-green-500' },
  { type: 'Active', name: 'Anil Singh', amount: '', time: '12 minutes ago', color: 'bg-green-500' },
  { type: 'Rejected', name: 'Sonia Patel', amount: '₹2,75,000', time: '18 minutes ago', color: 'bg-red-500' },
  { type: 'Completed', name: 'Vikram Gupta', amount: '₹4,80,000', time: '25 minutes ago', color: 'bg-blue-500' },
  { type: 'Verified', name: 'Maya Financial Services', amount: '', time: '32 minutes ago', color: 'bg-purple-500' },
  { type: 'Updated', name: 'Amit Desai', amount: '', time: '38 minutes ago', color: 'bg-cyan-500' },
  { type: 'Withdrawn', name: 'Suchi Mehta', amount: '₹1,95,000', time: '42 minutes ago', color: 'bg-gray-500' },
  { type: 'Pending', name: 'Deepak Rao', amount: '₹6,20,000', time: '48 minutes ago', color: 'bg-orange-500' },
  { type: 'Approved', name: 'Neha Kapoor', amount: '₹4,15,000', time: '52 minutes ago', color: 'bg-green-500' }
]

export default function GlobalActivityFeed() {
  return (
    <div className="h-full flex flex-col p-6 bg-black">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <h3 className="text-base font-semibold font-poppins">Real Time Activity Feed</h3>
        <Button variant="ghost" className="text-orange-400 text-xs hover:text-orange-300 p-0 h-auto">
          View All
        </Button>
      </div>

      {/* Scrollable Activity List */}
      <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent pr-2">
        {activityFeed.map((activity, index) => (
          <Card key={index} className="">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full ${activity.color} mt-1.5 flex-shrink-0`}></div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium mb-1">
                    {activity.type === 'Pending' && 'New loan application'}
                    {activity.type === 'Approved' && 'Loan sanctioned'}
                    {activity.type === 'Active' && 'Associate joined'}
                    {activity.type === 'Rejected' && 'Application rejected'}
                    {activity.type === 'Completed' && 'Amount disbursed'}
                    {activity.type === 'Verified' && 'Partner verified'}
                    {activity.type === 'Updated' && 'Profile updated'}
                    {activity.type === 'Withdrawn' && 'Application withdrawn'}
                  </p>
                  <p className="text-gray-400 text-xs truncate mb-1">
                    {activity.name} {activity.amount && `• ${activity.amount}`}
                  </p>
                  <p className="text-gray-500 text-xs">{activity.time}</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium text-white flex-shrink-0 ${
                  activity.type === 'Pending' ? 'bg-orange-500' :
                  activity.type === 'Approved' ? 'bg-green-500' :
                  activity.type === 'Active' ? 'bg-green-500' :
                  activity.type === 'Rejected' ? 'bg-red-500' :
                  activity.type === 'Completed' ? 'bg-blue-500' :
                  activity.type === 'Verified' ? 'bg-purple-500' :
                  activity.type === 'Updated' ? 'bg-cyan-500' :
                  'bg-gray-500'
                }`}>
                  {activity.type}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
