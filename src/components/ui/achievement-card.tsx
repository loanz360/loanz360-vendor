import * as React from "react"
import { cn } from "@/lib/utils/cn"
import Image from "next/image"

export interface AchievementCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description: string
  progress: number
  total: number
  badgeUrl?: string
  badgeAlt?: string
  variant?: "aqua" | "gold" | "purple" | "rose" | "emerald" | "sapphire" | "orange" | "electric"
  tier?: "common" | "rare" | "epic" | "legendary"
}

const AchievementCard = React.forwardRef<HTMLDivElement, AchievementCardProps>(
  ({
    className,
    title,
    description,
    progress,
    total,
    badgeUrl,
    badgeAlt = "Badge",
    variant = "aqua",
    tier,
    ...props
  }, ref) => {
    const percentage = (progress / total) * 100

    // Premium color palette optimized for black backgrounds
    // Inspired by gaming UIs, luxury brands, and modern design systems
    const variantColors = {
      // Aqua Neon - High-tech, modern, premium (like the reference image)
      aqua: {
        border: "border-[#00D9FF]/40",
        progressBg: "bg-gradient-to-r from-[#00D9FF] to-[#00F5FF]",
        progressText: "text-[#00F5FF]",
        shadow: "shadow-[8px_8px_16px_rgba(0,0,0,0.5),-8px_-8px_16px_rgba(0,217,255,0.08)]",
        glow: "hover:shadow-[8px_8px_20px_rgba(0,0,0,0.6),-8px_-8px_20px_rgba(0,217,255,0.15),0_0_40px_rgba(0,217,255,0.25)]"
      },
      // Legendary Gold - Premium, exclusive, top-tier
      gold: {
        border: "border-[#FFD700]/40",
        progressBg: "bg-gradient-to-r from-[#FFD700] to-[#FFA500]",
        progressText: "text-[#FFD700]",
        shadow: "shadow-[8px_8px_16px_rgba(0,0,0,0.5),-8px_-8px_16px_rgba(255,215,0,0.08)]",
        glow: "hover:shadow-[8px_8px_20px_rgba(0,0,0,0.6),-8px_-8px_20px_rgba(255,215,0,0.15),0_0_40px_rgba(255,215,0,0.25)]"
      },
      // Royal Purple - Elegant, sophisticated, rare
      purple: {
        border: "border-[#B621FE]/40",
        progressBg: "bg-gradient-to-r from-[#B621FE] to-[#C026D3]",
        progressText: "text-[#C026D3]",
        shadow: "shadow-[8px_8px_16px_rgba(0,0,0,0.5),-8px_-8px_16px_rgba(182,33,254,0.08)]",
        glow: "hover:shadow-[8px_8px_20px_rgba(0,0,0,0.6),-8px_-8px_20px_rgba(182,33,254,0.15),0_0_40px_rgba(182,33,254,0.25)]"
      },
      // Hot Rose - Bold, energetic, passionate
      rose: {
        border: "border-[#FF006E]/40",
        progressBg: "bg-gradient-to-r from-[#FF006E] to-[#EC4899]",
        progressText: "text-[#FF006E]",
        shadow: "shadow-[8px_8px_16px_rgba(0,0,0,0.5),-8px_-8px_16px_rgba(255,0,110,0.08)]",
        glow: "hover:shadow-[8px_8px_20px_rgba(0,0,0,0.6),-8px_-8px_20px_rgba(255,0,110,0.15),0_0_40px_rgba(255,0,110,0.25)]"
      },
      // Emerald Green - Success, achievement, growth
      emerald: {
        border: "border-[#00F5A0]/40",
        progressBg: "bg-gradient-to-r from-[#00F5A0] to-[#00D9F5]",
        progressText: "text-[#00F5A0]",
        shadow: "shadow-[8px_8px_16px_rgba(0,0,0,0.5),-8px_-8px_16px_rgba(0,245,160,0.08)]",
        glow: "hover:shadow-[8px_8px_20px_rgba(0,0,0,0.6),-8px_-8px_20px_rgba(0,245,160,0.15),0_0_40px_rgba(0,245,160,0.25)]"
      },
      // Electric Sapphire - Professional, trustworthy, powerful
      sapphire: {
        border: "border-[#0096FF]/40",
        progressBg: "bg-gradient-to-r from-[#0096FF] to-[#0047AB]",
        progressText: "text-[#0096FF]",
        shadow: "shadow-[8px_8px_16px_rgba(0,0,0,0.5),-8px_-8px_16px_rgba(0,150,255,0.08)]",
        glow: "hover:shadow-[8px_8px_20px_rgba(0,0,0,0.6),-8px_-8px_20px_rgba(0,150,255,0.15),0_0_40px_rgba(0,150,255,0.25)]"
      },
      // Brand Orange - Signature LOANZ 360 color
      orange: {
        border: "border-[#FF6700]/40",
        progressBg: "bg-gradient-to-r from-[#FF6700] to-[#FF8C00]",
        progressText: "text-[#FF6700]",
        shadow: "shadow-[8px_8px_16px_rgba(0,0,0,0.5),-8px_-8px_16px_rgba(255,103,0,0.08)]",
        glow: "hover:shadow-[8px_8px_20px_rgba(0,0,0,0.6),-8px_-8px_20px_rgba(255,103,0,0.15),0_0_40px_rgba(255,103,0,0.25)]"
      },
      // Electric Violet - Futuristic, innovative, digital
      electric: {
        border: "border-[#8B5CF6]/40",
        progressBg: "bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA]",
        progressText: "text-[#8B5CF6]",
        shadow: "shadow-[8px_8px_16px_rgba(0,0,0,0.5),-8px_-8px_16px_rgba(139,92,246,0.08)]",
        glow: "hover:shadow-[8px_8px_20px_rgba(0,0,0,0.6),-8px_-8px_20px_rgba(139,92,246,0.15),0_0_40px_rgba(139,92,246,0.25)]"
      }
    }

    // Tier-based automatic color selection (optional override)
    const tierColors = tier ? {
      common: "sapphire",
      rare: "purple",
      epic: "rose",
      legendary: "gold"
    }[tier] as keyof typeof variantColors : variant

    const colors = variantColors[tierColors]

    return (
      <div
        ref={ref}
        className={cn(
          // Card container - slightly lighter than pure black for contrast
          "relative w-full max-w-[280px] rounded-2xl",
          "bg-gradient-to-br from-[#0d1117] to-[#161b22]", // GitHub dark theme inspired
          "border-2",
          colors.border,
          "p-6 flex flex-col items-center gap-4",
          // Box shadow with colored glow - this is the key for black backgrounds!
          colors.shadow,
          "hover:scale-[1.03]",
          colors.glow,
          "transition-all duration-300 ease-out",
          "font-poppins",
          className
        )}
        {...props}
      >
        {/* Badge/Logo Circle - matches reference image with neomorphism */}
        <div className={cn(
          "relative w-32 h-32 rounded-full overflow-hidden",
          "bg-gradient-to-br from-[#1c2938] to-[#0f1922]", // Darker blue-gray like reference
          "border-3",
          colors.border,
          // Neomorphism inner shadow for inset effect
          "shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-4px_-4px_8px_rgba(255,255,255,0.03)]",
          "flex items-center justify-center",
          "transition-transform duration-300"
        )}>
          {badgeUrl ? (
            <Image
              src={badgeUrl}
              alt={badgeAlt}
              width={128}
              height={128}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-6xl">🏆</div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-white text-center leading-tight mt-2">
          {title}
        </h3>

        {/* Description */}
        <p className="text-xs text-gray-400 text-center leading-relaxed">
          {description}
        </p>

        {/* Progress Badge - pill style like reference with neomorphism */}
        <div className={cn(
          "px-4 py-1.5 rounded-full font-bold text-sm",
          colors.progressBg,
          "text-black",
          // Raised neomorphism effect for the pill
          "shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.1)]",
          "hover:shadow-[6px_6px_12px_rgba(0,0,0,0.5),-3px_-3px_8px_rgba(255,255,255,0.15)]",
          "transition-shadow duration-300"
        )}>
          {progress}/{total}
        </div>
      </div>
    )
  }
)

AchievementCard.displayName = "AchievementCard"

export { AchievementCard }
