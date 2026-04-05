/**
 * Server-side reCAPTCHA verification utility
 * Verifies reCAPTCHA tokens with Google's API
 * Implements score-based validation for v3
 */

export interface RecaptchaVerificationResult {
  success: boolean
  score?: number
  action?: string
  challenge_ts?: string
  hostname?: string
  error_codes?: string[]
}

/**
 * Verify reCAPTCHA token with Google
 * @param token - The reCAPTCHA token from client
 * @param expectedAction - Expected action name (optional)
 * @param minScore - Minimum score threshold (0.0 - 1.0, default 0.5)
 * @returns Verification result with success status and score
 */
export async function verifyRecaptcha(
  token: string,
  expectedAction?: string,
  minScore: number = 0.5
): Promise<RecaptchaVerificationResult> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY

  if (!secretKey) {
    console.error('RECAPTCHA_SECRET_KEY not configured')
    return {
      success: false,
      error_codes: ['missing-secret-key']
    }
  }

  if (!token) {
    return {
      success: false,
      error_codes: ['missing-token']
    }
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token
      })
    })

    if (!response.ok) {
      throw new Error('Failed to verify reCAPTCHA')
    }

    const data: RecaptchaVerificationResult = await response.json()

    // For v3, check score
    if (data.success && data.score !== undefined) {
      if (data.score < minScore) {
        return {
          ...data,
          success: false,
          error_codes: [...(data.error_codes || []), 'score-too-low']
        }
      }
    }

    // Check action if provided
    if (data.success && expectedAction && data.action !== expectedAction) {
      return {
        ...data,
        success: false,
        error_codes: [...(data.error_codes || []), 'action-mismatch']
      }
    }

    return data
  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error)
    return {
      success: false,
      error_codes: ['verification-failed']
    }
  }
}

/**
 * Express-like middleware for reCAPTCHA verification
 * Usage: Extract token from request body and verify before processing
 */
export async function verifyRecaptchaMiddleware(
  request: Request,
  action: string,
  minScore?: number
): Promise<{ verified: boolean; score?: number; error?: string }> {
  try {
    const body = await request.json()
    const token = body.recaptchaToken

    if (!token) {
      return {
        verified: false,
        error: 'reCAPTCHA token missing'
      }
    }

    const result = await verifyRecaptcha(token, action, minScore)

    if (!result.success) {
      return {
        verified: false,
        score: result.score,
        error: result.error_codes?.join(', ') || 'Verification failed'
      }
    }

    return {
      verified: true,
      score: result.score
    }
  } catch (error) {
    console.error('Error in reCAPTCHA middleware:', error)
    return {
      verified: false,
      error: 'Internal error during verification'
    }
  }
}
