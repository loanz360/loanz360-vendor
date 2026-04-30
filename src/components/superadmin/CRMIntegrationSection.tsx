'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info, Zap, TrendingUp, DollarSign, Users, MapPin } from 'lucide-react';

interface CRMIntegrationSectionProps {
  value: {
    enabled: boolean;
    crmMetric: string;
    updateFrequency: 'real-time' | 'hourly' | 'daily';
  };
  onChange: (value: unknown) => void;
  targetRole?: string;
}

export default function CRMIntegrationSection({
  value,
  onChange,
  targetRole,
}: CRMIntegrationSectionProps) {
  const [enabled, setEnabled] = useState(value?.enabled || false);
  const [crmMetric, setCrmMetric] = useState(value?.crmMetric || '');
  const [updateFrequency, setUpdateFrequency] = useState(value?.updateFrequency || 'real-time');

  const handleEnabledChange = (checked: boolean) => {
    setEnabled(checked);
    onChange({ enabled: checked, crmMetric, updateFrequency });
  };

  const handleMetricChange = (metric: string) => {
    setCrmMetric(metric);
    onChange({ enabled, crmMetric: metric, updateFrequency });
  };

  const handleFrequencyChange = (frequency: string) => {
    setUpdateFrequency(frequency as unknown);
    onChange({ enabled, crmMetric, updateFrequency: frequency });
  };

  const availableMetrics = getMetricsForRole(targetRole);

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              CRM Integration (Auto-Sync)
            </CardTitle>
            <CardDescription>
              Automatically sync incentive progress from CRM activities
            </CardDescription>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleEnabledChange}
            aria-label="Enable CRM Integration"
          />
        </div>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-6">
          {/* CRM Metric Selection */}
          <div className="space-y-2">
            <Label htmlFor="crm-metric">CRM Metric to Track</Label>
            <Select value={crmMetric} onValueChange={handleMetricChange}>
              <SelectTrigger id="crm-metric">
                <SelectValue placeholder="Select a CRM metric" />
              </SelectTrigger>
              <SelectContent>
                {availableMetrics.map((metric) => (
                  <SelectItem key={metric.value} value={metric.value}>
                    <div className="flex items-center gap-2">
                      <metric.icon className="h-4 w-4" />
                      <span>{metric.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This metric will be automatically tracked from the CRM system
            </p>
          </div>

          {/* Selected Metric Info */}
          {crmMetric && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>{getMetricLabel(crmMetric, availableMetrics)}</strong>
                <br />
                {getMetricDescription(crmMetric)}
              </AlertDescription>
            </Alert>
          )}

          {/* Update Frequency */}
          <div className="space-y-2">
            <Label htmlFor="update-frequency">Update Frequency</Label>
            <Select value={updateFrequency} onValueChange={handleFrequencyChange}>
              <SelectTrigger id="update-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="real-time">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="font-medium">Real-time</div>
                      <div className="text-xs text-muted-foreground">
                        Updates instantly when CRM activity occurs
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="hourly">
                  <div>
                    <div className="font-medium">Hourly</div>
                    <div className="text-xs text-muted-foreground">Syncs every hour</div>
                  </div>
                </SelectItem>
                <SelectItem value="daily">
                  <div>
                    <div className="font-medium">Daily</div>
                    <div className="text-xs text-muted-foreground">Syncs once per day at midnight</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Benefits */}
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
            <div className="font-semibold text-green-900 text-sm">Benefits of CRM Integration:</div>
            <ul className="text-xs text-green-800 space-y-1">
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-900 text-[10px] px-1 py-0">
                  ✓
                </Badge>
                <span>Zero manual data entry required</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-900 text-[10px] px-1 py-0">
                  ✓
                </Badge>
                <span>100% accuracy (CRM is source of truth)</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-900 text-[10px] px-1 py-0">
                  ✓
                </Badge>
                <span>Real-time progress visibility for employees</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-900 text-[10px] px-1 py-0">
                  ✓
                </Badge>
                <span>Automatic tier detection and notifications</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-900 text-[10px] px-1 py-0">
                  ✓
                </Badge>
                <span>Complete audit trail of all changes</span>
              </li>
            </ul>
          </div>

          {/* Warning */}
          <Alert variant="default" className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm">
              <strong>Note:</strong> You still need to set individual target values for each employee
              in the assignment step. The CRM will automatically update their current progress towards
              those targets.
            </AlertDescription>
          </Alert>
        </CardContent>
      )}
    </Card>
  );
}

// Helper Functions

interface MetricOption {
  value: string;
  label: string;
  icon: unknown; description: string;
  applicableRoles: string[];
}

const ALL_METRICS: MetricOption[] = [
  // CRO Metrics
  {
    value: 'leads_converted',
    label: 'Leads Converted',
    icon: TrendingUp,
    description: 'Number of leads converted to deals by CRO',
    applicableRoles: ['cro', 'customer relationship officer'],
  },
  {
    value: 'calls_made',
    label: 'Calls Made',
    icon: TrendingUp,
    description: 'Total number of calls made by CRO',
    applicableRoles: ['cro', 'customer relationship officer'],
  },
  {
    value: 'positive_calls',
    label: 'Positive Calls',
    icon: TrendingUp,
    description: 'Number of calls with positive sentiment/outcome',
    applicableRoles: ['cro', 'customer relationship officer'],
  },
  {
    value: 'conversion_rate',
    label: 'Conversion Rate',
    icon: TrendingUp,
    description: 'Percentage of contacted leads that converted',
    applicableRoles: ['cro', 'customer relationship officer'],
  },

  // BDE Metrics
  {
    value: 'deals_won',
    label: 'Deals Won',
    icon: TrendingUp,
    description: 'Number of deals successfully closed by BDE',
    applicableRoles: ['bde', 'business development'],
  },
  {
    value: 'revenue_generated',
    label: 'Revenue Generated',
    icon: DollarSign,
    description: 'Total revenue from sanctioned deals',
    applicableRoles: ['bde', 'business development'],
  },
  {
    value: 'disbursed_amount',
    label: 'Disbursed Amount',
    icon: DollarSign,
    description: 'Total amount actually disbursed to customers',
    applicableRoles: ['bde', 'business development'],
  },

  // Channel Partner Executive Metrics
  {
    value: 'partners_recruited',
    label: 'Partners Recruited',
    icon: Users,
    description: 'Number of new partners onboarded',
    applicableRoles: ['channel partner', 'cp executive'],
  },
  {
    value: 'partner_leads_generated',
    label: 'Partner Leads Generated',
    icon: TrendingUp,
    description: 'Total leads generated by managed partners',
    applicableRoles: ['channel partner', 'cp executive'],
  },
  {
    value: 'partner_leads_converted',
    label: 'Partner Leads Converted',
    icon: TrendingUp,
    description: 'Number of partner leads that converted to deals',
    applicableRoles: ['channel partner', 'cp executive'],
  },
  {
    value: 'partner_revenue',
    label: 'Partner Revenue',
    icon: DollarSign,
    description: 'Revenue generated from partner network',
    applicableRoles: ['channel partner', 'cp executive'],
  },

  // Direct Sales Metrics
  {
    value: 'field_visits',
    label: 'Field Visits',
    icon: MapPin,
    description: 'Number of field visits logged',
    applicableRoles: ['direct sales'],
  },
  {
    value: 'direct_customer_acquisitions',
    label: 'Direct Customer Acquisitions',
    icon: Users,
    description: 'Customers acquired through direct sales',
    applicableRoles: ['direct sales'],
  },
  {
    value: 'direct_revenue',
    label: 'Direct Revenue',
    icon: DollarSign,
    description: 'Revenue from direct sales activities',
    applicableRoles: ['direct sales'],
  },
];

function getMetricsForRole(role?: string): MetricOption[] {
  if (!role) return ALL_METRICS;

  const roleLower = role.toLowerCase();
  return ALL_METRICS.filter((metric) =>
    metric.applicableRoles.some((applicableRole) => roleLower.includes(applicableRole))
  );
}

function getMetricLabel(value: string, metrics: MetricOption[]): string {
  const metric = metrics.find((m) => m.value === value);
  return metric?.label || value;
}

function getMetricDescription(value: string): string {
  const metric = ALL_METRICS.find((m) => m.value === value);
  return metric?.description || '';
}
