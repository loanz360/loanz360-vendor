'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RiskItem, OpportunityItem, WhatIfScenario } from '@/types/bdm-team-performance'
import {
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Target,
  Clock,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { formatCurrency } from '@/lib/bdm/team-performance-utils'
import { useState } from 'react'

interface RiskOpportunityDashboardProps {
  risks: RiskItem[]
  opportunities: OpportunityItem[]
  scenarios: WhatIfScenario[]
}

export default function RiskOpportunityDashboard({
  risks,
  opportunities,
  scenarios,
}: RiskOpportunityDashboardProps) {
  const [activeTab, setActiveTab] = useState<'risks' | 'opportunities' | 'scenarios'>('risks')

  return (
    <div className="space-y-6">
      {/* Tab Selector */}
      <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('risks')}
          className={`flex-1 px-4 py-2 rounded-md font-medium text-sm transition-all ${
            activeTab === 'risks'
              ? 'bg-white text-red-700 shadow-md'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Risks ({risks.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('opportunities')}
          className={`flex-1 px-4 py-2 rounded-md font-medium text-sm transition-all ${
            activeTab === 'opportunities'
              ? 'bg-white text-green-700 shadow-md'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Opportunities ({opportunities.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('scenarios')}
          className={`flex-1 px-4 py-2 rounded-md font-medium text-sm transition-all ${
            activeTab === 'scenarios'
              ? 'bg-white text-purple-700 shadow-md'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Lightbulb className="h-4 w-4" />
            What-If Scenarios ({scenarios.length})
          </div>
        </button>
      </div>

      {/* Risks Tab */}
      {activeTab === 'risks' && (
        <div className="space-y-4">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Risk Management
          </CardTitle>

          {risks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-400" />
                <p className="text-sm">No significant risks identified</p>
              </CardContent>
            </Card>
          ) : (
            risks.map((risk) => (
              <Card
                key={risk.id}
                className={`border-2 ${
                  risk.severity === 'critical'
                    ? 'border-red-500 bg-red-50'
                    : risk.severity === 'high'
                    ? 'border-orange-500 bg-orange-50'
                    : risk.severity === 'medium'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-blue-500 bg-blue-50'
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-lg ${
                        risk.severity === 'critical'
                          ? 'bg-red-200'
                          : risk.severity === 'high'
                          ? 'bg-orange-200'
                          : risk.severity === 'medium'
                          ? 'bg-yellow-200'
                          : 'bg-blue-200'
                      }`}
                    >
                      <AlertTriangle
                        className={`h-6 w-6 ${
                          risk.severity === 'critical'
                            ? 'text-red-700'
                            : risk.severity === 'high'
                            ? 'text-orange-700'
                            : risk.severity === 'medium'
                            ? 'text-yellow-700'
                            : 'text-blue-700'
                        }`}
                      />
                    </div>

                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{risk.title}</h3>
                          <p className="text-sm text-gray-700 mt-1">{risk.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              risk.severity === 'critical'
                                ? 'bg-red-600 text-white'
                                : risk.severity === 'high'
                                ? 'bg-orange-600 text-white'
                                : risk.severity === 'medium'
                                ? 'bg-yellow-600 text-white'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            {risk.severity.toUpperCase()}
                          </span>
                          <div className="text-xs text-gray-600">
                            Probability: {risk.probability}%
                          </div>
                        </div>
                      </div>

                      {/* Impact */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4 p-4 bg-white/70 rounded-lg border">
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Potential Loss (Conversions)</div>
                          <div className="text-2xl font-bold text-red-700">
                            -{risk.impact.potentialLoss.conversions}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Potential Loss (Revenue)</div>
                          <div className="text-2xl font-bold text-red-700">
                            -{formatCurrency(risk.impact.potentialLoss.revenue, true)}
                          </div>
                        </div>
                      </div>

                      {/* Mitigation */}
                      <div className="mt-4 p-4 bg-white rounded-lg border">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">Mitigation Plan</h4>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              risk.mitigation.status === 'mitigated'
                                ? 'bg-green-100 text-green-800'
                                : risk.mitigation.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {risk.mitigation.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>
                        <ul className="space-y-1 mb-3">
                          {risk.mitigation.actions.map((action, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                              <ArrowRight className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
                              {action}
                            </li>
                          ))}
                        </ul>
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>
                            <strong>Owner:</strong> {risk.mitigation.owner}
                          </span>
                          <span>
                            <Clock className="h-3 w-3 inline mr-1" />
                            <strong>Deadline:</strong> {risk.mitigation.deadline}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Opportunities Tab */}
      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Growth Opportunities
          </CardTitle>

          {opportunities.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Lightbulb className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No opportunities identified</p>
              </CardContent>
            </Card>
          ) : (
            opportunities.map((opp) => (
              <Card
                key={opp.id}
                className="border-2 border-green-400 bg-gradient-to-br from-green-50 to-green-100"
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-green-200">
                      <TrendingUp className="h-6 w-6 text-green-700" />
                    </div>

                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{opp.title}</h3>
                          <p className="text-sm text-gray-700 mt-1">{opp.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              opp.priority === 'high'
                                ? 'bg-green-600 text-white'
                                : opp.priority === 'medium'
                                ? 'bg-yellow-600 text-white'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            {opp.priority.toUpperCase()} PRIORITY
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              opp.effort === 'low'
                                ? 'bg-green-100 text-green-800'
                                : opp.effort === 'medium'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {opp.effort.toUpperCase()} EFFORT
                          </span>
                        </div>
                      </div>

                      {/* Potential */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4 p-4 bg-white rounded-lg border-2 border-green-300">
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Additional Conversions</div>
                          <div className="text-2xl font-bold text-green-700">
                            +{opp.potential.additionalConversions}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Additional Revenue</div>
                          <div className="text-2xl font-bold text-green-700">
                            +{formatCurrency(opp.potential.additionalRevenue, true)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Timeframe</div>
                          <div className="text-xl font-bold text-gray-900">
                            {opp.potential.timeframe}
                          </div>
                        </div>
                      </div>

                      {/* Requirements */}
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2 text-sm">Requirements:</h4>
                        <div className="flex flex-wrap gap-2">
                          {opp.requirements.map((req, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-white rounded-full text-xs border border-gray-300"
                            >
                              {req}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Action Plan */}
                      <div className="p-4 bg-white rounded-lg border-2 border-green-300">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">Next Steps</h4>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              opp.action.status === 'realized'
                                ? 'bg-green-100 text-green-800'
                                : opp.action.status === 'in_execution'
                                ? 'bg-blue-100 text-blue-800'
                                : opp.action.status === 'planned'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {opp.action.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {opp.action.nextSteps.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                              <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
                              {step}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 text-xs text-gray-600">
                          <strong>Owner:</strong> {opp.action.owner}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* What-If Scenarios Tab */}
      {activeTab === 'scenarios' && (
        <div className="space-y-4">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            What-If Scenario Analysis
          </CardTitle>

          {scenarios.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Lightbulb className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No scenarios generated</p>
              </CardContent>
            </Card>
          ) : (
            scenarios.map((scenario) => (
              <Card
                key={scenario.scenarioId}
                className="border-2 border-purple-400 bg-gradient-to-br from-purple-50 to-purple-100"
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-purple-200">
                      <Sparkles className="h-6 w-6 text-purple-700" />
                    </div>

                    <div className="flex-1">
                      {/* Header */}
                      <div className="mb-3">
                        <h3 className="text-lg font-bold text-gray-900">{scenario.scenarioName}</h3>
                        <p className="text-sm text-gray-700 mt-1">{scenario.scenarioDescription}</p>
                      </div>

                      {/* Assumptions */}
                      <div className="mb-4 p-4 bg-white rounded-lg border">
                        <h4 className="font-semibold text-gray-900 mb-3 text-sm">Assumptions:</h4>
                        {scenario.assumptions.map((assumption, idx) => (
                          <div key={idx} className="flex items-center justify-between mb-2 text-sm">
                            <span className="text-gray-700">{assumption.parameter}:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">{assumption.currentValue}</span>
                              <ArrowRight className="h-4 w-4 text-purple-600" />
                              <span className="font-bold text-purple-700">{assumption.adjustedValue}</span>
                              <span
                                className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                                  assumption.change.startsWith('+')
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {assumption.change}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Projected Outcome */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-white rounded-lg border-2 border-purple-300">
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Projected Conversions</div>
                          <div className="text-2xl font-bold text-purple-700">
                            {scenario.projectedOutcome.conversions}
                          </div>
                          <div className="text-xs text-green-600 font-medium">
                            +{scenario.projectedOutcome.conversionChange}% increase
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Projected Revenue</div>
                          <div className="text-2xl font-bold text-purple-700">
                            {formatCurrency(scenario.projectedOutcome.revenue, true)}
                          </div>
                          <div className="text-xs text-green-600 font-medium">
                            +{scenario.projectedOutcome.revenueChange}% increase
                          </div>
                        </div>
                      </div>

                      {/* Feasibility & Effort */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-3 bg-white rounded-lg border text-center">
                          <div className="text-xs text-gray-600 mb-1">Feasibility</div>
                          <div
                            className={`text-lg font-bold ${
                              scenario.feasibility === 'high'
                                ? 'text-green-700'
                                : scenario.feasibility === 'medium'
                                ? 'text-yellow-700'
                                : 'text-red-700'
                            }`}
                          >
                            {scenario.feasibility.toUpperCase()}
                          </div>
                        </div>
                        <div className="p-3 bg-white rounded-lg border text-center">
                          <div className="text-xs text-gray-600 mb-1">Effort Required</div>
                          <div
                            className={`text-lg font-bold ${
                              scenario.effort === 'low'
                                ? 'text-green-700'
                                : scenario.effort === 'medium'
                                ? 'text-yellow-700'
                                : 'text-red-700'
                            }`}
                          >
                            {scenario.effort.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {/* Implementation Steps */}
                      {scenario.implementationSteps && scenario.implementationSteps.length > 0 && (
                        <div className="p-4 bg-white rounded-lg border-2 border-purple-300">
                          <h4 className="font-semibold text-gray-900 mb-2 text-sm">
                            Implementation Steps:
                          </h4>
                          <ul className="space-y-1">
                            {scenario.implementationSteps.map((step, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="text-purple-600 font-bold">{idx + 1}.</span>
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
