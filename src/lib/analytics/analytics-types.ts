/**
 * Analytics & Business Intelligence Types
 * Complete TypeScript type definitions for MILESTONE 8
 */

// ============================================================================
// ML MODEL TYPES
// ============================================================================

export type MLModelType = 'logistic_regression' | 'random_forest' | 'neural_network' | 'gradient_boosting'

export interface MLModelFeatures {
  source_weight: number
  status_weight: number
  engagement_weight: number
  time_weight: number
  [key: string]: number // Allow additional custom features
}

export interface FeatureImportance {
  feature_name: string
  importance_score: number
  rank: number
}

export interface LeadScoringModel {
  id: string
  model_name: string
  model_type: MLModelType
  features: MLModelFeatures
  feature_importance: FeatureImportance[]

  // Model Performance Metrics
  accuracy_score: number // 0-1
  precision_score: number // 0-1
  recall_score: number // 0-1
  f1_score: number // 0-1
  roc_auc_score: number // 0-1

  // Training Information
  training_data_size?: number
  training_duration_seconds?: number
  last_trained_at?: string

  // Status
  is_active: boolean
  is_production: boolean
  trained_at: string
  created_at: string
  updated_at: string
}

// ============================================================================
// LEAD SCORING & PREDICTIONS
// ============================================================================

export type NextBestAction = 'call' | 'email' | 'meeting' | 'close' | 'nurture' | 'follow_up' | 'qualify'
export type ActionPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface FeatureScore {
  feature_name: string
  contribution: number // -1 to 1
  value: string | number
}

export interface LeadScore {
  id: string
  lead_id: string
  model_id: string

  // Core Predictions
  conversion_probability: number // 0-100%
  churn_risk: number // 0-100%
  predicted_revenue: number
  predicted_close_days: number
  confidence_score: number // 0-100%

  // AI Recommendations
  next_best_action: NextBestAction
  action_priority: ActionPriority
  optimal_contact_time: string
  recommended_message: string

  // Feature Analysis
  feature_scores: FeatureScore[]
  risk_factors: string[]
  opportunity_factors: string[]

  // Metadata
  scored_at: string
  created_at: string
  updated_at: string
}

// ============================================================================
// REVENUE FORECASTING
// ============================================================================

export type ForecastPeriod = '30_days' | '60_days' | '90_days' | 'quarterly' | 'yearly'
export type ForecastMethod = 'linear_regression' | 'moving_average' | 'arima' | 'prophet' | 'exponential_smoothing'

export interface RevenueByDimension {
  [key: string]: number
}

export interface RevenueForecast {
  id: string
  forecast_date: string
  forecast_period: ForecastPeriod
  forecast_method: ForecastMethod

  // Predictions with Confidence Intervals
  predicted_revenue: number
  confidence_interval_low: number
  confidence_interval_high: number
  confidence_level: number // Default 95.00

  // Actual Results (filled after period completion)
  actual_revenue?: number
  accuracy_percentage?: number
  forecast_error?: number

  // Dimensional Breakdown
  revenue_by_source: RevenueByDimension
  revenue_by_product: RevenueByDimension
  revenue_by_region: RevenueByDimension

  // Metadata
  created_at: string
  updated_at: string
}

// ============================================================================
// BUSINESS INSIGHTS
// ============================================================================

export type InsightType = 'anomaly' | 'trend' | 'correlation' | 'recommendation' | 'alert' | 'opportunity'
export type InsightCategory = 'revenue' | 'leads' | 'performance' | 'operations' | 'risk' | 'growth'
export type InsightSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'
export type ImplementationEffort = 'low' | 'medium' | 'high'

export interface VisualizationConfig {
  chart_type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'gauge'
  x_axis?: string
  y_axis?: string
  colors?: string[]
  [key: string]: unknown
}

export interface BusinessInsight {
  id: string
  insight_type: InsightType
  category: InsightCategory
  severity: InsightSeverity

  // Content
  title: string
  description: string
  insight_data: Record<string, unknown>
  visualization_config?: VisualizationConfig

  // Actionable Recommendations
  recommendations: string[]
  estimated_impact: string // e.g., "+15% conversion"
  implementation_effort: ImplementationEffort

  // Status Tracking
  is_read: boolean
  is_dismissed: boolean
  is_actioned: boolean
  action_taken?: string
  actioned_by?: string
  actioned_at?: string

  // Metadata
  detected_at: string
  expires_at?: string
  created_at: string
  updated_at: string
}

// ============================================================================
// CUSTOM REPORTS
// ============================================================================

export type MetricType = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'percentage' | 'ratio'
export type DimensionType = 'time' | 'category' | 'geography' | 'source' | 'status' | 'product'
export type VisualizationType = 'table' | 'line_chart' | 'bar_chart' | 'pie_chart' | 'scatter' | 'heatmap' | 'gauge' | 'funnel'
export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly'
export type ExportFormat = 'pdf' | 'excel' | 'csv' | 'json'

export interface ReportMetric {
  metric_name: string
  metric_type: MetricType
  aggregation: string
  label: string
}

export interface ReportDimension {
  dimension_name: string
  dimension_type: DimensionType
  label: string
}

export interface ReportFilter {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'between'
  value: unknown}

export interface ReportConfig {
  title: string
  description?: string
  metrics: ReportMetric[]
  dimensions: ReportDimension[]
  filters: ReportFilter[]
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  limit?: number
}

export interface CustomReport {
  id: string
  report_name: string
  report_config: ReportConfig
  metrics: ReportMetric[]
  dimensions: ReportDimension[]
  filters: ReportFilter[]
  visualization_type: VisualizationType

  // Scheduling
  schedule_enabled: boolean
  schedule_frequency?: ScheduleFrequency
  schedule_time?: string // HH:MM format
  schedule_day_of_week?: number // 0-6 (Sunday-Saturday)
  schedule_day_of_month?: number // 1-31
  recipient_emails: string[]
  export_format: ExportFormat

  // Sharing
  is_public: boolean
  shared_with: string[]

  // Metadata
  created_by: string
  last_run_at?: string
  next_run_at?: string
  created_at: string
  updated_at: string
}

// ============================================================================
// EXECUTIVE DASHBOARDS
// ============================================================================

export type DashboardType = 'ceo' | 'cfo' | 'coo' | 'cro' | 'board'

export interface DashboardWidget {
  widget_id: string
  widget_type: 'kpi' | 'chart' | 'table' | 'gauge' | 'trend'
  title: string
  metric: string
  position: { x: number; y: number; w: number; h: number }
  config: Record<string, unknown>
}

export interface DashboardLayout {
  widgets: DashboardWidget[]
  columns: number
  row_height: number
}

export interface DashboardKPI {
  kpi_id: string
  kpi_name: string
  label: string
  value_type: 'currency' | 'number' | 'percentage' | 'duration'
  trend_enabled: boolean
  target?: number
  format?: string
}

export interface ExecutiveDashboard {
  id: string
  dashboard_type: DashboardType
  dashboard_name: string
  description?: string
  layout_config: DashboardLayout
  kpis: DashboardKPI[]
  refresh_interval_seconds: number
  allowed_roles: string[]

  // Metadata
  created_at: string
  updated_at: string
}

// ============================================================================
// DASHBOARD KPI VALUES
// ============================================================================

export interface KPIValue {
  current_value: number
  previous_value?: number
  change_percentage?: number
  trend: 'up' | 'down' | 'stable'
  is_positive: boolean // Whether trend direction is good
  formatted_value: string
  target?: number
  target_percentage?: number
}

export interface CEODashboardData {
  total_revenue: KPIValue
  total_leads: KPIValue
  conversion_rate: KPIValue
  active_cros: KPIValue
  growth_rate: KPIValue
  customer_acquisition_cost: KPIValue
  customer_lifetime_value: KPIValue
  net_promoter_score?: KPIValue
}

export interface CFODashboardData {
  revenue_this_month: KPIValue
  revenue_forecast: KPIValue
  customer_acquisition_cost: KPIValue
  lifetime_value: KPIValue
  burn_rate: KPIValue
  runway_months: KPIValue
  gross_margin: KPIValue
  operating_expenses: KPIValue
}

export interface COODashboardData {
  team_productivity: KPIValue
  operational_efficiency: KPIValue
  capacity_utilization: KPIValue
  avg_response_time: KPIValue
  sla_compliance: KPIValue
  system_uptime: KPIValue
  automation_rate: KPIValue
}

export interface CRODashboardData {
  pipeline_value: KPIValue
  win_rate: KPIValue
  avg_deal_size: KPIValue
  sales_cycle_days: KPIValue
  quota_attainment: KPIValue
  lead_velocity: KPIValue
  conversion_funnel: {
    stage: string
    count: number
    conversion_rate: number
  }[]
}

export interface BoardDashboardData {
  quarterly_revenue: KPIValue
  yoy_growth: KPIValue
  customer_count: KPIValue
  retention_rate: KPIValue
  market_share?: KPIValue
  strategic_initiatives: {
    initiative: string
    progress: number
    status: 'on_track' | 'at_risk' | 'delayed'
  }[]
}

// ============================================================================
// ANALYTICS CACHE
// ============================================================================

export interface AnalyticsCache {
  id: string
  cache_key: string
  cached_data: Record<string, unknown>
  data_hash: string
  expires_at: string
  access_count: number
  created_at: string
  updated_at: string
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface LeadScoringRequest {
  lead_id: string
  model_id?: string // Optional, uses production model if not specified
  force_refresh?: boolean
}

export interface LeadScoringResponse {
  success: boolean
  score: LeadScore
  model_used: string
}

export interface BulkScoringRequest {
  lead_ids: string[]
  model_id?: string
}

export interface BulkScoringResponse {
  success: boolean
  scores: LeadScore[]
  failed_leads: string[]
  processing_time_ms: number
}

export interface RevenueForecastRequest {
  period: ForecastPeriod
  method?: ForecastMethod
  include_breakdown?: boolean
}

export interface RevenueForecastResponse {
  success: boolean
  forecast: RevenueForecast
  historical_accuracy?: number
}

export interface InsightsRequest {
  category?: InsightCategory
  severity?: InsightSeverity
  limit?: number
  include_dismissed?: boolean
}

export interface InsightsResponse {
  success: boolean
  insights: BusinessInsight[]
  total_count: number
  unread_count: number
}

export interface DashboardDataRequest {
  dashboard_type: DashboardType
  date_from?: string
  date_to?: string
  refresh?: boolean
}

export interface DashboardDataResponse {
  success: boolean
  dashboard_type: DashboardType
  data: CEODashboardData | CFODashboardData | COODashboardData | CRODashboardData | BoardDashboardData
  last_updated: string
  next_refresh: string
}

export interface ReportGenerationRequest {
  report_id: string
  date_from?: string
  date_to?: string
  export_format?: ExportFormat
  email_to?: string[]
}

export interface ReportGenerationResponse {
  success: boolean
  report_url?: string
  generation_time_ms: number
  row_count: number
}

// ============================================================================
// ML TRAINING TYPES
// ============================================================================

export interface TrainingDataset {
  lead_id: string
  features: Record<string, number>
  label: boolean // true = converted, false = not converted
}

export interface ModelTrainingRequest {
  model_name: string
  model_type: MLModelType
  training_data: TrainingDataset[]
  test_split: number // 0-1 (e.g., 0.2 for 20% test data)
  hyperparameters?: Record<string, unknown>
}

export interface ModelTrainingResponse {
  success: boolean
  model_id: string
  metrics: {
    accuracy: number
    precision: number
    recall: number
    f1_score: number
    roc_auc: number
  }
  training_time_seconds: number
  feature_importance: FeatureImportance[]
}

// ============================================================================
// REAL-TIME ANALYTICS
// ============================================================================

export interface RealTimeMetric {
  metric_name: string
  current_value: number
  timestamp: string
  change_from_previous: number
  change_percentage: number
}

export interface RealTimeUpdate {
  update_type: 'metric' | 'insight' | 'alert' | 'forecast'
  data: RealTimeMetric | BusinessInsight | RevenueForecast
  timestamp: string
}

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'update' | 'ping' | 'pong'
  channel?: string
  data?: unknown}

// ============================================================================
// ANALYTICS SERVICE TYPES
// ============================================================================

export interface AnalyticsServiceConfig {
  enable_ml: boolean
  enable_forecasting: boolean
  enable_insights: boolean
  cache_ttl_seconds: number
  real_time_update_interval_seconds: number
  model_training_enabled: boolean
}

export interface AnalyticsHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  ml_service: 'online' | 'offline'
  forecasting_service: 'online' | 'offline'
  insights_engine: 'online' | 'offline'
  cache_hit_rate: number
  avg_response_time_ms: number
  last_health_check: string
}
