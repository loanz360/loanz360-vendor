'use client'

import React from 'react'
import { ShieldAlert, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'

interface Anomaly {
  type: string
  severity: 'warning' | 'critical'
  message: string
}

interface Props {
  anomalies: Anomaly[]
}

export default function AnomalyAlerts({ anomalies }: Props) {
  const critical = anomalies.filter(a => a.severity === 'critical')
  const warnings = anomalies.filter(a => a.severity === 'warning')

  return (
    <div className="frosted-card p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-poppins text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-orange-500" />
          Anomaly Detection
        </h2>
        {anomalies.length > 0 && (
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            critical.length > 0 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            {anomalies.length} alert{anomalies.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {anomalies.length > 0 ? (
        <div className="space-y-2">
          {critical.map((anomaly, idx) => (
            <div key={`critical-${idx}`} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-red-300 font-medium">{anomaly.message}</p>
                <p className="text-xs text-red-400/60 mt-0.5 uppercase tracking-wider">Critical</p>
              </div>
            </div>
          ))}
          {warnings.map((anomaly, idx) => (
            <div key={`warning-${idx}`} className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-yellow-300">{anomaly.message}</p>
                <p className="text-xs text-yellow-400/60 mt-0.5 uppercase tracking-wider">Warning</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-sm text-green-300 font-medium">All systems normal</p>
            <p className="text-xs text-gray-500 mt-0.5">No anomalies detected in today&apos;s operations</p>
          </div>
        </div>
      )}
    </div>
  )
}
