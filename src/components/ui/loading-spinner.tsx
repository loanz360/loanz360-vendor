"use client"

import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils/cn"
import {
  DEFAULT_SPINNER_VARIANT,
  DEFAULT_LOGO_SIZE,
  DEFAULT_LOADING_TEXT,
  DEFAULT_LOADING_SUBTEXT
} from "@/config/loading.config"

export type SpinnerVariant =
  | "pulse"           // Logo pulsing/breathing
  | "ring"            // Rotating ring around logo
  | "dots"            // Orbiting dots around logo
  | "wave"            // Wave effect emanating from logo
  | "morph"           // Morphing glow effect
  | "bounce"          // Bouncing logo
  | "flip"            // 3D flip animation
  | "radar"           // Radar sweep effect
  | "particles"       // Floating particles around logo
  | "gradient-ring"   // Gradient spinning ring
  | "bounce-balls"    // Logo with bouncing balls below
  | "loan-queue"      // People queue outside office, come out happy with sanction letter
  | "letter-bounce"   // Each letter in LOANZ360 bounces sequentially

interface LoadingSpinnerProps {
  variant?: SpinnerVariant
  text?: string
  subText?: string
  className?: string
  logoSize?: number
}

export function LoadingSpinner({
  variant = "ring",
  text = "Loading...",
  subText,
  className,
  logoSize = 120
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex flex-col items-center gap-6">
        {variant === "pulse" && <PulseSpinner logoSize={logoSize} />}
        {variant === "ring" && <RingSpinner logoSize={logoSize} />}
        {variant === "dots" && <DotsSpinner logoSize={logoSize} />}
        {variant === "wave" && <WaveSpinner logoSize={logoSize} />}
        {variant === "morph" && <MorphSpinner logoSize={logoSize} />}
        {variant === "bounce" && <BounceSpinner logoSize={logoSize} />}
        {variant === "flip" && <FlipSpinner logoSize={logoSize} />}
        {variant === "radar" && <RadarSpinner logoSize={logoSize} />}
        {variant === "particles" && <ParticlesSpinner logoSize={logoSize} />}
        {variant === "gradient-ring" && <GradientRingSpinner logoSize={logoSize} />}
        {variant === "bounce-balls" && <BounceBallsSpinner logoSize={logoSize} />}
        {variant === "loan-queue" && <LoanQueueSpinner logoSize={logoSize} />}
        {variant === "letter-bounce" && <LetterBounceSpinner logoSize={logoSize} />}

        {text && (
          <div className="text-center">
            <p className="text-white text-lg font-medium animate-pulse">{text}</p>
            {subText && (
              <p className="text-gray-400 text-sm mt-1">{subText}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 1. Pulse/Breathing Animation
function PulseSpinner({ logoSize }: { logoSize: number }) {
  return (
    <div className="relative">
      <div className="animate-[pulse_2s_ease-in-out_infinite]">
        <Image
          src="/loanz-logo.png"
          alt="LOANZ 360"
          width={logoSize}
          height={logoSize * 0.3}
          className="object-contain drop-shadow-[0_0_20px_rgba(249,115,22,0.5)]"
          priority
        />
      </div>
      <div className="absolute inset-0 animate-[ping_2s_ease-in-out_infinite] opacity-30">
        <Image
          src="/loanz-logo.png"
          alt=""
          width={logoSize}
          height={logoSize * 0.3}
          className="object-contain"
        />
      </div>
    </div>
  )
}

// 2. Rotating Ring Around Logo
function RingSpinner({ logoSize }: { logoSize: number }) {
  const ringSize = logoSize + 60
  return (
    <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
      {/* Outer rotating ring */}
      <div
        className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-500 border-r-orange-500/50 animate-spin"
        style={{ animationDuration: '1.5s' }}
      />
      {/* Inner glow ring */}
      <div
        className="absolute rounded-full border-2 border-orange-500/30 animate-pulse"
        style={{
          width: ringSize - 20,
          height: ringSize - 20,
        }}
      />
      {/* Logo */}
      <Image
        src="/loanz-logo.png"
        alt="LOANZ 360"
        width={logoSize}
        height={logoSize * 0.3}
        className="object-contain z-10"
        priority
      />
    </div>
  )
}

// 3. Orbiting Dots
function DotsSpinner({ logoSize }: { logoSize: number }) {
  const orbitSize = logoSize + 80
  return (
    <div className="relative flex items-center justify-center" style={{ width: orbitSize, height: orbitSize }}>
      {/* Orbiting dots */}
      <div
        className="absolute inset-0 animate-spin"
        style={{ animationDuration: '3s' }}
      >
        {[0, 60, 120, 180, 240, 300].map((rotation, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.8)]"
            style={{
              top: '50%',
              left: '50%',
              transform: `rotate(${rotation}deg) translateX(${orbitSize / 2 - 6}px) translateY(-50%)`,
              opacity: 1 - i * 0.1
            }}
          />
        ))}
      </div>
      {/* Logo */}
      <Image
        src="/loanz-logo.png"
        alt="LOANZ 360"
        width={logoSize}
        height={logoSize * 0.3}
        className="object-contain z-10"
        priority
      />
    </div>
  )
}

// 4. Wave Effect
function WaveSpinner({ logoSize }: { logoSize: number }) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Wave rings */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border-2 border-orange-500 animate-[wave_2s_ease-out_infinite]"
          style={{
            width: logoSize + 40,
            height: logoSize + 40,
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}
      {/* Logo */}
      <Image
        src="/loanz-logo.png"
        alt="LOANZ 360"
        width={logoSize}
        height={logoSize * 0.3}
        className="object-contain z-10"
        priority
      />
      <style jsx>{`
        @keyframes wave {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

// 5. Morphing Glow Effect
function MorphSpinner({ logoSize }: { logoSize: number }) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Morphing glow background */}
      <div
        className="absolute rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 blur-xl animate-[morph_4s_ease-in-out_infinite]"
        style={{ width: logoSize + 40, height: logoSize / 2 + 20 }}
      />
      {/* Logo */}
      <Image
        src="/loanz-logo.png"
        alt="LOANZ 360"
        width={logoSize}
        height={logoSize * 0.3}
        className="object-contain z-10 relative"
        priority
      />
      <style jsx>{`
        @keyframes morph {
          0%, 100% {
            transform: scale(1) rotate(0deg);
            opacity: 0.5;
          }
          25% {
            transform: scale(1.1) rotate(2deg);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.2) rotate(0deg);
            opacity: 0.6;
          }
          75% {
            transform: scale(1.1) rotate(-2deg);
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  )
}

// 6. Bouncing Logo
function BounceSpinner({ logoSize }: { logoSize: number }) {
  return (
    <div className="relative flex items-center justify-center h-32">
      <div className="animate-[bounce_1s_ease-in-out_infinite]">
        <Image
          src="/loanz-logo.png"
          alt="LOANZ 360"
          width={logoSize}
          height={logoSize * 0.3}
          className="object-contain drop-shadow-[0_20px_20px_rgba(0,0,0,0.5)]"
          priority
        />
      </div>
      {/* Shadow */}
      <div
        className="absolute bottom-0 w-20 h-2 bg-orange-500/30 rounded-full blur-sm animate-[shadow-pulse_1s_ease-in-out_infinite]"
      />
      <style jsx>{`
        @keyframes shadow-pulse {
          0%, 100% {
            transform: scaleX(0.8);
            opacity: 0.3;
          }
          50% {
            transform: scaleX(1.2);
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  )
}

// 7. 3D Flip Animation
function FlipSpinner({ logoSize }: { logoSize: number }) {
  return (
    <div
      className="relative animate-[flip_2s_ease-in-out_infinite]"
      style={{ perspective: '1000px' }}
    >
      <Image
        src="/loanz-logo.png"
        alt="LOANZ 360"
        width={logoSize}
        height={logoSize * 0.3}
        className="object-contain"
        priority
      />
      <style jsx>{`
        @keyframes flip {
          0% {
            transform: perspective(1000px) rotateY(0deg);
          }
          50% {
            transform: perspective(1000px) rotateY(180deg);
          }
          100% {
            transform: perspective(1000px) rotateY(360deg);
          }
        }
      `}</style>
    </div>
  )
}

// 8. Radar Sweep Effect
function RadarSpinner({ logoSize }: { logoSize: number }) {
  const radarSize = logoSize + 80
  return (
    <div className="relative flex items-center justify-center" style={{ width: radarSize, height: radarSize }}>
      {/* Radar circles */}
      <div className="absolute inset-0 rounded-full border border-orange-500/20" />
      <div
        className="absolute rounded-full border border-orange-500/30"
        style={{ width: radarSize * 0.75, height: radarSize * 0.75 }}
      />
      <div
        className="absolute rounded-full border border-orange-500/40"
        style={{ width: radarSize * 0.5, height: radarSize * 0.5 }}
      />
      {/* Radar sweep */}
      <div
        className="absolute inset-0 animate-spin origin-center"
        style={{ animationDuration: '2s' }}
      >
        <div
          className="absolute top-1/2 left-1/2 w-1/2 h-0.5"
          style={{
            background: 'linear-gradient(90deg, rgba(249,115,22,0.8) 0%, transparent 100%)',
            transformOrigin: 'left center',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 origin-left"
          style={{
            width: radarSize / 2,
            height: radarSize / 2,
            background: 'conic-gradient(from 0deg, rgba(249,115,22,0.3) 0deg, transparent 60deg)',
            transform: 'translateY(-50%)',
          }}
        />
      </div>
      {/* Logo */}
      <Image
        src="/loanz-logo.png"
        alt="LOANZ 360"
        width={logoSize * 0.8}
        height={logoSize * 0.24}
        className="object-contain z-10"
        priority
      />
    </div>
  )
}

// 9. Floating Particles
function ParticlesSpinner({ logoSize }: { logoSize: number }) {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    delay: i * 0.2,
    duration: 2 + Math.random(),
    x: (Math.random() - 0.5) * 100,
    y: (Math.random() - 0.5) * 100,
  }))

  return (
    <div className="relative flex items-center justify-center" style={{ width: logoSize + 100, height: logoSize + 100 }}>
      {/* Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-2 h-2 bg-orange-500 rounded-full animate-[particle_2s_ease-in-out_infinite]"
          style={{
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--tx': `${p.x}px`,
            '--ty': `${p.y}px`,
          } as React.CSSProperties}
        />
      ))}
      {/* Logo with glow */}
      <div className="relative">
        <div className="absolute inset-0 bg-orange-500/20 blur-2xl rounded-full animate-pulse" />
        <Image
          src="/loanz-logo.png"
          alt="LOANZ 360"
          width={logoSize}
          height={logoSize * 0.3}
          className="object-contain z-10 relative"
          priority
        />
      </div>
      <style jsx>{`
        @keyframes particle {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          50% {
            transform: translate(var(--tx), var(--ty)) scale(0.5);
          }
        }
      `}</style>
    </div>
  )
}

// 10. Gradient Spinning Ring
function GradientRingSpinner({ logoSize }: { logoSize: number }) {
  const ringSize = logoSize + 60
  return (
    <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
      {/* Gradient ring */}
      <div
        className="absolute inset-0 rounded-full animate-spin"
        style={{
          animationDuration: '2s',
          background: 'conic-gradient(from 0deg, transparent, #f97316, #fbbf24, #f97316, transparent)',
          padding: '4px',
        }}
      >
        <div className="w-full h-full rounded-full bg-black" />
      </div>
      {/* Secondary ring */}
      <div
        className="absolute rounded-full animate-spin"
        style={{
          width: ringSize - 16,
          height: ringSize - 16,
          animationDuration: '3s',
          animationDirection: 'reverse',
          background: 'conic-gradient(from 180deg, transparent, #f97316 50%, transparent)',
          padding: '2px',
        }}
      >
        <div className="w-full h-full rounded-full bg-black" />
      </div>
      {/* Logo */}
      <Image
        src="/loanz-logo.png"
        alt="LOANZ 360"
        width={logoSize}
        height={logoSize * 0.3}
        className="object-contain z-10"
        priority
      />
    </div>
  )
}

// 11. Logo with Bouncing Balls Below
function BounceBallsSpinner({ logoSize }: { logoSize: number }) {
  const ballSize = Math.max(12, logoSize * 0.1)
  const ballCount = 5

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Logo */}
      <Image
        src="/loanz-logo.png"
        alt="LOANZ 360"
        width={logoSize}
        height={logoSize * 0.3}
        className="object-contain drop-shadow-[0_0_15px_rgba(249,115,22,0.3)]"
        priority
      />

      {/* Bouncing balls container */}
      <div className="flex items-end justify-center gap-2" style={{ height: ballSize * 3 }}>
        {Array.from({ length: ballCount }).map((_, i) => (
          <div
            key={i}
            className="rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.6)]"
            style={{
              width: ballSize,
              height: ballSize,
              animation: `bounceBall 0.6s ease-in-out infinite`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes bounceBall {
          0%, 100% {
            transform: translateY(0);
            opacity: 1;
          }
          50% {
            transform: translateY(-${ballSize * 2}px);
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  )
}

// 12. Letter Bounce - Each letter in LOANZ360 bounces sequentially
function LetterBounceSpinner({ logoSize }: { logoSize: number }) {
  const letters = ['L', 'O', 'A', 'N', 'Z', '3', '6', '0']
  const [activeIndex, setActiveIndex] = React.useState(0)

  React.useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % letters.length)
    }, 300) // 300ms per letter = ~2.4s per full cycle (slower bounce)
    return () => clearInterval(interval)
  }, [])

  // Calculate font size based on logo size
  const fontSize = Math.max(32, logoSize * 0.4)
  const bounceHeight = fontSize * 0.6

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Letter container */}
      <div className="flex items-end justify-center" style={{ height: fontSize + bounceHeight + 20 }}>
        {letters.map((letter, index) => {
          const isActive = index === activeIndex
          const isNumber = ['3', '6', '0'].includes(letter)

          return (
            <span
              key={index}
              className="transition-all duration-300 ease-out font-bold"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: 1,
                color: isNumber ? '#f97316' : '#fff',
                textShadow: isActive
                  ? '0 0 20px rgba(249, 115, 22, 0.8), 0 0 40px rgba(249, 115, 22, 0.5)'
                  : '0 0 10px rgba(249, 115, 22, 0.3)',
                transform: isActive
                  ? `translateY(-${bounceHeight}px) scale(1.2)`
                  : 'translateY(0) scale(1)',
                marginRight: letter === 'Z' ? '8px' : '2px', // Space before numbers
                fontFamily: '"Droid Serif", serif',
              }}
            >
              {letter}
            </span>
          )
        })}
      </div>

      {/* Subtle reflection/shadow */}
      <div
        className="flex items-start justify-center opacity-20"
        style={{
          transform: 'scaleY(-0.3) translateY(-20px)',
          filter: 'blur(2px)',
        }}
      >
        {letters.map((letter, index) => {
          const isActive = index === activeIndex
          const isNumber = ['3', '6', '0'].includes(letter)

          return (
            <span
              key={index}
              className="transition-all duration-300 ease-out font-bold"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: 1,
                color: isNumber ? '#f97316' : '#fff',
                transform: isActive ? 'scale(1.2)' : 'scale(1)',
                marginRight: letter === 'Z' ? '8px' : '2px',
                fontFamily: '"Droid Serif", serif',
              }}
            >
              {letter}
            </span>
          )
        })}
      </div>

      {/* Bouncing indicator dots */}
      <div className="flex gap-2 mt-2">
        {letters.map((_, index) => (
          <div
            key={index}
            className="rounded-full transition-all duration-300"
            style={{
              width: index === activeIndex ? 10 : 6,
              height: index === activeIndex ? 10 : 6,
              backgroundColor: index === activeIndex ? '#f97316' : 'rgba(249, 115, 22, 0.3)',
              boxShadow: index === activeIndex ? '0 0 10px rgba(249, 115, 22, 0.8)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// 13. Loan Queue - People waiting, entering office, coming out happy
function LoanQueueSpinner({ logoSize }: { logoSize: number }) {
  const [frame, setFrame] = React.useState(0)
  const [customerCount, setCustomerCount] = React.useState(0)

  // Total animation: 40 frames (4 seconds per customer cycle)
  const TOTAL_FRAMES = 40

  React.useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => {
        const next = (prev + 1) % TOTAL_FRAMES
        if (next === 0) {
          setCustomerCount(c => c + 1)
        }
        return next
      })
    }, 100) // 100ms per frame = 4 sec total cycle
    return () => clearInterval(interval)
  }, [])

  // Animation timeline:
  // Frames 0-14:  Person walks from LEFT queue towards CENTER door
  // Frames 15-19: Person enters door (fades into door)
  // Frames 20-24: Happy person emerges from door (pops out)
  // Frames 25-39: Happy person jumps and walks to RIGHT, celebrating

  const progress = frame / TOTAL_FRAMES // 0 to 1

  // Side-profile person component - facing RIGHT towards the door
  const Person = ({
    skinColor = "#fcd34d",
    shirtColor = "#f97316",
    isHappy = false,
    showLetter = false,
    jumpOffset = 0,
    facingLeft = false
  }: {
    skinColor?: string
    shirtColor?: string
    isHappy?: boolean
    showLetter?: boolean
    jumpOffset?: number
    facingLeft?: boolean
  }) => (
    <div
      className="relative"
      style={{
        transform: `translateY(${-jumpOffset}px) ${facingLeft ? 'scaleX(-1)' : ''}`,
      }}
    >
      <svg width="40" height="70" viewBox="0 0 40 70" fill="none">
        {/* Shadow */}
        <ellipse cx="20" cy="68" rx="10" ry="3" fill="rgba(0,0,0,0.3)" />

        {/* Back leg (farther) */}
        <rect x="12" y="46" width="7" height="18" rx="3" fill="#1e3a5f" opacity="0.8" />
        <ellipse cx="15" cy="65" rx="5" ry="3" fill="#1f2937" opacity="0.8" />

        {/* Front leg (closer) */}
        <rect x="18" y="46" width="7" height="18" rx="3" fill="#1e3a5f" />
        <ellipse cx="24" cy="65" rx="6" ry="3" fill="#1f2937" />

        {/* Body/Shirt - side view (narrower) */}
        <rect x="12" y="28" width="14" height="20" rx="4" fill={shirtColor} />

        {/* Arms - side view */}
        {isHappy ? (
          <>
            {/* Arm raised up in celebration (side view - only front arm visible) */}
            <rect x="18" y="20" width="5" height="14" rx="2" fill={shirtColor} transform="rotate(-30 20 28)" />
            {/* Hand raised */}
            <circle cx="28" cy="8" r="4" fill={skinColor} />
          </>
        ) : (
          <>
            {/* Normal arm hanging (side view) */}
            <rect x="18" y="30" width="5" height="14" rx="2" fill={shirtColor} />
            {/* Hand */}
            <circle cx="20" cy="46" r="3" fill={skinColor} />
          </>
        )}

        {/* Head - side profile facing right */}
        <ellipse cx="22" cy="14" rx="10" ry="11" fill={skinColor} />

        {/* Nose (profile) */}
        <path d="M32 14 L36 16 L32 18" fill={skinColor} stroke={skinColor} strokeWidth="1" />

        {/* Hair - side view */}
        <path d="M12 8 Q22 -2 32 8 L30 12 Q22 6 14 12 Z" fill="#4a3728" />

        {/* Ear */}
        <ellipse cx="12" cy="14" rx="3" ry="4" fill={skinColor} />
        <ellipse cx="12" cy="14" rx="1.5" ry="2" fill={skinColor} opacity="0.7" />

        {/* Face - side profile */}
        {isHappy ? (
          <>
            {/* Happy closed eye (curved) - only one visible in profile */}
            <path d="M24 11 Q27 9 30 11" stroke="#000" strokeWidth="2" fill="none" />
            {/* Big smile - side view */}
            <path d="M28 18 Q34 24 36 18" stroke="#000" strokeWidth="2" fill="#fff" />
            {/* Rosy cheek */}
            <circle cx="30" cy="18" r="3" fill="#f87171" opacity="0.5" />
          </>
        ) : (
          <>
            {/* Normal eye - side profile (only one visible) */}
            <ellipse cx="27" cy="12" rx="2.5" ry="2" fill="#fff" />
            <circle cx="28" cy="12" r="1.5" fill="#000" />
            {/* Eyebrow */}
            <path d="M24 9 L30 8" stroke="#4a3728" strokeWidth="1.5" />
            {/* Neutral mouth - side view */}
            <path d="M30 20 L35 19" stroke="#000" strokeWidth="1.5" fill="none" />
          </>
        )}
      </svg>

      {/* Sanction Letter - held up */}
      {showLetter && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg width="50" height="40" viewBox="0 0 50 40" fill="none">
            {/* Paper */}
            <rect x="2" y="2" width="46" height="36" rx="3" fill="#fff" stroke="#22c55e" strokeWidth="3" />
            {/* Text lines */}
            <rect x="8" y="8" width="34" height="4" rx="1" fill="#22c55e" />
            <rect x="8" y="15" width="28" height="3" rx="1" fill="#86efac" />
            <rect x="8" y="21" width="24" height="3" rx="1" fill="#86efac" />
            {/* Approved stamp */}
            <circle cx="38" cy="28" r="8" fill="#22c55e" />
            <path d="M33 28 L36 31 L43 24" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  )

  // Queue of people with different appearances
  const queuePeople = [
    { skin: "#fcd34d", shirt: "#f97316" }, // First in line (orange) - will walk to door
    { skin: "#f5d0c5", shirt: "#3b82f6" }, // Second (blue)
    { skin: "#d4a574", shirt: "#8b5cf6" }, // Third (purple)
    { skin: "#fcd34d", shirt: "#ec4899" }, // Fourth (pink)
    { skin: "#f5d0c5", shirt: "#10b981" }, // Fifth (teal)
  ]

  // Calculate what to show based on frame
  const isWalkingIn = frame >= 0 && frame < 15
  const isEntering = frame >= 15 && frame < 20
  const isExiting = frame >= 20 && frame < 25
  const isWalkingOut = frame >= 25 && frame < 40

  // Position calculations
  const walkInProgress = isWalkingIn ? frame / 15 : 1 // 0 to 1
  const walkInX = 140 + walkInProgress * 100 // Start from front of queue, walk to door
  const walkOutX = isWalkingOut ? 250 + ((frame - 25) / 15) * 220 : 250 // 250 to 470px
  const enterScale = isEntering ? 1 - ((frame - 15) / 5) : 1
  const exitScale = isExiting ? (frame - 20) / 5 : 1
  const jumpHeight = isWalkingOut ? Math.sin(((frame - 25) / 15) * Math.PI * 4) * 20 : 0

  // Queue shift: when first person is walking, others move forward
  const queueShift = isWalkingIn ? walkInProgress * 45 : (isEntering || isExiting || isWalkingOut) ? 45 : 0

  // Get current person's appearance (cycles through queue)
  const currentPersonIndex = customerCount % queuePeople.length
  const currentPerson = queuePeople[currentPersonIndex]

  return (
    <div className="flex flex-col items-center gap-4">
      {/* LOANZ 360 Office Building */}
      <div className="relative">
        <div className="bg-gradient-to-b from-gray-700 to-gray-900 rounded-2xl p-4 border-4 border-orange-500 shadow-[0_0_40px_rgba(249,115,22,0.5)]">
          <Image
            src="/loanz-logo.png"
            alt="LOANZ 360"
            width={logoSize * 1.2}
            height={logoSize * 0.36}
            className="object-contain"
            priority
          />
          <div className="text-center mt-2 text-orange-400 text-sm font-bold tracking-wider">
            LOAN OFFICE
          </div>
        </div>
      </div>

      {/* Animation Scene */}
      <div className="relative w-[550px] h-[160px] bg-gradient-to-b from-sky-900 via-gray-900 to-gray-800 rounded-2xl overflow-hidden border-2 border-gray-600">
        {/* Stars in sky */}
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${5 + i * 10}%`,
              top: `${8 + (i % 4) * 8}%`,
              animationDelay: `${i * 0.2}s`
            }}
          />
        ))}

        {/* Ground */}
        <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700" />

        {/* Queue rope/barrier */}
        <div className="absolute bottom-12 left-4 w-32 h-1 bg-yellow-600 rounded" />
        <div className="absolute bottom-5 left-4 w-1 h-8 bg-yellow-700 rounded" />
        <div className="absolute bottom-5 left-[136px] w-1 h-8 bg-yellow-700 rounded" />

        {/* ENTRANCE DOOR - Center */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20">
          <div className="relative">
            {/* Door frame */}
            <div className="w-20 h-28 bg-gradient-to-b from-orange-700 to-orange-900 rounded-t-xl border-4 border-orange-400 shadow-[0_0_25px_rgba(249,115,22,0.6)]">
              {/* Door window */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-10 bg-yellow-400/40 rounded border-2 border-orange-300" />
              {/* Door handle */}
              <div className="absolute right-3 top-1/2 w-3 h-3 bg-yellow-400 rounded-full shadow-lg" />
            </div>
            {/* Sign above door */}
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap animate-pulse">
              🚪 ENTER HERE 🚪
            </div>
          </div>
        </div>

        {/* LEFT: Queue of waiting people - they shift forward when front person leaves */}
        <div
          className="absolute bottom-5 left-8 flex items-end gap-0 transition-transform duration-500 ease-out"
          style={{ transform: `translateX(${queueShift}px)` }}
        >
          {/* Show queue people (skip first one when they're walking) */}
          {queuePeople.slice(isWalkingIn ? 1 : 0, 5).map((person, i) => {
            const actualIndex = isWalkingIn ? i + 1 : i
            const personData = queuePeople[(currentPersonIndex + actualIndex + 1) % queuePeople.length]
            return (
              <div key={i} className="transition-all duration-500">
                <Person
                  skinColor={personData.skin}
                  shirtColor={personData.shirt}
                />
              </div>
            )
          })}
        </div>

        {/* Queue label with arrow */}
        <div className="absolute bottom-0 left-4 text-gray-400 text-xs font-bold flex items-center gap-1">
          <span className="text-yellow-500">→</span> QUEUE LINE
        </div>

        {/* "NEXT" indicator above first person in queue */}
        {!isWalkingIn && (
          <div className="absolute bottom-[115px] left-[52px] z-10">
            <div className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded animate-bounce">
              NEXT
            </div>
          </div>
        )}

        {/* ANIMATED: First person walking from queue to door */}
        {isWalkingIn && (
          <div
            className="absolute bottom-5 z-30 transition-none"
            style={{ left: `${walkInX}px` }}
          >
            <Person skinColor={currentPerson.skin} shirtColor={currentPerson.shirt} />
          </div>
        )}

        {/* ANIMATED: Person entering door (shrinking) */}
        {isEntering && (
          <div
            className="absolute bottom-5 z-15"
            style={{
              left: '250px',
              transform: `scale(${enterScale})`,
              opacity: enterScale,
              transformOrigin: 'bottom center'
            }}
          >
            <Person skinColor={currentPerson.skin} shirtColor={currentPerson.shirt} />
          </div>
        )}

        {/* ANIMATED: Happy person exiting (growing) */}
        {isExiting && (
          <div
            className="absolute bottom-5 z-30"
            style={{
              left: '250px',
              transform: `scale(${exitScale})`,
              opacity: exitScale,
              transformOrigin: 'bottom center'
            }}
          >
            <Person skinColor={currentPerson.skin} shirtColor="#22c55e" isHappy={true} showLetter={true} />
          </div>
        )}

        {/* ANIMATED: Happy person walking/jumping away to the RIGHT */}
        {isWalkingOut && (
          <div
            className="absolute bottom-5 z-30"
            style={{ left: `${walkOutX}px` }}
          >
            <Person
              skinColor={currentPerson.skin}
              shirtColor="#22c55e"
              isHappy={true}
              showLetter={true}
              jumpOffset={Math.max(0, jumpHeight)}
            />
          </div>
        )}

        {/* Speech bubble when walking out */}
        {isWalkingOut && frame > 27 && (
          <div
            className="absolute z-40"
            style={{
              left: `${Math.min(walkOutX + 45, 480)}px`,
              bottom: '110px'
            }}
          >
            <div className="bg-green-500 text-white text-sm px-4 py-2 rounded-2xl shadow-xl font-bold whitespace-nowrap border-2 border-green-300 animate-bounce">
              🎉 MY LOAN IS SANCTIONED! 🎉
            </div>
            <div className="absolute -bottom-2 left-8 w-4 h-4 bg-green-500 rotate-45 border-r-2 border-b-2 border-green-300" />
          </div>
        )}

        {/* Confetti when celebrating */}
        {isWalkingOut && frame > 28 && (
          <>
            {['🎊', '✨', '🌟', '💰', '🎉', '⭐', '💵', '🏆'].map((emoji, i) => (
              <div
                key={i}
                className="absolute text-2xl animate-bounce"
                style={{
                  left: `${Math.min(walkOutX - 20 + i * 20, 520)}px`,
                  top: `${15 + (i % 4) * 18}px`,
                  animationDelay: `${i * 0.08}s`,
                  animationDuration: '0.4s'
                }}
              >
                {emoji}
              </div>
            ))}
          </>
        )}

        {/* Exit sign with arrow */}
        <div className="absolute bottom-0 right-4 text-gray-400 text-xs font-bold flex items-center gap-1">
          HAPPY EXIT <span className="text-green-500">→</span>
        </div>

        {/* Processing indicator in scene */}
        {(isEntering || isExiting) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-orange-500/90 text-white text-xs px-3 py-1 rounded-full animate-pulse">
            ⏳ Processing loan application...
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 bg-gray-800 px-6 py-3 rounded-full border border-gray-600">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏦</span>
          <span className="text-gray-400">Loans Approved:</span>
          <span className="text-green-400 font-bold text-2xl">{customerCount}</span>
        </div>
        <div className="w-px h-8 bg-gray-600" />
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
          <span className="text-orange-400 font-medium">Next customer in queue...</span>
        </div>
      </div>
    </div>
  )
}

// Individual spinner preview component
function SpinnerPreview({
  variant,
  name,
  selected,
  onSelect
}: {
  variant: SpinnerVariant
  name: string
  selected: boolean
  onSelect: () => void
}) {
  const logoSize = 80

  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-center justify-center p-6 rounded-xl cursor-pointer transition-all duration-300",
        variant === "letter-bounce" || variant === "loan-queue" ? "min-h-[280px]" : "min-h-[200px]",
        selected
          ? "bg-orange-500/20 border-2 border-orange-500 scale-105"
          : "bg-gray-900/80 border border-gray-700 hover:border-orange-500/50 hover:bg-gray-800/80"
      )}
    >
      <div className="flex-1 flex items-center justify-center w-full">
        {variant === "pulse" && <PulseSpinner logoSize={logoSize} />}
        {variant === "ring" && <RingSpinner logoSize={logoSize} />}
        {variant === "dots" && <DotsSpinner logoSize={logoSize} />}
        {variant === "wave" && <WaveSpinner logoSize={logoSize} />}
        {variant === "morph" && <MorphSpinner logoSize={logoSize} />}
        {variant === "bounce" && <BounceSpinner logoSize={logoSize} />}
        {variant === "flip" && <FlipSpinner logoSize={logoSize} />}
        {variant === "radar" && <RadarSpinner logoSize={logoSize} />}
        {variant === "particles" && <ParticlesSpinner logoSize={logoSize} />}
        {variant === "gradient-ring" && <GradientRingSpinner logoSize={logoSize} />}
        {variant === "bounce-balls" && <BounceBallsSpinner logoSize={logoSize} />}
        {variant === "letter-bounce" && <LetterBounceSpinner logoSize={logoSize} />}
        {variant === "loan-queue" && <LoanQueueSpinner logoSize={logoSize} />}
      </div>
      <div className="mt-4 text-center">
        <p className={cn(
          "text-sm font-medium capitalize",
          selected ? "text-orange-400" : "text-gray-300"
        )}>
          {name.replace(/-/g, " ")}
        </p>
        <p className="text-xs text-gray-500 mt-1">#{variants.indexOf(variant) + 1}</p>
      </div>
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  )
}

const variants: SpinnerVariant[] = [
  "pulse", "ring", "dots", "wave", "morph",
  "bounce", "flip", "radar", "particles", "gradient-ring", "bounce-balls", "letter-bounce", "loan-queue"
]

// Demo component to show all variants in a grid
export function LoadingSpinnerDemo() {
  const [selectedVariant, setSelectedVariant] = React.useState<SpinnerVariant>("ring")
  const [showFullscreen, setShowFullscreen] = React.useState(false)

  if (showFullscreen) {
    return (
      <div className="relative">
        <LoadingSpinner
          variant={selectedVariant}
          text="Loading LOANZ 360..."
          subText="Please wait while we prepare your dashboard"
        />
        <button
          onClick={() => setShowFullscreen(false)}
          className="fixed top-4 right-4 z-[10000] px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          ← Back to Grid
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">LOANZ 360 Loading Spinners</h1>
          <p className="text-gray-400">Click on any spinner to select it, then preview fullscreen</p>
        </div>

        {/* Selected indicator */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <span className="text-gray-400">Selected:</span>
          <span className="text-orange-400 font-semibold capitalize">{selectedVariant.replace("-", " ")}</span>
          <button
            onClick={() => setShowFullscreen(true)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
          >
            Preview Fullscreen →
          </button>
        </div>

        {/* Grid of all spinners */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {variants.map((variant) => (
            <div
              key={variant}
              className={cn(
                variant === "letter-bounce" || variant === "loan-queue"
                  ? "col-span-2"
                  : ""
              )}
            >
              <SpinnerPreview
                variant={variant}
                name={variant}
                selected={selectedVariant === variant}
                onSelect={() => setSelectedVariant(variant)}
              />
            </div>
          ))}
        </div>

        {/* Usage code */}
        <div className="mt-8 p-4 bg-gray-900 rounded-xl border border-gray-700">
          <p className="text-gray-400 text-sm mb-2">Usage:</p>
          <pre className="text-orange-400 text-sm overflow-x-auto">
{`import { LoadingSpinner } from "@/components/ui/loading-spinner"

<LoadingSpinner
  variant="${selectedVariant}"
  text="Loading..."
  subText="Please wait"
/>`}
          </pre>
        </div>
      </div>
    </div>
  )
}

/**
 * Page Loading Component
 *
 * Full-page loading spinner that uses the DEFAULT_SPINNER_VARIANT from config.
 * To change the spinner style across the app, edit: src/config/loading.config.ts
 */
export function PageLoading({
  text = DEFAULT_LOADING_TEXT,
  subText = DEFAULT_LOADING_SUBTEXT,
  className,
  variant = DEFAULT_SPINNER_VARIANT
}: {
  text?: string
  subText?: string
  className?: string
  variant?: SpinnerVariant
}) {
  return (
    <LoadingSpinner
      variant={variant}
      text={text}
      subText={subText}
      className={className}
    />
  )
}

/**
 * Inline Loading Component
 *
 * For use within components/sections (not full page).
 * Uses the DEFAULT_SPINNER_VARIANT from config.
 * To change the spinner style across the app, edit: src/config/loading.config.ts
 */
export function InlineLoading({
  size = "md",
  text,
  className,
  variant = DEFAULT_SPINNER_VARIANT
}: {
  size?: "sm" | "md" | "lg"
  text?: string
  className?: string
  variant?: SpinnerVariant
}) {
  const sizes = {
    sm: { logo: 60, container: 100 },
    md: { logo: 80, container: 140 },
    lg: { logo: 120, container: 200 }
  }

  const { logo, container } = sizes[size]

  // For inline, we render a smaller version of the selected spinner
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div style={{ transform: `scale(${container / 200})` }}>
        {variant === "pulse" && <PulseSpinner logoSize={logo} />}
        {variant === "ring" && <RingSpinner logoSize={logo} />}
        {variant === "dots" && <DotsSpinner logoSize={logo} />}
        {variant === "wave" && <WaveSpinner logoSize={logo} />}
        {variant === "morph" && <MorphSpinner logoSize={logo} />}
        {variant === "bounce" && <BounceSpinner logoSize={logo} />}
        {variant === "flip" && <FlipSpinner logoSize={logo} />}
        {variant === "radar" && <RadarSpinner logoSize={logo} />}
        {variant === "particles" && <ParticlesSpinner logoSize={logo} />}
        {variant === "gradient-ring" && <GradientRingSpinner logoSize={logo} />}
        {variant === "bounce-balls" && <BounceBallsSpinner logoSize={logo} />}
        {variant === "letter-bounce" && <LetterBounceSpinner logoSize={logo} />}
        {/* loan-queue is too complex for inline, fallback to ring */}
        {variant === "loan-queue" && <RingSpinner logoSize={logo} />}
      </div>
      {text && (
        <p className="text-gray-400 text-sm animate-pulse">{text}</p>
      )}
    </div>
  )
}

export default LoadingSpinner
