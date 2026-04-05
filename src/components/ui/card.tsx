import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils/cn"

const cardVariants = cva(
  "rounded-lg text-card-foreground font-poppins text-xs",
  {
    variants: {
      variant: {
        default: "frosted-card", // Frosted Card Glassmorphism
        dark: "frosted-card",    // Frosted Card Glassmorphism
        ash: "frosted-card",     // Frosted Card Glassmorphism
        content: "content-card", // Customer portal style card
        plain: "",               // No base style, className controls everything
        gradient: "bg-gradient-dark border-0 shadow-sm",
        outline: "bg-transparent border-border border-2 shadow-sm",
        success: "bg-success/10 border-0 text-success shadow-sm",
        warning: "bg-warning/10 border-0 text-warning shadow-sm",
        error: "bg-error/10 border-0 text-error shadow-sm",
        info: "bg-info/10 border-0 text-info shadow-sm",
      },
      padding: {
        none: "",
        sm: "p-3",
        default: "p-6",
        lg: "p-8",
      },
      hover: {
        none: "",
        lift: "hover:shadow-lg hover:scale-[1.02] transition-all duration-200",
        glow: "hover:shadow-orange-glow transition-shadow duration-300",
        both: "hover:shadow-orange-glow hover:scale-[1.02] transition-all duration-200",
      }
    },
    defaultVariants: {
      variant: "default",
      padding: "default",
      hover: "none",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, hover, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, hover, className }))}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// Custom LOANZ 360 card variants
const DashboardCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    title: string
    value: string | number
    subtitle?: string
    icon?: React.ReactNode
    trend?: "up" | "down" | "neutral"
    trendValue?: string
  }
>(({ className, title, value, subtitle, icon, trend, trendValue, ...props }, ref) => (
  <Card
    ref={ref}
    variant="ash"
    hover="lift"
    className={cn("", className)}
    {...props}
  >
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-primary">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
          {trend && trendValue && (
            <div className="flex items-center mt-2">
              <span
                className={cn(
                  "text-xs font-medium",
                  trend === "up" && "text-success",
                  trend === "down" && "text-error",
                  trend === "neutral" && "text-muted-foreground"
                )}
              >
                {trend === "up" && "↗"} {trend === "down" && "↘"} {trendValue}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="text-primary opacity-80">
            {icon}
          </div>
        )}
      </div>
    </CardContent>
  </Card>
))
DashboardCard.displayName = "DashboardCard"

const StatsCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    label: string
    value: string | number
    change?: string
    changeType?: "positive" | "negative" | "neutral"
    size?: "sm" | "md" | "lg"
  }
>(({ className, label, value, change, changeType = "neutral", size = "md", ...props }, ref) => (
  <Card
    ref={ref}
    variant="ash"
    padding={size === "sm" ? "sm" : "default"}
    className={cn("text-center", className)}
    {...props}
  >
    <CardContent className={cn(
      "flex flex-col gap-2",
      size === "sm" && "p-3",
      size === "lg" && "p-8"
    )}>
      <p className={cn(
        "font-medium text-muted-foreground",
        size === "sm" && "text-xs",
        size === "lg" && "text-base"
      )}>
        {label}
      </p>
      <p className={cn(
        "font-bold text-primary",
        size === "sm" && "text-lg",
        size === "md" && "text-2xl",
        size === "lg" && "text-3xl"
      )}>
        {value}
      </p>
      {change && (
        <p className={cn(
          "text-xs font-medium",
          changeType === "positive" && "text-success",
          changeType === "negative" && "text-error",
          changeType === "neutral" && "text-muted-foreground"
        )}>
          {changeType === "positive" && "+"}{change}
        </p>
      )}
    </CardContent>
  </Card>
))
StatsCard.displayName = "StatsCard"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  DashboardCard,
  StatsCard,
  cardVariants
}