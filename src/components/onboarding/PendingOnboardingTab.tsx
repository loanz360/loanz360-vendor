'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Search, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PendingOnboardingTabProps {
  onUpdate: () => void;
}

interface OnboardingRecord {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_joining: string;
  status: string;
  profile_completion_percentage: number;
  documents_completion_percentage: number;
  created_at: string;
  department?: {
    name: string;
  };
  role?: {
    role_name: string;
  };
}

export default function PendingOnboardingTab({ onUpdate }: PendingOnboardingTabProps) {
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<OnboardingRecord | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/onboarding/list?status=pending,in_progress');
      const data = await response.json();

      if (data.success) {
        setRecords(data.data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch onboarding records',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching records:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (record: OnboardingRecord, action: 'approve' | 'reject') => {
    setSelectedRecord(record);
    setReviewAction(action);
    setIsReviewDialogOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedRecord) return;

    if (reviewAction === 'reject' && !rejectionReason.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a reason for rejection',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/onboarding/${selectedRecord.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: reviewAction,
          rejection_reason: rejectionReason || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: `Onboarding ${reviewAction === 'approve' ? 'approved' : 'rejected'} successfully`,
        });

        setIsReviewDialogOpen(false);
        setRejectionReason('');
        fetchRecords();
        onUpdate();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to process review',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error processing review:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter(
    (record) =>
      record.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: string; label: string }> = {
      pending: { variant: 'secondary', label: 'Pending' },
      in_progress: { variant: 'default', label: 'In Progress' },
      completed: { variant: 'default', label: 'Completed' },
      rejected: { variant: 'destructive', label: 'Rejected' },
    };

    const config = statusConfig[status] || { variant: 'secondary', label: status };

    return (
      <Badge
        variant={config.variant as unknown}
        className={
          status === 'in_progress' ? 'bg-blue-600' :
          status === 'completed' ? 'bg-green-600' : ''
        }
      >
        {config.label}
      </Badge>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pending Onboarding Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or employee ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading records...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No records match your search' : 'No pending onboarding requests'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {record.employee_id}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.first_name} {record.last_name}
                      </TableCell>
                      <TableCell>{record.email}</TableCell>
                      <TableCell>{record.department?.name || '-'}</TableCell>
                      <TableCell>{record.role?.role_name || '-'}</TableCell>
                      <TableCell>
                        {new Date(record.date_of_joining).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <div className="w-16 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${record.profile_completion_percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {record.profile_completion_percentage}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <div className="w-16 bg-muted rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${record.documents_completion_percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {record.documents_completion_percentage}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReview(record, 'approve')}
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReview(record, 'reject')}
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve' : 'Reject'} Onboarding
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'approve'
                ? 'Approve this employee onboarding and create their account?'
                : 'Reject this onboarding request. Please provide a reason.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedRecord && (
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-medium">
                  {selectedRecord.first_name} {selectedRecord.last_name}
                </p>
                <p className="text-sm text-muted-foreground">{selectedRecord.email}</p>
                <p className="text-sm text-muted-foreground">
                  Employee ID: {selectedRecord.employee_id}
                </p>
              </div>
            )}

            {reviewAction === 'reject' && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  rows={4}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsReviewDialogOpen(false);
                setRejectionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={loading}
              variant={reviewAction === 'reject' ? 'destructive' : 'default'}
            >
              {loading
                ? 'Processing...'
                : reviewAction === 'approve'
                ? 'Approve'
                : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
