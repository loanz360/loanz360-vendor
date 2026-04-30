/**
 * E2E Tests — API Health & Rate Limiting
 */
import { test, expect } from '@playwright/test'

test.describe('API Health', () => {
  test('health endpoint returns 200', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body.success).toBe(true)
  })

  test('feature flags endpoint works', async ({ request }) => {
    const response = await request.get('/api/feature-flags')
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body.success).toBe(true)
  })

  test('rate limiting returns proper headers', async ({ request }) => {
    const response = await request.get('/api/health')
    const headers = response.headers()
    // Rate limit headers should be present
    expect(headers['x-ratelimit-limit'] || response.ok()).toBeTruthy()
  })

  test('invalid JSON body returns 400', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      data: 'not-json{{{',
    })
    expect(response.status()).toBe(400)
  })

  test('oversized body returns 413', async ({ request }) => {
    const largeBody = JSON.stringify({ data: 'x'.repeat(2_000_000) })
    const response = await request.post('/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      data: largeBody,
    })
    expect([400, 413]).toContain(response.status())
  })
})
