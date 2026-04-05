import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils/cn"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground border-border",

        // Status variants for LOANZ 360
        success: "border-transparent bg-success text-white shadow",
        warning: "border-transparent bg-warning text-white shadow",
        error: "border-transparent bg-error text-white shadow",
        info: "border-transparent bg-info text-white shadow",

        // Application status variants
        pending: "border-transparent bg-orange-500/20 text-orange-400 border border-orange-500/30",
        approved: "border-transparent bg-green-500/20 text-green-400 border border-green-500/30",
        rejected: "border-transparent bg-red-500/20 text-red-400 border border-red-500/30",
        "under-review": "border-transparent bg-blue-500/20 text-blue-400 border border-blue-500/30",
        disbursed: "border-transparent bg-green-600/20 text-green-300 border border-green-600/30",
        closed: "border-transparent bg-gray-500/20 text-gray-400 border border-gray-500/30",

        // KYC status variants
        "kyc-pending": "border-transparent bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
        "kyc-approved": "border-transparent bg-green-500/20 text-green-400 border border-green-500/30",
        "kyc-rejected": "border-transparent bg-red-500/20 text-red-400 border border-red-500/30",
        "kyc-expired": "border-transparent bg-orange-500/20 text-orange-400 border border-orange-500/30",

        // User status variants
        active: "border-transparent bg-green-500/20 text-green-400 border border-green-500/30",
        inactive: "border-transparent bg-gray-500/20 text-gray-400 border border-gray-500/30",
        suspended: "border-transparent bg-red-500/20 text-red-400 border border-red-500/30",

        // Partner type variants
        "business-associate": "border-transparent bg-blue-500/20 text-blue-400 border border-blue-500/30",
        "business-partner": "border-transparent bg-purple-500/20 text-purple-400 border border-purple-500/30",
        "channel-partner": "border-transparent bg-indigo-500/20 text-indigo-400 border border-indigo-500/30",

        // Priority variants
        high: "border-transparent bg-red-500/20 text-red-400 border border-red-500/30",
        medium: "border-transparent bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
        low: "border-transparent bg-green-500/20 text-green-400 border border-green-500/30",

        // Custom LOANZ 360 variant
        orange: "border-transparent bg-primary text-white shadow hover:bg-primary/80",
        ash: "border-transparent bg-brand-ash text-white",
      },
      size: {
        default: "text-xs",
        sm: "text-xs px-2 py-0.5",
        lg: "text-sm px-3 py-1",
        xl: "text-base px-4 py-1.5",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode
  dot?: boolean
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, icon, dot, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {dot && (
          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />
        )}
        {icon && (
          <span className="mr-1">{icon}</span>
        )}
        {children}
      </div>
    )
  }
)
Badge.displayName = "Badge"

// Specialized badge components for LOANZ 360

const StatusBadge = React.forwardRef<HTMLDivElement, {
  status: 'active' | 'inactive' | 'suspended' | 'pending' | 'approved' | 'rejected' | 'under-review' | 'disbursed' | 'closed'
  className?: string
  children?: React.ReactNode
}>(
  ({ status, className, children, ...props }, ref) => {
    const statusConfig = {
      active: { variant: 'active' as const, text: 'Active' },
      inactive: { variant: 'inactive' as const, text: 'Inactive' },
      suspended: { variant: 'suspended' as const, text: 'Suspended' },
      pending: { variant: 'pending' as const, text: 'Pending' },
      approved: { variant: 'approved' as const, text: 'Approved' },
      rejected: { variant: 'rejected' as const, text: 'Rejected' },
      'under-review': { variant: 'under-review' as const, text: 'Under Review' },
      disbursed: { variant: 'disbursed' as const, text: 'Disbursed' },
      closed: { variant: 'closed' as const, text: 'Closed' },
    }

    const config = statusConfig[status]

    return (
      <Badge
        ref={ref}
        variant={config.variant}
        className={className}
        dot
        {...props}
      >
        {children || config.text}
      </Badge>
    )
  }
)
StatusBadge.displayName = "StatusBadge"

const KYCBadge = React.forwardRef<HTMLDivElement, {
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'under-review'
  className?: string
  children?: React.ReactNode
}>(
  ({ status, className, children, ...props }, ref) => {
    const kycConfig = {
      pending: { variant: 'kyc-pending' as const, text: 'KYC Pending' },
      approved: { variant: 'kyc-approved' as const, text: 'KYC Verified' },
      rejected: { variant: 'kyc-rejected' as const, text: 'KYC Rejected' },
      expired: { variant: 'kyc-expired' as const, text: 'KYC Expired' },
      'under-review': { variant: 'under-review' as const, text: 'KYC Under Review' },
    }

    const config = kycConfig[status]

    return (
      <Badge
        ref={ref}
        variant={config.variant}
        className={className}
        {...props}
      >
        {children || config.text}
      </Badge>
    )
  }
)
KYCBadge.displayName = "KYCBadge"

const PartnerTypeBadge = React.forwardRef<HTMLDivElement, {
  type: 'business-associate' | 'business-partner' | 'channel-partner'
  className?: string
  children?: React.ReactNode
}>(
  ({ type, className, children, ...props }, ref) => {
    const typeConfig = {
      'business-associate': { variant: 'business-associate' as const, text: 'Business Associate' },
      'business-partner': { variant: 'business-partner' as const, text: 'Business Partner' },
      'channel-partner': { variant: 'channel-partner' as const, text: 'Channel Partner' },
    }

    const config = typeConfig[type]

    return (
      <Badge
        ref={ref}
        variant={config.variant}
        className={className}
        {...props}
      >
        {children || config.text}
      </Badge>
    )
  }
)
PartnerTypeBadge.displayName = "PartnerTypeBadge"

const PriorityBadge = React.forwardRef<HTMLDivElement, {
  priority: 'high' | 'medium' | 'low'
  className?: string
  children?: React.ReactNode
}>(
  ({ priority, className, children, ...props }, ref) => {
    const priorityConfig = {
      high: { variant: 'high' as const, text: 'High Priority' },
      medium: { variant: 'medium' as const, text: 'Medium Priority' },
      low: { variant: 'low' as const, text: 'Low Priority' },
    }

    const config = priorityConfig[priority]

    return (
      <Badge
        ref={ref}
        variant={config.variant}
        className={className}
        {...props}
      >
        {children || config.text}
      </Badge>
    )
  }
)
PriorityBadge.displayName = "PriorityBadge"

const RoleBadge = React.forwardRef<HTMLDivElement, {
  role: string
  className?: string
  variant?: 'default' | 'orange' | 'ash'
}>(
  ({ role, className, variant = 'ash', ...props }, ref) => (
    <Badge
      ref={ref}
      variant={variant}
      className={cn("uppercase tracking-wide", className)}
      {...props}
    >
      {role.replace(/_/g, ' ')}
    </Badge>
  )
)
RoleBadge.displayName = "RoleBadge"

export {
  Badge,
  StatusBadge,
  KYCBadge,
  PartnerTypeBadge,
  PriorityBadge,
  RoleBadge,
  badgeVariants
}