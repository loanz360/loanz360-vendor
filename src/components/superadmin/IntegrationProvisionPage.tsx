'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Settings, ExternalLink, Shield, Zap, type LucideIcon } from 'lucide-react'

interface IntegrationFeature {
  title: string
  description: string
  icon: LucideIcon
}

interface IntegrationProvisionPageProps {
  title: string
  description: string
  icon: LucideIcon
  status: 'planned' | 'in-development' | 'sandbox-ready' | 'live'
  provider?: string
  features: IntegrationFeature[]
  apiEndpoints?: string[]
  configFields?: { label: string; placeholder: string; type?: string }[]
}

export default function IntegrationProvisionPage({
  title,
  description,
  icon: Icon,
  status,
  provider,
  features,
  apiEndpoints = [],
  configFields = [],
}: IntegrationProvisionPageProps) {
  const statusColors = {
    'planned': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'in-development': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'sandbox-ready': 'bg-[#FF6700]/10 text-[#FF6700] border-[#FF6700]/20',
    'live': 'bg-green-500/10 text-green-400 border-green-500/20',
  }

  const statusLabels = {
    'planned': 'Planned',
    'in-development': 'In Development',
    'sandbox-ready': 'Sandbox Ready',
    'live': 'Live',
  }

  return (
    <div className="p-6 max-w-6xl mx-auto font-poppins">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#FF6700]/10 border border-[#FF6700]/20 flex items-center justify-center">
            <Icon className="w-7 h-7 text-[#FF6700]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="text-gray-400 text-sm mt-1">{description}</p>
            {provider && <p className="text-gray-500 text-xs mt-0.5">Provider: {provider}</p>}
          </div>
        </div>
        <Badge className={`${statusColors[status]} border px-3 py-1`}>
          {statusLabels[status]}
        </Badge>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {features.map((feature, i) => (
          <Card key={i} className="bg-[#171717] border-gray-800 hover:border-[#FF6700]/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <feature.icon className="w-4.5 h-4.5 text-[#FF6700]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
                  <p className="text-xs text-gray-400 mt-1">{feature.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Configuration Section */}
      {configFields.length > 0 && (
        <Card className="bg-[#171717] border-gray-800 mb-8">
          <CardHeader>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#FF6700]" /> Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {configFields.map((field, i) => (
              <div key={i}>
                <label className="text-xs font-medium text-gray-400 block mb-1.5">{field.label}</label>
                <input
                  type={field.type || 'text'}
                  placeholder={field.placeholder}
                  disabled
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-500 placeholder:text-gray-600 cursor-not-allowed"
                />
              </div>
            ))}
            <p className="text-xs text-amber-400/80 flex items-center gap-1.5 mt-2">
              <Shield className="w-3.5 h-3.5" />
              Configuration will be available when integration development begins.
            </p>
          </CardContent>
        </Card>
      )}

      {/* API Endpoints */}
      {apiEndpoints.length > 0 && (
        <Card className="bg-[#171717] border-gray-800 mb-8">
          <CardHeader>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#FF6700]" /> API Endpoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {apiEndpoints.map((endpoint, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-900 rounded-lg">
                  <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
                  <code className="text-xs text-gray-400 font-mono">{endpoint}</code>
                  <Badge className="ml-auto bg-amber-500/10 text-amber-400 border-amber-500/20 border text-[10px]">
                    Planned
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Card */}
      <Card className="bg-gradient-to-r from-[#FF6700]/5 to-transparent border-[#FF6700]/20">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#FF6700]/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#FF6700]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Integration Roadmap</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              This integration is currently in the planning phase. Development will begin as part of the third-party integration sprint.
              All API endpoints, configuration, and monitoring will be available once development is complete.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
