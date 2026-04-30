'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Send, User, Mail, Phone, MapPin, FileText } from 'lucide-react';

interface ReviewSubmitStepProps {
  onboardingData: unknown  onSubmit: () => void;
  loading: boolean;
}

export default function ReviewSubmitStep({ onboardingData, onSubmit, loading }: ReviewSubmitStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Review & Submit
        </CardTitle>
        <CardDescription>
          Please review your information before submitting for HR approval
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Summary */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Profile Summary</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                <p className="font-medium">
                  {onboardingData.first_name} {onboardingData.last_name}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="font-medium">{onboardingData.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Phone</p>
                <p className="font-medium">{onboardingData.phone || 'Not provided'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Employee ID</p>
                <p className="font-medium">
                  <code className="bg-muted px-2 py-1 rounded">
                    {onboardingData.employee_id}
                  </code>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Address</h3>
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">
                {onboardingData.address || 'Not provided'}
              </p>
              {onboardingData.city && (
                <p className="text-sm text-muted-foreground">
                  {onboardingData.city}, {onboardingData.state} - {onboardingData.pincode}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        {onboardingData.emergency_contact_name && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Emergency Contact</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contact Name</p>
                <p className="font-medium">{onboardingData.emergency_contact_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contact Phone</p>
                <p className="font-medium">{onboardingData.emergency_contact_phone}</p>
              </div>
            </div>
          </div>
        )}

        {/* Completion Status */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Completion Status</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Profile</span>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    {onboardingData.profile_completion_percentage}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Documents</span>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    {onboardingData.documents_completion_percentage}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Important Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Ready to Submit
          </h4>
          <p className="text-sm text-blue-800">
            Your profile and documents are complete. Once you submit, HR will review your information
            and approve your onboarding. You'll receive an email notification once approved.
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <Button
            size="lg"
            onClick={onSubmit}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              'Submitting...'
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit for HR Approval
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
