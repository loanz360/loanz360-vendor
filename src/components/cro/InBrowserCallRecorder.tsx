'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react'

interface InBrowserCallRecorderProps {
  /** Called when recording stops with the audio blob */
  onRecordingComplete: (audioBlob: Blob) => void
  /** Whether to auto-start recording */
  autoStart?: boolean
  /** Whether to show the recording indicator */
  showIndicator?: boolean
  /** Optional class for the indicator */
  className?: string
}

export default function InBrowserCallRecorder({
  onRecordingComplete,
  autoStart = false,
  showIndicator = true,
  className = '',
}: InBrowserCallRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startRecording = useCallback(async () => {
    setError(null)
    setIsPending(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      })

      streamRef.current = stream
      chunksRef.current = []

      // Choose best supported format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000,
      })

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []
        onRecordingComplete(blob)
      }

      recorder.start(1000) // Collect data every second
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setDuration(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access to record calls.')
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.')
      } else {
        setError('Failed to start recording. Please try again.')
      }
    } finally {
      setIsPending(false)
    }
  }, [onRecordingComplete])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    setIsRecording(false)
  }, [])

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && !isRecording && !isPending) {
      startRecording()
    }
  }, [autoStart]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-red-400 text-xs bg-red-900/20 px-3 py-2 rounded-lg ${className}`}>
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{error}</span>
        <button
          onClick={() => { setError(null); startRecording() }}
          className="ml-auto text-orange-400 hover:text-orange-300 text-xs underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!showIndicator && !isRecording && !isPending) {
    return null
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isPending && (
        <div className="flex items-center gap-2 text-orange-400 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Requesting mic access...</span>
        </div>
      )}

      {isRecording && (
        <div className="flex items-center gap-2">
          <div className="relative flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-400 font-medium">REC</span>
            <span className="text-xs text-gray-400 font-mono">{formatTime(duration)}</span>
          </div>
          <button
            onClick={stopRecording}
            className="p-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg transition-colors"
            title="Stop recording"
          >
            <MicOff className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      )}

      {!isRecording && !isPending && showIndicator && (
        <button
          onClick={startRecording}
          className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white transition-colors"
          title="Start recording"
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Record</span>
        </button>
      )}
    </div>
  )
}
