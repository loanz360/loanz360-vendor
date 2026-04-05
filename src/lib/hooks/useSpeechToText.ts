'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { SupportedLanguage, SpeechToTextResult } from '@/types/ai-crm'

// Language codes for Web Speech API
const LANGUAGE_CODES: Record<SupportedLanguage, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  bn: 'bn-IN',
  ml: 'ml-IN'
}

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  hi: 'Hindi',
  te: 'Telugu',
  ta: 'Tamil',
  kn: 'Kannada',
  mr: 'Marathi',
  gu: 'Gujarati',
  bn: 'Bengali',
  ml: 'Malayalam'
}

export interface UseSpeechToTextOptions {
  language?: SupportedLanguage
  continuous?: boolean
  interimResults?: boolean
  onResult?: (result: SpeechToTextResult) => void
  onError?: (error: string) => void
  onEnd?: () => void
}

export interface UseSpeechToTextReturn {
  isListening: boolean
  isSupported: boolean
  transcript: string
  interimTranscript: string
  confidence: number
  error: string | null
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => void
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
  toggleListening: () => void
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const {
    language: initialLanguage = 'en',
    continuous = true,
    interimResults = true,
    onResult,
    onError,
    onEnd
  } = options

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<SupportedLanguage>(initialLanguage)
  const [isSupported, setIsSupported] = useState(false)

  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition ||
                              (window as any).webkitSpeechRecognition

    setIsSupported(!!SpeechRecognition)

    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser')
    }
  }, [])

  // Initialize recognition
  const initializeRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition ||
                              (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      return null
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = LANGUAGE_CODES[language]
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
    }

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let interim = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcriptText = result[0].transcript

        if (result.isFinal) {
          finalTranscript += transcriptText + ' '
          setConfidence(result[0].confidence || 0)

          // Call onResult callback with final result
          if (onResult) {
            onResult({
              transcript: transcriptText,
              confidence: result[0].confidence || 0,
              language,
              is_final: true
            })
          }
        } else {
          interim += transcriptText
        }
      }

      if (finalTranscript) {
        transcriptRef.current += finalTranscript
        setTranscript(transcriptRef.current.trim())
      }

      setInterimTranscript(interim)
    }

    recognition.onerror = (event: any) => {
      let errorMessage = 'Speech recognition error'

      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.'
          break
        case 'audio-capture':
          errorMessage = 'Microphone not found. Please check your microphone.'
          break
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access.'
          break
        case 'network':
          errorMessage = 'Network error. Please check your connection.'
          break
        case 'aborted':
          errorMessage = 'Speech recognition was aborted.'
          break
        case 'language-not-supported':
          errorMessage = `Language ${LANGUAGE_NAMES[language]} is not supported.`
          break
        default:
          errorMessage = `Error: ${event.error}`
      }

      setError(errorMessage)
      setIsListening(false)

      if (onError) {
        onError(errorMessage)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimTranscript('')

      if (onEnd) {
        onEnd()
      }

      // Auto-restart if continuous mode and not manually stopped
      if (continuous && recognitionRef.current && !error) {
        try {
          recognition.start()
        } catch (e) {
          // Ignore restart errors
        }
      }
    }

    return recognition
  }, [language, continuous, interimResults, onResult, onError, onEnd, error])

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported')
      return
    }

    if (isListening) {
      return
    }

    setError(null)
    const recognition = initializeRecognition()

    if (recognition) {
      recognitionRef.current = recognition
      try {
        recognition.start()
      } catch (e: unknown) {
        setError((e instanceof Error ? e.message : String(e)) || 'Failed to start speech recognition')
      }
    }
  }, [isSupported, isListening, initializeRecognition])

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // Reset transcript
  const resetTranscript = useCallback(() => {
    transcriptRef.current = ''
    setTranscript('')
    setInterimTranscript('')
    setConfidence(0)
    setError(null)
  }, [])

  // Update language
  const handleSetLanguage = useCallback((newLanguage: SupportedLanguage) => {
    const wasListening = isListening
    if (wasListening) {
      stopListening()
    }
    setLanguage(newLanguage)
    if (wasListening) {
      // Small delay to allow recognition to stop properly
      setTimeout(() => {
        startListening()
      }, 100)
    }
  }, [isListening, stopListening, startListening])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    }
  }, [])

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    confidence,
    error,
    language,
    setLanguage: handleSetLanguage,
    startListening,
    stopListening,
    resetTranscript,
    toggleListening
  }
}

export default useSpeechToText
