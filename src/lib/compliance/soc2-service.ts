/**
 * SOC 2 Compliance Service
 * Implements SOC 2 Trust Service Criteria controls and testing framework
 *
 * Trust Service Criteria (TSC):
 * - CC6: Security - Logical and physical access controls, encryption
 * - CC7: Availability - Monitoring, incident response, capacity
 * - CC8: Processing Integrity - Data validation, error handling
 * - CC9: Confidentiality - Data classification, DLP
 * - CC10: Privacy - Consent management, data subject rights
 */

import { createClient } from '@/lib/supabase/client'

// ==================== TYPES ====================

export type TrustServiceCategory = 'security' | 'availability' | 'processing_integrity' | 'confidentiality' | 'privacy'

export type ControlType = 'preventive' | 'detective' | 'corrective'

export type ControlFrequency = 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'

export type TestResult = 'pass' | 'fail' | 'not_applicable' | 'not_tested'

export type VendorRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface SOC2Control {
  id: string
  control_id: string // e.g., 'CC6.1', 'CC7.2'
  control_name: string
  trust_service_category: TrustServiceCategory
  control_objective: string
  control_description?: string
  control_type: ControlType
  control_frequency: ControlFrequency
  control_owner?: string
  is_implemented: boolean
  implementation_date?: string
  implementation_notes?: string
  evidence_requirements?: string[]
  created_at: string
  updated_at: string
}

export interface ControlTest {
  id: string
  control_id: string
  test_date: string
  test_procedure: string
  test_result: TestResult
  tester_name: string
  sample_size?: number
  exceptions_found: number
  exception_details?: string
  evidence_file_paths?: string[]
  remediation_required: boolean
  remediation_notes?: string
  next_test_date?: string
  created_at: string
  updated_at: string
}

export interface VendorRiskAssessment {
  id: string
  vendor_name: string
  vendor_type: string // 'cloud_provider', 'saas', 'payment_processor', etc.
  services_provided: string[]
  data_shared: string[]
  contract_start_date?: string
  contract_end_date?: string
  inherent_risk_score: number // 1-100
  residual_risk_score: number // 1-100
  risk_level: VendorRiskLevel
  has_soc2_report: boolean
  soc2_report_date?: string
  soc2_report_type?: '1' | '2'
  has_iso27001: boolean
  iso27001_expiry?: string
  security_questionnaire_completed: boolean
  questionnaire_score?: number
  last_review_date?: string
  next_review_date?: string
  approval_status: 'pending' | 'approved' | 'rejected' | 'renewal_required'
  approved_by?: string
  created_at: string
  updated_at: string
}

// ==================== SOC 2 CONTROLS SERVICE ====================

export class SOC2Service {
  private supabase = createClient()

  // ==================== CONTROL MANAGEMENT ====================

  /**
   * Get all SOC 2 controls
   */
  async getControls(filters?: {
    trust_service_category?: TrustServiceCategory
    is_implemented?: boolean
    control_owner?: string
  }): Promise<SOC2Control[]> {
    try {
      let query = this.supabase
        .from('soc2_controls')
        .select('*')
        .order('control_id', { ascending: true })

      if (filters?.trust_service_category) {
        query = query.eq('trust_service_category', filters.trust_service_category)
      }

      if (filters?.is_implemented !== undefined) {
        query = query.eq('is_implemented', filters.is_implemented)
      }

      if (filters?.control_owner) {
        query = query.eq('control_owner', filters.control_owner)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching SOC2 controls:', error)
      return []
    }
  }

  /**
   * Get control by ID
   */
  async getControl(controlId: string): Promise<SOC2Control | null> {
    try {
      const { data, error } = await this.supabase
        .from('soc2_controls')
        .select('*')
        .eq('id', controlId)
        .maybeSingle()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching control:', error)
      return null
    }
  }

  /**
   * Update control implementation status
   */
  async updateControlImplementation(
    controlId: string,
    data: {
      is_implemented: boolean
      implementation_date?: string
      implementation_notes?: string
      control_owner?: string
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('soc2_controls')
        .update(data)
        .eq('id', controlId)

      if (error) throw error
      return { success: true }
    } catch (error: unknown) {
      console.error('Error updating control:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get control implementation statistics
   */
  async getControlStats(): Promise<{
    total_controls: number
    implemented: number
    not_implemented: number
    implementation_percentage: number
    by_category: Record<TrustServiceCategory, { total: number; implemented: number }>
  }> {
    try {
      const { data: controls } = await this.supabase
        .from('soc2_controls')
        .select('trust_service_category, is_implemented')

      if (!controls) {
        return {
          total_controls: 0,
          implemented: 0,
          not_implemented: 0,
          implementation_percentage: 0,
          by_category: {} as any
        }
      }

      const total = controls.length
      const implemented = controls.filter(c => c.is_implemented).length
      const notImplemented = total - implemented

      const byCategory = controls.reduce((acc, control) => {
        const cat = control.trust_service_category
        if (!acc[cat]) {
          acc[cat] = { total: 0, implemented: 0 }
        }
        acc[cat].total++
        if (control.is_implemented) {
          acc[cat].implemented++
        }
        return acc
      }, {} as Record<TrustServiceCategory, { total: number; implemented: number }>)

      return {
        total_controls: total,
        implemented,
        not_implemented: notImplemented,
        implementation_percentage: total > 0 ? (implemented / total) * 100 : 0,
        by_category: byCategory
      }
    } catch (error) {
      console.error('Error fetching control stats:', error)
      return {
        total_controls: 0,
        implemented: 0,
        not_implemented: 0,
        implementation_percentage: 0,
        by_category: {} as any
      }
    }
  }

  // ==================== CONTROL TESTING ====================

  /**
   * Record a control test
   */
  async recordControlTest(data: Omit<ControlTest, 'id' | 'created_at' | 'updated_at'>): Promise<{
    success: boolean
    test_id?: string
    error?: string
  }> {
    try {
      const { data: test, error } = await this.supabase
        .from('soc2_control_tests')
        .insert(data)
        .select()
        .maybeSingle()

      if (error) throw error
      return { success: true, test_id: test.id }
    } catch (error: unknown) {
      console.error('Error recording control test:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get control tests
   */
  async getControlTests(filters?: {
    control_id?: string
    test_result?: TestResult
    start_date?: string
    end_date?: string
  }): Promise<ControlTest[]> {
    try {
      let query = this.supabase
        .from('soc2_control_tests')
        .select('*')
        .order('test_date', { ascending: false })

      if (filters?.control_id) {
        query = query.eq('control_id', filters.control_id)
      }

      if (filters?.test_result) {
        query = query.eq('test_result', filters.test_result)
      }

      if (filters?.start_date) {
        query = query.gte('test_date', filters.start_date)
      }

      if (filters?.end_date) {
        query = query.lte('test_date', filters.end_date)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching control tests:', error)
      return []
    }
  }

  /**
   * Get testing statistics
   */
  async getTestingStats(period?: { start_date: string; end_date: string }): Promise<{
    total_tests: number
    passed: number
    failed: number
    not_applicable: number
    pass_rate: number
    total_exceptions: number
    controls_tested: number
    controls_not_tested: number
  }> {
    try {
      let query = this.supabase
        .from('soc2_control_tests')
        .select('test_result, exceptions_found, control_id')

      if (period) {
        query = query
          .gte('test_date', period.start_date)
          .lte('test_date', period.end_date)
      }

      const { data: tests } = await query

      if (!tests) {
        return {
          total_tests: 0,
          passed: 0,
          failed: 0,
          not_applicable: 0,
          pass_rate: 0,
          total_exceptions: 0,
          controls_tested: 0,
          controls_not_tested: 0
        }
      }

      const totalTests = tests.length
      const passed = tests.filter(t => t.test_result === 'pass').length
      const failed = tests.filter(t => t.test_result === 'fail').length
      const notApplicable = tests.filter(t => t.test_result === 'not_applicable').length
      const totalExceptions = tests.reduce((sum, t) => sum + (t.exceptions_found || 0), 0)
      const uniqueControlsTested = new Set(tests.map(t => t.control_id)).size

      // Get total controls count
      const { data: allControls } = await this.supabase
        .from('soc2_controls')
        .select('id', { count: 'exact', head: true })

      const totalControls = allControls ? (allControls as any).count : 0

      return {
        total_tests: totalTests,
        passed,
        failed,
        not_applicable: notApplicable,
        pass_rate: totalTests > 0 ? (passed / totalTests) * 100 : 0,
        total_exceptions: totalExceptions,
        controls_tested: uniqueControlsTested,
        controls_not_tested: Math.max(0, totalControls - uniqueControlsTested)
      }
    } catch (error) {
      console.error('Error fetching testing stats:', error)
      return {
        total_tests: 0,
        passed: 0,
        failed: 0,
        not_applicable: 0,
        pass_rate: 0,
        total_exceptions: 0,
        controls_tested: 0,
        controls_not_tested: 0
      }
    }
  }

  /**
   * Get controls due for testing
   */
  async getControlsDueForTesting(): Promise<Array<SOC2Control & { last_test_date?: string; days_since_test?: number }>> {
    try {
      // Get all controls
      const { data: controls } = await this.supabase
        .from('soc2_controls')
        .select('*')
        .eq('is_implemented', true)

      if (!controls) return []

      // Get latest test date for each control
      const controlsWithTests = await Promise.all(
        controls.map(async (control) => {
          const { data: latestTest } = await this.supabase
            .from('soc2_control_tests')
            .select('test_date')
            .eq('control_id', control.id)
            .order('test_date', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (!latestTest) {
            return {
              ...control,
              last_test_date: undefined,
              days_since_test: undefined
            }
          }

          const daysSinceTest = Math.floor(
            (new Date().getTime() - new Date(latestTest.test_date).getTime()) / (1000 * 60 * 60 * 24)
          )

          return {
            ...control,
            last_test_date: latestTest.test_date,
            days_since_test: daysSinceTest
          }
        })
      )

      // Filter based on frequency
      const dueForTesting = controlsWithTests.filter((control) => {
        if (!control.last_test_date) return true // Never tested

        const daysSinceTest = control.days_since_test || 0

        switch (control.control_frequency) {
          case 'continuous':
            return daysSinceTest > 1
          case 'daily':
            return daysSinceTest > 1
          case 'weekly':
            return daysSinceTest > 7
          case 'monthly':
            return daysSinceTest > 30
          case 'quarterly':
            return daysSinceTest > 90
          case 'annual':
            return daysSinceTest > 365
          default:
            return false
        }
      })

      return dueForTesting
    } catch (error) {
      console.error('Error fetching controls due for testing:', error)
      return []
    }
  }

  // ==================== VENDOR RISK MANAGEMENT ====================

  /**
   * Create vendor risk assessment
   */
  async createVendorAssessment(
    data: Omit<VendorRiskAssessment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; assessment_id?: string; error?: string }> {
    try {
      const { data: assessment, error } = await this.supabase
        .from('vendor_risk_assessments')
        .insert(data)
        .select()
        .maybeSingle()

      if (error) throw error
      return { success: true, assessment_id: assessment.id }
    } catch (error: unknown) {
      console.error('Error creating vendor assessment:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get vendor assessments
   */
  async getVendorAssessments(filters?: {
    risk_level?: VendorRiskLevel
    approval_status?: VendorRiskAssessment['approval_status']
    review_due?: boolean
  }): Promise<VendorRiskAssessment[]> {
    try {
      let query = this.supabase
        .from('vendor_risk_assessments')
        .select('*')
        .order('vendor_name', { ascending: true })

      if (filters?.risk_level) {
        query = query.eq('risk_level', filters.risk_level)
      }

      if (filters?.approval_status) {
        query = query.eq('approval_status', filters.approval_status)
      }

      if (filters?.review_due) {
        query = query.lte('next_review_date', new Date().toISOString())
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching vendor assessments:', error)
      return []
    }
  }

  /**
   * Update vendor assessment
   */
  async updateVendorAssessment(
    assessmentId: string,
    data: Partial<VendorRiskAssessment>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('vendor_risk_assessments')
        .update(data)
        .eq('id', assessmentId)

      if (error) throw error
      return { success: true }
    } catch (error: unknown) {
      console.error('Error updating vendor assessment:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Calculate vendor risk score
   */
  calculateVendorRisk(data: {
    has_soc2_report: boolean
    has_iso27001: boolean
    security_questionnaire_score?: number
    data_sensitivity: 'low' | 'medium' | 'high' | 'critical'
    vendor_size: 'startup' | 'small' | 'medium' | 'enterprise'
  }): { inherent_risk_score: number; residual_risk_score: number; risk_level: VendorRiskLevel } {
    let inherentRisk = 50 // Base score

    // Data sensitivity factor
    const sensitivityScores = { low: 0, medium: 10, high: 20, critical: 30 }
    inherentRisk += sensitivityScores[data.data_sensitivity]

    // Vendor size factor (smaller = higher risk)
    const sizeScores = { startup: 20, small: 10, medium: 5, enterprise: 0 }
    inherentRisk += sizeScores[data.vendor_size]

    // Cap at 100
    inherentRisk = Math.min(100, inherentRisk)

    // Calculate residual risk (after controls)
    let residualRisk = inherentRisk

    if (data.has_soc2_report) residualRisk -= 20
    if (data.has_iso27001) residualRisk -= 15
    if (data.security_questionnaire_score) {
      residualRisk -= (data.security_questionnaire_score / 100) * 20
    }

    residualRisk = Math.max(0, residualRisk)

    // Determine risk level
    let riskLevel: VendorRiskLevel
    if (residualRisk < 25) riskLevel = 'low'
    else if (residualRisk < 50) riskLevel = 'medium'
    else if (residualRisk < 75) riskLevel = 'high'
    else riskLevel = 'critical'

    return {
      inherent_risk_score: Math.round(inherentRisk),
      residual_risk_score: Math.round(residualRisk),
      risk_level: riskLevel
    }
  }

  /**
   * Get vendor risk statistics
   */
  async getVendorRiskStats(): Promise<{
    total_vendors: number
    by_risk_level: Record<VendorRiskLevel, number>
    by_approval_status: Record<VendorRiskAssessment['approval_status'], number>
    with_soc2: number
    with_iso27001: number
    reviews_due: number
  }> {
    try {
      const { data: vendors } = await this.supabase
        .from('vendor_risk_assessments')
        .select('*')

      if (!vendors) {
        return {
          total_vendors: 0,
          by_risk_level: { low: 0, medium: 0, high: 0, critical: 0 },
          by_approval_status: { pending: 0, approved: 0, rejected: 0, renewal_required: 0 },
          with_soc2: 0,
          with_iso27001: 0,
          reviews_due: 0
        }
      }

      const now = new Date()

      return {
        total_vendors: vendors.length,
        by_risk_level: {
          low: vendors.filter(v => v.risk_level === 'low').length,
          medium: vendors.filter(v => v.risk_level === 'medium').length,
          high: vendors.filter(v => v.risk_level === 'high').length,
          critical: vendors.filter(v => v.risk_level === 'critical').length
        },
        by_approval_status: {
          pending: vendors.filter(v => v.approval_status === 'pending').length,
          approved: vendors.filter(v => v.approval_status === 'approved').length,
          rejected: vendors.filter(v => v.approval_status === 'rejected').length,
          renewal_required: vendors.filter(v => v.approval_status === 'renewal_required').length
        },
        with_soc2: vendors.filter(v => v.has_soc2_report).length,
        with_iso27001: vendors.filter(v => v.has_iso27001).length,
        reviews_due: vendors.filter(v => v.next_review_date && new Date(v.next_review_date) <= now).length
      }
    } catch (error) {
      console.error('Error fetching vendor risk stats:', error)
      return {
        total_vendors: 0,
        by_risk_level: { low: 0, medium: 0, high: 0, critical: 0 },
        by_approval_status: { pending: 0, approved: 0, rejected: 0, renewal_required: 0 },
        with_soc2: 0,
        with_iso27001: 0,
        reviews_due: 0
      }
    }
  }
}

// Export singleton instance
export const soc2Service = new SOC2Service()
