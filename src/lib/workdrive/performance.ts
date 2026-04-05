/**
 * WorkDrive Performance Monitoring
 * Track and optimize performance metrics
 */

// Performance timing interface
interface PerformanceMetric {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
}

// Metrics storage
const metrics: PerformanceMetric[] = []
const MAX_METRICS = 1000

// Start a performance measurement
export function startMeasure(name: string, metadata?: Record<string, any>): () => number {
  const metric: PerformanceMetric = {
    name,
    startTime: Date.now(),
    metadata,
  }

  return () => {
    metric.endTime = Date.now()
    metric.duration = metric.endTime - metric.startTime

    // Store metric (with size limit)
    if (metrics.length >= MAX_METRICS) {
      metrics.shift()
    }
    metrics.push(metric)

    return metric.duration
  }
}

// Measure async function execution time
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const endMeasure = startMeasure(name, metadata)
  try {
    const result = await fn()
    endMeasure()
    return result
  } catch (error) {
    endMeasure()
    throw error
  }
}

// Get performance statistics
export function getPerformanceStats(filter?: {
  name?: string
  minDuration?: number
  since?: number
}): {
  count: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  p50: number
  p95: number
  p99: number
} {
  let filteredMetrics = metrics.filter(m => m.duration !== undefined)

  if (filter?.name) {
    filteredMetrics = filteredMetrics.filter(m => m.name.includes(filter.name))
  }

  if (filter?.minDuration) {
    filteredMetrics = filteredMetrics.filter(m => (m.duration || 0) >= filter.minDuration)
  }

  if (filter?.since) {
    filteredMetrics = filteredMetrics.filter(m => m.startTime >= filter.since)
  }

  if (filteredMetrics.length === 0) {
    return {
      count: 0,
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    }
  }

  const durations = filteredMetrics.map(m => m.duration || 0).sort((a, b) => a - b)
  const sum = durations.reduce((a, b) => a + b, 0)

  return {
    count: durations.length,
    avgDuration: sum / durations.length,
    minDuration: durations[0],
    maxDuration: durations[durations.length - 1],
    p50: durations[Math.floor(durations.length * 0.5)],
    p95: durations[Math.floor(durations.length * 0.95)],
    p99: durations[Math.floor(durations.length * 0.99)],
  }
}

// Clear metrics
export function clearMetrics(): void {
  metrics.length = 0
}

// Upload optimization settings
export interface UploadOptimizationConfig {
  chunkSize: number
  maxConcurrentUploads: number
  useWebWorker: boolean
  compressImages: boolean
  maxImageDimension: number
  imageQuality: number
}

export const defaultUploadConfig: UploadOptimizationConfig = {
  chunkSize: 5 * 1024 * 1024, // 5 MB
  maxConcurrentUploads: 3,
  useWebWorker: true,
  compressImages: true,
  maxImageDimension: 2048,
  imageQuality: 0.85,
}

// Calculate optimal chunk size based on connection speed
export function calculateOptimalChunkSize(
  connectionSpeed: number // in bytes per second
): number {
  // Target 5-10 seconds per chunk
  const targetDuration = 7 * 1000 // 7 seconds
  const optimalSize = connectionSpeed * (targetDuration / 1000)

  // Clamp between 1 MB and 50 MB
  const minChunkSize = 1 * 1024 * 1024
  const maxChunkSize = 50 * 1024 * 1024

  return Math.max(minChunkSize, Math.min(maxChunkSize, optimalSize))
}

// Connection speed estimator
export async function estimateConnectionSpeed(): Promise<number> {
  try {
    const testSize = 100 * 1024 // 100 KB test
    const startTime = Date.now()

    // Use a small API request to estimate speed
    const response = await fetch('/api/workdrive/health', {
      cache: 'no-store',
    })
    await response.text()

    const duration = Date.now() - startTime
    const estimatedSize = testSize // Rough estimate

    // Calculate bytes per second
    const speed = (estimatedSize / duration) * 1000

    // Apply a conservative multiplier since actual uploads may be slower
    return speed * 0.7
  } catch {
    // Intentionally empty: connection speed estimation is optional, return conservative default (1 MB/s)
    return 1 * 1024 * 1024
  }
}

// Image compression utility
export async function compressImage(
  file: File,
  config: {
    maxDimension: number
    quality: number
  }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = () => {
      let { width, height } = img

      // Scale down if needed
      if (width > config.maxDimension || height > config.maxDimension) {
        if (width > height) {
          height = (height / width) * config.maxDimension
          width = config.maxDimension
        } else {
          width = (width / height) * config.maxDimension
          height = config.maxDimension
        }
      }

      canvas.width = width
      canvas.height = height
      ctx?.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to compress image'))
          }
        },
        file.type,
        config.quality
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

// Lazy loading helper for file lists
export function createIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') {
    return null
  }

  return new IntersectionObserver(callback, {
    root: null,
    rootMargin: '100px',
    threshold: 0.1,
    ...options,
  })
}

// Debounce utility for search and filters
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// Throttle utility for scroll and resize handlers
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

// Request batching for multiple file metadata fetches
export class RequestBatcher<T, R> {
  private queue: { key: T; resolve: (value: R) => void; reject: (error: any) => void }[] = []
  private timeout: NodeJS.Timeout | null = null

  constructor(
    private batchFn: (keys: T[]) => Promise<Map<T, R>>,
    private delay: number = 50,
    private maxBatchSize: number = 50
  ) {}

  async get(key: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ key, resolve, reject })

      if (this.queue.length >= this.maxBatchSize) {
        this.flush()
      } else if (!this.timeout) {
        this.timeout = setTimeout(() => this.flush(), this.delay)
      }
    })
  }

  private async flush(): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }

    const batch = this.queue.splice(0, this.maxBatchSize)
    if (batch.length === 0) return

    try {
      const keys = batch.map(item => item.key)
      const results = await this.batchFn(keys)

      batch.forEach(item => {
        const result = results.get(item.key)
        if (result !== undefined) {
          item.resolve(result)
        } else {
          item.reject(new Error(`No result for key: ${item.key}`))
        }
      })
    } catch (error) {
      batch.forEach(item => item.reject(error))
    }
  }
}

export default {
  startMeasure,
  measureAsync,
  getPerformanceStats,
  clearMetrics,
  defaultUploadConfig,
  calculateOptimalChunkSize,
  estimateConnectionSpeed,
  compressImage,
  createIntersectionObserver,
  debounce,
  throttle,
  RequestBatcher,
}
