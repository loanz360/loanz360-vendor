// LOANZ 360 UI Component Library
// Export all UI components for easy importing

// Core UI Components
export { Button, buttonVariants } from './button'
export type { ButtonProps } from './button'

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
} from './card'
export type { CardProps } from './card'

export {
  Input,
  CurrencyInput,
  SearchInput,
  PasswordInput,
  OTPInput,
  PhoneInput,
  inputVariants
} from './input'
export type { InputProps } from './input'

export {
  Avatar,
  UserAvatar,
  ProfileAvatar,
  AvatarGroup,
  CompanyAvatar,
  avatarVariants
} from './avatar'
export type { AvatarProps } from './avatar'

export {
  Badge,
  StatusBadge,
  KYCBadge,
  PartnerTypeBadge,
  PriorityBadge,
  RoleBadge,
  badgeVariants
} from './badge'
export type { BadgeProps } from './badge'

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
} from './logo'
export type { LogoProps } from './logo'

// Re-export common types and utilities
export type { VariantProps } from 'class-variance-authority'