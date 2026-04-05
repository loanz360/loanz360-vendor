'use client'

import React, { useState, useRef } from 'react'
import { Upload, FileText, Loader2, Mic, X, CheckCircle } from 'lucide-react'
import CallAnalysisPanel from './CallAnalysisPanel'

interface CallTranscriptionUploaderProps {
  callLogId: string
  contactId?: string
  onAnalysisComplete?: () => void
}

type Mode = 'upload' | 'paste'

interface AnalysisResult {
  ai_summary?: string
  ai_rating?: number
  ai_sentiment?: string
  ai_coaching_feedback?: string
  ai_positive_points?: string[]
  ai_improvement_points?: string[]
  ai_extracted_data?: Record<string, unknown>
  transcript?: string
}

export default function CallTranscriptionUploader({
  callLogId,
  contactId,
  onAnalysisComplete,
}: CallTranscriptionUploaderProps) {
  const [mode, setMode] = useState<Mode>('upload')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [pastedTranscript, setPastedTranscript] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowed = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a']
    if (!allowed.includes(file.type)) {
      setError('Please upload an audio file (MP3, WAV, WebM, OGG, or M4A)')
      return
    }

    // Validate size (25MB max for Whisper)
    if (file.size > 25 * 1024 * 1024) {
      setError('File too large. Maximum 25MB allowed.')
      return
    }

    setError('')
    setSelectedFile(file)
  }

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('audio', selectedFile)
      formData.append('callLogId', callLogId)
      if (contactId) formData.append('contactId', contactId)

      const response = await fetch('/api/ai-crm/transcribe', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Transcription failed')
      }

      setAnalysisResult({
        transcript: result.data.transcript,
        ai_summary: result.data.ai_analysis?.summary,
        ai_rating: result.data.ai_analysis?.rating,
        ai_sentiment: result.data.ai_analysis?.sentiment,
        ai_positive_points: result.data.ai_analysis?.positive_points,
        ai_improvement_points: result.data.ai_analysis?.improvement_points,
      })

      onAnalysisComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process recording')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePasteAndAnalyze = async () => {
    if (!pastedTranscript.trim()) {
      setError('Please paste a transcript')
      return
    }

    setIsProcessing(true)
    setError('')

    try {
      const response = await fetch('/api/ai-crm/analyze-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: pastedTranscript,
          callLogId,
          contextType: 'cro_call',
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Analysis failed')
      }

      setAnalysisResult({
        transcript: pastedTranscript,
        ai_summary: result.data.coachingFeedback,
        ai_rating: result.data.aiRating,
        ai_sentiment: result.data.sentiment,
        ai_positive_points: result.data.positivePoints,
        ai_improvement_points: result.data.improvementPoints,
        ai_extracted_data: result.data.extractedData,
      })

      onAnalysisComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze transcript')
    } finally {
      setIsProcessing(false)
    }
  }

  // If analysis is complete, show results
  if (analysisResult) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" />
          AI Analysis Complete
        </div>
        <CallAnalysisPanel analysis={analysisResult} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => { setMode('upload'); setError('') }}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'upload' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Mic className="w-4 h-4" />
          Upload Recording
        </button>
        <button
          onClick={() => { setMode('paste'); setError('') }}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'paste' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          Paste Transcript
        </button>
      </div>

      {/* Upload Mode */}
      {mode === 'upload' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!selectedFile ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-700 hover:border-orange-500/50 rounded-lg p-8 text-center transition-colors"
            >
              <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Click to upload call recording</p>
              <p className="text-xs text-gray-600 mt-1">MP3, WAV, WebM, OGG, M4A (max 25MB)</p>
            </button>
          ) : (
            <div className="bg-gray-800/50 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mic className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-sm text-white">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedFile(null); setError('') }}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {selectedFile && (
            <button
              onClick={handleUploadAndAnalyze}
              disabled={isProcessing}
              className="w-full mt-3 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Transcribing & Analyzing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Transcribe & Analyze
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Paste Mode */}
      {mode === 'paste' && (
        <div>
          <textarea
            value={pastedTranscript}
            onChange={(e) => setPastedTranscript(e.target.value)}
            placeholder="Paste the call transcript here...&#10;&#10;CRO: Good morning, this is Rahul from LOANZ 360...&#10;Customer: Hi, I was looking for a business loan..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
            rows={6}
          />
          <button
            onClick={handlePasteAndAnalyze}
            disabled={isProcessing || !pastedTranscript.trim()}
            className="w-full mt-3 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing Conversation...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Analyze Transcript
              </>
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 text-center">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-2" />
          <p className="text-sm text-orange-400">AI is analyzing the conversation...</p>
          <p className="text-xs text-gray-500 mt-1">This may take 15-30 seconds</p>
        </div>
      )}
    </div>
  )
}
