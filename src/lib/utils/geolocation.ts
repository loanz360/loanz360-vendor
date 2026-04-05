/**
 * Geolocation utility for attendance tracking
 */

export interface GeolocationCoordinates {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export interface GeolocationError {
  code: number
  message: string
}

/**
 * Get current geolocation coordinates
 */
export const getCurrentLocation = (): Promise<GeolocationCoordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        code: 0,
        message: 'Geolocation is not supported by this browser'
      })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        })
      },
      (error) => {
        let message = 'Unable to retrieve location'

        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please enable location access.'
            break
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable.'
            break
          case error.TIMEOUT:
            message = 'Location request timed out.'
            break
        }

        reject({
          code: error.code,
          message
        })
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  })
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

/**
 * Format coordinates as a location string
 */
export const formatLocation = (coords: GeolocationCoordinates): string => {
  return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
}

/**
 * Get location name from coordinates using reverse geocoding
 * Note: This requires an external API (Google Maps, OpenStreetMap, etc.)
 */
export const getLocationName = async (
  latitude: number,
  longitude: number
): Promise<string> => {
  try {
    // Using OpenStreetMap Nominatim API (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
      {
        headers: {
          'User-Agent': 'LOANZ360-Attendance-App'
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch location name')
    }

    const data = await response.json()

    // Extract relevant parts of the address
    const parts = []
    if (data.address.road) parts.push(data.address.road)
    if (data.address.suburb || data.address.neighbourhood) {
      parts.push(data.address.suburb || data.address.neighbourhood)
    }
    if (data.address.city || data.address.town) {
      parts.push(data.address.city || data.address.town)
    }

    return parts.length > 0 ? parts.join(', ') : formatLocation({ latitude, longitude, accuracy: 0, timestamp: 0 })
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    return formatLocation({ latitude, longitude, accuracy: 0, timestamp: 0 })
  }
}

/**
 * Check if user is within allowed radius of office location
 */
export const isWithinOfficeRadius = (
  userLat: number,
  userLon: number,
  officeLat: number,
  officeLon: number,
  allowedRadiusMeters: number = 200
): boolean => {
  const distance = calculateDistance(userLat, userLon, officeLat, officeLon)
  return distance <= allowedRadiusMeters
}

/**
 * Request location permission
 */
export const requestLocationPermission = async (): Promise<boolean> => {
  try {
    await getCurrentLocation()
    return true
  } catch (error) {
    return false
  }
}
