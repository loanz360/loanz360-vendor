'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Camera,
  FileText,
  Image,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Trash2,
  RefreshCw,
  FileWarning,
  Download,
} from 'lucide-react';

// Document type configuration
export interface DocumentTypeConfig {
  id: string;
  name: string;
  description?: string;
  category: 'identity' | 'income' | 'property' | 'bank' | 'other';
  isRequired: boolean;
  acceptedFormats: string[];
  maxSizeMB: number;
  helpText?: string;
}

// Upload status for each document
export interface DocumentUploadStatus {
  documentType: string;
  file?: File;
  fileName?: string;
  fileSize?: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'error' | 'verifying';
  progress: number;
  error?: string;
  uploadedUrl?: string;
  documentId?: string;
  thumbnailUrl?: string;
  uploadedAt?: string;
}

// Props for the component
export interface ULAPDocumentUploadProps {
  leadId: string;
  leadNumber: string;
  loanCategory?: string;
  loanSubcategory?: string;
  documents: DocumentTypeConfig[];
  onDocumentUploaded?: (documentType: string, result: DocumentUploadStatus) => void;
  onAllDocumentsUploaded?: (results: Record<string, DocumentUploadStatus>) => void;
  existingDocuments?: DocumentUploadStatus[];
  isPublicForm?: boolean;
  showCamera?: boolean;
}

// Default document configurations based on loan type
export const LOAN_DOCUMENTS: Record<string, DocumentTypeConfig[]> = {
  default: [
    {
      id: 'pan_card',
      name: 'PAN Card',
      description: 'Clear copy of PAN card (front)',
      category: 'identity',
      isRequired: true,
      acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'],
      maxSizeMB: 5,
      helpText: 'Upload a clear, readable image of your PAN card',
    },
    {
      id: 'aadhaar_front',
      name: 'Aadhaar Card (Front)',
      description: 'Front side of Aadhaar card',
      category: 'identity',
      isRequired: true,
      acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'],
      maxSizeMB: 5,
    },
    {
      id: 'aadhaar_back',
      name: 'Aadhaar Card (Back)',
      description: 'Back side of Aadhaar card',
      category: 'identity',
      isRequired: true,
      acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'],
      maxSizeMB: 5,
    },
    {
      id: 'photo',
      name: 'Passport Photo',
      description: 'Recent passport size photograph',
      category: 'identity',
      isRequired: true,
      acceptedFormats: ['.jpg', '.jpeg', '.png'],
      maxSizeMB: 2,
    },
    {
      id: 'bank_statement',
      name: 'Bank Statement (6 months)',
      description: 'Last 6 months bank statement with salary credits',
      category: 'bank',
      isRequired: true,
      acceptedFormats: ['.pdf'],
      maxSizeMB: 15,
      helpText: 'Statement should show salary credits',
    },
    {
      id: 'salary_slip',
      name: 'Salary Slips (3 months)',
      description: 'Latest 3 months salary slips',
      category: 'income',
      isRequired: true,
      acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'],
      maxSizeMB: 10,
    },
  ],
  secured: [
    {
      id: 'property_documents',
      name: 'Property Documents',
      description: 'Sale deed / Title deed / Allotment letter',
      category: 'property',
      isRequired: true,
      acceptedFormats: ['.pdf'],
      maxSizeMB: 20,
    },
    {
      id: 'property_tax_receipt',
      name: 'Property Tax Receipt',
      description: 'Latest property tax paid receipt',
      category: 'property',
      isRequired: false,
      acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'],
      maxSizeMB: 5,
    },
    {
      id: 'building_plan',
      name: 'Building Plan',
      description: 'Approved building plan if applicable',
      category: 'property',
      isRequired: false,
      acceptedFormats: ['.pdf'],
      maxSizeMB: 20,
    },
  ],
  business: [
    {
      id: 'gst_certificate',
      name: 'GST Certificate',
      description: 'GST registration certificate',
      category: 'income',
      isRequired: true,
      acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'],
      maxSizeMB: 5,
    },
    {
      id: 'business_proof',
      name: 'Business Proof',
      description: 'Shop & Establishment / MSME / Incorporation certificate',
      category: 'income',
      isRequired: true,
      acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'],
      maxSizeMB: 10,
    },
    {
      id: 'itr_2_years',
      name: 'ITR (Last 2 years)',
      description: 'Income Tax Returns for last 2 years',
      category: 'income',
      isRequired: true,
      acceptedFormats: ['.pdf'],
      maxSizeMB: 15,
    },
  ],
  vehicle: [
    {
      id: 'vehicle_rc',
      name: 'Vehicle RC',
      description: 'Registration Certificate of the vehicle',
      category: 'property',
      isRequired: true,
      acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'],
      maxSizeMB: 5,
    },
    {
      id: 'vehicle_quotation',
      name: 'Vehicle Quotation',
      description: 'Quotation from dealer (for new vehicle)',
      category: 'property',
      isRequired: false,
      acceptedFormats: ['.pdf'],
      maxSizeMB: 5,
    },
  ],
};

export function ULAPDocumentUpload({
  leadId,
  leadNumber,
  loanCategory,
  loanSubcategory,
  documents,
  onDocumentUploaded,
  onAllDocumentsUploaded,
  existingDocuments = [],
  isPublicForm = false,
  showCamera = true,
}: ULAPDocumentUploadProps) {
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, DocumentUploadStatus>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DocumentUploadStatus | null>(null);
  const [cameraOpen, setCameraOpen] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Initialize upload statuses from existing documents
  useEffect(() => {
    const initial: Record<string, DocumentUploadStatus> = {};

    documents.forEach((doc) => {
      const existing = existingDocuments.find((e) => e.documentType === doc.id);
      initial[doc.id] = existing || {
        documentType: doc.id,
        status: 'pending',
        progress: 0,
      };
    });

    setUploadStatuses(initial);
  }, [documents, existingDocuments]);

  // Handle file selection
  const handleFileSelect = useCallback(
    async (documentType: string, file: File) => {
      const docConfig = documents.find((d) => d.id === documentType);
      if (!docConfig) return;

      // Validate file type
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!docConfig.acceptedFormats.includes(fileExtension)) {
        setUploadStatuses((prev) => ({
          ...prev,
          [documentType]: {
            ...prev[documentType],
            status: 'error',
            error: `Invalid file type. Accepted: ${docConfig.acceptedFormats.join(', ')}`,
          },
        }));
        return;
      }

      // Validate file size
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > docConfig.maxSizeMB) {
        setUploadStatuses((prev) => ({
          ...prev,
          [documentType]: {
            ...prev[documentType],
            status: 'error',
            error: `File too large. Maximum size: ${docConfig.maxSizeMB}MB`,
          },
        }));
        return;
      }

      // Update status to uploading
      setUploadStatuses((prev) => ({
        ...prev,
        [documentType]: {
          documentType,
          file,
          fileName: file.name,
          fileSize: file.size,
          status: 'uploading',
          progress: 0,
        },
      }));

      try {
        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('leadId', leadId);
        formData.append('leadNumber', leadNumber);
        formData.append('documentType', documentType);
        formData.append('documentCategory', docConfig.category);
        if (loanCategory) formData.append('loanCategory', loanCategory);
        if (loanSubcategory) formData.append('loanSubcategory', loanSubcategory);

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setUploadStatuses((prev) => ({
            ...prev,
            [documentType]: {
              ...prev[documentType],
              progress: Math.min((prev[documentType]?.progress || 0) + 10, 90),
            },
          }));
        }, 200);

        // Upload to API
        const response = await fetch('/api/ulap/documents/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const result = await response.json();

        // Update status to uploaded
        const uploadedStatus: DocumentUploadStatus = {
          documentType,
          fileName: file.name,
          fileSize: file.size,
          status: 'uploaded',
          progress: 100,
          uploadedUrl: result.document?.s3Url,
          documentId: result.document?.id,
          thumbnailUrl: result.document?.thumbnailUrl,
          uploadedAt: new Date().toISOString(),
        };

        setUploadStatuses((prev) => ({
          ...prev,
          [documentType]: uploadedStatus,
        }));

        // Callback
        onDocumentUploaded?.(documentType, uploadedStatus);
      } catch (error) {
        setUploadStatuses((prev) => ({
          ...prev,
          [documentType]: {
            ...prev[documentType],
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed',
            progress: 0,
          },
        }));
      }
    },
    [leadId, leadNumber, loanCategory, loanSubcategory, documents, onDocumentUploaded]
  );

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent, documentType: string) => {
    e.preventDefault();
    setDragOver(documentType);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, documentType: string) => {
      e.preventDefault();
      setDragOver(null);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(documentType, files[0]);
      }
    },
    [handleFileSelect]
  );

  // Handle camera capture
  const startCamera = useCallback(async (documentType: string) => {
    setCameraOpen(documentType);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraOpen(null);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !cameraOpen) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `${cameraOpen}_capture.jpg`, { type: 'image/jpeg' });
            handleFileSelect(cameraOpen, file);
          }
          stopCamera();
        },
        'image/jpeg',
        0.9
      );
    }
  }, [cameraOpen, handleFileSelect]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraOpen(null);
  }, []);

  // Delete document
  const handleDelete = useCallback(
    async (documentType: string) => {
      const status = uploadStatuses[documentType];
      if (!status?.documentId) {
        // Just clear local state
        setUploadStatuses((prev) => ({
          ...prev,
          [documentType]: {
            documentType,
            status: 'pending',
            progress: 0,
          },
        }));
        return;
      }

      try {
        const response = await fetch(`/api/ulap/documents/${status.documentId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete document');
        }

        setUploadStatuses((prev) => ({
          ...prev,
          [documentType]: {
            documentType,
            status: 'pending',
            progress: 0,
          },
        }));
      } catch (error) {
        console.error('Delete error:', error);
      }
    },
    [uploadStatuses]
  );

  // Get required documents completion status
  const requiredDocs = documents.filter((d) => d.isRequired);
  const uploadedRequiredDocs = requiredDocs.filter(
    (d) => uploadStatuses[d.id]?.status === 'uploaded'
  );
  const completionPercent = requiredDocs.length > 0
    ? Math.round((uploadedRequiredDocs.length / requiredDocs.length) * 100)
    : 0;

  // Check if all required documents are uploaded
  useEffect(() => {
    if (completionPercent === 100) {
      onAllDocumentsUploaded?.(uploadStatuses);
    }
  }, [completionPercent, uploadStatuses, onAllDocumentsUploaded]);

  // Group documents by category
  const groupedDocuments = documents.reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, DocumentTypeConfig[]>);

  const categoryLabels: Record<string, string> = {
    identity: 'Identity Documents',
    income: 'Income Documents',
    property: 'Property Documents',
    bank: 'Bank Documents',
    other: 'Other Documents',
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Document Upload Progress</h3>
          <span className="text-sm text-blue-600 font-medium">
            {uploadedRequiredDocs.length} / {requiredDocs.length} Required Documents
          </span>
        </div>
        <div className="h-3 bg-blue-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-600"
            initial={{ width: 0 }}
            animate={{ width: `${completionPercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        {completionPercent === 100 && (
          <div className="mt-2 flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">All required documents uploaded!</span>
          </div>
        )}
      </div>

      {/* Document Groups */}
      {Object.entries(groupedDocuments).map(([category, docs]) => (
        <div key={category} className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            {categoryLabels[category] || category}
          </h4>

          <div className="grid gap-4 md:grid-cols-2">
            {docs.map((doc) => {
              const status = uploadStatuses[doc.id];
              const isUploaded = status?.status === 'uploaded';
              const isUploading = status?.status === 'uploading';
              const hasError = status?.status === 'error';
              const isDraggingOver = dragOver === doc.id;

              return (
                <motion.div
                  key={doc.id}
                  className={`relative rounded-xl border-2 transition-all ${
                    isDraggingOver
                      ? 'border-blue-500 bg-blue-50'
                      : isUploaded
                      ? 'border-green-300 bg-green-50'
                      : hasError
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  onDragOver={(e) => handleDragOver(e, doc.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, doc.id)}
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="p-4">
                    {/* Document Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{doc.name}</span>
                          {doc.isRequired && (
                            <span className="text-xs text-red-500 font-medium">Required</span>
                          )}
                        </div>
                        {doc.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                        )}
                      </div>

                      {/* Status Icon */}
                      {isUploaded && (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      )}
                      {isUploading && (
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                      )}
                      {hasError && (
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      )}
                    </div>

                    {/* Upload Area */}
                    {!isUploaded && !isUploading && (
                      <div className="space-y-3">
                        <div
                          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                            isDraggingOver
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                          }`}
                          onClick={() => fileInputRefs.current[doc.id]?.click()}
                        >
                          <input
                            type="file"
                            ref={(el) => {
                              fileInputRefs.current[doc.id] = el;
                            }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(doc.id, file);
                              e.target.value = '';
                            }}
                            accept={doc.acceptedFormats.join(',')}
                            className="hidden"
                          />
                          <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">
                            Drag & drop or <span className="text-blue-600">browse</span>
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {doc.acceptedFormats.join(', ')} • Max {doc.maxSizeMB}MB
                          </p>
                        </div>

                        {/* Camera Button */}
                        {showCamera && doc.acceptedFormats.some((f) => ['.jpg', '.jpeg', '.png'].includes(f)) && (
                          <button
                            onClick={() => startCamera(doc.id)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <Camera className="w-4 h-4" />
                            <span className="text-sm">Take Photo</span>
                          </button>
                        )}

                        {/* Error Message */}
                        {hasError && status?.error && (
                          <div className="flex items-start gap-2 p-2 bg-red-100 rounded-lg">
                            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-red-700">{status.error}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Uploading State */}
                    {isUploading && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-700 truncate flex-1">
                            {status?.fileName}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-blue-600"
                            initial={{ width: 0 }}
                            animate={{ width: `${status?.progress || 0}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 text-center">
                          Uploading... {status?.progress}%
                        </p>
                      </div>
                    )}

                    {/* Uploaded State */}
                    {isUploaded && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 p-2 bg-green-100 rounded-lg">
                          {status?.fileName?.match(/\.(jpg|jpeg|png)$/i) ? (
                            <Image className="w-4 h-4 text-green-600" />
                          ) : (
                            <FileText className="w-4 h-4 text-green-600" />
                          )}
                          <span className="text-sm text-gray-700 truncate flex-1">
                            {status?.fileName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {status?.fileSize
                              ? `${(status.fileSize / (1024 * 1024)).toFixed(2)} MB`
                              : ''}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {status?.uploadedUrl && (
                            <button
                              onClick={() => setPreviewDocument(status)}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                            >
                              <Eye className="w-4 h-4" />
                              Preview
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Help Text */}
                    {doc.helpText && !isUploaded && (
                      <p className="mt-2 text-xs text-gray-500 flex items-start gap-1">
                        <FileWarning className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {doc.helpText}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Camera Modal */}
      <AnimatePresence>
        {cameraOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full"
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  Take Photo: {documents.find((d) => d.id === cameraOpen)?.name}
                </h3>
                <button
                  onClick={stopCamera}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="aspect-video bg-black relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="p-4 flex justify-center gap-4">
                <button
                  onClick={stopCamera}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={capturePhoto}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Capture
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewDocument && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPreviewDocument(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{previewDocument.fileName}</h3>
                  {previewDocument.uploadedAt && (
                    <p className="text-xs text-gray-500">
                      Uploaded: {new Date(previewDocument.uploadedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {previewDocument.uploadedUrl && (
                    <a
                      href={previewDocument.uploadedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  )}
                  <button
                    onClick={() => setPreviewDocument(null)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-gray-100">
                {previewDocument.fileName?.match(/\.(jpg|jpeg|png)$/i) ? (
                  <img
                    src={previewDocument.uploadedUrl || previewDocument.thumbnailUrl}
                    alt={previewDocument.fileName}
                    className="max-w-full max-h-[70vh] mx-auto rounded-lg shadow-lg"
                  />
                ) : previewDocument.fileName?.match(/\.pdf$/i) ? (
                  <iframe
                    src={previewDocument.uploadedUrl}
                    className="w-full h-[70vh] rounded-lg shadow-lg"
                    title={previewDocument.fileName}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <FileText className="w-16 h-16 mb-4" />
                    <p>Preview not available for this file type</p>
                    {previewDocument.uploadedUrl && (
                      <a
                        href={previewDocument.uploadedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Download File
                      </a>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ULAPDocumentUpload;
