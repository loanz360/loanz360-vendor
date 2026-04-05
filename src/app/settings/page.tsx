'use client'

import { Settings, ArrowLeft, Bell, Globe, Lock, User, Palette, Shield, Save, Mail, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'
import { useState } from 'react'

export default function VendorSettingsPage() {
  const [activeSection, setActiveSection] = useState('notifications')

  const sections = [
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'preferences', label: 'Preferences', icon: Palette },
    { key: 'security', label: 'Security', icon: Lock },
    { key: 'communication', label: 'Communication', icon: Mail },
  ]

  return (
    <div className="min-h-screen bg-black font-poppins text-xs">
      {/* Header */}
      <header className="bg-black border-b border-neutral-800 p-6">
        <div className="flex items-center space-x-4">
          <Link href="/vendors">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white font-poppins">Settings</h1>
            <p className="text-gray-400 text-sm mt-1">Manage your account settings and preferences</p>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="flex gap-6">
          {/* Settings Sidebar */}
          <div className="w-56 flex-shrink-0">
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs transition-colors ${
                    activeSection === section.key
                      ? 'bg-[#FF6700] text-black font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <section.icon className="w-4 h-4" />
                  <span>{section.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Settings Content */}
          <div className="flex-1 space-y-6">
            {activeSection === 'notifications' && (
              <Card className="bg-brand-ash">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Notification Preferences</CardTitle>
                  <CardDescription>Choose how you want to be notified</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: 'New contract assignments', description: 'Get notified when a new contract is assigned to you' },
                    { label: 'Payment received', description: 'Notification when payment is credited to your account' },
                    { label: 'Contract updates', description: 'Updates on contract status changes and renewals' },
                    { label: 'Performance alerts', description: 'Alerts when your performance metrics change significantly' },
                    { label: 'System announcements', description: 'Important platform updates and maintenance notices' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-3 border-b border-neutral-800 last:border-0">
                      <div>
                        <p className="text-white text-xs font-medium">{item.label}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{item.description}</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 text-[#FF6700] focus:ring-[#FF6700]" />
                          <span className="text-gray-400 text-xs">Email</span>
                        </label>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input type="checkbox" className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 text-[#FF6700] focus:ring-[#FF6700]" />
                          <span className="text-gray-400 text-xs">SMS</span>
                        </label>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4">
                    <Button className="bg-[#FF6700] hover:bg-[#FF6700]/90 text-black font-medium">
                      <Save className="w-4 h-4 mr-2" /> Save Preferences
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'preferences' && (
              <Card className="bg-brand-ash">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Display & Preferences</CardTitle>
                  <CardDescription>Customize your portal experience</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <label className="text-white text-xs font-medium block mb-1.5">Language</label>
                    <select className="w-full max-w-xs bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-xs focus:border-[#FF6700] focus:outline-none">
                      <option>English</option>
                      <option>Hindi</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white text-xs font-medium block mb-1.5">Currency Display</label>
                    <select className="w-full max-w-xs bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-xs focus:border-[#FF6700] focus:outline-none">
                      <option>INR (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white text-xs font-medium block mb-1.5">Date Format</label>
                    <select className="w-full max-w-xs bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-xs focus:border-[#FF6700] focus:outline-none">
                      <option>DD/MM/YYYY</option>
                      <option>MM/DD/YYYY</option>
                      <option>YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white text-xs font-medium block mb-1.5">Timezone</label>
                    <select className="w-full max-w-xs bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-xs focus:border-[#FF6700] focus:outline-none">
                      <option>Asia/Kolkata (IST, UTC+5:30)</option>
                    </select>
                  </div>
                  <div className="pt-2">
                    <Button className="bg-[#FF6700] hover:bg-[#FF6700]/90 text-black font-medium">
                      <Save className="w-4 h-4 mr-2" /> Save Preferences
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'security' && (
              <Card className="bg-brand-ash">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Security Settings</CardTitle>
                  <CardDescription>Manage your account security</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between py-3 border-b border-neutral-800">
                    <div>
                      <p className="text-white text-xs font-medium">Change Password</p>
                      <p className="text-gray-500 text-xs mt-0.5">Update your account password</p>
                    </div>
                    <Button variant="outline" size="sm" className="border-neutral-700 text-gray-300">
                      Update
                    </Button>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-neutral-800">
                    <div>
                      <p className="text-white text-xs font-medium">Two-Factor Authentication</p>
                      <p className="text-gray-500 text-xs mt-0.5">Add an extra layer of security to your account</p>
                    </div>
                    <Button variant="outline" size="sm" className="border-neutral-700 text-gray-300">
                      Enable
                    </Button>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-white text-xs font-medium">Active Sessions</p>
                      <p className="text-gray-500 text-xs mt-0.5">View and manage your active login sessions</p>
                    </div>
                    <Button variant="outline" size="sm" className="border-neutral-700 text-gray-300">
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'communication' && (
              <Card className="bg-brand-ash">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Communication Preferences</CardTitle>
                  <CardDescription>Manage how LOANZ 360 communicates with you</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: 'Marketing emails', description: 'Receive updates about new features and opportunities' },
                    { label: 'Weekly digest', description: 'Summary of your weekly activity and earnings' },
                    { label: 'WhatsApp notifications', description: 'Receive important updates via WhatsApp' },
                    { label: 'SMS alerts', description: 'Critical alerts sent via SMS' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-3 border-b border-neutral-800 last:border-0">
                      <div>
                        <p className="text-white text-xs font-medium">{item.label}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{item.description}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-9 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#FF6700] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                      </label>
                    </div>
                  ))}
                  <div className="pt-4">
                    <Button className="bg-[#FF6700] hover:bg-[#FF6700]/90 text-black font-medium">
                      <Save className="w-4 h-4 mr-2" /> Save Preferences
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
