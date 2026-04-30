'use client'

import { toast } from 'sonner'

/**
 * Security Console
 * Comprehensive security management dashboard
 * Features:
 * - MFA management (view/enable/disable methods)
 * - Encryption key management
 * - Security scan results
 * - Anomaly detection monitoring
 * - User behavior analytics
 * - Threat detection alerts
 */

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mfaService, MFAMethod, type MFAMethodType } from '@/lib/security/mfa-service'
import { encryptionService, type EncryptionKey } from '@/lib/security/encryption-service'
import {
  Shield,
  Key,
  Scan,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  RefreshCw,
  Eye,
  EyeOff,
  Smartphone,
  Mail,
  QrCode,
  Download,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  FileText,
  Database
} from 'lucide-react'

// ==================== TYPES ====================

interface SecurityScan {
  id: string
  scan_type: 'vulnerability' | 'compliance' | 'code' | 'dependency'
  status: 'pending' | 'running' | 'completed' | 'failed'
  severity: 'low' | 'medium' | 'high' | 'critical'
  findings: number
  started_at: string
  completed_at?: string
  scan_data?: Record<string, unknown>
}

interface AnomalyDetection {
  id: string
  rule_name: string
  anomaly_type: 'login' | 'access' | 'data' | 'behavior'
  severity: 'low' | 'medium' | 'high' | 'critical'
  user_id?: string
  ip_address?: string
  user_agent?: string
  details: Record<string, unknown>
  detected_at: string
  resolved_at?: string
  resolution_notes?: string
}

interface SecurityStats {
  total_mfa_users: number
  mfa_enabled_percentage: number
  active_sessions: number
  failed_login_attempts_24h: number
  security_scans_last_week: number
  critical_vulnerabilities: number
  anomalies_detected_today: number
  encryption_keys_active: number
}

interface UserBehavior {
  user_id: string
  user_name: string
  user_email: string
  login_count: number
  last_login: string
  failed_attempts: number
  risk_score: number
  devices: number
  locations: string[]
}

// ==================== COMPONENT ====================

export default function SecurityConsole() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'mfa' | 'encryption' | 'scans' | 'anomalies' | 'behavior'>('mfa')
  const [loading, setLoading] = useState(true)

  // State
  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [mfaMethods, setMfaMethods] = useState<MFAMethod[]>([])
  const [encryptionKeys, setEncryptionKeys] = useState<EncryptionKey[]>([])
  const [securityScans, setSecurityScans] = useState<SecurityScan[]>([])
  const [anomalies, setAnomalies] = useState<AnomalyDetection[]>([])
  const [userBehavior, setUserBehavior] = useState<UserBehavior[]>([])

  // Filters
  const [scanFilter, setScanFilter] = useState<'all' | 'vulnerability' | 'compliance' | 'code' | 'dependency'>('all')
  const [anomalyFilter, setAnomalyFilter] = useState<'all' | 'resolved' | 'unresolved'>('all')
  const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all')

  // ==================== DATA FETCHING ====================

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadStats(),
        loadMFAMethods(),
        loadEncryptionKeys(),
        loadSecurityScans(),
        loadAnomalies(),
        loadUserBehavior()
      ])
    } catch (error) {
      console.error('Error loading security data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_security_stats')
      if (error) throw error
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadMFAMethods = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const methods = await mfaService.getUserMethods(user.id)
      setMfaMethods(methods)
    } catch (error) {
      console.error('Error loading MFA methods:', error)
    }
  }

  const loadEncryptionKeys = async () => {
    try {
      const keys = await encryptionService.getKeys()
      setEncryptionKeys(keys)
    } catch (error) {
      console.error('Error loading encryption keys:', error)
    }
  }

  const loadSecurityScans = async () => {
    try {
      const { data, error } = await supabase
        .from('security_scans')
        .select('id, scan_type, status, started_at, completed_at, findings_count, critical_count, high_count, medium_count, low_count')
        .order('started_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setSecurityScans(data || [])
    } catch (error) {
      console.error('Error loading security scans:', error)
    }
  }

  const loadAnomalies = async () => {
    try {
      const { data, error } = await supabase
        .from('anomaly_detections')
        .select('id, anomaly_type, severity, description, detected_at, resolved, resolved_at, user_id, ip_address')
        .order('detected_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setAnomalies(data || [])
    } catch (error) {
      console.error('Error loading anomalies:', error)
    }
  }

  const loadUserBehavior = async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_behavior_analytics')
      if (error) throw error
      setUserBehavior(data || [])
    } catch (error) {
      console.error('Error loading user behavior:', error)
    }
  }

  // ==================== ACTIONS ====================

  const handleDisableMFA = async (methodId: string) => {
    if (!confirm('Are you sure you want to disable this MFA method?')) return

    try {
      const result = await mfaService.disableMethod(methodId)
      if (result.success) {
        await loadMFAMethods()
        toast.success('MFA method disabled successfully')
      } else {
        toast.error(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error disabling MFA:', error)
      toast.error('Failed to disable MFA method')
    }
  }

  const handleRotateKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to rotate this encryption key? This will require re-encrypting data.')) return

    const masterPassword = prompt('Enter master password to rotate key:')
    if (!masterPassword) return

    try {
      const result = await encryptionService.rotateKey(keyId, masterPassword)
      if (result.success) {
        await loadEncryptionKeys()
        toast.success('Encryption key rotated successfully')
      } else {
        toast.error(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error rotating key:', error)
      toast.error('Failed to rotate encryption key')
    }
  }

  const handleRunScan = async (scanType: 'vulnerability' | 'compliance' | 'code' | 'dependency') => {
    if (!confirm(`Start ${scanType} scan? This may take several minutes.`)) return

    try {
      const { data, error } = await supabase
        .from('security_scans')
        .insert({
          scan_type: scanType,
          status: 'pending'
        })
        .select()
        .maybeSingle()

      if (error) throw error

      // Trigger scan in background
      await supabase.rpc('trigger_security_scan', { scan_id: data.id })

      toast.info('Security scan started. Results will appear when complete.')
      await loadSecurityScans()
    } catch (error) {
      console.error('Error starting scan:', error)
      toast.error('Failed to start security scan')
    }
  }

  const handleResolveAnomaly = async (anomalyId: string) => {
    const notes = prompt('Enter resolution notes:')
    if (!notes) return

    try {
      const { error } = await supabase
        .from('anomaly_detections')
        .update({
          resolved_at: new Date().toISOString(),
          resolution_notes: notes
        })
        .eq('id', anomalyId)

      if (error) throw error

      await loadAnomalies()
      toast.info('Anomaly marked as resolved')
    } catch (error) {
      console.error('Error resolving anomaly:', error)
      toast.error('Failed to resolve anomaly')
    }
  }

  // ==================== FILTERS ====================

  const filteredScans = securityScans.filter(scan => {
    if (scanFilter !== 'all' && scan.scan_type !== scanFilter) return false
    if (severityFilter !== 'all' && scan.severity !== severityFilter) return false
    return true
  })

  const filteredAnomalies = anomalies.filter(anomaly => {
    if (anomalyFilter === 'resolved' && !anomaly.resolved_at) return false
    if (anomalyFilter === 'unresolved' && anomaly.resolved_at) return false
    if (severityFilter !== 'all' && anomaly.severity !== severityFilter) return false
    return true
  })

  // ==================== HELPERS ====================

  const getMFAIcon = (method: MFAMethodType) => {
    switch (method) {
      case 'totp':
        return <Smartphone className="w-4 h-4" />
      case 'sms':
        return <Smartphone className="w-4 h-4" />
      case 'email':
        return <Mail className="w-4 h-4" />
      case 'backup_codes':
        return <Key className="w-4 h-4" />
      default:
        return <Shield className="w-4 h-4" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50'
      case 'high':
        return 'text-orange-600 bg-orange-50'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50'
      case 'low':
        return 'text-blue-600 bg-blue-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600 bg-red-50'
    if (score >= 60) return 'text-orange-600 bg-orange-50'
    if (score >= 40) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Security Console</h1>
          <p className="text-gray-600">Monitor and manage system security</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4 inline mr-2" />
          Refresh
        </button>
      </div>

      {/* Stats Dashboard */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">MFA Adoption</p>
                <p className="text-2xl font-bold text-gray-900">{stats.mfa_enabled_percentage}%</p>
                <p className="text-xs text-gray-500">{stats.total_mfa_users} users</p>
              </div>
              <Shield className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Sessions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active_sessions}</p>
                <p className="text-xs text-gray-500">{stats.failed_login_attempts_24h} failed logins</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Critical Vulnerabilities</p>
                <p className="text-2xl font-bold text-gray-900">{stats.critical_vulnerabilities}</p>
                <p className="text-xs text-gray-500">{stats.security_scans_last_week} scans this week</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Anomalies Today</p>
                <p className="text-2xl font-bold text-gray-900">{stats.anomalies_detected_today}</p>
                <p className="text-xs text-gray-500">{stats.encryption_keys_active} active keys</p>
              </div>
              <Activity className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'mfa', label: 'MFA Management', icon: Shield },
            { id: 'encryption', label: 'Encryption Keys', icon: Key },
            { id: 'scans', label: 'Security Scans', icon: Scan },
            { id: 'anomalies', label: 'Anomaly Detection', icon: AlertTriangle },
            { id: 'behavior', label: 'User Behavior', icon: Activity }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as unknown)}
              className={`
                flex items-center py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <tab.icon className="w-5 h-5 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* MFA Management */}
        {activeTab === 'mfa' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">MFA Methods</h2>
              <button
                onClick={() => window.location.href = '/security/mfa-setup'}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Setup New Method
              </button>
            </div>

            {mfaMethods.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No MFA methods configured</p>
                <button
                  onClick={() => window.location.href = '/security/mfa-setup'}
                  className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Setup your first method
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {mfaMethods.map(method => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-lg ${method.is_enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {getMFAIcon(method.method_type)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900 capitalize">{method.method_type.replace(/_/g, ' ')}</h3>
                          {method.is_enabled ? (
                            <span className="px-2 py-1 text-xs font-medium text-green-600 bg-green-50 rounded">
                              Enabled
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded">
                              Disabled
                            </span>
                          )}
                          {method.is_primary && (
                            <span className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded">
                              Primary
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {method.method_type === 'totp' && 'Authenticator app (TOTP)'}
                          {method.method_type === 'sms' && `SMS to ${method.phone_number || 'phone'}`}
                          {method.method_type === 'email' && `Email to ${method.email || 'email'}`}
                          {method.method_type === 'backup_codes' && 'Recovery codes'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Created {new Date(method.created_at).toLocaleDateString()}
                          {method.last_used_at && ` • Last used ${new Date(method.last_used_at).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {method.is_enabled && (
                        <button
                          onClick={() => handleDisableMFA(method.id)}
                          className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700"
                        >
                          Disable
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Encryption Keys */}
        {activeTab === 'encryption' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Encryption Keys</h2>
              <button
                onClick={() => toast.info('Generate new key feature coming soon')}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Generate New Key
              </button>
            </div>

            <div className="space-y-3">
              {encryptionKeys.map(key => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${key.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">{key.key_id}</h3>
                        <span className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded">
                          v{key.key_version}
                        </span>
                        {key.is_active ? (
                          <span className="px-2 py-1 text-xs font-medium text-green-600 bg-green-50 rounded">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded">
                            Rotated
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{key.purpose || 'No description'}</p>
                      <p className="text-xs text-gray-500">
                        {key.encryption_algorithm.toUpperCase()} • Created {new Date(key.created_at).toLocaleDateString()}
                        {key.rotated_at && ` • Rotated ${new Date(key.rotated_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {key.is_active && (
                      <button
                        onClick={() => handleRotateKey(key.key_id)}
                        className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Rotate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Scans */}
        {activeTab === 'scans' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Security Scans</h2>
              <div className="flex items-center space-x-2">
                <select
                  value={scanFilter}
                  onChange={e => setScanFilter(e.target.value as unknown)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="all">All Types</option>
                  <option value="vulnerability">Vulnerability</option>
                  <option value="compliance">Compliance</option>
                  <option value="code">Code</option>
                  <option value="dependency">Dependency</option>
                </select>
                <select
                  value={severityFilter}
                  onChange={e => setSeverityFilter(e.target.value as unknown)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <button
                  onClick={() => toast.info('Select scan type')}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Run Scan
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {filteredScans.map(scan => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${getSeverityColor(scan.severity)}`}>
                      <Scan className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900 capitalize">{scan.scan_type}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${getSeverityColor(scan.severity)}`}>
                          {scan.severity}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${
                          scan.status === 'completed' ? 'text-green-600 bg-green-50' :
                          scan.status === 'failed' ? 'text-red-600 bg-red-50' :
                          scan.status === 'running' ? 'text-blue-600 bg-blue-50' :
                          'text-gray-600 bg-gray-50'
                        }`}>
                          {scan.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{scan.findings} findings</p>
                      <p className="text-xs text-gray-500">
                        Started {new Date(scan.started_at).toLocaleString()}
                        {scan.completed_at && ` • Completed ${new Date(scan.completed_at).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                  <button className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                    View Details
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Anomaly Detection */}
        {activeTab === 'anomalies' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Anomaly Detection</h2>
              <div className="flex items-center space-x-2">
                <select
                  value={anomalyFilter}
                  onChange={e => setAnomalyFilter(e.target.value as unknown)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="all">All Anomalies</option>
                  <option value="unresolved">Unresolved</option>
                  <option value="resolved">Resolved</option>
                </select>
                <select
                  value={severityFilter}
                  onChange={e => setSeverityFilter(e.target.value as unknown)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {filteredAnomalies.map(anomaly => (
                <div
                  key={anomaly.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${getSeverityColor(anomaly.severity)}`}>
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">{anomaly.rule_name}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${getSeverityColor(anomaly.severity)}`}>
                          {anomaly.severity}
                        </span>
                        {anomaly.resolved_at ? (
                          <span className="px-2 py-1 text-xs font-medium text-green-600 bg-green-50 rounded">
                            Resolved
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded">
                            Unresolved
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 capitalize">{anomaly.anomaly_type} anomaly</p>
                      <p className="text-xs text-gray-500">
                        {anomaly.ip_address && `IP: ${anomaly.ip_address}`}
                        {anomaly.ip_address && anomaly.detected_at && ' • '}
                        Detected {new Date(anomaly.detected_at).toLocaleString()}
                      </p>
                      {anomaly.resolution_notes && (
                        <p className="text-xs text-gray-500 mt-1">
                          Resolution: {anomaly.resolution_notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!anomaly.resolved_at && (
                      <button
                        onClick={() => handleResolveAnomaly(anomaly.id)}
                        className="px-3 py-1 text-sm font-medium text-green-600 hover:text-green-700"
                      >
                        Resolve
                      </button>
                    )}
                    <button className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                      Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Behavior */}
        {activeTab === 'behavior' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">User Behavior Analytics</h2>
            <div className="space-y-3">
              {userBehavior.map(user => (
                <div
                  key={user.user_id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${getRiskColor(user.risk_score)}`}>
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">{user.user_name}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getRiskColor(user.risk_score)}`}>
                          Risk: {user.risk_score}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{user.user_email}</p>
                      <p className="text-xs text-gray-500">
                        {user.login_count} logins • {user.failed_attempts} failed • {user.devices} devices
                        {user.locations.length > 0 && ` • Locations: ${user.locations.join(', ')}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        Last login: {new Date(user.last_login).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                    View Profile
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
