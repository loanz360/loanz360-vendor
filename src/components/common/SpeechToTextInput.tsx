'use client'

import React, { useState, useEffect } from 'react'
import { Mic, MicOff, RotateCcw, Languages, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { useSpeechToText, LANGUAGE_NAMES } from '@/lib/hooks/useSpeechToText'
import type { SupportedLanguage } from '@/types/ai-crm'

interface SpeechToTextInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  language?: SupportedLanguage
  onLanguageChange?: (lang: SupportedLanguage) => void
  showLanguageSelector?: boolean
  minRows?: number
  maxRows?: number
  disabled?: boolean
  className?: string
  required?: boolean
  error?: string
}

export function SpeechToTextInput({
  value,
  onChange,
  placeholder = 'Start speaking or type here...',
  label,
  language: initialLanguage = 'en',
  onLanguageChange,
  showLanguageSelector = true,
  minRows = 3,
  maxRows = 10,
  disabled = false,
  className,
  required = false,
  error
}: SpeechToTextInputProps) {
  const [localValue, setLocalValue] = useState(value)

  const {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    confidence,
    error: speechError,
    language,
    setLanguage,
    startListening,
    stopListening,
    resetTranscript,
    toggleListening
  } = useSpeechToText({
    language: initialLanguage,
    continuous: true,
    interimResults: true
  })

  // Sync value prop with local state
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Append transcript to value when it changes
  useEffect(() => {
    if (transcript) {
      const newValue = localValue ? `${localValue} ${transcript}` : transcript
      setLocalValue(newValue)
      onChange(newValue)
      resetTranscript()
    }
  }, [transcript])

  // Handle language change
  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang)
    if (onLanguageChange) {
      onLanguageChange(lang)
    }
  }

  // Handle text change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    onChange(newValue)
  }

  // Handle reset
  const handleReset = () => {
    resetTranscript()
    setLocalValue('')
    onChange('')
  }

  // Calculate display value (include interim transcript while listening)
  const displayValue = isListening && interimTranscript
    ? `${localValue} ${interimTranscript}`.trim()
    : localValue

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header with label and controls */}
      <div className="flex items-center justify-between">
        {label && (
          <Label className="text-sm font-medium">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        )}

        <div className="flex items-center gap-2">
          {/* Language Selector */}
          {showLanguageSelector && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <Languages className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={language}
                      onValueChange={(val) => handleLanguageChange(val as SupportedLanguage)}
                      disabled={disabled || isListening}
                    >
                      <SelectTrigger className="w-[120px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(LANGUAGE_NAMES) as SupportedLanguage[]).map((lang) => (
                          <SelectItem key={lang} value={lang} className="text-xs">
                            {LANGUAGE_NAMES[lang]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select speech language</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Confidence indicator */}
          {confidence > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {Math.round(confidence * 100)}%
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Recognition confidence</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Reset button */}
          {localValue && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    disabled={disabled || isListening}
                    className="h-8 w-8 p-0"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear text</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Text input area */}
      <div className="relative">
        <Textarea
          value={displayValue}
          onChange={handleTextChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'pr-14 resize-none transition-all',
            isListening && 'ring-2 ring-red-500 ring-offset-2',
            error && 'border-red-500'
          )}
          style={{
            minHeight: `${minRows * 24}px`,
            maxHeight: `${maxRows * 24}px`
          }}
        />

        {/* Microphone button */}
        <div className="absolute right-2 bottom-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={isListening ? 'destructive' : 'secondary'}
                  size="sm"
                  onClick={toggleListening}
                  disabled={disabled || !isSupported}
                  className={cn(
                    'h-10 w-10 rounded-full p-0 transition-all',
                    isListening && 'animate-pulse'
                  )}
                >
                  {isListening ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isListening ? 'Stop recording' : 'Start recording'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Listening indicator */}
        {isListening && (
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-xs text-red-600 font-medium">Recording...</span>
          </div>
        )}
      </div>

      {/* Error messages */}
      {(error || speechError) && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {error || speechError}
          </AlertDescription>
        </Alert>
      )}

      {/* Not supported warning */}
      {!isSupported && (
        <Alert className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Speech recognition is not supported in this browser. Please use Chrome or Edge for voice input.
          </AlertDescription>
        </Alert>
      )}

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        {isListening
          ? `Speaking in ${LANGUAGE_NAMES[language]}... Click the mic button to stop.`
          : 'Click the microphone button to start voice input, or type directly.'}
      </p>
    </div>
  )
}

export default SpeechToTextInput
