/**
 * Document Upload Section Component
 * Premium document upload with drag-drop, preview, and verification
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { DocumentType, DocumentConfig, UploadedDocument, VerificationStatus } from '../types';

// =====================================================
// ICONS
// =====================================================

const UploadIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

const DocumentIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const PhotoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

const LoadingIcon = ({ className }: { className?: string }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// =====================================================
// DOCUMENT ICONS BY TYPE
// =====================================================

const DocumentTypeIcons: Record<string, React.FC<{ className?: string }>> = {
  PAN: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
    </svg>
  ),
  AADHAAR: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
    </svg>
  ),
  SALARY_SLIP: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  BANK_STATEMENT: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  ),
  ITR: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
  PHOTO: PhotoIcon,
  DEFAULT: DocumentIcon,
};

// =====================================================
// TYPES
// =====================================================

interface DocumentUploadSectionProps {
  requiredDocuments: DocumentConfig[];
  uploadedDocuments: UploadedDocument[];
  onUpload: (type: DocumentType, file: File) => Promise<void>;
  onDelete: (documentId: string) => void;
  onVerify?: (documentId: string) => Promise<void>;
  className?: string;
}

interface FileUploadState {
  isUploading: boolean;
  progress: number;
  error?: string;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileExtension = (filename: string): string => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toUpperCase();
};

const isImageFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().split('.').pop();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
};

const getVerificationStatusColor = (status: VerificationStatus): string => {
  switch (status) {
    case 'VERIFIED':
      return 'text-emerald-400 bg-emerald-500/20';
    case 'FAILED':
    case 'MISMATCH':
      return 'text-red-400 bg-red-500/20';
    case 'IN_PROGRESS':
      return 'text-amber-400 bg-amber-500/20';
    default:
      return 'text-white/50 bg-white/10';
  }
};

// =====================================================
// DOCUMENT CARD COMPONENT
// =====================================================

interface DocumentCardProps {
  config: DocumentConfig;
  uploadedDoc?: UploadedDocument;
  uploadState: FileUploadState;
  onUpload: (file: File) => void;
  onDelete: () => void;
  onVerify?: () => void;
  onPreview?: () => void;
}

const DocumentCard = ({
  config,
  uploadedDoc,
  uploadState,
  onUpload,
  onDelete,
  onVerify,
  onPreview,
}: DocumentCardProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const IconComponent = DocumentTypeIcons[config.type] || DocumentTypeIcons.DEFAULT;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  const isUploaded = !!uploadedDoc;
  const isRequired = !config.isOptional;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-2xl overflow-hidden transition-all duration-300',
        'bg-white/[0.03] border',
        isDragging && 'border-brand-primary bg-brand-primary/5',
        isUploaded ? 'border-emerald-500/30' : 'border-white/[0.05]',
        uploadState.error && 'border-red-500/30'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/[0.05]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              isUploaded
                ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                : 'bg-white/10'
            )}>
              <IconComponent className={cn('w-5 h-5', isUploaded ? 'text-white' : 'text-white/60')} />
            </div>
            <div>
              <h4 className="text-sm font-medium text-white">{config.name}</h4>
              <p className="text-xs text-white/50">{config.description}</p>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2">
            {isRequired ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                Required
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/50">
                Optional
              </span>
            )}
            {isUploaded && (
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                getVerificationStatusColor(uploadedDoc.verificationStatus)
              )}>
                {uploadedDoc.verificationStatus === 'VERIFIED' ? 'Verified' :
                 uploadedDoc.verificationStatus === 'IN_PROGRESS' ? 'Verifying...' :
                 uploadedDoc.verificationStatus === 'FAILED' ? 'Failed' : 'Uploaded'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {!isUploaded ? (
          /* Upload Area */
          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'relative p-6 rounded-xl border-2 border-dashed cursor-pointer',
              'transition-all duration-300 group',
              isDragging
                ? 'border-brand-primary bg-brand-primary/10'
                : 'border-white/10 hover:border-brand-primary/50 hover:bg-white/[0.02]'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={config.acceptedFormats.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-3 text-center">
              <motion.div
                animate={{ y: isDragging ? -5 : 0 }}
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  'bg-brand-primary/10 group-hover:bg-brand-primary/20 transition-colors'
                )}
              >
                <UploadIcon className="w-6 h-6 text-brand-primary" />
              </motion.div>

              <div>
                <p className="text-sm text-white/70">
                  <span className="text-brand-primary font-medium">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-white/40 mt-1">
                  {config.acceptedFormats.join(', ')} (max {formatFileSize(config.maxSize)})
                </p>
              </div>
            </div>

            {/* Upload Progress */}
            {uploadState.isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 rounded-xl">
                <div className="text-center">
                  <LoadingIcon className="w-8 h-8 text-brand-primary mx-auto mb-2" />
                  <p className="text-sm text-white/70">Uploading... {uploadState.progress}%</p>
                  <div className="w-32 h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-brand-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadState.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Uploaded File Preview */
          <div className="space-y-3">
            {/* File Info */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03]">
              {isImageFile(uploadedDoc.fileName) ? (
                <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadedDoc.fileUrl}
                    alt={uploadedDoc.fileName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                  <span className="text-xs font-medium text-white/60">
                    {getFileExtension(uploadedDoc.fileName)}
                  </span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{uploadedDoc.fileName}</p>
                <p className="text-xs text-white/40">
                  {formatFileSize(uploadedDoc.fileSize)} • Uploaded {new Date(uploadedDoc.uploadedAt).toLocaleDateString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {onPreview && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onPreview}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    title="Preview"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                  title="Replace"
                >
                  <RefreshIcon className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onDelete}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <TrashIcon className="w-4 h-4" />
                </motion.button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={config.acceptedFormats.join(',')}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Verification Status */}
            {uploadedDoc.verificationStatus === 'PENDING' && config.verificationRequired && onVerify && (
              <motion.button
                onClick={onVerify}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full p-3 rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20
                         text-brand-primary text-sm font-medium transition-colors"
              >
                Verify Document
              </motion.button>
            )}

            {uploadedDoc.verificationStatus === 'IN_PROGRESS' && (
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-500/10">
                <LoadingIcon className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-400">Verification in progress...</span>
              </div>
            )}

            {uploadedDoc.verificationStatus === 'VERIFIED' && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10">
                <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">Document verified successfully</span>
              </div>
            )}

            {(uploadedDoc.verificationStatus === 'FAILED' || uploadedDoc.verificationStatus === 'MISMATCH') && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10">
                <XCircleIcon className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">
                  {uploadedDoc.verificationStatus === 'MISMATCH'
                    ? 'Document details mismatch. Please upload correct document.'
                    : 'Verification failed. Please try again.'}
                </span>
              </div>
            )}

            {/* Extracted Data Preview */}
            {uploadedDoc.extractedData && Object.keys(uploadedDoc.extractedData).length > 0 && (
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <p className="text-xs text-white/40 mb-2">Extracted Information</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(uploadedDoc.extractedData).slice(0, 4).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-xs text-white/40 capitalize">{key.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-white">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {uploadState.error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-xs text-red-400 flex items-center gap-1"
          >
            <XCircleIcon className="w-3.5 h-3.5" />
            {uploadState.error}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
};

// =====================================================
// PROGRESS SUMMARY COMPONENT
// =====================================================

interface ProgressSummaryProps {
  required: number;
  uploaded: number;
  verified: number;
  total: number;
}

const ProgressSummary = ({ required, uploaded, verified, total }: ProgressSummaryProps) => {
  const requiredProgress = required > 0 ? Math.min(100, (uploaded / required) * 100) : 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl bg-gradient-to-br from-brand-primary/10 to-orange-500/10 border border-brand-primary/20"
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-white">Document Upload Progress</h4>
        <span className={cn(
          'px-3 py-1 rounded-full text-xs font-medium',
          requiredProgress >= 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
        )}>
          {requiredProgress >= 100 ? 'All Required Uploaded' : `${Math.round(requiredProgress)}% Complete`}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
        <motion.div
          className="h-full bg-gradient-to-r from-brand-primary to-orange-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${requiredProgress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-2xl font-bold text-white">{uploaded}</p>
          <p className="text-xs text-white/50">Uploaded</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-2xl font-bold text-emerald-400">{verified}</p>
          <p className="text-xs text-white/50">Verified</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-2xl font-bold text-white/60">{total - uploaded}</p>
          <p className="text-xs text-white/50">Pending</p>
        </div>
      </div>
    </motion.div>
  );
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export function DocumentUploadSection({
  requiredDocuments,
  uploadedDocuments,
  onUpload,
  onDelete,
  onVerify,
  className,
}: DocumentUploadSectionProps) {
  const [uploadStates, setUploadStates] = useState<Record<string, FileUploadState>>({});
  const [previewDoc, setPreviewDoc] = useState<UploadedDocument | null>(null);

  const handleUpload = async (docType: DocumentType, file: File) => {
    setUploadStates(prev => ({
      ...prev,
      [docType]: { isUploading: true, progress: 0 },
    }));

    try {
      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 50));
        setUploadStates(prev => ({
          ...prev,
          [docType]: { isUploading: true, progress: i },
        }));
      }

      await onUpload(docType, file);

      setUploadStates(prev => ({
        ...prev,
        [docType]: { isUploading: false, progress: 100 },
      }));
    } catch (error) {
      setUploadStates(prev => ({
        ...prev,
        [docType]: { isUploading: false, progress: 0, error: 'Upload failed. Please try again.' },
      }));
    }
  };

  const getUploadedDoc = (docType: DocumentType) => {
    return uploadedDocuments.find(d => d.type === docType);
  };

  const requiredCount = requiredDocuments.filter(d => !d.isOptional).length;
  const uploadedCount = uploadedDocuments.length;
  const verifiedCount = uploadedDocuments.filter(d => d.verificationStatus === 'VERIFIED').length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('space-y-6', className)}
    >
      {/* Section Header */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-white mb-2">
          Document Upload
        </h3>
        <p className="text-sm text-white/60">
          Please upload clear, legible copies of the required documents. Ensure all information is visible and not cropped.
        </p>
      </div>

      {/* Progress Summary */}
      <ProgressSummary
        required={requiredCount}
        uploaded={uploadedCount}
        verified={verifiedCount}
        total={requiredDocuments.length}
      />

      {/* Document Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {requiredDocuments.map((docConfig) => (
          <DocumentCard
            key={docConfig.type}
            config={docConfig}
            uploadedDoc={getUploadedDoc(docConfig.type)}
            uploadState={uploadStates[docConfig.type] || { isUploading: false, progress: 0 }}
            onUpload={(file) => handleUpload(docConfig.type, file)}
            onDelete={() => {
              const doc = getUploadedDoc(docConfig.type);
              if (doc) onDelete(doc.id);
            }}
            onVerify={onVerify ? () => {
              const doc = getUploadedDoc(docConfig.type);
              if (doc) onVerify(doc.id);
            } : undefined}
            onPreview={() => {
              const doc = getUploadedDoc(docConfig.type);
              if (doc) setPreviewDoc(doc);
            }}
          />
        ))}
      </div>

      {/* Upload Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
      >
        <h4 className="text-sm font-medium text-white mb-4">Tips for Document Upload</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-white/80">Clear & Legible</p>
              <p className="text-xs text-white/50">Ensure all text is readable and not blurry</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-white/80">Complete Document</p>
              <p className="text-xs text-white/50">All corners and edges should be visible</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-white/80">Original Copies</p>
              <p className="text-xs text-white/50">Upload original documents, not photocopies</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-white/80">File Size</p>
              <p className="text-xs text-white/50">Keep files under 5MB for faster upload</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPreviewDoc(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] bg-zinc-900 rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h4 className="text-lg font-medium text-white">{previewDoc.fileName}</h4>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <XCircleIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
                {isImageFile(previewDoc.fileName) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewDoc.fileUrl}
                    alt={previewDoc.fileName}
                    className="max-w-full h-auto rounded-lg"
                  />
                ) : (
                  <div className="flex items-center justify-center h-64 bg-white/5 rounded-lg">
                    <div className="text-center">
                      <DocumentIcon className="w-12 h-12 text-white/40 mx-auto mb-2" />
                      <p className="text-sm text-white/60">Preview not available</p>
                      <a
                        href={previewDoc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-primary hover:underline mt-2 inline-block"
                      >
                        Open in new tab
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default DocumentUploadSection;
