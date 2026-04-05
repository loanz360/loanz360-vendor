/**
 * Employee Configuration Service
 * Provides dynamic configuration for employee types based on database role definitions
 */

import { fetchRoleDefinitionsByType, fetchRoleDefinitionByKey } from '@/lib/api/role-definitions-api'
import type { RoleDefinition } from '@/lib/constants/role-definitions'
import { getRoleDefinitionByKey as getHardcodedRoleDefinition, EMPLOYEE_SUB_ROLES } from '@/lib/constants/role-definitions'
import { clientLogger } from '@/lib/utils/client-logger'
import {
  LayoutDashboard,
  FileText,
  Users,
  Calculator,
  FolderOpen,
  User,
  Bell,
  HelpCircle,
  Target,
  TrendingUp,
  Briefcase,
  Phone,
  Calendar,
  ClipboardList,
  BarChart3,
  CalendarCheck,
  DollarSign,
  Receipt,
  FileCheck,
  Upload,
  Clock,
  Brain,
  MessageSquare,
  MessageCircle,
  ThumbsUp,
  Ticket,
  AlertCircle,
  Settings,
  Gift,
  Tag,
  HardDrive,
  Mail,
  Kanban,
  MapPin,
  BookOpen,
  Send,
  Link2,
  ListChecks,
  ShieldCheck,
  GraduationCap,
  Heart,
  Landmark,
  ScrollText,
  Network,
  UserPlus,
  RefreshCcw,
  Wallet,
  Activity,
  Award,
  type LucideIcon
} from 'lucide-react'

export interface MenuItem {
  icon: LucideIcon
  label: string
  href: string
  exact?: boolean
  badge?: string | number
  submenu?: MenuItem[]
}

export interface MenuSection {
  title: string
  items: MenuItem[]
}

export interface EmployeeConfig {
  key: string
  displayName: string
  shortCode: string
  route: string
  color: string
  menuItems: MenuItem[]
  menuSections?: MenuSection[]
  roleDefinition: RoleDefinition
}

/**
 * Payroll submenu - shared across all employee roles
 */
const PAYROLL_SUBMENU: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Overview', href: '/employees/employee/payroll', exact: true },
  { icon: DollarSign, label: 'My Salary', href: '/employees/employee/payroll/my-salary' },
  { icon: Receipt, label: 'My Payslips', href: '/employees/employee/payroll/payslips' },
  { icon: FileCheck, label: 'Tax Declaration', href: '/employees/employee/payroll/tax-declaration' },
  { icon: Upload, label: 'Investment Proofs', href: '/employees/employee/payroll/investment-proofs' },
]

// Note: Common bottom menu items (Attendance, Payroll, WorkDrive, etc.) are now
// included directly in each role's MENU_SECTION_CONFIGURATIONS below.
// This eliminates the need for a separate COMMON_BOTTOM_MENU constant.

// MENU_CONFIGURATIONS (simple flat menu) has been removed.
// MENU_SECTION_CONFIGURATIONS below is the SINGLE source of truth for all sidebar menus.
// The old MENU_CONFIGURATIONS was a flat array fallback that was never rendered
// (since all 27 roles have detailed sections defined). Maintaining two menu systems
// caused sync bugs where items were added to one but not the other.
/**
 * MENU_SECTION_CONFIGURATIONS - The SINGLE source of truth for all employee sidebar menus.
 * Each role's complete menu is defined here in organized sections with headers.
 * Common items (Payroll, Attendance, WorkDrive, etc.) are included in each role's sections.
 */
const MENU_SECTION_CONFIGURATIONS: Record<string, MenuSection[]> = {
  CRO: [
    {
      title: 'MY DAY',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
        { icon: Calendar, label: "Today's Agenda", href: '/employees/cro/agenda' },
      ],
    },
    {
      title: 'SALES PIPELINE',
      items: [
        { icon: BarChart3, label: 'Analytics', href: '/employees/cro/ai-crm/analytics' },
        { icon: Users, label: 'My Contacts', href: '/employees/cro/ai-crm/contacts' },
        { icon: ThumbsUp, label: 'Positive Contacts', href: '/employees/cro/ai-crm/positive-contacts' },
        { icon: Clock, label: 'Follow-ups & Reminders', href: '/employees/cro/followups-v2' },
        { icon: ListChecks, label: 'My Leads', href: '/employees/cro/ai-crm/leads' },
        { icon: Briefcase, label: 'My Deals', href: '/employees/cro/ai-crm/deals' },
        { icon: Send, label: 'Submit a Lead', href: '/employees/leads/submit' },
        { icon: Link2, label: 'Share a Link', href: '/employees/leads/share' },
      ],
    },
    {
      title: 'ENGAGEMENT',
      items: [
        { icon: MessageSquare, label: 'Communications', href: '/employees/cro/communications-v2' },
        { icon: Phone, label: 'Call Tracking', href: '/employees/cro/call-tracking-v2' },
        { icon: MessageCircle, label: 'Chat', href: '/employees/cro/chat' },
      ],
    },
    {
      title: 'PERFORMANCE & REWARDS',
      items: [
        { icon: BarChart3, label: 'My Performance', href: '/employees/cro/performance' },
        { icon: Gift, label: 'My Targets & Incentives', href: '/employees/incentives' },
        { icon: TrendingUp, label: 'Reports & Analytics', href: '/employees/cro/analytics' },
      ],
    },
    {
      title: 'TOOLS',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: FileCheck, label: 'Eligibility Checker', href: '/employees/cro/eligibility-checker' },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Tag, label: 'Offers to Customers', href: '/offers' },
        { icon: ListChecks, label: 'Bank Product Matrix', href: '/employees/cro/bank-products' },
      ],
    },
    {
      title: 'MY WORKSPACE',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
      ],
    },
  ],
  CRO_TEAM_LEADER: [
    {
      title: 'MY DAY',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
        { icon: TrendingUp, label: 'Team Overview', href: '/employees/cro/analytics' },
      ],
    },
    {
      title: 'TEAM MANAGEMENT',
      items: [
        { icon: Users, label: 'My CROs', href: '/employees/cro/ai-crm/contacts' },
        { icon: Kanban, label: 'Team Pipeline', href: '/employees/cro/ai-crm/leads' },
        { icon: Phone, label: 'Team Call Analytics', href: '/employees/cro/call-tracking-v2' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Target, label: 'Team Targets', href: '/employees/cro/ai-crm/analytics' },
        { icon: BarChart3, label: 'Team Performance', href: '/employees/cro/performance' },
        { icon: FileText, label: 'Team Reports', href: '/employees/cro/analytics' },
      ],
    },
    {
      title: 'TOOLS',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'MY WORKSPACE',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
      ],
    },
  ],
  CRO_STATE_MANAGER: [
    {
      title: 'MY DAY',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
        { icon: TrendingUp, label: 'State Overview', href: '/employees/cro/analytics' },
      ],
    },
    {
      title: 'STATE MANAGEMENT',
      items: [
        { icon: Users, label: 'Team Leaders', href: '/employees/cro/ai-crm/contacts' },
        { icon: Users, label: 'All CROs', href: '/employees/cro/ai-crm/contacts' },
        { icon: Kanban, label: 'State Pipeline', href: '/employees/cro/ai-crm/leads' },
        { icon: Phone, label: 'State Call Analytics', href: '/employees/cro/call-tracking-v2' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Target, label: 'State Targets', href: '/employees/cro/ai-crm/analytics' },
        { icon: BarChart3, label: 'State Performance', href: '/employees/cro/performance' },
        { icon: FileText, label: 'State Reports', href: '/employees/cro/analytics' },
      ],
    },
    {
      title: 'TOOLS',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'MY WORKSPACE',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
      ],
    },
  ],
  BUSINESS_DEVELOPMENT_EXECUTIVE: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'BUSINESS',
      items: [
        { icon: Kanban, label: 'Leads Management', href: '/employees/bde/leads-management' },
        { icon: TrendingUp, label: 'My Pipeline', href: '/employees/bde/leads' },
        { icon: Brain, label: 'Applications in Progress', href: '/employees/bde/ai-crm' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Gift, label: 'My Targets & Incentives', href: '/employees/incentives' },
        { icon: BarChart3, label: 'My Performance', href: '/employees/bde/performance' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: ClipboardList, label: 'Tasks', href: '/employees/tasks' },
        { icon: Clock, label: 'Reminders', href: '/employees/reminders' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
        { icon: Tag, label: 'Offers to Customers', href: '/offers' },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  BUSINESS_DEVELOPMENT_MANAGER: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'TEAM MANAGEMENT',
      items: [
        { icon: Users, label: 'Team Management', href: '/employees/bdm/team-management' },
        { icon: Target, label: 'Team Targets', href: '/employees/bdm/team-targets' },
        { icon: BarChart3, label: 'Team Performance', href: '/employees/bdm/team-performance' },
      ],
    },
    {
      title: 'BUSINESS',
      items: [
        { icon: Kanban, label: 'Leads Management', href: '/employees/bdm/leads' },
        { icon: TrendingUp, label: 'Team Pipeline', href: '/employees/bdm/team-pipeline/stages' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Gift, label: 'My Targets & Incentives', href: '/employees/incentives' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
        { icon: Tag, label: 'Offers to Customers', href: '/offers' },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  DIGITAL_SALES: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'LEADS MANAGEMENT',
      items: [
        { icon: Send, label: 'Submit a Lead', href: '/employees/leads/submit' },
        { icon: Link2, label: 'Share a Link', href: '/employees/leads/share' },
        { icon: ListChecks, label: 'Lead Status', href: '/employees/leads/status' },
      ],
    },
    {
      title: 'BUSINESS',
      items: [
        { icon: TrendingUp, label: 'My Pipeline', href: '/employees/digital-sales/leads' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Gift, label: 'My Targets & Incentives', href: '/employees/incentives' },
        { icon: BarChart3, label: 'My Performance', href: '/employees/performance' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: Calendar, label: 'My Schedule', href: '/employees/digital-sales/my-schedule' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
        { icon: Tag, label: 'Offers to Customers', href: '/offers' },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  CHANNEL_PARTNER_EXECUTIVE: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees/channel-partner-executive', exact: true },
      ],
    },
    {
      title: 'PARTNER MANAGEMENT',
      items: [
        { icon: Users, label: 'Partner Management', href: '/employees/channel-partner-executive/partner-management' },
        { icon: FileText, label: 'Applications', href: '/employees/applications' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Gift, label: 'My Targets & Incentives', href: '/employees/incentives' },
        { icon: BarChart3, label: 'My Performance', href: '/employees/channel-partner-executive/performance' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: Calendar, label: 'My Schedule', href: '/employees/schedule' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
        { icon: Tag, label: 'Offers to Customers', href: '/offers' },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  CHANNEL_PARTNER_MANAGER: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'TEAM MANAGEMENT',
      items: [
        { icon: TrendingUp, label: 'Team Performance', href: '/employees/channel-partner-manager/team-performance' },
        { icon: Calendar, label: 'Team Schedule', href: '/employees/schedule' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Gift, label: 'My Targets & Incentives', href: '/employees/incentives' },
        { icon: BarChart3, label: 'My Performance', href: '/employees/channel-partner-manager/performance' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
        { icon: Tag, label: 'Offers to Customers', href: '/offers' },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  FINANCE_EXECUTIVE: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'FINANCE',
      items: [
        { icon: DollarSign, label: 'CP Payouts', href: '/employees/finance-executive/cp-payouts' },
        { icon: Calculator, label: 'Financial Analysis', href: '/employees/analysis' },
        { icon: BarChart3, label: 'Reports', href: '/employees/reports' },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: Ticket, label: 'Finance Tickets', href: '/employees/finance-executive/tickets' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: Calendar, label: 'My Schedule', href: '/employees/schedule' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  FINANCE_MANAGER: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'TEAM MANAGEMENT',
      items: [
        { icon: Users, label: 'Team Management', href: '/employees/team' },
        { icon: BarChart3, label: 'Team Performance', href: '/employees/performance' },
        { icon: Target, label: 'Department Targets', href: '/employees/targets' },
        { icon: Calendar, label: 'Team Schedule', href: '/employees/schedule' },
      ],
    },
    {
      title: 'FINANCE',
      items: [
        { icon: DollarSign, label: 'Payout Oversight', href: '/employees/finance-manager/payout-oversight' },
        { icon: DollarSign, label: 'CP Payouts', href: '/employees/finance-executive/cp-payouts' },
        { icon: ScrollText, label: 'Financial Reports', href: '/employees/finance-manager/reports' },
        { icon: Calculator, label: 'Financial Analysis', href: '/employees/analysis' },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: Ticket, label: 'Finance Tickets', href: '/employees/finance-manager/tickets' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  ACCOUNTS_EXECUTIVE: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'APPROVALS',
      items: [
        { icon: FileText, label: 'BA App for Approval', href: '/employees/accounts-executive/ba-applications' },
        { icon: FileText, label: 'BP App for Approval', href: '/employees/accounts-executive/bp-applications' },
        { icon: FileText, label: 'CP App for Approval', href: '/employees/accounts-executive/cp-applications' },
        { icon: Award, label: 'Employee Incentives', href: '/employees/accounts-executive/incentive-approvals' },
      ],
    },
    {
      title: 'FINANCE',
      items: [
        { icon: BarChart3, label: 'Accounts Overview', href: '/employees/accounting' },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: Ticket, label: 'Support Tickets', href: '/employees/accounts-executive/tickets' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: ClipboardList, label: 'My Tasks', href: '/employees/tasks' },
        { icon: Calendar, label: 'My Schedule', href: '/employees/schedule' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  ACCOUNTS_MANAGER: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees/accounts-manager', exact: true },
      ],
    },
    {
      title: 'TEAM MANAGEMENT',
      items: [
        { icon: Users, label: 'Team Performance', href: '/employees/accounts-manager/team-performance' },
        { icon: Award, label: 'AE Scorecards', href: '/employees/accounts-manager/scorecards' },
        { icon: Target, label: 'Department Targets', href: '/employees/targets' },
        { icon: Calendar, label: 'Team Schedule', href: '/employees/schedule' },
        { icon: Calendar, label: 'Team Calendar', href: '/employees/accounts-manager/team-calendar' },
      ],
    },
    {
      title: 'APPROVALS',
      items: [
        { icon: FileText, label: 'BA App for Approval', href: '/employees/accounts-manager/ba-applications' },
        { icon: FileText, label: 'BP App for Approval', href: '/employees/accounts-manager/bp-applications' },
        { icon: FileText, label: 'CP App for Approval', href: '/employees/accounts-manager/cp-applications' },
        { icon: Award, label: 'Incentive Approvals', href: '/employees/accounts-manager/incentive-approvals' },
        { icon: ClipboardList, label: 'Approval Center', href: '/employees/accounts-manager/approval-center' },
      ],
    },
    {
      title: 'ANALYTICS & FINANCE',
      items: [
        { icon: BarChart3, label: 'Financial Analytics', href: '/employees/accounts-manager/financial-analytics' },
        { icon: Calculator, label: 'Accounts Overview', href: '/employees/accounting' },
        { icon: ShieldCheck, label: 'SLA Dashboard', href: '/employees/accounts-manager/sla-dashboard' },
        { icon: AlertCircle, label: 'Anomaly Detection', href: '/employees/accounts-manager/anomaly-detection' },
        { icon: Landmark, label: 'Bank Reconciliation', href: '/employees/accounts-manager/bank-reconciliation' },
        { icon: ScrollText, label: 'Compliance', href: '/employees/accounts-manager/compliance' },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: Ticket, label: 'All Accounts Tickets', href: '/employees/accounts-manager/tickets' },
        { icon: ShieldCheck, label: 'Audit Trail', href: '/employees/accounts-manager/audit-trail' },
      ],
    },
    {
      title: 'MONITORING',
      items: [
        { icon: Activity, label: 'Live Dashboard', href: '/employees/accounts-manager/live-dashboard' },
        { icon: FileText, label: 'Financial Reports', href: '/employees/reports' },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  DIRECT_SALES_EXECUTIVE: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees/direct-sales-executive', exact: true },
      ],
    },
    {
      title: 'LEADS MANAGEMENT',
      items: [
        { icon: Send, label: 'Submit a Lead', href: '/employees/direct-sales-executive/leads/new' },
        { icon: Link2, label: 'Apply for Customer', href: '/employees/direct-sales-executive/apply-for-customer' },
        { icon: ListChecks, label: 'Lead Status', href: '/employees/direct-sales-executive/leads/my-leads' },
      ],
    },
    {
      title: 'BUSINESS',
      items: [
        { icon: TrendingUp, label: 'My Pipeline', href: '/employees/direct-sales-executive/leads' },
        { icon: Briefcase, label: 'Customer Database', href: '/employees/direct-sales-executive/customer-database' },
        { icon: FileText, label: 'My Proposals', href: '/employees/direct-sales-executive/my-proposals' },
      ],
    },
    {
      title: 'PARTNER NETWORK',
      items: [
        { icon: Network, label: 'Network Overview', href: '/employees/direct-sales-executive/partner-network' },
        { icon: UserPlus, label: 'Recruit Partners', href: '/employees/direct-sales-executive/partner-recruitment' },
        { icon: Users, label: 'My Partners', href: '/employees/direct-sales-executive/my-partners' },
        { icon: ClipboardList, label: 'Partner Leads', href: '/employees/direct-sales-executive/partner-leads' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Gift, label: 'My Targets & Incentives', href: '/employees/incentives' },
        { icon: BarChart3, label: 'My Performance', href: '/employees/direct-sales-executive/performance' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: Calendar, label: 'My Schedule', href: '/employees/direct-sales-executive/schedule' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: GraduationCap, label: 'Sales Playbook', href: '/employees/sales-playbook', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
        { icon: Tag, label: 'Offers to Customers', href: '/employees/direct-sales-executive/customer-database', exact: true },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: DollarSign, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  DIRECT_SALES_MANAGER: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'TEAM MANAGEMENT',
      items: [
        { icon: Users, label: 'Team Management', href: '/employees/direct-sales-manager/team-management' },
        { icon: TrendingUp, label: 'Team Pipeline', href: '/employees/direct-sales-manager/team-pipeline' },
        { icon: FileText, label: 'Team Proposals', href: '/employees/direct-sales-manager/team-proposals' },
        { icon: Calendar, label: 'Team Schedules', href: '/employees/direct-sales-manager/team-schedules' },
      ],
    },
    {
      title: 'PARTNER NETWORK',
      items: [
        { icon: Network, label: 'Team Partners', href: '/employees/direct-sales-manager/team-partners' },
        { icon: ClipboardList, label: 'Team Partner Leads', href: '/employees/direct-sales-manager/team-partner-leads' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Gift, label: 'My Targets & Incentives', href: '/employees/incentives' },
        { icon: BarChart3, label: 'My Performance', href: '/employees/direct-sales-manager/performance' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: BookOpen, label: 'Sales Playbook', href: '/employees/sales-playbook', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
        { icon: Tag, label: 'Offers to Customers', href: '/offers' },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  TELE_SALES: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'LEADS MANAGEMENT',
      items: [
        { icon: Send, label: 'Submit a Lead', href: '/employees/leads/submit' },
        { icon: Link2, label: 'Share a Link', href: '/employees/leads/share' },
        { icon: ListChecks, label: 'Lead Status', href: '/employees/leads/status' },
      ],
    },
    {
      title: 'BUSINESS',
      items: [
        { icon: TrendingUp, label: 'My Pipeline', href: '/employees/tele-sales/leads' },
        { icon: Phone, label: 'Call Center', href: '/employees/tele-sales/calls' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Gift, label: 'My Targets & Incentives', href: '/employees/incentives' },
        { icon: BarChart3, label: 'My Performance', href: '/employees/tele-sales/performance' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: Calendar, label: 'My Schedule', href: '/employees/tele-sales/my-schedule' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
        { icon: Tag, label: 'Offers to Customers', href: '/offers' },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  FIELD_SALES: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'BUSINESS',
      items: [
        { icon: Kanban, label: 'Leads Management', href: '/employees/field-sales/leads-management' },
        { icon: TrendingUp, label: 'My Pipeline', href: '/employees/field-sales/leads' },
        { icon: MapPin, label: 'Visit Tracker', href: '/employees/field-sales/visit-tracker' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Gift, label: 'My Targets & Incentives', href: '/employees/incentives' },
        { icon: BarChart3, label: 'My Performance', href: '/employees/field-sales/performance' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: Calendar, label: 'My Schedule', href: '/employees/field-sales/my-schedule' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
        { icon: Tag, label: 'Offers to Customers', href: '/offers' },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  FIELD_SALES_MANAGER: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'TEAM MANAGEMENT',
      items: [
        { icon: Users, label: 'Team Management', href: '/employees/field-sales-manager/team-management' },
        { icon: MapPin, label: 'Team Visit Tracker', href: '/employees/field-sales-manager/team-visits' },
        { icon: BarChart3, label: 'Team Performance', href: '/employees/field-sales-manager/team-performance' },
        { icon: Calendar, label: 'Team Schedules', href: '/employees/field-sales-manager/team-schedules' },
      ],
    },
    {
      title: 'BUSINESS',
      items: [
        { icon: Kanban, label: 'Leads Management', href: '/employees/field-sales-manager/leads' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Gift, label: 'My Targets & Incentives', href: '/employees/incentives' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
        { icon: Tag, label: 'Offers to Customers', href: '/offers' },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  PARTNER_SUPPORT_EXECUTIVE: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: Ticket, label: 'Partner Tickets', href: '/employees/partner-support-executive/tickets' },
        { icon: AlertCircle, label: 'Urgent Tickets', href: '/employees/partner-support-executive/tickets?filter=urgent' },
        { icon: MessageSquare, label: 'Canned Responses', href: '/employees/partner-support-executive/canned-responses' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: BarChart3, label: 'My Performance', href: '/employees/performance' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: ClipboardList, label: 'My Tasks', href: '/employees/tasks' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  PARTNER_SUPPORT_MANAGER: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'TEAM MANAGEMENT',
      items: [
        { icon: Users, label: 'Team Management', href: '/employees/team' },
        { icon: BarChart3, label: 'Team Performance', href: '/employees/performance' },
        { icon: Target, label: 'Team Targets', href: '/employees/targets' },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: Ticket, label: 'All Partner Tickets', href: '/employees/partner-support-manager/tickets' },
        { icon: FileText, label: 'Reports', href: '/employees/reports' },
        { icon: Settings, label: 'Ticket Settings', href: '/employees/partner-support-manager/settings' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  CUSTOMER_SUPPORT_EXECUTIVE: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: Ticket, label: 'Customer Tickets', href: '/employees/customer-support-executive/tickets' },
        { icon: AlertCircle, label: 'Urgent Tickets', href: '/employees/customer-support-executive/tickets?filter=urgent' },
        { icon: MessageSquare, label: 'Canned Responses', href: '/employees/customer-support-executive/canned-responses' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: BarChart3, label: 'My Performance', href: '/employees/performance' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: ClipboardList, label: 'My Tasks', href: '/employees/tasks' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  CUSTOMER_SUPPORT_MANAGER: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'TEAM MANAGEMENT',
      items: [
        { icon: Users, label: 'Team Management', href: '/employees/team' },
        { icon: BarChart3, label: 'Team Performance', href: '/employees/performance' },
        { icon: Target, label: 'Team Targets', href: '/employees/targets' },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: Ticket, label: 'All Customer Tickets', href: '/employees/customer-support-manager/tickets' },
        { icon: FileText, label: 'Reports', href: '/employees/reports' },
        { icon: Settings, label: 'Ticket Settings', href: '/employees/customer-support-manager/settings' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  PAYOUT_SPECIALIST: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'FINANCE',
      items: [
        { icon: DollarSign, label: 'Payout Management', href: '/employees/payout-specialist/payouts' },
        { icon: Receipt, label: 'Commission Queries', href: '/employees/payout-specialist/commissions' },
        { icon: FileCheck, label: 'Payout Approvals', href: '/employees/payout-specialist/approvals' },
        { icon: FolderOpen, label: 'Documents', href: '/employees/documents' },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: Ticket, label: 'Support Tickets', href: '/employees/payout-specialist/tickets' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: BarChart3, label: 'My Performance', href: '/employees/performance' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: ClipboardList, label: 'My Tasks', href: '/employees/tasks' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  TECHNICAL_SUPPORT_EXECUTIVE: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: Ticket, label: 'Technical Tickets', href: '/employees/technical-support-executive/tickets' },
        { icon: AlertCircle, label: 'Urgent Issues', href: '/employees/technical-support-executive/tickets?filter=urgent' },
        { icon: MessageSquare, label: 'Canned Responses', href: '/employees/technical-support-executive/canned-responses' },
        { icon: FileText, label: 'Bug Reports', href: '/employees/technical-support-executive/bugs' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: BarChart3, label: 'My Performance', href: '/employees/performance' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: ClipboardList, label: 'My Tasks', href: '/employees/tasks' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  TECHNICAL_SUPPORT_MANAGER: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'TEAM MANAGEMENT',
      items: [
        { icon: Users, label: 'Team Management', href: '/employees/team' },
        { icon: BarChart3, label: 'Team Performance', href: '/employees/performance' },
        { icon: Target, label: 'Team Targets', href: '/employees/targets' },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: Ticket, label: 'All Technical Tickets', href: '/employees/technical-support-manager/tickets' },
        { icon: FileText, label: 'Bug Tracking', href: '/employees/technical-support-manager/bugs' },
        { icon: FileText, label: 'Reports', href: '/employees/reports' },
        { icon: Settings, label: 'Support Settings', href: '/employees/technical-support-manager/settings' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  COMPLIANCE_OFFICER: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'COMPLIANCE',
      items: [
        { icon: FileCheck, label: 'Compliance Reviews', href: '/employees/compliance-officer/reviews' },
        { icon: AlertCircle, label: 'Compliance Alerts', href: '/employees/compliance-officer/alerts' },
        { icon: FileText, label: 'Regulatory Reports', href: '/employees/compliance-officer/reports' },
        { icon: FolderOpen, label: 'Policy Documents', href: '/employees/compliance-officer/policies' },
        { icon: BarChart3, label: 'Audit Analytics', href: '/employees/compliance-officer/analytics' },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: Ticket, label: 'Compliance Tickets', href: '/employees/compliance-officer/tickets' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: ClipboardList, label: 'My Tasks', href: '/employees/tasks' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  PARTNERSHIP_MANAGER: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'PARTNERSHIPS',
      items: [
        { icon: Users, label: 'Partner Relationships', href: '/employees/partnership-manager/partners' },
        { icon: Briefcase, label: 'Partnership Deals', href: '/employees/partnership-manager/deals' },
        { icon: FileText, label: 'Contracts & Agreements', href: '/employees/partnership-manager/contracts' },
        { icon: BarChart3, label: 'Partnership Analytics', href: '/employees/partnership-manager/analytics' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Gift, label: 'My Targets & Incentives', href: '/employees/incentives' },
        { icon: Target, label: 'Partnership Targets', href: '/employees/targets' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: Calendar, label: 'Meetings & Events', href: '/employees/partnership-manager/meetings' },
        { icon: ClipboardList, label: 'My Tasks', href: '/employees/tasks' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
        { icon: Tag, label: 'Offers to Customers', href: '/offers' },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  TRAINING_DEVELOPMENT_EXECUTIVE: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
      ],
    },
    {
      title: 'TRAINING',
      items: [
        { icon: Users, label: 'Training Sessions', href: '/employees/training-development-executive/sessions' },
        { icon: FileText, label: 'Training Materials', href: '/employees/training-development-executive/materials' },
        { icon: Calendar, label: 'Training Schedule', href: '/employees/training-development-executive/schedule' },
        { icon: BarChart3, label: 'Training Analytics', href: '/employees/training-development-executive/analytics' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Target, label: 'My Targets', href: '/employees/targets' },
      ],
    },
    {
      title: 'TASKS & SCHEDULE',
      items: [
        { icon: ClipboardList, label: 'My Tasks', href: '/employees/tasks' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/employees/notifications' },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
  HR: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/employees/hr/dashboard', exact: true },
      ],
    },
    {
      title: 'EMPLOYEE MANAGEMENT',
      items: [
        { icon: Users, label: 'Employee Management', href: '/employees/hr/employees', exact: true },
        { icon: Users, label: 'Onboarding', href: '/employees/hr/onboarding-management', exact: true },
        { icon: FileCheck, label: 'Profile Reviews', href: '/employees/hr/profile-reviews', exact: true },
        { icon: FileText, label: 'Resignations', href: '/employees/hr/resignations', exact: true },
        { icon: DollarSign, label: 'Final Settlement', href: '/employees/hr/final-settlement', exact: true },
        { icon: AlertCircle, label: 'PIP Management', href: '/employees/hr/pip', exact: true },
      ],
    },
    {
      title: 'ATTENDANCE & PAYROLL',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves (Admin)', href: '/employees/hr/employee-attendance', exact: true },
        { icon: Calendar, label: 'Holidays Management', href: '/employees/hr/holidays', exact: true },
        { icon: Calculator, label: 'Payroll Management', href: '/employees/hr/payroll' },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        { icon: Target, label: 'Target Assignment', href: '/employees/hr/incentives/assign-targets', exact: true },
        { icon: Gift, label: 'Incentives Management', href: '/employees/hr/incentives', exact: true },
        { icon: ClipboardList, label: 'Performance Reviews', href: '/employees/hr/reviews', exact: true },
        { icon: RefreshCcw, label: '360° Feedback', href: '/employees/hr/feedback-360', exact: true },
        { icon: BarChart3, label: 'HR Analytics', href: '/employees/hr/analytics', exact: true },
        { icon: TrendingUp, label: 'CRO Statistics', href: '/employees/hr/cro-statistics', exact: true },
      ],
    },
    {
      title: 'COMPLIANCE & STATUTORY',
      items: [
        { icon: Landmark, label: 'Statutory Compliance', href: '/employees/hr/compliance', exact: true },
        { icon: CalendarCheck, label: 'Leave Balance', href: '/employees/hr/leave-balance', exact: true },
        { icon: ScrollText, label: 'Audit Logs', href: '/employees/hr/audit-logs', exact: true },
      ],
    },
    {
      title: 'PEOPLE OPS',
      items: [
        { icon: Network, label: 'Org Chart', href: '/employees/hr/org-chart', exact: true },
        { icon: ShieldCheck, label: 'Background Verification', href: '/employees/hr/bgv', exact: true },
        { icon: UserPlus, label: 'Recruitment', href: '/employees/hr/recruitment', exact: true },
      ],
    },
    {
      title: 'LEARNING & BENEFITS',
      items: [
        { icon: GraduationCap, label: 'Learning & Development', href: '/employees/hr/learning', exact: true },
        { icon: Heart, label: 'Benefits Admin', href: '/employees/hr/benefits', exact: true },
      ],
    },
    {
      title: 'HR TOOLS',
      items: [
        { icon: FileText, label: 'Letter Generator', href: '/employees/hr/letters', exact: true },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: MessageSquare, label: 'Support Tickets', href: '/employees/hr/support-tickets' },
        { icon: MessageCircle, label: 'Canned Responses', href: '/employees/hr/canned-responses', exact: true },
      ],
    },
    {
      title: 'DOCUMENTS',
      items: [
        { icon: FolderOpen, label: 'Documents', href: '/employees/hr/documents', exact: true },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/employees/emi-calculator', exact: true },
        { icon: Activity, label: 'Affordability Analyzer', href: '/employees/affordability-analyzer', exact: true },
        { icon: BookOpen, label: 'Knowledge Base', href: '/employees/knowledge-base', exact: true },
        { icon: Landmark, label: 'Bank Comparison', href: '/employees/bank-comparison', exact: true },
        { icon: Wallet, label: 'Commission Simulator', href: '/employees/commission-simulator', exact: true },
        { icon: FileCheck, label: 'Document Checklist', href: '/employees/document-checklist', exact: true },
      ],
    },
    {
      title: 'WORK MANAGEMENT',
      items: [
        { icon: CalendarCheck, label: 'Attendance & Leaves', href: '/employees/attendance', exact: true },
        { icon: Calculator, label: 'My Payroll', href: '/employees/employee/payroll', exact: true },
        { icon: HardDrive, label: 'WorkDrive', href: '/employees/workdrive', exact: true },
        { icon: Mail, label: 'Company Email', href: '/employees/email', exact: true },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'HR Alerts & Approvals', href: '/employees/hr/notification-center', exact: true },
        { icon: Bell, label: 'My Notifications', href: '/employees/notifications', exact: true },
        { icon: User, label: 'My Profile', href: '/employees/profile', exact: true },
      ],
    },
  ],
}

// Add lowercase alias for HR
MENU_SECTION_CONFIGURATIONS['hr'] = MENU_SECTION_CONFIGURATIONS['HR']

/**
 * Get menu sections for a role from static configuration
 */
function getMenuSections(roleKey: string): MenuSection[] | undefined {
  return MENU_SECTION_CONFIGURATIONS[roleKey]
}

/**
 * Helper function to normalize role key for menu lookup
 */
function normalizeRoleKey(roleKey: string): string {
  return roleKey.toUpperCase().trim()
}

/**
 * Generate route prefix from role key
 */
function getRoutePrefix(roleKey: string): string {
  // For employees, all use the same base /employees route
  // Differentiation happens through components and menu items
  return roleKey.toLowerCase().replace(/_/g, '-')
}

/**
 * Get flat menu items for a role by flattening MENU_SECTION_CONFIGURATIONS.
 * This derives menuItems from the sectioned menu (single source of truth).
 * Used for backward compatibility where flat menu arrays are needed.
 */
function getMenuItems(roleKey: string): MenuItem[] {
  const sections = MENU_SECTION_CONFIGURATIONS[roleKey]
  if (sections) {
    return sections.flatMap(section => section.items)
  }
  // Fallback for completely unknown roles
  return [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/employees', exact: true },
  ]
}

/**
 * Get configuration for a specific employee type
 */
export async function getEmployeeConfig(roleKey: string): Promise<EmployeeConfig | null> {
  // Normalize role key for consistent lookup
  const normalizedKey = normalizeRoleKey(roleKey)
  clientLogger.debug('Fetching config for employee role', { roleKey, normalizedKey })

  // Special handling for HR role (doesn't exist in role_definitions table)
  if (normalizedKey === 'HR') {
    const menuSections = getMenuSections('HR')

    if (!menuSections) {
      clientLogger.warn('HR menu section configuration not found')
      return null
    }

    const menuItems = getMenuItems('HR')

    return {
      key: 'HR',
      displayName: 'Human Resources',
      shortCode: 'hr',
      route: '/employees',
      color: '#FF6700',
      menuItems,
      menuSections,
      roleDefinition: {
        id: 'hr-role',
        key: 'HR',
        name: 'Human Resources',
        type: 'ADMIN',
        isActive: true,
        permissions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }
  }

  // First, check hardcoded constants for instant response (no network call)
  let roleDefinition: RoleDefinition | null = null
  const hardcodedRole = getHardcodedRoleDefinition(roleKey)

  if (hardcodedRole && hardcodedRole.isActive) {
    // Use hardcoded role directly - this is instant and avoids slow API calls
    roleDefinition = hardcodedRole
    clientLogger.debug('Using role definition from hardcoded constants', { roleKey })
  } else {
    // Fall back to database only if not found in hardcoded constants
    roleDefinition = await fetchRoleDefinitionByKey(roleKey)
    clientLogger.debug('Role definition fetched from database', { roleDefinition })
  }

  if (!roleDefinition || !roleDefinition.isActive) {
    clientLogger.warn('Employee role not found or inactive', { roleKey })
    return null
  }

  const shortCode = getRoutePrefix(roleDefinition.key)
  const menuSections = getMenuSections(roleDefinition.key)
  const menuItems = getMenuItems(roleDefinition.key)

  clientLogger.debug('Generated employee config', { shortCode, menuItemsCount: menuItems.length, hasSections: !!menuSections })

  return {
    key: roleDefinition.key,
    displayName: roleDefinition.name,
    shortCode,
    route: '/employees',
    color: '#FF6700', // Default orange color
    menuItems,
    menuSections,
    roleDefinition
  }
}

/**
 * Get all active employee configurations
 */
export async function getAllEmployeeConfigs(): Promise<EmployeeConfig[]> {
  const roleDefinitions = await fetchRoleDefinitionsByType('EMPLOYEE')

  const configs = await Promise.all(
    roleDefinitions
      .filter(role => role.isActive)
      .map(role => getEmployeeConfig(role.key))
  )

  return configs.filter((config): config is EmployeeConfig => config !== null)
}

/**
 * Get employee config by short code
 */
export async function getEmployeeConfigByShortCode(shortCode: string): Promise<EmployeeConfig | null> {
  const allConfigs = await getAllEmployeeConfigs()
  return allConfigs.find(config => config.shortCode === shortCode) || null
}

// registerEmployeeMenuConfiguration() removed - no longer needed.
// All menu configurations are defined in MENU_SECTION_CONFIGURATIONS.
