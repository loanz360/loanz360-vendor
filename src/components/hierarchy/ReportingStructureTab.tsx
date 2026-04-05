'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GitBranch } from 'lucide-react';

export default function ReportingStructureTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <GitBranch className="h-6 w-6" />
          Reporting Structure & Org Chart
        </h2>
        <p className="text-muted-foreground">
          Visualize and manage reporting relationships across the organization
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
            <li>Interactive organization chart visualization</li>
            <li>Hierarchical tree view with drag-and-drop</li>
            <li>Reporting relationship management</li>
            <li>Department-level org charts</li>
            <li>Export org chart as PDF/PNG</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
