import * as React from "react"
import Image from "next/image"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils/cn"

const logoVariants = cva(
  "flex items-center",
  {
    variants: {
      size: {
        xs: "h-6", // 24px height
        sm: "h-8", // 32px height
        md: "h-10", // 40px height
        lg: "h-12", // 48px height
        xl: "h-16", // 64px height
        "2xl": "h-20", // 80px height
        "3xl": "h-24", // 96px height
      },
      orientation: {
        horizontal: "flex items-center",
        vertical: "flex flex-col items-center",
        inline: "inline-flex items-center",
      }
    },
    defaultVariants: {
      size: "md",
      orientation: "horizontal",
    },
  }
)

export interface LogoProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof logoVariants> {
  showFullText?: boolean
  href?: string
  as?: 'div' | 'h1' | 'h2' | 'h3' | 'span'
}

const Logo = React.forwardRef<HTMLDivElement, LogoProps>(
  ({
    className,
    size,
    orientation,
    showFullText = true,
    href,
    as: Component = "div",
    ...props
  }, ref) => {
    const logoSizes = {
      xs: { width: 120, height: 24 },
      sm: { width: 160, height: 32 },
      md: { width: 200, height: 40 },
      lg: { width: 240, height: 48 },
      xl: { width: 320, height: 64 },
      "2xl": { width: 400, height: 80 },
      "3xl": { width: 480, height: 96 }
    }

    const currentSize = logoSizes[size || "md"]

    const logoContent = (
      <Component
        ref={ref}
        className={cn(logoVariants({ size, orientation, className }))}
        {...props}
      >
        <Image
          src="/loanz-logo.png"
          alt="LOANZ 360"
          width={currentSize.width}
          height={currentSize.height}
          className="object-contain"
          priority
        />
        {showFullText && orientation === "vertical" && (
          <span className="text-xs font-normal text-muted-foreground mt-2 font-sans">
            Financial Services Platform
          </span>
        )}
      </Component>
    )

    if (href) {
      return (
        <a href={href} className="inline-block transition-opacity hover:opacity-80">
          {logoContent}
        </a>
      )
    }

    return logoContent
  }
)
Logo.displayName = "Logo"

// Specialized logo variants for different contexts

const SidebarLogo = React.forwardRef<HTMLDivElement, Omit<LogoProps, 'size' | 'orientation'>>(
  ({ className, ...props }, ref) => (
    <Logo
      ref={ref}
      size="xl"
      orientation="horizontal"
      className={cn("mb-6", className)}
      {...props}
    />
  )
)
SidebarLogo.displayName = "SidebarLogo"

const HeaderLogo = React.forwardRef<HTMLDivElement, Omit<LogoProps, 'size' | 'orientation'>>(
  ({ className, ...props }, ref) => (
    <Logo
      ref={ref}
      size="sm"
      orientation="horizontal"
      className={className}
      {...props}
    />
  )
)
HeaderLogo.displayName = "HeaderLogo"

const MobileLogo = React.forwardRef<HTMLDivElement, Omit<LogoProps, 'size' | 'orientation'>>(
  ({ className, ...props }, ref) => (
    <Logo
      ref={ref}
      size="sm"
      orientation="horizontal"
      className={className}
      {...props}
    />
  )
)
MobileLogo.displayName = "MobileLogo"

const HeroLogo = React.forwardRef<HTMLDivElement, Omit<LogoProps, 'size' | 'orientation'>>(
  ({ className, showFullText = true, ...props }, ref) => (
    <Logo
      ref={ref}
      size="3xl"
      orientation="vertical"
      showFullText={showFullText}
      className={cn("text-center", className)}
      {...props}
    />
  )
)
HeroLogo.displayName = "HeroLogo"

const FooterLogo = React.forwardRef<HTMLDivElement, Omit<LogoProps, 'size' | 'orientation'>>(
  ({ className, ...props }, ref) => (
    <Logo
      ref={ref}
      size="sm"
      orientation="horizontal"
      className={className}
      {...props}
    />
  )
)
FooterLogo.displayName = "FooterLogo"

// Logo with icon/symbol only (for very small spaces)
const LogoIcon = React.forwardRef<HTMLDivElement, {
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
}>(
  ({ size = "md", className, ...props }, ref) => {
    const iconSizes = {
      xs: { width: 60, height: 12, container: "w-6 h-6" },
      sm: { width: 80, height: 16, container: "w-8 h-8" },
      md: { width: 100, height: 20, container: "w-10 h-10" },
      lg: { width: 120, height: 24, container: "w-12 h-12" },
      xl: { width: 160, height: 32, container: "w-16 h-16" }
    }

    const currentSize = iconSizes[size]

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center",
          currentSize.container,
          className
        )}
        {...props}
      >
        <Image
          src="/loanz-logo.png"
          alt="LOANZ 360"
          width={currentSize.width}
          height={currentSize.height}
          className="object-contain"
        />
      </div>
    )
  }
)
LogoIcon.displayName = "LogoIcon"

// Animated logo for loading states
const AnimatedLogo = React.forwardRef<HTMLDivElement, LogoProps>(
  ({ className, ...props }, ref) => (
    <div className="relative">
      <Logo
        ref={ref}
        className={cn("animate-pulse-orange", className)}
        {...props}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-ping" />
    </div>
  )
)
AnimatedLogo.displayName = "AnimatedLogo"

// Logo with tagline for marketing materials
const LogoWithTagline = React.forwardRef<HTMLDivElement, LogoProps & {
  tagline?: string
}>(
  ({ className, tagline = "Your Trusted Financial Partner", ...props }, ref) => (
    <div ref={ref} className={cn("text-center flex flex-col gap-2", className)}>
      <Logo orientation="horizontal" {...props} />
      <p className="text-sm text-muted-foreground font-sans">{tagline}</p>
    </div>
  )
)
LogoWithTagline.displayName = "LogoWithTagline"

export {
  Logo,
  SidebarLogo,
  HeaderLogo,
  MobileLogo,
  HeroLogo,
  FooterLogo,
  LogoIcon,
  AnimatedLogo,
  LogoWithTagline,
  logoVariants
}