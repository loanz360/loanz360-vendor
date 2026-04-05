import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils/cn"
import { getInitials } from "@/lib/utils/cn"

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full",
  {
    variants: {
      size: {
        xs: "h-6 w-6 text-xs",
        sm: "h-8 w-8 text-sm",
        default: "h-10 w-10",
        lg: "h-12 w-12 text-lg",
        xl: "h-16 w-16 text-xl",
        "2xl": "h-20 w-20 text-2xl",
        "3xl": "h-24 w-24 text-3xl",
      },
      variant: {
        default: "bg-muted",
        primary: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        ash: "bg-brand-ash text-white",
        orange: "bg-brand-primary text-white",
      }
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
)

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {
  src?: string
  alt?: string
  fallback?: string
  name?: string
  showStatus?: boolean
  status?: 'online' | 'offline' | 'away' | 'busy'
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size, variant, src, alt, fallback, name, showStatus, status = 'offline', ...props }, ref) => {
  const initials = name ? getInitials(name) : fallback

  return (
    <div className="relative inline-block">
      <AvatarPrimitive.Root
        ref={ref}
        className={cn(avatarVariants({ size, variant, className }))}
        {...props}
      >
        <AvatarPrimitive.Image
          src={src}
          alt={alt || name || 'Avatar'}
          className="aspect-square h-full w-full object-cover"
        />
        <AvatarPrimitive.Fallback
          className={cn(
            "flex h-full w-full items-center justify-center font-medium bg-muted text-muted-foreground",
            variant === "primary" && "bg-primary text-primary-foreground",
            variant === "secondary" && "bg-secondary text-secondary-foreground",
            variant === "ash" && "bg-brand-ash text-white",
            variant === "orange" && "bg-brand-primary text-white"
          )}
        >
          {initials || "?"}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>

      {showStatus && (
        <div
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
            status === 'online' && "bg-green-500",
            status === 'offline' && "bg-gray-500",
            status === 'away' && "bg-yellow-500",
            status === 'busy' && "bg-red-500"
          )}
        />
      )}
    </div>
  )
})
Avatar.displayName = AvatarPrimitive.Root.displayName

// Specialized avatar components for LOANZ 360

const UserAvatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  Omit<AvatarProps, 'variant'> & {
    role?: string
    verified?: boolean
  }
>(({ role, verified, name, className, ...props }, ref) => {
  // Determine variant based on role
  const getVariantByRole = (role?: string) => {
    if (!role) return 'default'
    if (role.includes('ADMIN')) return 'orange'
    if (role.includes('PARTNER')) return 'primary'
    if (role.includes('EMPLOYEE')) return 'ash'
    return 'default'
  }

  return (
    <div className="relative">
      <Avatar
        ref={ref}
        variant={getVariantByRole(role)}
        name={name}
        className={className}
        {...props}
      />
      {verified && (
        <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
          <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  )
})
UserAvatar.displayName = "UserAvatar"

const ProfileAvatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps & {
    editable?: boolean
    onEdit?: () => void
  }
>(({ editable, onEdit, className, ...props }, ref) => (
  <div className="relative group">
    <Avatar
      ref={ref}
      size="2xl"
      className={cn("transition-all duration-200", editable && "group-hover:opacity-80", className)}
      {...props}
    />
    {editable && (
      <button
        onClick={onEdit}
        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-full"
      >
        <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    )}
  </div>
))
ProfileAvatar.displayName = "ProfileAvatar"

const AvatarGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    avatars: Array<{
      src?: string
      name?: string
      alt?: string
    }>
    max?: number
    size?: AvatarProps['size']
    variant?: AvatarProps['variant']
  }
>(({ avatars, max = 4, size = "default", variant = "default", className, ...props }, ref) => {
  const displayAvatars = avatars.slice(0, max)
  const remainingCount = avatars.length - max

  return (
    <div
      ref={ref}
      className={cn("flex -space-x-2", className)}
      {...props}
    >
      {displayAvatars.map((avatar, index) => (
        <Avatar
          key={index}
          src={avatar.src}
          name={avatar.name}
          alt={avatar.alt}
          size={size}
          variant={variant}
          className="border-2 border-background"
        />
      ))}
      {remainingCount > 0 && (
        <Avatar
          size={size}
          variant="ash"
          fallback={`+${remainingCount}`}
          className="border-2 border-background"
        />
      )}
    </div>
  )
})
AvatarGroup.displayName = "AvatarGroup"

const CompanyAvatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  Omit<AvatarProps, 'variant'> & {
    companyName?: string
    isVerified?: boolean
  }
>(({ companyName, isVerified, className, ...props }, ref) => (
  <div className="relative">
    <Avatar
      ref={ref}
      variant="primary"
      name={companyName}
      className={cn("rounded-lg", className)} // Square avatar for companies
      {...props}
    />
    {isVerified && (
      <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
        <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    )}
  </div>
))
CompanyAvatar.displayName = "CompanyAvatar"

// Export primitives for direct use
const AvatarImage = AvatarPrimitive.Image
const AvatarFallback = AvatarPrimitive.Fallback

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  UserAvatar,
  ProfileAvatar,
  AvatarGroup,
  CompanyAvatar,
  avatarVariants
}