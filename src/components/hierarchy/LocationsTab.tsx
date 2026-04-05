'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

export default function LocationsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-6 w-6" />
          Location Mappings
        </h2>
        <p className="text-muted-foreground">
          Manage office locations and department-location assignments
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
            <li>Office location management</li>
            <li>Department-to-location mapping</li>
            <li>Multi-location support for departments</li>
            <li>Location hierarchy (HQ, Regional, Branch)</li>
            <li>Address and contact information</li>
            <li>Location-based reporting and analytics</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
