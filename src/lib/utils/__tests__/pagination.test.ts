import {
  parsePaginationParams,
  getSupabaseRange,
  createPaginatedResponse,
  calculatePaginationMeta,
  validatePaginationParams,
  encodeCursor,
  decodeCursor,
  parseCursorPaginationParams,
  createCursorPaginationMeta,
  PAGINATION_DEFAULTS,
} from '../pagination'

describe('Pagination Utilities', () => {
  describe('parsePaginationParams', () => {
    it('should return default values when no params provided', () => {
      const searchParams = new URLSearchParams()
      const result = parsePaginationParams(searchParams)

      expect(result).toEqual({
        page: 1,
        limit: PAGINATION_DEFAULTS.defaultLimit,
        offset: 0,
      })
    })

    it('should parse valid pagination params', () => {
      const searchParams = new URLSearchParams({
        page: '3',
        limit: '50',
      })
      const result = parsePaginationParams(searchParams)

      expect(result).toEqual({
        page: 3,
        limit: 50,
        offset: 100, // (3-1) * 50
      })
    })

    it('should enforce max limit', () => {
      const searchParams = new URLSearchParams({
        limit: '99999',
      })
      const result = parsePaginationParams(searchParams)

      expect(result.limit).toBe(PAGINATION_DEFAULTS.maxLimit)
    })

    it('should enforce min limit', () => {
      const searchParams = new URLSearchParams({
        limit: '-5',
      })
      const result = parsePaginationParams(searchParams)

      expect(result.limit).toBe(PAGINATION_DEFAULTS.defaultLimit)
    })

    it('should enforce max page', () => {
      const searchParams = new URLSearchParams({
        page: '99999',
      })
      const result = parsePaginationParams(searchParams)

      expect(result.page).toBe(PAGINATION_DEFAULTS.maxPage)
    })

    it('should handle invalid page numbers', () => {
      const searchParams = new URLSearchParams({
        page: 'invalid',
      })
      const result = parsePaginationParams(searchParams)

      expect(result.page).toBe(1)
    })
  })

  describe('getSupabaseRange', () => {
    it('should calculate correct range for first page', () => {
      const [from, to] = getSupabaseRange(1, 20)
      expect(from).toBe(0)
      expect(to).toBe(19)
    })

    it('should calculate correct range for second page', () => {
      const [from, to] = getSupabaseRange(2, 20)
      expect(from).toBe(20)
      expect(to).toBe(39)
    })

    it('should calculate correct range for custom limit', () => {
      const [from, to] = getSupabaseRange(3, 50)
      expect(from).toBe(100)
      expect(to).toBe(149)
    })
  })

  describe('calculatePaginationMeta', () => {
    it('should calculate meta for first page', () => {
      const meta = calculatePaginationMeta(1, 20, 100)

      expect(meta).toEqual({
        page: 1,
        limit: 20,
        totalCount: 100,
        totalPages: 5,
        hasNextPage: true,
        hasPreviousPage: false,
        nextPage: 2,
        previousPage: null,
      })
    })

    it('should calculate meta for last page', () => {
      const meta = calculatePaginationMeta(5, 20, 100)

      expect(meta).toEqual({
        page: 5,
        limit: 20,
        totalCount: 100,
        totalPages: 5,
        hasNextPage: false,
        hasPreviousPage: true,
        nextPage: null,
        previousPage: 4,
      })
    })

    it('should handle partial last page', () => {
      const meta = calculatePaginationMeta(3, 20, 55)

      expect(meta.totalPages).toBe(3)
      expect(meta.hasNextPage).toBe(false)
    })

    it('should handle empty results', () => {
      const meta = calculatePaginationMeta(1, 20, 0)

      expect(meta.totalPages).toBe(0)
      expect(meta.hasNextPage).toBe(false)
      expect(meta.hasPreviousPage).toBe(false)
    })
  })

  describe('createPaginatedResponse', () => {
    it('should create complete paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const response = createPaginatedResponse(data, 1, 20, 100)

      expect(response).toHaveProperty('success', true)
      expect(response).toHaveProperty('data', data)
      expect(response).toHaveProperty('pagination')
      expect(response.pagination.page).toBe(1)
      expect(response.pagination.totalCount).toBe(100)
    })
  })

  describe('validatePaginationParams', () => {
    it('should not throw for valid params', () => {
      expect(() => {
        validatePaginationParams(1, 20)
      }).not.toThrow()
    })

    it('should throw for limit exceeding max', () => {
      expect(() => {
        validatePaginationParams(1, 99999)
      }).toThrow(/Limit cannot exceed/)
    })

    it('should throw for page exceeding max', () => {
      expect(() => {
        validatePaginationParams(99999, 20)
      }).toThrow(/Page number cannot exceed/)
    })

    it('should throw for negative page', () => {
      expect(() => {
        validatePaginationParams(-1, 20)
      }).toThrow(/Page number must be at least 1/)
    })

    it('should throw for zero limit', () => {
      expect(() => {
        validatePaginationParams(1, 0)
      }).toThrow(/Limit must be at least 1/)
    })
  })

  describe('Cursor Pagination', () => {
    describe('encodeCursor / decodeCursor', () => {
      it('should encode and decode cursor correctly', () => {
        const id = '123e4567-e89b-12d3-a456-426614174000'
        const timestamp = new Date('2025-01-01T00:00:00Z')

        const cursor = encodeCursor(id, timestamp)
        expect(cursor).toBeTruthy()
        expect(typeof cursor).toBe('string')

        const decoded = decodeCursor(cursor)
        expect(decoded).not.toBeNull()
        expect(decoded!.id).toBe(id)
        expect(decoded!.timestamp).toBe(timestamp.toISOString())
      })

      it('should handle string timestamp', () => {
        const id = '123e4567-e89b-12d3-a456-426614174000'
        const timestamp = '2025-01-01T00:00:00.000Z'

        const cursor = encodeCursor(id, timestamp)
        const decoded = decodeCursor(cursor)

        expect(decoded).not.toBeNull()
        expect(decoded!.timestamp).toBe(timestamp)
      })

      it('should return null for invalid cursor', () => {
        const decoded = decodeCursor('invalid-cursor')
        expect(decoded).toBeNull()
      })
    })

    describe('parseCursorPaginationParams', () => {
      it('should parse cursor pagination params', () => {
        const searchParams = new URLSearchParams({
          limit: '25',
          cursor: 'abc123',
        })

        const result = parseCursorPaginationParams(searchParams)

        expect(result).toEqual({
          limit: 25,
          cursor: 'abc123',
        })
      })

      it('should use defaults when params missing', () => {
        const searchParams = new URLSearchParams()
        const result = parseCursorPaginationParams(searchParams)

        expect(result.limit).toBe(PAGINATION_DEFAULTS.defaultLimit)
        expect(result.cursor).toBeUndefined()
      })
    })

    describe('createCursorPaginationMeta', () => {
      it('should create meta when hasMore is true', () => {
        const data = Array.from({ length: 20 }, (_, i) => ({
          id: `id-${i}`,
          created_at: new Date(2025, 0, i + 1).toISOString(),
        }))

        const meta = createCursorPaginationMeta(data, 20)

        expect(meta.hasMore).toBe(true)
        expect(meta.nextCursor).toBeTruthy()
        expect(meta.count).toBe(20)
      })

      it('should create meta when hasMore is false', () => {
        const data = Array.from({ length: 15 }, (_, i) => ({
          id: `id-${i}`,
          created_at: new Date(2025, 0, i + 1).toISOString(),
        }))

        const meta = createCursorPaginationMeta(data, 20)

        expect(meta.hasMore).toBe(false)
        expect(meta.nextCursor).toBeNull()
        expect(meta.count).toBe(15)
      })

      it('should handle empty data', () => {
        const meta = createCursorPaginationMeta([], 20)

        expect(meta.hasMore).toBe(false)
        expect(meta.nextCursor).toBeNull()
        expect(meta.count).toBe(0)
      })
    })
  })
})
