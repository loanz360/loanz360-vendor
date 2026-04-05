import { createClient } from '@/lib/supabase/server'

/**
 * A/B Testing Service
 * Provides variant assignment, statistical tracking, and winner determination
 */

interface ABTest {
  id: string
  chatbot_id: string
  name: string
  description?: string
  status: 'draft' | 'running' | 'paused' | 'completed'
  variants: Variant[]
  traffic_split: number[] // e.g., [50, 50] for 50/50 split
  goal: 'conversion' | 'engagement' | 'lead_quality'
  start_date?: string
  end_date?: string
  winner_variant_id?: string
  created_at: string
  updated_at: string
}

interface Variant {
  id: string
  name: string
  description?: string
  flow_version_id?: string
  config?: Record<string, unknown>
  is_control: boolean
}

interface VariantStats {
  variant_id: string
  sessions: number
  conversions: number
  conversion_rate: number
  avg_engagement_time: number
  leads_generated: number
  avg_lead_score: number
}

interface TestResult {
  test_id: string
  variants: VariantStats[]
  winner?: {
    variant_id: string
    confidence: number
    improvement: number
  }
  is_significant: boolean
  sample_size_adequate: boolean
}

export class ABTestingService {
  /**
   * Create a new A/B test
   */
  static async createTest(
    chatbotId: string,
    name: string,
    variants: Omit<Variant, 'id'>[],
    options?: {
      description?: string
      goal?: ABTest['goal']
      traffic_split?: number[]
    }
  ): Promise<{ success: boolean; testId?: string; error?: string }> {
    try {
      const supabase = await createClient()

      // Validate traffic split
      const trafficSplit = options?.traffic_split || variants.map(() => Math.floor(100 / variants.length))
      const totalSplit = trafficSplit.reduce((a, b) => a + b, 0)
      if (totalSplit !== 100) {
        return { success: false, error: 'Traffic split must total 100%' }
      }

      // Create variants with IDs
      const variantsWithIds = variants.map((v, index) => ({
        ...v,
        id: `var_${Date.now()}_${index}`
      }))

      const { data, error } = await supabase
        .from('chatbot_ab_tests')
        .insert({
          chatbot_id: chatbotId,
          name,
          description: options?.description,
          status: 'draft',
          variants: variantsWithIds,
          traffic_split: trafficSplit,
          goal: options?.goal || 'conversion',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .maybeSingle()

      if (error) throw error

      return { success: true, testId: data.id }
    } catch (error) {
      console.error('Create test error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create test'
      }
    }
  }

  /**
   * Start an A/B test
   */
  static async startTest(testId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('chatbot_ab_tests')
        .update({
          status: 'running',
          start_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', testId)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Start test error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start test'
      }
    }
  }

  /**
   * Pause an A/B test
   */
  static async pauseTest(testId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('chatbot_ab_tests')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString()
        })
        .eq('id', testId)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Pause test error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pause test'
      }
    }
  }

  /**
   * End an A/B test and declare winner
   */
  static async endTest(
    testId: string,
    winnerVariantId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('chatbot_ab_tests')
        .update({
          status: 'completed',
          end_date: new Date().toISOString(),
          winner_variant_id: winnerVariantId,
          updated_at: new Date().toISOString()
        })
        .eq('id', testId)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('End test error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to end test'
      }
    }
  }

  /**
   * Assign a visitor to a variant
   */
  static async assignVariant(
    testId: string,
    visitorId: string
  ): Promise<{ success: boolean; variantId?: string; error?: string }> {
    try {
      const supabase = await createClient()

      // Check for existing assignment
      const { data: existing } = await supabase
        .from('ab_test_assignments')
        .select('variant_id')
        .eq('test_id', testId)
        .eq('visitor_id', visitorId)
        .maybeSingle()

      if (existing) {
        return { success: true, variantId: existing.variant_id }
      }

      // Get test details
      const { data: test, error: testError } = await supabase
        .from('chatbot_ab_tests')
        .select('*')
        .eq('id', testId)
        .eq('status', 'running')
        .maybeSingle()

      if (testError || !test) {
        return { success: false, error: 'Test not found or not running' }
      }

      // Randomly assign based on traffic split
      const variants = test.variants as Variant[]
      const trafficSplit = test.traffic_split as number[]

      const random = Math.random() * 100
      let cumulative = 0
      let selectedVariant = variants[0]

      for (let i = 0; i < variants.length; i++) {
        cumulative += trafficSplit[i]
        if (random < cumulative) {
          selectedVariant = variants[i]
          break
        }
      }

      // Record assignment
      await supabase
        .from('ab_test_assignments')
        .insert({
          test_id: testId,
          visitor_id: visitorId,
          variant_id: selectedVariant.id,
          assigned_at: new Date().toISOString()
        })

      return { success: true, variantId: selectedVariant.id }
    } catch (error) {
      console.error('Assign variant error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign variant'
      }
    }
  }

  /**
   * Record a conversion for a variant
   */
  static async recordConversion(
    testId: string,
    visitorId: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient()

      // Get the visitor's variant assignment
      const { data: assignment } = await supabase
        .from('ab_test_assignments')
        .select('variant_id')
        .eq('test_id', testId)
        .eq('visitor_id', visitorId)
        .maybeSingle()

      if (!assignment) {
        return { success: false, error: 'No variant assignment found' }
      }

      // Record conversion
      await supabase
        .from('ab_test_conversions')
        .insert({
          test_id: testId,
          visitor_id: visitorId,
          variant_id: assignment.variant_id,
          converted_at: new Date().toISOString(),
          metadata
        })

      return { success: true }
    } catch (error) {
      console.error('Record conversion error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record conversion'
      }
    }
  }

  /**
   * Get variant statistics
   */
  static async getVariantStats(testId: string): Promise<{
    success: boolean
    stats?: VariantStats[]
    error?: string
  }> {
    try {
      const supabase = await createClient()

      // Get test details
      const { data: test } = await supabase
        .from('chatbot_ab_tests')
        .select('*')
        .eq('id', testId)
        .maybeSingle()

      if (!test) {
        return { success: false, error: 'Test not found' }
      }

      const variants = test.variants as Variant[]
      const stats: VariantStats[] = []

      for (const variant of variants) {
        // Get assignment count
        const { data: assignments } = await supabase
          .from('ab_test_assignments')
          .select('id, visitor_id')
          .eq('test_id', testId)
          .eq('variant_id', variant.id)

        const sessionCount = assignments?.length || 0

        // Get conversions
        const { data: conversions } = await supabase
          .from('ab_test_conversions')
          .select('id')
          .eq('test_id', testId)
          .eq('variant_id', variant.id)

        const conversionCount = conversions?.length || 0

        // Get leads generated
        const visitorIds = assignments?.map(a => a.visitor_id) || []
        let leadsCount = 0
        let avgLeadScore = 0

        if (visitorIds.length > 0) {
          const { data: leads } = await supabase
            .from('online_leads')
            .select('id, lead_score')
            .in('visitor_id', visitorIds)

          leadsCount = leads?.length || 0
          if (leads && leads.length > 0) {
            const scores = leads.filter(l => l.lead_score !== null).map(l => l.lead_score || 0)
            avgLeadScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
          }
        }

        stats.push({
          variant_id: variant.id,
          sessions: sessionCount,
          conversions: conversionCount,
          conversion_rate: sessionCount > 0 ? (conversionCount / sessionCount) * 100 : 0,
          avg_engagement_time: 0, // Would need session duration tracking
          leads_generated: leadsCount,
          avg_lead_score: Math.round(avgLeadScore * 10) / 10
        })
      }

      return { success: true, stats }
    } catch (error) {
      console.error('Get stats error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stats'
      }
    }
  }

  /**
   * Calculate statistical significance using chi-square test
   */
  static calculateSignificance(
    controlConversions: number,
    controlSessions: number,
    treatmentConversions: number,
    treatmentSessions: number
  ): { isSignificant: boolean; confidence: number; improvement: number } {
    const controlRate = controlSessions > 0 ? controlConversions / controlSessions : 0
    const treatmentRate = treatmentSessions > 0 ? treatmentConversions / treatmentSessions : 0

    const improvement = controlRate > 0
      ? ((treatmentRate - controlRate) / controlRate) * 100
      : treatmentRate > 0 ? 100 : 0

    // Chi-square calculation
    const totalConversions = controlConversions + treatmentConversions
    const totalSessions = controlSessions + treatmentSessions

    if (totalSessions === 0 || totalConversions === 0) {
      return { isSignificant: false, confidence: 0, improvement }
    }

    const expectedControlConversions = (controlSessions / totalSessions) * totalConversions
    const expectedTreatmentConversions = (treatmentSessions / totalSessions) * totalConversions
    const expectedControlNonConversions = controlSessions - expectedControlConversions
    const expectedTreatmentNonConversions = treatmentSessions - expectedTreatmentConversions

    const controlNonConversions = controlSessions - controlConversions
    const treatmentNonConversions = treatmentSessions - treatmentConversions

    let chiSquare = 0
    if (expectedControlConversions > 0) {
      chiSquare += Math.pow(controlConversions - expectedControlConversions, 2) / expectedControlConversions
    }
    if (expectedTreatmentConversions > 0) {
      chiSquare += Math.pow(treatmentConversions - expectedTreatmentConversions, 2) / expectedTreatmentConversions
    }
    if (expectedControlNonConversions > 0) {
      chiSquare += Math.pow(controlNonConversions - expectedControlNonConversions, 2) / expectedControlNonConversions
    }
    if (expectedTreatmentNonConversions > 0) {
      chiSquare += Math.pow(treatmentNonConversions - expectedTreatmentNonConversions, 2) / expectedTreatmentNonConversions
    }

    // Chi-square to confidence level (simplified)
    // Critical values: 2.71 (90%), 3.84 (95%), 6.63 (99%)
    let confidence = 0
    if (chiSquare >= 6.63) confidence = 99
    else if (chiSquare >= 3.84) confidence = 95
    else if (chiSquare >= 2.71) confidence = 90
    else confidence = Math.round((chiSquare / 2.71) * 90)

    return {
      isSignificant: chiSquare >= 3.84, // 95% confidence
      confidence,
      improvement: Math.round(improvement * 10) / 10
    }
  }

  /**
   * Analyze test results and determine winner
   */
  static async analyzeTest(testId: string): Promise<{
    success: boolean
    result?: TestResult
    error?: string
  }> {
    try {
      const statsResult = await this.getVariantStats(testId)
      if (!statsResult.success || !statsResult.stats) {
        return { success: false, error: statsResult.error }
      }

      const stats = statsResult.stats
      const totalSessions = stats.reduce((sum, s) => sum + s.sessions, 0)
      const minSampleSize = 100 // Minimum sessions per variant

      // Find control variant
      const supabase = await createClient()
      const { data: test } = await supabase
        .from('chatbot_ab_tests')
        .select('variants')
        .eq('id', testId)
        .maybeSingle()

      const variants = test?.variants as Variant[]
      const controlVariant = variants?.find(v => v.is_control)
      const controlStats = stats.find(s => s.variant_id === controlVariant?.id) || stats[0]

      // Calculate significance for each treatment vs control
      let winner: TestResult['winner'] = undefined
      let isSignificant = false

      for (const treatmentStats of stats) {
        if (treatmentStats.variant_id === controlStats.variant_id) continue

        const significance = this.calculateSignificance(
          controlStats.conversions,
          controlStats.sessions,
          treatmentStats.conversions,
          treatmentStats.sessions
        )

        if (significance.isSignificant && significance.improvement > 0) {
          if (!winner || significance.improvement > winner.improvement) {
            winner = {
              variant_id: treatmentStats.variant_id,
              confidence: significance.confidence,
              improvement: significance.improvement
            }
            isSignificant = true
          }
        }
      }

      // Check if control is winning
      if (!winner) {
        for (const treatmentStats of stats) {
          if (treatmentStats.variant_id === controlStats.variant_id) continue

          const significance = this.calculateSignificance(
            treatmentStats.conversions,
            treatmentStats.sessions,
            controlStats.conversions,
            controlStats.sessions
          )

          if (significance.isSignificant && significance.improvement > 0) {
            winner = {
              variant_id: controlStats.variant_id,
              confidence: significance.confidence,
              improvement: significance.improvement
            }
            isSignificant = true
            break
          }
        }
      }

      return {
        success: true,
        result: {
          test_id: testId,
          variants: stats,
          winner,
          is_significant: isSignificant,
          sample_size_adequate: stats.every(s => s.sessions >= minSampleSize)
        }
      }
    } catch (error) {
      console.error('Analyze test error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze test'
      }
    }
  }

  /**
   * Get all tests for a chatbot
   */
  static async getTests(chatbotId: string): Promise<{
    success: boolean
    tests?: ABTest[]
    error?: string
  }> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('chatbot_ab_tests')
        .select('*')
        .eq('chatbot_id', chatbotId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return { success: true, tests: data }
    } catch (error) {
      console.error('Get tests error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tests'
      }
    }
  }

  /**
   * Get a specific test
   */
  static async getTest(testId: string): Promise<{
    success: boolean
    test?: ABTest
    error?: string
  }> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('chatbot_ab_tests')
        .select('*')
        .eq('id', testId)
        .maybeSingle()

      if (error) throw error

      return { success: true, test: data }
    } catch (error) {
      console.error('Get test error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get test'
      }
    }
  }

  /**
   * Delete a test (only if draft or completed)
   */
  static async deleteTest(testId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient()

      // Check test status
      const { data: test } = await supabase
        .from('chatbot_ab_tests')
        .select('status')
        .eq('id', testId)
        .maybeSingle()

      if (test?.status === 'running') {
        return { success: false, error: 'Cannot delete a running test. Please pause or end it first.' }
      }

      // Delete related data
      await supabase.from('ab_test_conversions').delete().eq('test_id', testId)
      await supabase.from('ab_test_assignments').delete().eq('test_id', testId)

      const { error } = await supabase
        .from('chatbot_ab_tests')
        .delete()
        .eq('id', testId)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Delete test error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete test'
      }
    }
  }
}

export default ABTestingService
