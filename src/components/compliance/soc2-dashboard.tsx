'use client'

/**
 * SOC 2 Compliance Dashboard
 * Control testing, vendor risk management, and compliance tracking
 */

import { useState, useEffect } from 'react'
import {
  soc2Service,
  type SOC2Control,
  type ControlTest,
  type VendorRiskAssessment,
  type TrustServiceCategory
} from '@/lib/compliance/soc2-service'

const TSC_COLORS: Record<TrustServiceCategory, string> = {
  security: 'bg-blue-500',
  availability: 'bg-green-500',
  processing_integrity: 'bg-purple-500',
  confidentiality: 'bg-orange-500',
  privacy: 'bg-pink-500'
}

const TSC_LABELS: Record<TrustServiceCategory, string> = {
  security: 'Security (CC6)',
  availability: 'Availability (CC7)',
  processing_integrity: 'Processing Integrity (CC8)',
  confidentiality: 'Confidentiality (CC9)',
  privacy: 'Privacy (CC10)'
}

export default function SOC2Dashboard() {
  const [activeTab, setActiveTab] = useState<'controls' | 'testing' | 'vendors'>('controls')
  const [controls, setControls] = useState<SOC2Control[]>([])
  const [tests, setTests] = useState<ControlTest[]>([])
  const [vendors, setVendors] = useState<VendorRiskAssessment[]>([])
  const [loading, setLoading] = useState(true)

  const [controlStats, setControlStats] = useState({
    total_controls: 0,
    implemented: 0,
    not_implemented: 0,
    implementation_percentage: 0,
    by_category: {} as Record<TrustServiceCategory, { total: number; implemented: number }>
  })

  const [testStats, setTestStats] = useState({
    total_tests: 0,
    passed: 0,
    failed: 0,
    pass_rate: 0,
    total_exceptions: 0,
    controls_tested: 0,
    controls_not_tested: 0
  })

  const [vendorStats, setVendorStats] = useState({
    total_vendors: 0,
    by_risk_level: { low: 0, medium: 0, high: 0, critical: 0 },
    with_soc2: 0,
    with_iso27001: 0,
    reviews_due: 0
  })

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)

    if (activeTab === 'controls') {
      const [controlsData, stats] = await Promise.all([
        soc2Service.getControls(),
        soc2Service.getControlStats()
      ])
      setControls(controlsData)
      setControlStats(stats)
    } else if (activeTab === 'testing') {
      const [testsData, stats, controlsDue] = await Promise.all([
        soc2Service.getControlTests(),
        soc2Service.getTestingStats(),
        soc2Service.getControlsDueForTesting()
      ])
      setTests(testsData)
      setTestStats(stats)
    } else if (activeTab === 'vendors') {
      const [vendorsData, stats] = await Promise.all([
        soc2Service.getVendorAssessments(),
        soc2Service.getVendorRiskStats()
      ])
      setVendors(vendorsData)
      setVendorStats(stats)
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">SOC 2 Compliance Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Manage Trust Service Criteria controls, testing, and vendor risk assessments
        </p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600 font-medium">Control Implementation</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {controlStats.implementation_percentage.toFixed(0)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {controlStats.implemented}/{controlStats.total_controls} controls
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-sm text-gray-600 font-medium">Test Pass Rate</div>
          <div className="text-3xl font-bold text-green-600 mt-1">
            {testStats.pass_rate.toFixed(0)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {testStats.passed}/{testStats.total_tests} tests passed
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="text-sm text-gray-600 font-medium">Vendor Risk</div>
          <div className="text-3xl font-bold text-orange-600 mt-1">
            {vendorStats.by_risk_level.high + vendorStats.by_risk_level.critical}
          </div>
          <div className="text-xs text-gray-500 mt-1">High/Critical risk vendors</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="text-sm text-gray-600 font-medium">Reviews Due</div>
          <div className="text-3xl font-bold text-purple-600 mt-1">{vendorStats.reviews_due}</div>
          <div className="text-xs text-gray-500 mt-1">Vendor assessments overdue</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('controls')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'controls'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Controls ({controlStats.total_controls})
            </button>
            <button
              onClick={() => setActiveTab('testing')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'testing'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Control Testing ({testStats.total_tests})
            </button>
            <button
              onClick={() => setActiveTab('vendors')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'vendors'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Vendor Risk ({vendorStats.total_vendors})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'controls' && <ControlsTab controls={controls} stats={controlStats} loading={loading} />}
          {activeTab === 'testing' && <TestingTab tests={tests} stats={testStats} loading={loading} />}
          {activeTab === 'vendors' && <VendorsTab vendors={vendors} stats={vendorStats} loading={loading} />}
        </div>
      </div>

      {/* SOC 2 Info */}
      <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
        <h3 className="text-lg font-semibold text-purple-900 mb-3">
          🔒 SOC 2 Trust Service Criteria
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
          {Object.entries(TSC_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-start space-x-2">
              <div className={`w-3 h-3 rounded-full ${TSC_COLORS[key as TrustServiceCategory]} mt-1`} />
              <div>
                <div className="font-semibold text-purple-900">{label}</div>
                <div className="text-purple-700 text-xs mt-1">
                  {controlStats.by_category[key as TrustServiceCategory]?.implemented || 0}/
                  {controlStats.by_category[key as TrustServiceCategory]?.total || 0} controls
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ==================== CONTROLS TAB ====================

interface ControlsTabProps {
  controls: SOC2Control[]
  stats: any
  loading: boolean
}

function ControlsTab({ controls, stats, loading }: ControlsTabProps) {
  const [filter, setFilter] = useState<TrustServiceCategory | 'all'>('all')

  const filteredControls = filter === 'all' ? controls : controls.filter((c) => c.trust_service_category === filter)

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">Filter by Category:</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as TrustServiceCategory | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories ({controls.length})</option>
          <option value="security">Security - CC6 ({stats.by_category.security?.total || 0})</option>
          <option value="availability">Availability - CC7 ({stats.by_category.availability?.total || 0})</option>
          <option value="processing_integrity">
            Processing Integrity - CC8 ({stats.by_category.processing_integrity?.total || 0})
          </option>
          <option value="confidentiality">Confidentiality - CC9 ({stats.by_category.confidentiality?.total || 0})</option>
          <option value="privacy">Privacy - CC10 ({stats.by_category.privacy?.total || 0})</option>
        </select>
      </div>

      {/* Controls List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading controls...</div>
        ) : filteredControls.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No controls found</div>
        ) : (
          filteredControls.map((control) => (
            <div key={control.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-mono font-bold">
                      {control.control_id}
                    </span>
                    <span className={`px-2 py-1 ${TSC_COLORS[control.trust_service_category]} text-white rounded text-xs font-semibold`}>
                      {TSC_LABELS[control.trust_service_category]}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        control.is_implemented ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {control.is_implemented ? '✓ Implemented' : '✗ Not Implemented'}
                    </span>
                  </div>

                  <h4 className="text-lg font-semibold text-gray-900 mt-2">{control.control_name}</h4>

                  <p className="text-sm text-gray-600 mt-1">{control.control_objective}</p>

                  <div className="flex items-center space-x-6 mt-3 text-xs text-gray-500">
                    <div>
                      <strong>Type:</strong> {control.control_type}
                    </div>
                    <div>
                      <strong>Frequency:</strong> {control.control_frequency}
                    </div>
                    {control.control_owner && (
                      <div>
                        <strong>Owner:</strong> {control.control_owner}
                      </div>
                    )}
                  </div>
                </div>

                <button className="ml-4 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium">
                  Edit
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ==================== TESTING TAB ====================

interface TestingTabProps {
  tests: ControlTest[]
  stats: any
  loading: boolean
}

function TestingTab({ tests, stats, loading }: TestingTabProps) {
  return (
    <div className="space-y-4">
      {/* Testing Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-sm text-green-700 font-medium">Tests Passed</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.passed}</div>
        </div>

        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="text-sm text-red-700 font-medium">Tests Failed</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{stats.failed}</div>
        </div>

        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="text-sm text-orange-700 font-medium">Exceptions Found</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">{stats.total_exceptions}</div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="text-sm text-purple-700 font-medium">Controls Not Tested</div>
          <div className="text-2xl font-bold text-purple-600 mt-1">{stats.controls_not_tested}</div>
        </div>
      </div>

      {/* Recent Tests */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Control Tests</h3>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Control</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tester</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exceptions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Loading tests...
                  </td>
                </tr>
              ) : tests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No tests recorded
                  </td>
                </tr>
              ) : (
                tests.slice(0, 10).map((test) => (
                  <tr key={test.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(test.test_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{test.control_id.substring(0, 8)}...</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          test.test_result === 'pass'
                            ? 'bg-green-100 text-green-700'
                            : test.test_result === 'fail'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {test.test_result}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{test.tester_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{test.exceptions_found}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="text-blue-600 hover:text-blue-800 font-medium">View Details</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ==================== VENDORS TAB ====================

interface VendorsTabProps {
  vendors: VendorRiskAssessment[]
  stats: any
  loading: boolean
}

function VendorsTab({ vendors, stats, loading }: VendorsTabProps) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-700'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700'
      case 'high':
        return 'bg-orange-100 text-orange-700'
      case 'critical':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="space-y-4">
      {/* Vendor Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-sm text-green-700 font-medium">Low Risk</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.by_risk_level.low}</div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="text-sm text-yellow-700 font-medium">Medium Risk</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.by_risk_level.medium}</div>
        </div>

        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="text-sm text-orange-700 font-medium">High Risk</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">{stats.by_risk_level.high}</div>
        </div>

        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="text-sm text-red-700 font-medium">Critical Risk</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{stats.by_risk_level.critical}</div>
        </div>
      </div>

      {/* Vendors List */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Vendor Risk Assessments</h3>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading vendors...</div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No vendor assessments found</div>
          ) : (
            vendors.map((vendor) => (
              <div key={vendor.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-lg font-semibold text-gray-900">{vendor.vendor_name}</h4>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(vendor.risk_level)}`}>
                        {vendor.risk_level.toUpperCase()} RISK
                      </span>
                      {vendor.has_soc2_report && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                          SOC 2 Type {vendor.soc2_report_type}
                        </span>
                      )}
                      {vendor.has_iso27001 && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">ISO 27001</span>
                      )}
                    </div>

                    <div className="flex items-center space-x-6 mt-3 text-sm text-gray-600">
                      <div>
                        <strong>Type:</strong> {vendor.vendor_type}
                      </div>
                      <div>
                        <strong>Inherent Risk:</strong> {vendor.inherent_risk_score}/100
                      </div>
                      <div>
                        <strong>Residual Risk:</strong> {vendor.residual_risk_score}/100
                      </div>
                      <div>
                        <strong>Status:</strong> {vendor.approval_status}
                      </div>
                    </div>
                  </div>

                  <button className="ml-4 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium">
                    View Assessment
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
