/**
 * Applicant Profile Module
 * Consolidates customer identity and personal information
 */

import type { ApplicantProfile, Address } from '../types'

interface IdentityVerificationResult {
  pan?: {
    number: string
    name: string
    status: string
    verified: boolean
  }
  aadhaar?: {
    last_4: string
    name: string
    dob: string
    address: unknown    verified: boolean
  }
  digilocker?: {
    connected: boolean
    documents: string[]
  }
}

interface CustomerData {
  name: string
  mobile: string
  email?: string
  dob?: string
  gender?: string
  marital_status?: string
  pan?: string
  alternate_mobile?: string
  address?: unknown}

export class ApplicantProfileModule {
  /**
   * Build applicant profile from customer data and verification results
   */
  build(
    customerData: CustomerData,
    verificationResults?: IdentityVerificationResult
  ): ApplicantProfile {
    // Calculate age from DOB
    const age = this.calculateAge(customerData.dob || verificationResults?.aadhaar?.dob)

    // Build current address
    const currentAddress = this.buildAddress(
      customerData.address,
      verificationResults?.aadhaar?.address
    )

    // Determine KYC status
    const panVerified = verificationResults?.pan?.verified || false
    const aadhaarVerified = verificationResults?.aadhaar?.verified || false
    const addressVerified = aadhaarVerified // Address verified through Aadhaar

    const kycCompletionPercent = this.calculateKYCCompletion({
      panVerified,
      aadhaarVerified,
      addressVerified,
      emailProvided: !!customerData.email,
      mobileProvided: !!customerData.mobile,
    })

    const kycStatus = this.determineKYCStatus(kycCompletionPercent)

    // Calculate name match score
    const nameMatchScore = this.calculateNameMatchScore(
      customerData.name,
      verificationResults?.pan?.name,
      verificationResults?.aadhaar?.name
    )

    return {
      // Personal Details
      name: customerData.name,
      dob: customerData.dob || verificationResults?.aadhaar?.dob || null,
      age,
      gender: this.normalizeGender(customerData.gender),
      marital_status: this.normalizeMaritalStatus(customerData.marital_status),

      // Contact
      mobile: customerData.mobile,
      alternate_mobile: customerData.alternate_mobile || null,
      email: customerData.email || null,

      // Identity
      pan: customerData.pan || verificationResults?.pan?.number || null,
      pan_verified: panVerified,
      aadhaar_last_4: verificationResults?.aadhaar?.last_4 || null,
      aadhaar_verified: aadhaarVerified,

      // Address
      current_address: currentAddress,
      permanent_address: currentAddress, // Same as current for now
      address_verified: addressVerified,

      // DigiLocker
      digilocker_connected: verificationResults?.digilocker?.connected || false,
      digilocker_documents: verificationResults?.digilocker?.documents || [],

      // KYC Status
      kyc_status: kycStatus,
      kyc_completion_percent: kycCompletionPercent,

      // Identity Verification Summary
      identity_verification: {
        pan_status: this.getVerificationStatus(verificationResults?.pan),
        aadhaar_status: this.getVerificationStatus(verificationResults?.aadhaar),
        name_match_score: nameMatchScore,
        dob_match: this.checkDOBMatch(customerData.dob, verificationResults?.aadhaar?.dob),
        photo_match: false, // Would need face match integration
      },
    }
  }

  private calculateAge(dob: string | undefined | null): number | null {
    if (!dob) return null

    try {
      const birthDate = new Date(dob)
      const today = new Date()
      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }

      return age
    } catch {
      return null
    }
  }

  private buildAddress(customerAddress: unknown, aadhaarAddress: unknown): Address | null {
    const addr = customerAddress || aadhaarAddress

    if (!addr) return null

    return {
      line1: addr.line1 || addr.address_line_1 || addr.street || '',
      line2: addr.line2 || addr.address_line_2 || addr.landmark || null,
      city: addr.city || addr.district || '',
      state: addr.state || '',
      pincode: addr.pincode || addr.pin || '',
      country: addr.country || 'India',
      type: this.normalizeAddressType(addr.type),
      years_at_address: addr.years_at_address || null,
    }
  }

  private normalizeAddressType(type: string | undefined): Address['type'] {
    if (!type) return 'OTHER'

    const normalized = type.toUpperCase().replace(/[^A-Z]/g, '_')

    if (normalized.includes('OWN')) return 'OWNED'
    if (normalized.includes('RENT')) return 'RENTED'
    if (normalized.includes('COMPANY')) return 'COMPANY_PROVIDED'
    if (normalized.includes('FAMILY') || normalized.includes('PARENT')) return 'FAMILY'

    return 'OTHER'
  }

  private normalizeGender(gender: string | undefined): ApplicantProfile['gender'] {
    if (!gender) return null

    const g = gender.toUpperCase()
    if (g === 'M' || g === 'MALE') return 'MALE'
    if (g === 'F' || g === 'FEMALE') return 'FEMALE'
    return 'OTHER'
  }

  private normalizeMaritalStatus(status: string | undefined): ApplicantProfile['marital_status'] {
    if (!status) return null

    const s = status.toUpperCase()
    if (s.includes('SINGLE') || s.includes('UNMARRIED')) return 'SINGLE'
    if (s.includes('MARRIED')) return 'MARRIED'
    if (s.includes('DIVORCE')) return 'DIVORCED'
    if (s.includes('WIDOW')) return 'WIDOWED'

    return null
  }

  private calculateKYCCompletion(checks: {
    panVerified: boolean
    aadhaarVerified: boolean
    addressVerified: boolean
    emailProvided: boolean
    mobileProvided: boolean
  }): number {
    const weights = {
      pan: 30,
      aadhaar: 30,
      address: 20,
      email: 10,
      mobile: 10,
    }

    let score = 0
    if (checks.panVerified) score += weights.pan
    if (checks.aadhaarVerified) score += weights.aadhaar
    if (checks.addressVerified) score += weights.address
    if (checks.emailProvided) score += weights.email
    if (checks.mobileProvided) score += weights.mobile

    return score
  }

  private determineKYCStatus(completionPercent: number): ApplicantProfile['kyc_status'] {
    if (completionPercent >= 80) return 'COMPLETE'
    if (completionPercent >= 50) return 'PARTIAL'
    return 'PENDING'
  }

  private getVerificationStatus(result: Record<string, unknown>): 'VERIFIED' | 'PENDING' | 'FAILED' | 'NOT_AVAILABLE' {
    if (!result) return 'NOT_AVAILABLE'
    if (result.verified) return 'VERIFIED'
    if (result.status === 'FAILED') return 'FAILED'
    return 'PENDING'
  }

  private calculateNameMatchScore(
    customerName: string,
    panName?: string,
    aadhaarName?: string
  ): number {
    if (!customerName) return 0

    const normalizedCustomer = this.normalizeName(customerName)
    let maxScore = 0

    if (panName) {
      const panScore = this.fuzzyNameMatch(normalizedCustomer, this.normalizeName(panName))
      maxScore = Math.max(maxScore, panScore)
    }

    if (aadhaarName) {
      const aadhaarScore = this.fuzzyNameMatch(normalizedCustomer, this.normalizeName(aadhaarName))
      maxScore = Math.max(maxScore, aadhaarScore)
    }

    return maxScore
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private fuzzyNameMatch(name1: string, name2: string): number {
    if (name1 === name2) return 100

    const words1 = name1.split(' ')
    const words2 = name2.split(' ')

    let matchedWords = 0
    for (const w1 of words1) {
      if (words2.some(w2 => w1 === w2 || this.levenshteinSimilarity(w1, w2) > 0.8)) {
        matchedWords++
      }
    }

    return Math.round((matchedWords / Math.max(words1.length, words2.length)) * 100)
  }

  private levenshteinSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2
    const shorter = s1.length > s2.length ? s2 : s1

    if (longer.length === 0) return 1.0

    const distance = this.levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = []

    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j
        } else if (j > 0) {
          let newValue = costs[j - 1]
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
          }
          costs[j - 1] = lastValue
          lastValue = newValue
        }
      }
      if (i > 0) costs[s2.length] = lastValue
    }

    return costs[s2.length]
  }

  private checkDOBMatch(customerDOB?: string, verifiedDOB?: string): boolean {
    if (!customerDOB || !verifiedDOB) return false

    try {
      const d1 = new Date(customerDOB).toISOString().split('T')[0]
      const d2 = new Date(verifiedDOB).toISOString().split('T')[0]
      return d1 === d2
    } catch {
      return false
    }
  }
}

export const applicantProfileModule = new ApplicantProfileModule()
