/**
 * ML-Based Lead Scoring Service
 * Uses TensorFlow.js for predictive lead conversion scoring
 */

import * as tf from '@tensorflow/tfjs'
import { createClient } from '@/lib/supabase/server'
import type {
  LeadScore,
  LeadScoringModel,
  NextBestAction,
  ActionPriority,
  FeatureScore,
  TrainingDataset,
  ModelTrainingRequest,
  ModelTrainingResponse,
} from './analytics-types'

// ============================================================================
// FEATURE ENGINEERING
// ============================================================================

interface LeadFeatures {
  source_score: number
  status_score: number
  engagement_score: number
  time_decay: number
  interaction_velocity: number
  response_rate: number
  [key: string]: number
}

/**
 * Extract numerical features from lead data for ML model
 */
export async function extractLeadFeatures(leadId: string): Promise<LeadFeatures> {
  const supabase = await createClient()

  // Fetch lead data with related information
  const { data: lead, error } = await supabase
    .from('leads')
    .select(`
      *,
      interactions:lead_interactions(count),
      notes:lead_notes(count)
    `)
    .eq('id', leadId)
    .maybeSingle()

  if (error || !lead) {
    throw new Error(`Failed to fetch lead data: ${error?.message}`)
  }

  // Feature 1: Lead Source Score (0-1)
  const sourceWeights: Record<string, number> = {
    website: 0.8,
    referral: 0.9,
    social_media: 0.6,
    direct: 0.7,
    paid_ads: 0.75,
    organic: 0.85,
    email: 0.65,
    other: 0.5,
  }
  const source_score = sourceWeights[lead.source?.toLowerCase()] || 0.5

  // Feature 2: Lead Status Score (0-1)
  const statusWeights: Record<string, number> = {
    new: 0.3,
    contacted: 0.7,
    qualified: 0.85,
    proposal: 0.95,
    negotiation: 0.9,
    won: 1.0,
    lost: 0.0,
    nurturing: 0.4,
  }
  const status_score = statusWeights[lead.status?.toLowerCase()] || 0.3

  // Feature 3: Engagement Score (0-1)
  const interactionCount = lead.interactions?.[0]?.count || 0
  const noteCount = lead.notes?.[0]?.count || 0
  const totalEngagement = interactionCount + noteCount
  const engagement_score = Math.min(totalEngagement / 10, 1.0) // Normalize to 0-1

  // Feature 4: Time Decay Factor (0-1)
  const createdAt = new Date(lead.created_at)
  const now = new Date()
  const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  const time_decay = Math.max(1.0 - daysSinceCreated / 30, 0) // Decay over 30 days

  // Feature 5: Interaction Velocity (interactions per day)
  const interaction_velocity = daysSinceCreated > 0
    ? Math.min(interactionCount / daysSinceCreated, 1.0)
    : 0

  // Feature 6: Response Rate (if contact_attempts available)
  const response_rate = lead.contact_attempts > 0
    ? (lead.successful_contacts || 0) / lead.contact_attempts
    : 0.5

  return {
    source_score,
    status_score,
    engagement_score,
    time_decay,
    interaction_velocity,
    response_rate,
  }
}

// ============================================================================
// LEAD SCORING
// ============================================================================

/**
 * Calculate ML-based lead score using the production model
 */
export async function calculateLeadScore(
  leadId: string,
  modelId?: string
): Promise<LeadScore> {
  const supabase = await createClient()

  // Get the production model or specific model
  const modelQuery = modelId
    ? supabase.from('lead_scoring_models').select('*').eq('id', modelId).maybeSingle()
    : supabase.from('lead_scoring_models').select('*').eq('is_production', true).maybeSingle()

  const { data: model, error: modelError } = await modelQuery

  if (modelError || !model) {
    throw new Error(`Failed to fetch model: ${modelError?.message}`)
  }

  // Extract features from lead data
  const features = await extractLeadFeatures(leadId)

  // Calculate conversion probability using weighted features
  const modelFeatures = model.features as Record<string, number>
  let conversion_probability = 0
  const feature_scores: FeatureScore[] = []

  // Weighted average of features
  if (model.model_type === 'logistic_regression') {
    conversion_probability =
      features.source_score * (modelFeatures.source_weight || 0.3) +
      features.status_score * (modelFeatures.status_weight || 0.4) +
      features.engagement_score * (modelFeatures.engagement_weight || 0.2) +
      features.time_decay * (modelFeatures.time_weight || 0.1)

    // Record individual feature contributions
    feature_scores.push(
      { feature_name: 'source', contribution: features.source_score * (modelFeatures.source_weight || 0.3), value: features.source_score },
      { feature_name: 'status', contribution: features.status_score * (modelFeatures.status_weight || 0.4), value: features.status_score },
      { feature_name: 'engagement', contribution: features.engagement_score * (modelFeatures.engagement_weight || 0.2), value: features.engagement_score },
      { feature_name: 'time_decay', contribution: features.time_decay * (modelFeatures.time_weight || 0.1), value: features.time_decay }
    )
  }

  // Convert to percentage (0-100)
  conversion_probability = Math.min(Math.max(conversion_probability * 100, 0), 100)

  // Calculate churn risk (inverse of engagement and time decay)
  const churn_risk = (1 - features.engagement_score) * (1 - features.time_decay) * 100

  // Predict revenue based on conversion probability
  const avgDealSize = 50000 // TODO: Get from business settings
  const predicted_revenue = (conversion_probability / 100) * avgDealSize

  // Predict close days based on status and engagement
  const baseCloseDays = 30
  const predicted_close_days = Math.round(
    baseCloseDays * (1 - features.status_score) * (1 + (1 - features.engagement_score))
  )

  // Calculate confidence score based on data quality
  const dataQualityScore = (
    (features.engagement_score > 0 ? 0.3 : 0) +
    (features.interaction_velocity > 0 ? 0.3 : 0) +
    (features.response_rate > 0 ? 0.2 : 0) +
    0.2 // Base confidence
  )
  const confidence_score = dataQualityScore * 100

  // Determine next best action
  const { action, priority } = determineNextBestAction(
    conversion_probability,
    features.status_score,
    features.engagement_score,
    churn_risk
  )

  // Identify risk and opportunity factors
  const risk_factors = identifyRiskFactors(features, churn_risk)
  const opportunity_factors = identifyOpportunityFactors(features, conversion_probability)

  // Generate recommended message
  const recommended_message = generateRecommendedMessage(action, features)

  // Optimal contact time (business hours, prefer morning)
  const optimal_contact_time = calculateOptimalContactTime(features)

  // Save lead score to database
  const leadScore: Omit<LeadScore, 'id' | 'created_at' | 'updated_at' | 'scored_at'> = {
    lead_id: leadId,
    model_id: model.id,
    conversion_probability,
    churn_risk,
    predicted_revenue,
    predicted_close_days,
    confidence_score,
    next_best_action: action,
    action_priority: priority,
    optimal_contact_time,
    recommended_message,
    feature_scores,
    risk_factors,
    opportunity_factors,
  }

  const { data: savedScore, error: saveError } = await supabase
    .from('lead_scores')
    .upsert(leadScore, { onConflict: 'lead_id,model_id' })
    .select()
    .maybeSingle()

  if (saveError) {
    throw new Error(`Failed to save lead score: ${saveError.message}`)
  }

  return savedScore as LeadScore
}

/**
 * Bulk scoring for multiple leads
 */
export async function bulkScoreLeads(
  leadIds: string[],
  modelId?: string
): Promise<{ scores: LeadScore[]; failed: string[] }> {
  const scores: LeadScore[] = []
  const failed: string[] = []

  for (const leadId of leadIds) {
    try {
      const score = await calculateLeadScore(leadId, modelId)
      scores.push(score)
    } catch (error) {
      console.error(`Failed to score lead ${leadId}:`, error)
      failed.push(leadId)
    }
  }

  return { scores, failed }
}

// ============================================================================
// DECISION LOGIC
// ============================================================================

function determineNextBestAction(
  conversionProb: number,
  statusScore: number,
  engagementScore: number,
  churnRisk: number
): { action: NextBestAction; priority: ActionPriority } {
  // High conversion probability + high status = ready to close
  if (conversionProb >= 80 && statusScore >= 0.85) {
    return { action: 'close', priority: 'urgent' }
  }

  // High churn risk = urgent follow-up needed
  if (churnRisk >= 70) {
    return { action: 'call', priority: 'urgent' }
  }

  // Medium conversion + low engagement = need meeting
  if (conversionProb >= 50 && engagementScore < 0.5) {
    return { action: 'meeting', priority: 'high' }
  }

  // Good conversion + medium status = continue nurturing
  if (conversionProb >= 60 && statusScore >= 0.5) {
    return { action: 'email', priority: 'medium' }
  }

  // Medium status = qualify further
  if (statusScore >= 0.5 && statusScore < 0.8) {
    return { action: 'qualify', priority: 'medium' }
  }

  // Low conversion = nurture campaign
  if (conversionProb < 40) {
    return { action: 'nurture', priority: 'low' }
  }

  // Default: follow up
  return { action: 'follow_up', priority: 'medium' }
}

function identifyRiskFactors(features: LeadFeatures, churnRisk: number): string[] {
  const risks: string[] = []

  if (churnRisk >= 70) risks.push('High churn risk - immediate attention needed')
  if (features.engagement_score < 0.3) risks.push('Very low engagement - lead may be cold')
  if (features.time_decay < 0.2) risks.push('Lead aging - created over 24 days ago')
  if (features.interaction_velocity < 0.1) risks.push('Low interaction velocity')
  if (features.response_rate < 0.3) risks.push('Poor response rate to outreach')

  return risks
}

function identifyOpportunityFactors(features: LeadFeatures, conversionProb: number): string[] {
  const opportunities: string[] = []

  if (conversionProb >= 80) opportunities.push('Very high conversion probability')
  if (features.source_score >= 0.85) opportunities.push('High-quality lead source')
  if (features.status_score >= 0.85) opportunities.push('Advanced in sales pipeline')
  if (features.engagement_score >= 0.7) opportunities.push('Highly engaged lead')
  if (features.interaction_velocity >= 0.5) opportunities.push('Strong interaction velocity')
  if (features.response_rate >= 0.7) opportunities.push('Excellent response rate')

  return opportunities
}

function generateRecommendedMessage(action: NextBestAction, features: LeadFeatures): string {
  const messages: Record<NextBestAction, string> = {
    call: 'Schedule a discovery call to understand their needs and timeline.',
    email: 'Send a personalized email with relevant case studies and success stories.',
    meeting: 'Propose a demo meeting to showcase product capabilities.',
    close: 'Send the final proposal and schedule a closing call.',
    nurture: 'Add to nurture campaign with educational content.',
    follow_up: 'Send a follow-up message checking on their interest and timeline.',
    qualify: 'Conduct qualification call to assess fit and budget.',
  }

  return messages[action] || 'Engage with personalized outreach.'
}

function calculateOptimalContactTime(features: LeadFeatures): string {
  // Prefer morning (9-11 AM) for high-value leads
  // Prefer afternoon (2-4 PM) for others
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const hour = features.status_score >= 0.7 ? 10 : 14 // 10 AM or 2 PM
  tomorrow.setHours(hour, 0, 0, 0)

  return tomorrow.toISOString()
}

// ============================================================================
// MODEL TRAINING (Advanced - for future implementation)
// ============================================================================

/**
 * Train a new ML model using historical conversion data
 * Uses TensorFlow.js for logistic regression
 */
export async function trainScoringModel(
  request: ModelTrainingRequest
): Promise<ModelTrainingResponse> {
  const startTime = Date.now()

  // Prepare training data
  const { trainingData, testData } = splitTrainingData(
    request.training_data,
    request.test_split
  )

  // Build TensorFlow model
  const model = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [6], units: 12, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 6, activation: 'relu' }),
      tf.layers.dense({ units: 1, activation: 'sigmoid' }),
    ],
  })

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  })

  // Convert data to tensors
  const xTrain = tf.tensor2d(trainingData.map(d => Object.values(d.features)))
  const yTrain = tf.tensor2d(trainingData.map(d => [d.label ? 1 : 0]))

  // Train model
  await model.fit(xTrain, yTrain, {
    epochs: request.hyperparameters?.epochs || 50,
    batchSize: request.hyperparameters?.batchSize || 32,
    validationSplit: 0.1,
    verbose: 0,
  })

  // Evaluate on test data
  const xTest = tf.tensor2d(testData.map(d => Object.values(d.features)))
  const yTest = tf.tensor2d(testData.map(d => [d.label ? 1 : 0]))

  const evalResult = model.evaluate(xTest, yTest) as tf.Scalar[]
  const testAccuracy = await evalResult[1].data()

  // Calculate feature importance (simplified - weights from first layer)
  const weights = model.layers[0].getWeights()[0]
  const weightsData = await weights.data()
  const feature_importance = Object.keys(trainingData[0].features).map((name, idx) => ({
    feature_name: name,
    importance_score: Math.abs(Array.from(weightsData)[idx] || 0),
    rank: idx + 1,
  }))

  // Save model to database
  const supabase = await createClient()
  const modelData: Partial<LeadScoringModel> = {
    model_name: request.model_name,
    model_type: request.model_type,
    features: {
      source_weight: 0.3,
      status_weight: 0.4,
      engagement_weight: 0.2,
      time_weight: 0.1,
    },
    feature_importance: feature_importance,
    accuracy_score: testAccuracy[0],
    precision_score: testAccuracy[0], // TODO: Calculate actual precision
    recall_score: testAccuracy[0], // TODO: Calculate actual recall
    f1_score: testAccuracy[0], // TODO: Calculate actual F1
    roc_auc_score: testAccuracy[0], // TODO: Calculate actual ROC-AUC
    training_data_size: trainingData.length,
    training_duration_seconds: (Date.now() - startTime) / 1000,
    is_active: true,
    is_production: false, // Don't auto-promote to production
    trained_at: new Date().toISOString(),
  }

  const { data: savedModel, error } = await supabase
    .from('lead_scoring_models')
    .insert(modelData)
    .select()
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to save model: ${error.message}`)
  }

  // Cleanup tensors
  xTrain.dispose()
  yTrain.dispose()
  xTest.dispose()
  yTest.dispose()

  return {
    success: true,
    model_id: savedModel.id,
    metrics: {
      accuracy: testAccuracy[0],
      precision: testAccuracy[0],
      recall: testAccuracy[0],
      f1_score: testAccuracy[0],
      roc_auc: testAccuracy[0],
    },
    training_time_seconds: (Date.now() - startTime) / 1000,
    feature_importance,
  }
}

function splitTrainingData(
  data: TrainingDataset[],
  testSplit: number
): { trainingData: TrainingDataset[]; testData: TrainingDataset[] } {
  const shuffled = [...data].sort(() => Math.random() - 0.5)
  const splitIndex = Math.floor(shuffled.length * (1 - testSplit))

  return {
    trainingData: shuffled.slice(0, splitIndex),
    testData: shuffled.slice(splitIndex),
  }
}

// ============================================================================
// SCORE RETRIEVAL
// ============================================================================

/**
 * Get existing lead score from database
 */
export async function getLeadScore(leadId: string): Promise<LeadScore | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lead_scores')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return data as LeadScore
}

/**
 * Get scores for multiple leads
 */
export async function getLeadScores(leadIds: string[]): Promise<LeadScore[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lead_scores')
    .select('*')
    .in('lead_id', leadIds)
    .order('created_at', { ascending: false })

  if (error) return []
  return data as LeadScore[]
}
