/**
 * Async Lock/Mutex Implementation
 * Prevents race conditions in concurrent async operations
 */

export class AsyncLock {
  private locked = false
  private waitQueue: Array<() => void> = []

  /**
   * Acquire the lock
   * Returns a promise that resolves when lock is acquired
   */
  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true
        resolve()
      } else {
        this.waitQueue.push(resolve)
      }
    })
  }

  /**
   * Release the lock
   * Allows next waiting operation to proceed
   */
  release(): void {
    const nextResolve = this.waitQueue.shift()
    if (nextResolve) {
      nextResolve()
    } else {
      this.locked = false
    }
  }

  /**
   * Execute a function with lock protection
   * Automatically acquires and releases lock
   */
  async synchronized<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }

  /**
   * Check if lock is currently held
   */
  isLocked(): boolean {
    return this.locked
  }

  /**
   * Get number of waiting operations
   */
  getQueueLength(): number {
    return this.waitQueue.length
  }
}

/**
 * Lock with timeout support
 */
export class AsyncLockWithTimeout extends AsyncLock {
  /**
   * Acquire lock with timeout
   * Throws error if lock cannot be acquired within timeout
   */
  async acquireWithTimeout(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Lock acquisition timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      super.acquire().then(() => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  /**
   * Execute function with lock and timeout
   */
  async synchronizedWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    await this.acquireWithTimeout(timeoutMs)
    try {
      return await fn()
    } finally {
      this.release()
    }
  }
}

/**
 * Named lock manager for multiple resources
 */
export class LockManager {
  private locks = new Map<string, AsyncLock>()

  /**
   * Get or create lock for resource
   */
  private getLock(resource: string): AsyncLock {
    if (!this.locks.has(resource)) {
      this.locks.set(resource, new AsyncLock())
    }
    return this.locks.get(resource)!
  }

  /**
   * Acquire lock for named resource
   */
  async acquire(resource: string): Promise<void> {
    const lock = this.getLock(resource)
    await lock.acquire()
  }

  /**
   * Release lock for named resource
   */
  release(resource: string): void {
    const lock = this.locks.get(resource)
    if (lock) {
      lock.release()
    }
  }

  /**
   * Execute function with named lock
   */
  async synchronized<T>(resource: string, fn: () => Promise<T>): Promise<T> {
    const lock = this.getLock(resource)
    return lock.synchronized(fn)
  }

  /**
   * Check if resource is locked
   */
  isLocked(resource: string): boolean {
    const lock = this.locks.get(resource)
    return lock ? lock.isLocked() : false
  }

  /**
   * Get all locked resources
   */
  getLockedResources(): string[] {
    const locked: string[] = []
    for (const [resource, lock] of this.locks.entries()) {
      if (lock.isLocked()) {
        locked.push(resource)
      }
    }
    return locked
  }

  /**
   * Clear all locks (use with caution)
   */
  clear(): void {
    this.locks.clear()
  }
}

// Export singleton instance for global use
export const globalLockManager = new LockManager()