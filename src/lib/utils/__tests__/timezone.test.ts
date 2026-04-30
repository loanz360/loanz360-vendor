/**
 * Unit Tests for Timezone Utilities
 */

import {
  utcToUserTimezone,
  userTimezoneToUtc,
  formatInUserTimezone,
  getDaysRemaining,
  getHoursRemaining,
  getContestStatusWithTimezone,
  isDateInPast,
  isDateInFuture,
  isValidTimezone,
  getBrowserTimezone,
  DEFAULT_TIMEZONE,
} from '../timezone'

describe('Timezone Utilities', () => {
  describe('utcToUserTimezone', () => {
    it('should convert UTC date to IST timezone', () => {
      const utcDate = new Date('2025-03-01T00:00:00Z')
      const istDate = utcToUserTimezone(utcDate, 'Asia/Kolkata')

      expect(istDate).toBeInstanceOf(Date)
      // IST is UTC+5:30, so 00:00 UTC = 05:30 IST
      expect(istDate.getHours()).toBe(5)
      expect(istDate.getMinutes()).toBe(30)
    })

    it('should handle string dates', () => {
      const utcDateString = '2025-03-01T00:00:00Z'
      const istDate = utcToUserTimezone(utcDateString, 'Asia/Kolkata')

      expect(istDate).toBeInstanceOf(Date)
      expect(istDate.getHours()).toBe(5)
    })

    it('should use default timezone when not specified', () => {
      const utcDate = new Date('2025-03-01T00:00:00Z')
      const result = utcToUserTimezone(utcDate)

      expect(result).toBeInstanceOf(Date)
    })

    it('should handle invalid dates gracefully', () => {
      const invalidDate = 'not-a-date'
      const result = utcToUserTimezone(invalidDate)

      expect(result).toBeInstanceOf(Date)
    })
  })

  describe('userTimezoneToUtc', () => {
    it('should convert IST date to UTC', () => {
      // Create a date that represents 05:30 IST
      const istDate = new Date('2025-03-01T05:30:00+05:30')
      const utcDate = userTimezoneToUtc(istDate, 'Asia/Kolkata')

      expect(utcDate).toBeInstanceOf(Date)
      // Should convert back to 00:00 UTC
      expect(utcDate.getUTCHours()).toBe(0)
      expect(utcDate.getUTCMinutes()).toBe(0)
    })

    it('should handle string dates', () => {
      const istDateString = '2025-03-01T05:30:00+05:30'
      const utcDate = userTimezoneToUtc(istDateString, 'Asia/Kolkata')

      expect(utcDate).toBeInstanceOf(Date)
    })
  })

  describe('formatInUserTimezone', () => {
    it('should format date in specified timezone', () => {
      const date = new Date('2025-03-01T00:00:00Z')
      const formatted = formatInUserTimezone(date, 'PPP', 'Asia/Kolkata')

      expect(formatted).toContain('March')
      expect(formatted).toContain('2025')
    })

    it('should use default format when not specified', () => {
      const date = new Date('2025-03-01T00:00:00Z')
      const formatted = formatInUserTimezone(date, undefined, 'Asia/Kolkata')

      expect(formatted).toBeTruthy()
      expect(typeof formatted).toBe('string')
    })

    it('should handle invalid dates', () => {
      const invalidDate = 'invalid'
      const formatted = formatInUserTimezone(invalidDate)

      expect(formatted).toBe('Invalid date')
    })
  })

  describe('getDaysRemaining', () => {
    it('should calculate days remaining correctly', () => {
      const now = new Date()
      const futureDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000) // 5 days from now

      const daysRemaining = getDaysRemaining(futureDate)

      expect(daysRemaining).toBeGreaterThanOrEqual(4)
      expect(daysRemaining).toBeLessThanOrEqual(5)
    })

    it('should return 0 for past dates', () => {
      const pastDate = new Date('2020-01-01T00:00:00Z')
      const daysRemaining = getDaysRemaining(pastDate)

      expect(daysRemaining).toBe(0)
    })
  })

  describe('getHoursRemaining', () => {
    it('should calculate hours remaining correctly', () => {
      const now = new Date()
      const futureDate = new Date(now.getTime() + 10 * 60 * 60 * 1000) // 10 hours from now

      const hoursRemaining = getHoursRemaining(futureDate)

      expect(hoursRemaining).toBeGreaterThanOrEqual(9)
      expect(hoursRemaining).toBeLessThanOrEqual(10)
    })

    it('should return 0 for past dates', () => {
      const pastDate = new Date('2020-01-01T00:00:00Z')
      const hoursRemaining = getHoursRemaining(pastDate)

      expect(hoursRemaining).toBe(0)
    })
  })

  describe('getContestStatusWithTimezone', () => {
    it('should return "upcoming" for future contests', () => {
      const now = new Date()
      const startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) // 14 days from now

      const status = getContestStatusWithTimezone(startDate, endDate)

      expect(status.status).toBe('upcoming')
      expect(status.message).toContain('Starts in')
      expect(status.daysRemaining).toBeGreaterThanOrEqual(6)
    })

    it('should return "active" for ongoing contests', () => {
      const now = new Date()
      const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

      const status = getContestStatusWithTimezone(startDate, endDate)

      expect(status.status).toBe('active')
      expect(status.message).toContain('remaining')
      expect(status.daysRemaining).toBeGreaterThanOrEqual(6)
    })

    it('should return "ended" for past contests', () => {
      const startDate = new Date('2020-01-01T00:00:00Z')
      const endDate = new Date('2020-01-31T23:59:59Z')

      const status = getContestStatusWithTimezone(startDate, endDate)

      expect(status.status).toBe('ended')
      expect(status.message).toBe('Contest ended')
      expect(status.daysRemaining).toBeUndefined()
    })
  })

  describe('isDateInPast', () => {
    it('should return true for past dates', () => {
      const pastDate = new Date('2020-01-01T00:00:00Z')
      const result = isDateInPast(pastDate)

      expect(result).toBe(true)
    })

    it('should return false for future dates', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const result = isDateInPast(futureDate)

      expect(result).toBe(false)
    })
  })

  describe('isDateInFuture', () => {
    it('should return true for future dates', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const result = isDateInFuture(futureDate)

      expect(result).toBe(true)
    })

    it('should return false for past dates', () => {
      const pastDate = new Date('2020-01-01T00:00:00Z')
      const result = isDateInFuture(pastDate)

      expect(result).toBe(false)
    })
  })

  describe('isValidTimezone', () => {
    it('should return true for valid timezones', () => {
      expect(isValidTimezone('Asia/Kolkata')).toBe(true)
      expect(isValidTimezone('America/New_York')).toBe(true)
      expect(isValidTimezone('UTC')).toBe(true)
    })

    it('should return false for invalid timezones', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false)
      expect(isValidTimezone('Not_A_Timezone')).toBe(false)
    })
  })

  describe('getBrowserTimezone', () => {
    it('should return a timezone string', () => {
      const timezone = getBrowserTimezone()

      expect(typeof timezone).toBe('string')
      expect(timezone.length).toBeGreaterThan(0)
    })

    it('should return default timezone on error', () => {
      // Mock Intl to throw an error
      const originalIntl = global.Intl
      delete (global as unknown).Intl

      const timezone = getBrowserTimezone()

      expect(timezone).toBe(DEFAULT_TIMEZONE)

      // Restore Intl
      global.Intl = originalIntl
    })
  })
})
