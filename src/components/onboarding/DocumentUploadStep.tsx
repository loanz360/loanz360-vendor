'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react';

interface DocumentUploadStepProps {
  onboardingData: unknown; onComplete: () => void;
}

interface DocumentType {
  id: string;
  document_name: string;
  document_code: string;
  description: string;
  is_mandatory: boolean;
  max_file_size_mb: number;
  allowed_formats: string[];
}

interface UploadedDocument {
  id: string;
  document_type_id: string;
  file_name: string;
  file_size_kb: number;
  file_type: string;
  storage_path: string;
  is_verified: boolean;
}

export default function DocumentUploadStep({ onboardingData, onComplete }: DocumentUploadStepProps) {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDocumentTypes();
    fetchUploadedDocuments();
  }, []);

  const fetchDocumentTypes = async () => {
    try {
      const response = await fetch('/api/onboarding/document-types');
      const data = await response.json();
      if (data.success) {
        setDocumentTypes(data.data);
      }
    } catch (error) {
      console.error('Error fetching document types:', error);
    }
  };

  const fetchUploadedDocuments = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/onboarding/my-documents');
      const data = await response.json();
      if (data.success) {
        setUploadedDocuments(data.data);
      }
    } catch (error) {
      console.error('Error fetching uploaded documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (documentType: DocumentType, file: File) => {
    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > documentType.max_file_size_mb) {
      toast({
        title: 'File Too Large',
        description: `Maximum file size is ${documentType.max_file_size_mb}MB`,
        variant: 'destructive',
      });
      return;
    }

    // Validate file type
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !documentType.allowed_formats.includes(fileExt)) {
      toast({
        title: 'Invalid File Type',
        description: `Allowed formats: ${documentType.allowed_formats.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setUploading(documentType.id);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type_id', documentType.id);

      const response = await fetch('/api/onboarding/upload-document', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: `${documentType.document_name} uploaded successfully`,
        });
        fetchUploadedDocuments();
      } else {
        toast({
          title: 'Upload Failed',
          description: data.error || 'Failed to upload document',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`/api/onboarding/delete-document/${documentId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Document deleted successfully',
        });
        fetchUploadedDocuments();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete document',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const isDocumentUploaded = (documentTypeId: string) => {
    return uploadedDocuments.some((doc) => doc.document_type_id === documentTypeId);
  };

  const getUploadedDocument = (documentTypeId: string) => {
    return uploadedDocuments.find((doc) => doc.document_type_id === documentTypeId);
  };

  const allMandatoryUploaded = documentTypes
    .filter((dt) => dt.is_mandatory)
    .every((dt) => isDocumentUploaded(dt.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Required Documents
        </CardTitle>
        <CardDescription>
          Please upload all mandatory documents to complete your onboarding
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-2">Loading documents...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {documentTypes.map((docType) => {
              const uploaded = getUploadedDocument(docType.id);
              const isUploaded = !!uploaded;
              const isUploading = uploading === docType.id;

              return (
                <Card key={docType.id} className={isUploaded ? 'border-green-200 bg-green-50' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{docType.document_name}</h4>
                          {docType.is_mandatory && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                          {isUploaded && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Uploaded
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {docType.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Max size: {docType.max_file_size_mb}MB • Formats:{' '}
                          {docType.allowed_formats.join(', ')}
                        </p>

                        {isUploaded && uploaded && (
                          <div className="mt-3 p-3 bg-white rounded border">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{uploaded.file_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {Math.round(uploaded.file_size_kb)} KB
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDocument(uploaded.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="ml-4">
                        {isUploading ? (
                          <Button disabled size="sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </Button>
                        ) : (
                          <Button
                            variant={isUploaded ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = docType.allowed_formats.map((f) => `.${f}`).join(',');
                              input.onchange = (e: unknown) => {
                                const file = e.target?.files?.[0];
                                if (file) {
                                  handleFileUpload(docType, file);
                                }
                              };
                              input.click();
                            }}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {isUploaded ? 'Replace' : 'Upload'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Continue Button */}
            <div className="flex justify-end pt-4">
              <Button
                size="lg"
                onClick={onComplete}
                disabled={!allMandatoryUploaded}
              >
                {allMandatoryUploaded ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Continue to Review
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Upload All Required Documents
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
