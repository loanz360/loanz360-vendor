/**
 * Custom Report Builder
 * Drag-and-drop report builder with saved templates
 */

'use client'

import { toast } from 'sonner';

import { useState } from 'react';
import { Plus, Save, Download, Eye, Trash2 } from 'lucide-react';

interface ReportField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  category: 'incentive' | 'user' | 'allocation' | 'claim';
}

interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between';
  value: any;
}

interface ReportConfig {
  name: string;
  fields: string[];
  filters: ReportFilter[];
  groupBy?: string;
  orderBy?: string;
  limit?: number;
}

const AVAILABLE_FIELDS: ReportField[] = [
  { id: 'incentive_title', name: 'Incentive Title', type: 'string', category: 'incentive' },
  { id: 'reward_amount', name: 'Reward Amount', type: 'number', category: 'incentive' },
  { id: 'user_name', name: 'Employee Name', type: 'string', category: 'user' },
  { id: 'progress_percentage', name: 'Progress %', type: 'number', category: 'allocation' },
  { id: 'earned_amount', name: 'Earned Amount', type: 'number', category: 'allocation' },
  { id: 'claimed_amount', name: 'Claimed Amount', type: 'number', category: 'claim' },
  { id: 'tier', name: 'User Tier', type: 'string', category: 'user' },
  { id: 'start_date', name: 'Start Date', type: 'date', category: 'incentive' },
  { id: 'end_date', name: 'End Date', type: 'date', category: 'incentive' },
];

export default function CustomReportBuilder() {
  const [config, setConfig] = useState<ReportConfig>({
    name: 'New Report',
    fields: [],
    filters: [],
  });
  const [savedReports, setSavedReports] = useState<ReportConfig[]>([]);

  const addField = (fieldId: string) => {
    if (!config.fields.includes(fieldId)) {
      setConfig({ ...config, fields: [...config.fields, fieldId] });
    }
  };

  const removeField = (fieldId: string) => {
    setConfig({ ...config, fields: config.fields.filter((f) => f !== fieldId) });
  };

  const addFilter = () => {
    setConfig({
      ...config,
      filters: [...config.filters, { field: '', operator: 'equals', value: '' }],
    });
  };

  const saveReport = () => {
    setSavedReports([...savedReports, config]);
    toast.success('Report saved!');
  };

  const runReport = async () => {
    const response = await fetch('/api/v2/reports/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await response.json();
    downloadCSV(data.results, config.name);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Custom Report Builder</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Report Name</label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-3">Available Fields</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {AVAILABLE_FIELDS.map((field) => (
                <button
                  key={field.id}
                  onClick={() => addField(field.id)}
                  className="w-full text-left px-3 py-2 border rounded hover:bg-blue-50"
                >
                  <span className="font-medium">{field.name}</span>
                  <span className="text-xs text-gray-500 ml-2">({field.category})</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Selected Fields</h3>
            <div className="space-y-2">
              {config.fields.map((fieldId) => {
                const field = AVAILABLE_FIELDS.find((f) => f.id === fieldId);
                return (
                  <div key={fieldId} className="flex items-center justify-between p-3 bg-blue-50 rounded">
                    <span>{field?.name}</span>
                    <button onClick={() => removeField(fieldId)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={saveReport} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
            <Save className="w-4 h-4" /> Save Report
          </button>
          <button onClick={runReport} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2">
            <Eye className="w-4 h-4" /> Run Report
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadCSV(data: any[], filename: string) {
  const csv = [
    Object.keys(data[0]).join(','),
    ...data.map((row) => Object.values(row).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
}
