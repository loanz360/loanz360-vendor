'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Camera, X, RotateCcw, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clientLogger } from '@/lib/utils/client-logger'

interface CameraCaptureProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (file: File) => void
  aspectRatio?: 'square' | 'portrait' | 'landscape'
}

export default function CameraCapture({
  isOpen,
  onClose,
  onCapture,
  aspectRatio = 'square'
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [isCameraActive, setIsCameraActive] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)

  // Get aspect ratio dimensions
  const getAspectRatioDimensions = () => {
    switch (aspectRatio) {
      case 'square':
        return { width: 500, height: 500 }
      case 'portrait':
        return { width: 400, height: 600 }
      case 'landscape':
        return { width: 600, height: 400 }
      default:
        return { width: 500, height: 500 }
    }
  }

  // Check for multiple cameras
  useEffect(() => {
    const checkCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput')
        setHasMultipleCameras(videoDevices.length > 1)
      } catch (err) {
        clientLogger.error('Error checking cameras', err)
      }
    }

    if (isOpen) {
      checkCameras()
    }
  }, [isOpen])

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera()
    }

    return () => {
      stopCamera()
    }
  }, [isOpen, facingMode, capturedImage])

  const startCamera = async () => {
    try {
      setError(null)

      // Stop existing stream
      stopCamera()

      // Request camera access
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsCameraActive(true)
        clientLogger.info('Camera started successfully')
      }
    } catch (err: unknown) {
      clientLogger.error('Error accessing camera', err)

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device.')
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is already in use by another application.')
      } else {
        setError('Failed to access camera. Please try again.')
      }

      setIsCameraActive(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsCameraActive(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const { width, height } = getAspectRatioDimensions()
    const canvas = canvasRef.current
    const video = videoRef.current

    // Set canvas size
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Calculate dimensions to crop video to canvas aspect ratio
    const videoAspectRatio = video.videoWidth / video.videoHeight
    const canvasAspectRatio = width / height

    let sourceX = 0
    let sourceY = 0
    let sourceWidth = video.videoWidth
    let sourceHeight = video.videoHeight

    if (videoAspectRatio > canvasAspectRatio) {
      // Video is wider, crop sides
      sourceWidth = video.videoHeight * canvasAspectRatio
      sourceX = (video.videoWidth - sourceWidth) / 2
    } else {
      // Video is taller, crop top/bottom
      sourceHeight = video.videoWidth / canvasAspectRatio
      sourceY = (video.videoHeight - sourceHeight) / 2
    }

    // Draw video frame to canvas with cropping
    ctx.drawImage(
      video,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height
    )

    // Get image data
    const imageData = canvas.toDataURL('image/jpeg', 0.95)
    setCapturedImage(imageData)
    stopCamera()
    clientLogger.info('Photo captured successfully')
  }

  const retakePhoto = () => {
    setCapturedImage(null)
    setError(null)
    startCamera()
  }

  const confirmPhoto = () => {
    if (!capturedImage) return

    // Convert base64 to File
    fetch(capturedImage)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `camera-capture-${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now()
        })
        onCapture(file)
        handleClose()
      })
      .catch(err => {
        clientLogger.error('Error converting captured image to file', err)
        setError('Failed to process captured image')
      })
  }

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
    setCapturedImage(null)
  }

  const handleClose = () => {
    stopCamera()
    setCapturedImage(null)
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <Camera className="w-6 h-6 text-orange-500" />
            {capturedImage ? 'Review Photo' : 'Capture Photo'}
          </h3>
          <Button
            onClick={handleClose}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Camera/Preview Area */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
          {error ? (
            <div className="aspect-square flex flex-col items-center justify-center p-8 text-center">
              <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
              <p className="text-red-400 mb-2 font-medium">Camera Error</p>
              <p className="text-gray-400 text-sm mb-4">{error}</p>
              <Button
                onClick={startCamera}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : capturedImage ? (
            <div className="aspect-square flex items-center justify-center">
              <img
                src={capturedImage}
                alt="Captured"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : (
            <div className="relative aspect-square bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!isCameraActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-16 h-16 text-gray-500 mx-auto mb-4 animate-pulse" />
                    <p className="text-gray-400">Starting camera...</p>
                  </div>
                </div>
              )}

              {/* Camera guide overlay */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 border-4 border-white/20 rounded-lg m-8" />
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/60 px-4 py-2 rounded-full">
                    <p className="text-white text-sm">
                      Position your face within the frame
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mt-6">
          {capturedImage ? (
            <>
              <Button
                onClick={retakePhoto}
                variant="outline"
                size="lg"
                className="border-gray-600 text-white hover:bg-gray-800"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Retake
              </Button>
              <Button
                onClick={confirmPhoto}
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="w-5 h-5 mr-2" />
                Use This Photo
              </Button>
            </>
          ) : (
            <>
              {hasMultipleCameras && (
                <Button
                  onClick={switchCamera}
                  variant="outline"
                  size="lg"
                  disabled={!isCameraActive}
                  className="border-gray-600 text-white hover:bg-gray-800"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Switch Camera
                </Button>
              )}
              <Button
                onClick={capturePhoto}
                size="lg"
                disabled={!isCameraActive}
                className="bg-orange-500 hover:bg-orange-600 text-white px-12"
              >
                <Camera className="w-5 h-5 mr-2" />
                Capture
              </Button>
            </>
          )}
        </div>

        {/* Help text */}
        {!capturedImage && !error && (
          <p className="text-center text-gray-400 text-sm mt-4">
            {hasMultipleCameras && 'Switch between front and back camera. '}
            Click capture when ready.
          </p>
        )}
      </div>
    </div>
  )
}
