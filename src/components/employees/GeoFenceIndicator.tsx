'use client'

import React, { useMemo } from 'react'
import { MapPin, Loader2, Navigation, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { validateCheckInLocation, formatDistance } from '@/lib/utils/geo-fence'

interface GeoFenceIndicatorProps {
  latitude: number | null
  longitude: number | null
  loading?: boolean
}

type GeoStatus = 'inside' | 'nearby' | 'remote' | 'unknown'

const STATUS_CONFIG: Record<GeoStatus, {
  bgClass: string
  borderClass: string
  textClass: string
  dotClass: string
  icon: React.ElementType
  label: string
}> = {
  inside: {
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    textClass: 'text-emerald-400',
    dotClass: 'bg-emerald-500',
    icon: CheckCircle2,
    label: 'Inside Office Zone',
  },
  nearby: {
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/30',
    textClass: 'text-orange-400',
    dotClass: 'bg-orange-500',
    icon: Navigation,
    label: 'Near Office Zone',
  },
  remote: {
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    textClass: 'text-red-400',
    dotClass: 'bg-red-500',
    icon: AlertTriangle,
    label: 'Remote Check-in',
  },
  unknown: {
    bgClass: 'bg-gray-500/10',
    borderClass: 'border-gray-500/30',
    textClass: 'text-gray-400',
    dotClass: 'bg-gray-500',
    icon: MapPin,
    label: 'Location unavailable',
  },
}

export default function GeoFenceIndicator({ latitude, longitude, loading }: GeoFenceIndicatorProps) {
  const validation = useMemo(() => {
    if (latitude == null || longitude == null) return null
    return validateCheckInLocation(latitude, longitude)
  }, [latitude, longitude])

  const status: GeoStatus = validation?.status ?? 'unknown'
  const config = STATUS_CONFIG[status]
  const StatusIcon = config.icon

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 border border-white/10">
        <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
        <span className="text-xs text-gray-400">Detecting location...</span>
      </div>
    )
  }

  return (
    <div className="group relative">
      {/* Main indicator */}
      <div
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all ${config.bgClass} ${config.borderClass}`}
      >
        {/* Pulsing dot */}
        <div className="relative flex items-center justify-center">
          <span className={`absolute inline-flex h-3 w-3 rounded-full opacity-40 animate-ping ${config.dotClass}`} />
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${config.dotClass}`} />
        </div>

        {/* Icon + status */}
        <StatusIcon className={`w-4 h-4 ${config.textClass}`} />
        <div className="flex flex-col">
          <span className={`text-xs font-medium ${config.textClass}`}>
            {validation ? (validation.zone_name || config.label) : config.label}
          </span>
          {validation && (
            <span className="text-[10px] text-gray-500">
              {status === 'inside'
                ? `${formatDistance(validation.distance_meters)} from center`
                : status === 'nearby'
                  ? `${formatDistance(validation.distance_meters)} away`
                  : status === 'remote'
                    ? 'Outside all zones'
                    : ''
              }
            </span>
          )}
        </div>

        {/* Map pin icon */}
        <MapPin className={`w-3.5 h-3.5 ml-auto ${config.textClass} opacity-50`} />
      </div>

      {/* Tooltip on hover */}
      <div
        className="absolute left-0 bottom-full mb-2 z-50 hidden group-hover:block w-64"
        role="tooltip"
      >
        <div className="bg-gray-900 border border-white/10 rounded-lg p-3 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className={`w-4 h-4 ${config.textClass}`} />
            <span className="text-xs font-semibold text-white">Geo-Fence Status</span>
          </div>
          <div className="space-y-1.5 text-[11px] text-gray-400">
            {latitude != null && longitude != null ? (
              <>
                <div className="flex justify-between">
                  <span>Coordinates</span>
                  <span className="text-gray-300 font-mono">
                    {latitude.toFixed(4)}, {longitude.toFixed(4)}
                  </span>
                </div>
                {validation && (
                  <>
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className={config.textClass}>{config.label}</span>
                    </div>
                    {validation.zone_name && (
                      <div className="flex justify-between">
                        <span>Zone</span>
                        <span className="text-gray-300">{validation.zone_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Distance</span>
                      <span className="text-gray-300">{formatDistance(validation.distance_meters)}</span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p>Location not available. Enable GPS to see geo-fence status.</p>
            )}
          </div>
          {/* Tooltip arrow */}
          <div className="absolute left-4 bottom-0 translate-y-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900" />
        </div>
      </div>
    </div>
  )
}
