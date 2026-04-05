'use client'

import { useState, useEffect } from 'react'
import {
  X, Download, Share2, Star, Trash2, Edit3, Clock,
  FileText, Image, Video, Music, Archive, FileCode,
  ChevronLeft, ChevronRight, Loader2, ExternalLink
} from 'lucide-react'
import { WorkDriveFile } from '@/types/workdrive'

interface FilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  file: WorkDriveFile | null
  files?: WorkDriveFile[]
  onDownload: (file: WorkDriveFile) => void
  onShare: (file: WorkDriveFile) => void
  onDelete: (file: WorkDriveFile) => void
  onToggleFavorite: (file: WorkDriveFile) => void
  getPreviewUrl: (file: WorkDriveFile) => Promise<string>
}

const FILE_ICONS: Record<string, React.ElementType> = {
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
  spreadsheet: FileText,
  presentation: FileText,
  archive: Archive,
  code: FileCode,
  other: FileText,
}

export default function FilePreviewModal({
  isOpen,
  onClose,
  file,
  files = [],
  onDownload,
  onShare,
  onDelete,
  onToggleFavorite,
  getPreviewUrl,
}: FilePreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showInfo, setShowInfo] = useState(true)

  const currentFile = file || (files.length > 0 ? files[currentIndex] : null)

  useEffect(() => {
    if (file && files.length > 0) {
      const idx = files.findIndex(f => f.id === file.id)
      if (idx !== -1) setCurrentIndex(idx)
    }
  }, [file, files])

  useEffect(() => {
    const loadPreview = async () => {
      if (!currentFile) return

      setIsLoading(true)
      setError('')

      try {
        const url = await getPreviewUrl(currentFile)
        setPreviewUrl(url)
      } catch (err) {
        setError('Failed to load preview')
        console.error('Preview error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (isOpen && currentFile) {
      loadPreview()
    }
  }, [isOpen, currentFile, getPreviewUrl])

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleNext = () => {
    if (currentIndex < files.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrevious()
    if (e.key === 'ArrowRight') handleNext()
    if (e.key === 'Escape') onClose()
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderPreview = () => {
    if (!currentFile) return null

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
          <p className="text-gray-400">Loading preview...</p>
        </div>
      )
    }

    if (error) {
      const IconComponent = FILE_ICONS[currentFile.file_category] || FILE_ICONS.other
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <IconComponent className="w-24 h-24 text-gray-600 mb-4" />
          <p className="text-gray-400 mb-2">Preview not available</p>
          <button
            onClick={() => onDownload(currentFile)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download to view
          </button>
        </div>
      )
    }

    // Render based on file category
    switch (currentFile.file_category) {
      case 'image':
        return (
          <div className="flex items-center justify-center h-full p-4">
            <img
              src={previewUrl}
              alt={currentFile.name}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        )

      case 'video':
        return (
          <div className="flex items-center justify-center h-full p-4">
            <video
              src={previewUrl}
              controls
              className="max-w-full max-h-full rounded-lg"
            >
              Your browser does not support video playback.
            </video>
          </div>
        )

      case 'audio':
        return (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <Music className="w-24 h-24 text-orange-500 mb-8" />
            <audio src={previewUrl} controls className="w-full max-w-md">
              Your browser does not support audio playback.
            </audio>
          </div>
        )

      case 'document':
      case 'spreadsheet':
      case 'presentation':
        // For PDFs, try to embed
        if (currentFile.mime_type === 'application/pdf') {
          return (
            <div className="h-full p-4">
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-lg bg-white"
                title={currentFile.name}
              />
            </div>
          )
        }
        // For other documents, show download option
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <FileText className="w-24 h-24 text-gray-600 mb-4" />
            <p className="text-white font-medium mb-2">{currentFile.name}</p>
            <p className="text-gray-400 mb-4">Document preview not available in browser</p>
            <div className="flex gap-3">
              <button
                onClick={() => onDownload(currentFile)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 border border-white/20 hover:bg-white/5 text-white rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in new tab
              </a>
            </div>
          </div>
        )

      default:
        const IconComponent = FILE_ICONS[currentFile.file_category] || FILE_ICONS.other
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <IconComponent className="w-24 h-24 text-gray-600 mb-4" />
            <p className="text-white font-medium mb-2">{currentFile.name}</p>
            <p className="text-gray-400 mb-4">Preview not available for this file type</p>
            <button
              onClick={() => onDownload(currentFile)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        )
    }
  }

  if (!isOpen || !currentFile) return null

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/90"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <div>
            <h2 className="text-white font-medium truncate max-w-md">{currentFile.name}</h2>
            {files.length > 1 && (
              <p className="text-sm text-gray-400">
                {currentIndex + 1} of {files.length}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleFavorite(currentFile)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title={currentFile.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              className={`w-5 h-5 ${
                currentFile.is_favorite ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'
              }`}
            />
          </button>
          <button
            onClick={() => onShare(currentFile)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Share"
          >
            <Share2 className="w-5 h-5 text-gray-400" />
          </button>
          <button
            onClick={() => onDownload(currentFile)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Download"
          >
            <Download className="w-5 h-5 text-gray-400" />
          </button>
          <button
            onClick={() => onDelete(currentFile)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-5 h-5 text-gray-400" />
          </button>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`p-2 rounded-lg transition-colors ${
              showInfo ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
            title="Toggle info panel"
          >
            <Edit3 className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Navigation Arrows */}
      {files.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed z-10"
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === files.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed z-10"
            style={{ right: showInfo ? '320px' : '16px' }}
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        </>
      )}

      {/* Main Preview Area */}
      <div
        className="flex-1 pt-20 pb-4"
        style={{ marginRight: showInfo ? '300px' : '0' }}
      >
        {renderPreview()}
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="w-[300px] bg-gray-900 border-l border-white/10 pt-20 p-6 overflow-y-auto">
          <h3 className="text-lg font-semibold text-white mb-6">File Details</h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Name</label>
              <p className="text-white mt-1 break-words">{currentFile.name}</p>
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Type</label>
              <p className="text-white mt-1">{currentFile.mime_type}</p>
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Size</label>
              <p className="text-white mt-1">{formatFileSize(currentFile.file_size)}</p>
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Category</label>
              <p className="text-white mt-1 capitalize">{currentFile.file_category}</p>
            </div>

            <div className="pt-4 border-t border-white/10">
              <label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Created
              </label>
              <p className="text-white mt-1">{formatDate(currentFile.created_at)}</p>
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Modified
              </label>
              <p className="text-white mt-1">{formatDate(currentFile.updated_at)}</p>
            </div>

            {currentFile.description && (
              <div className="pt-4 border-t border-white/10">
                <label className="text-xs text-gray-500 uppercase tracking-wide">Description</label>
                <p className="text-gray-300 mt-1">{currentFile.description}</p>
              </div>
            )}

            {currentFile.version && currentFile.version > 1 && (
              <div className="pt-4 border-t border-white/10">
                <label className="text-xs text-gray-500 uppercase tracking-wide">Version</label>
                <p className="text-white mt-1">v{currentFile.version}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
