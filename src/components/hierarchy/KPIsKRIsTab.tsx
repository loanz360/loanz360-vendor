'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';

export default function KPIsKRIsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Target className="h-6 w-6" />
          KPIs & KRIs Management
        </h2>
        <p className="text-muted-foreground">
          Define and track Key Performance Indicators and Key Result Indicators
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This feature will include:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
            <li>Role-specific KPI definition and assignment</li>
            <li>KRI (Key Risk Indicators) configuration</li>
            <li>Target setting (monthly, quarterly, yearly)</li>
            <li>Weightage and scoring system</li>
            <li>Performance measurement criteria</li>
            <li>KPI/KRI templates library</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
