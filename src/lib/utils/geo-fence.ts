/**
 * Geo-Fencing Utility for Attendance Check-in
 * Provides zone-based location validation for employee check-ins
 */

import { calculateDistance } from '@/lib/utils/geolocation'

export interface GeoFenceZone {
  id: string
  name: string
  latitude: number
  longitude: number
  radius_meters: number
  type: 'office' | 'branch' | 'wfh_allowed'
}

export interface GeoFenceResult {
  isInside: boolean
  zone: GeoFenceZone | null
  distance: number
}

export interface NearestZoneResult {
  zone: GeoFenceZone
  distance: number
}

export interface CheckInValidation {
  valid: boolean
  zone_name: string | null
  distance_meters: number
  message: string
  status: 'inside' | 'nearby' | 'remote'
}

// Default office locations (can be overridden from config / database)
const DEFAULT_ZONES: GeoFenceZone[] = [
  {
    id: 'hyd-main',
    name: 'Hyderabad Office',
    latitude: 17.4401,
    longitude: 78.3489,
    radius_meters: 500,
    type: 'office',
  },
  {
    id: 'blr-main',
    name: 'Bangalore Office',
    latitude: 12.9716,
    longitude: 77.5946,
    radius_meters: 500,
    type: 'office',
  },
  {
    id: 'del-main',
    name: 'Delhi Office',
    latitude: 28.6139,
    longitude: 77.2090,
    radius_meters: 500,
    type: 'office',
  },
  {
    id: 'mum-main',
    name: 'Mumbai Office',
    latitude: 19.0760,
    longitude: 72.8777,
    radius_meters: 500,
    type: 'office',
  },
]

/**
 * Check if coordinates are within any geo-fence zone
 * Returns the first matching zone and the distance to it
 */
export function isWithinGeoFence(
  latitude: number,
  longitude: number,
  zones?: GeoFenceZone[]
): GeoFenceResult {
  const activeZones = zones && zones.length > 0 ? zones : DEFAULT_ZONES

  for (const zone of activeZones) {
    const distance = calculateDistance(latitude, longitude, zone.latitude, zone.longitude)
    if (distance <= zone.radius_meters) {
      return {
        isInside: true,
        zone,
        distance: Math.round(distance),
      }
    }
  }

  // Not inside any zone - return distance to the nearest one
  const nearest = getNearestZone(latitude, longitude, zones)
  return {
    isInside: false,
    zone: null,
    distance: nearest.distance,
  }
}

/**
 * Get the nearest geo-fence zone from the given coordinates
 */
export function getNearestZone(
  latitude: number,
  longitude: number,
  zones?: GeoFenceZone[]
): NearestZoneResult {
  const activeZones = zones && zones.length > 0 ? zones : DEFAULT_ZONES

  let nearestZone = activeZones[0]
  let minDistance = Infinity

  for (const zone of activeZones) {
    const distance = calculateDistance(latitude, longitude, zone.latitude, zone.longitude)
    if (distance < minDistance) {
      minDistance = distance
      nearestZone = zone
    }
  }

  return {
    zone: nearestZone,
    distance: Math.round(minDistance),
  }
}

/**
 * Validate a check-in location against all geo-fence zones
 * Returns a structured result with status, zone info, and a human-readable message
 */
export function validateCheckInLocation(
  latitude: number,
  longitude: number,
  zones?: GeoFenceZone[]
): CheckInValidation {
  const result = isWithinGeoFence(latitude, longitude, zones)

  // Inside an office zone
  if (result.isInside && result.zone) {
    return {
      valid: true,
      zone_name: result.zone.name,
      distance_meters: result.distance,
      message: `Check-in from ${result.zone.name} (${result.distance}m away)`,
      status: 'inside',
    }
  }

  // Outside all zones - find nearest for context
  const nearest = getNearestZone(latitude, longitude, zones)
  const NEARBY_THRESHOLD = 1000 // 1km

  if (nearest.distance <= NEARBY_THRESHOLD) {
    // Within 1km of an office - nearby
    return {
      valid: true,
      zone_name: nearest.zone.name,
      distance_meters: nearest.distance,
      message: `You are ${nearest.distance}m from ${nearest.zone.name}. Outside geo-fence (${nearest.zone.radius_meters}m radius).`,
      status: 'nearby',
    }
  }

  // Completely remote
  const distanceKm = (nearest.distance / 1000).toFixed(1)
  return {
    valid: true, // Allow remote check-in but flag it
    zone_name: null,
    distance_meters: nearest.distance,
    message: `Remote check-in. Nearest office: ${nearest.zone.name} (${distanceKm}km away)`,
    status: 'remote',
  }
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}

/**
 * Get all default zones (for displaying on a map or in settings)
 */
export function getDefaultZones(): GeoFenceZone[] {
  return [...DEFAULT_ZONES]
}
