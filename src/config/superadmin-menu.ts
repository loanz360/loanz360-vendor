import {
  LayoutDashboard,
  Users,
  Handshake,
  UserCheck,
  CreditCard,
  Image,
  Trophy,
  Tag,
  Store,
  User,
  Shield,
  Building2,
  Zap,
  Bell,
  ClipboardList,
  Ticket,
  MessageSquare,
  Phone,
  Bot,
  FileCheck,
  HardDrive,
  Mail,
  UserCog,
  Briefcase,
  FileX,
  DollarSign,
  TrendingDown,
  Calendar,
  Clock,
  Wallet,
  FileText,
  Target,
  Award,
  BarChart3,
  Settings,
  Layout,
  LayoutGrid,
  Layers,
  Database,
  Upload,
  LineChart,
  MessageCircle,
  FileSearch,
  Scale,
  AlertTriangle,
  CheckSquare,
  Copy,
  Server,
  FileCode,
  Cog,
  Code,
  Activity,
  History,
  TestTube,
  Send,
  ScrollText,
  ShieldAlert,
  XCircle,
  MailPlus,
  Building,
  Signature,
  Logs,
  ChartBar,
  Filter,
  Timer,
  Workflow,
  FlaskConical,
  Video,
  Sparkles,
  Trash2,
  MapPin,
  Globe,
  SearchCheck,
  CloudDownload,
  Kanban,
  Landmark,
  Percent,
  Banknote,
  GitBranch,
  UsersRound,
  ClipboardCheck,
  FileKey,
  TrendingUp,
  RefreshCw,
  ToggleLeft,
  ListChecks,
  Radio,
  Brain,
  Package,
  type LucideIcon,
} from 'lucide-react'

export interface SubMenuItem {
  label: string
  href: string
  icon: LucideIcon
  description: string
  badge?: number | string
  badgeVariant?: 'default' | 'warning' | 'success' | 'error'
}

export interface MenuItem {
  icon: LucideIcon
  label: string
  href: string
  exact?: boolean
  description?: string
  subItems?: SubMenuItem[]
  badgeCount?: number
  dynamicBadge?: boolean
}

export interface MenuSection {
  title: string
  items: MenuItem[]
}

export const menuSections: MenuSection[] = [
  // MAIN
  {
    title: 'MAIN',
    items: [
      {
        icon: LayoutDashboard,
        label: 'Dashboard',
        href: '/superadmin',
        exact: true,
        description: 'Overview of system metrics and KPIs',
      },
    ],
  },
  // BUSINESS OPERATIONS
  {
    title: 'BUSINESS OPERATIONS',
    items: [
      {
        icon: ClipboardList,
        label: 'Leads Management',
        href: '/superadmin/leads-management',
        description: 'Unified CRM - Consolidated lead management',
        subItems: [
          {
            label: 'Unified CRM Leads',
            href: '/superadmin/unified-crm',
            icon: Kanban,
            description: 'All leads from Partner Portal & BDE Pipeline',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Communication Hub',
            href: '/superadmin/leads-management/communication',
            icon: MessageCircle,
            description: 'Centralized communication with leads',
          },
          {
            label: 'Communication Templates',
            href: '/superadmin/leads-management/communication/templates',
            icon: FileText,
            description: 'Manage email and SMS templates',
          },
          {
            label: 'Compliance Dashboard',
            href: '/superadmin/leads-management/compliance',
            icon: ShieldAlert,
            description: 'Monitor compliance metrics and alerts',
          },
          {
            label: 'Audit Trail',
            href: '/superadmin/leads-management/compliance/audit',
            icon: FileSearch,
            description: 'Track all system activities and changes',
          },
          {
            label: 'Dispute Resolution',
            href: '/superadmin/leads-management/compliance/disputes',
            icon: Scale,
            description: 'Handle and resolve customer disputes',
          },
          {
            label: 'Quality Assurance',
            href: '/superadmin/leads-management/compliance/quality',
            icon: CheckSquare,
            description: 'Monitor and maintain quality standards',
          },
          {
            label: 'Auto-Assignment Rules',
            href: '/superadmin/leads-management/assignment-rules',
            icon: Zap,
            description: 'Configure automatic lead assignment rules',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Assignment Dashboard',
            href: '/superadmin/assignment-management',
            icon: Users,
            description: 'Monitor CRO workload and assignment metrics',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Duplicate Detection',
            href: '/superadmin/leads-management/data/duplicates',
            icon: Copy,
            description: 'Find and merge duplicate leads',
          },
          {
            label: 'Analytics',
            href: '/superadmin/ai-crm/analytics',
            icon: LineChart,
            description: 'View detailed lead analytics and insights',
          },
          {
            label: 'Conversion Analytics',
            href: '/superadmin/leads-management/analytics',
            icon: BarChart3,
            description: 'Funnel, source, product & team conversion insights',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Cohort Analysis',
            href: '/superadmin/leads-management/cohort-analysis',
            icon: GitBranch,
            description: 'Monthly cohort retention heatmap and conversion trends',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Revenue Forecast',
            href: '/superadmin/leads-management/revenue-forecast',
            icon: TrendingUp,
            description: 'Predictive revenue modeling with scenario analysis',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Lead Timeline',
            href: '/superadmin/leads-management/timeline',
            icon: History,
            description: 'Full activity timeline and communication history per lead',
            badge: 'New',
            badgeVariant: 'success',
          },
        ],
      },
      {
        icon: Landmark,
        label: 'ULAP',
        href: '/superadmin/ulap',
        description: 'Unified Loan Application Platform - Manage loan types, banks and rates',
        subItems: [
          {
            label: 'Dashboard',
            href: '/superadmin/ulap',
            icon: Layout,
            description: 'ULAP overview and statistics',
          },
          {
            label: 'Form Builder',
            href: '/superadmin/ulap/form-builder',
            icon: Layers,
            description: 'Design complete loan application forms with categories, profiles & fields',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Loan Categories',
            href: '/superadmin/ulap/loan-categories',
            icon: Briefcase,
            description: 'Manage loan categories and subcategories',
          },
          {
            label: 'Loan Details',
            href: '/superadmin/ulap/loan-details',
            icon: FileText,
            description: 'Edit eligibility, documents, and features',
          },
          {
            label: 'Profile Fields',
            href: '/superadmin/ulap/profile-fields',
            icon: FileCode,
            description: 'Configure dynamic form fields for applications',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Banks & NBFCs',
            href: '/superadmin/ulap/banks',
            icon: Building,
            description: 'Manage banks, NBFCs and their logos',
          },
          {
            label: 'Interest Rates',
            href: '/superadmin/ulap/interest-rates',
            icon: Percent,
            description: 'Update interest rates and processing fees',
          },
          {
            label: 'Rate History',
            href: '/superadmin/ulap/rate-history',
            icon: History,
            description: 'View interest rate change history',
          },
          {
            label: 'Module Configuration',
            href: '/superadmin/ulap/module-config',
            icon: Cog,
            description: 'Configure ULAP module per role',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Share Link Settings',
            href: '/superadmin/ulap/share-link-settings',
            icon: Send,
            description: 'Manage share link settings and analytics',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Lead Attribution',
            href: '/superadmin/ulap/lead-attribution',
            icon: ChartBar,
            description: 'Track lead sources and conversion analytics',
            badge: 'New',
            badgeVariant: 'success',
          },
        ],
      },
      {
        icon: FileCheck,
        label: 'Credit Appraisal Engine',
        href: '/superadmin/cae-dashboard',
        description: 'Credit assessment and appraisal system',
        subItems: [
          {
            label: 'CAE Overview',
            href: '/superadmin/cae-dashboard',
            icon: Layout,
            description: 'Overview of credit appraisal metrics',
          },
          {
            label: 'Appraisals',
            href: '/superadmin/cae-dashboard/appraisals',
            icon: FileCheck,
            description: 'View and manage all credit appraisals',
          },
          {
            label: 'CAM Preview',
            href: '/superadmin/cae-dashboard/cam-preview',
            icon: FileText,
            description: 'Preview Credit Appraisal Memos',
          },
          {
            label: 'Loan Types',
            href: '/superadmin/cae-dashboard/loan-types',
            icon: Briefcase,
            description: 'Configure loan type parameters',
          },
          {
            label: 'Document Config',
            href: '/superadmin/cae-dashboard/document-config',
            icon: FileCode,
            description: 'Set up required document types',
          },
          {
            label: 'Provider Config',
            href: '/superadmin/cae-dashboard/providers',
            icon: Building,
            description: 'Manage credit bureau providers',
          },
          {
            label: 'Third Party APIs',
            href: '/superadmin/cae-dashboard/third-party-apis',
            icon: Code,
            description: 'Configure external API integrations',
          },
          {
            label: 'Business Rules',
            href: '/superadmin/cae-dashboard/rules',
            icon: Cog,
            description: 'Define credit assessment rules',
          },
          {
            label: 'Validation Rules',
            href: '/superadmin/cae-dashboard/validation-rules',
            icon: CheckSquare,
            description: 'Set up data validation rules',
          },
          {
            label: 'API Logs',
            href: '/superadmin/cae-dashboard/logs',
            icon: Activity,
            description: 'Monitor API calls and responses',
          },
          {
            label: 'Analytics',
            href: '/superadmin/cae-dashboard/analytics',
            icon: BarChart3,
            description: 'View CAE performance analytics',
          },
          {
            label: 'Scoring Models',
            href: '/superadmin/cae-dashboard/scoring-models',
            icon: Brain,
            description: 'Configure credit scoring models and weights',
            badge: 'New',
            badgeVariant: 'success',
          },
        ],
      },
      {
        icon: Radio,
        label: 'ULI Hub',
        href: '/superadmin/uli-hub',
        description: 'Unified Lending Interface (RBI) - 136+ API data services',
        badge: 'New',
        badgeVariant: 'success',
        subItems: [
          {
            label: 'Dashboard',
            href: '/superadmin/uli-hub',
            icon: Layout,
            description: 'ULI overview - service health, API usage, cost tracking',
          },
          {
            label: 'Identity & KYC',
            href: '/superadmin/uli-hub/identity-kyc',
            icon: UserCheck,
            description: 'PAN, Aadhaar, Face Match, DigiLocker, Voter ID, Passport, DL',
          },
          {
            label: 'Account Aggregator',
            href: '/superadmin/uli-hub/account-aggregator',
            icon: Database,
            description: 'Consent-based financial data from banks (FIP/FIU model)',
          },
          {
            label: 'Credit Bureau',
            href: '/superadmin/uli-hub/credit-bureau',
            icon: FileSearch,
            description: 'CIBIL, Experian, CRIF, Equifax score and report pull',
          },
          {
            label: 'GST & Compliance',
            href: '/superadmin/uli-hub/gst-compliance',
            icon: ScrollText,
            description: 'GSTN Verification, GST Returns, E-Invoice, E-Way Bill',
          },
          {
            label: 'Bank & Financial',
            href: '/superadmin/uli-hub/bank-financial',
            icon: Landmark,
            description: 'Bank Statement Analysis, NACH/eMandate, UPI Verification',
          },
          {
            label: 'Property & Land',
            href: '/superadmin/uli-hub/property-land',
            icon: MapPin,
            description: 'Land Records, Property Search, Encumbrance Check, CERSAI',
          },
          {
            label: 'eSign & eStamp',
            href: '/superadmin/uli-hub/esign-estamp',
            icon: Signature,
            description: 'Aadhaar eSign, eStamp, Digital Agreements via ULI',
          },
          {
            label: 'Business Verification',
            href: '/superadmin/uli-hub/business-verification',
            icon: Building,
            description: 'MCA/ROC Check, MSME Registration, Shop & Establishment',
          },
          {
            label: 'Employment & Income',
            href: '/superadmin/uli-hub/employment-income',
            icon: Briefcase,
            description: 'ITR Pull, Form 26AS, Employment Verification, EPFO',
          },
          {
            label: 'Geospatial (ISRO)',
            href: '/superadmin/uli-hub/geospatial',
            icon: Globe,
            description: 'Satellite imagery, crop assessment, property assessment',
          },
          {
            label: 'Environment Config',
            href: '/superadmin/uli-hub/environment',
            icon: Server,
            description: 'Sandbox vs Production toggle, JWT auth, base URL settings',
            badge: 'New',
            badgeVariant: 'warning',
          },
          {
            label: 'API Logs',
            href: '/superadmin/uli-hub/logs',
            icon: Activity,
            description: 'Monitor all ULI API calls, response times, errors',
          },
          {
            label: 'Cost & Usage Analytics',
            href: '/superadmin/uli-hub/analytics',
            icon: BarChart3,
            description: 'API call costs, usage trends, budget tracking',
          },
          {
            label: 'Sandbox Tester',
            href: '/superadmin/uli-hub/sandbox',
            icon: TestTube,
            description: 'Test ULI API endpoints in sandbox mode',
            badge: 'New',
            badgeVariant: 'success',
          },
        ],
      },
      {
        icon: Package,
        label: 'Bank Product Management',
        href: '/superadmin/bank-product-management',
        description: 'Manage bank/NBFC loan products - add, edit, delete by bank, loan type & location',
        badge: 'New',
        badgeVariant: 'success',
        subItems: [
          {
            label: 'All Products',
            href: '/superadmin/bank-product-management',
            icon: Layout,
            description: 'View and manage all bank loan products',
          },
          {
            label: 'By Bank / NBFC',
            href: '/superadmin/bank-product-management/by-bank',
            icon: Building,
            description: 'Manage products grouped by bank or NBFC',
          },
          {
            label: 'By Loan Type',
            href: '/superadmin/bank-product-management/by-loan-type',
            icon: Briefcase,
            description: 'Manage products grouped by loan category',
          },
          {
            label: 'Add New Product',
            href: '/superadmin/bank-product-management/add',
            icon: FileText,
            description: 'Add a new bank loan product',
          },
          {
            label: 'Bulk Import',
            href: '/superadmin/bank-product-management/import',
            icon: Upload,
            description: 'Bulk import products via CSV/Excel',
          },
          {
            label: 'Rate Updates',
            href: '/superadmin/bank-product-management/rate-updates',
            icon: Percent,
            description: 'Quick update interest rates across banks',
          },
          {
            label: 'Analytics',
            href: '/superadmin/bank-product-management/analytics',
            icon: BarChart3,
            description: 'Product coverage, comparison and gap analysis',
          },
        ],
      },
    ],
  },
  // USER MANAGEMENT
  {
    title: 'USER MANAGEMENT',
    items: [
      {
        icon: Users,
        label: 'Employee Management',
        href: '/superadmin/employee-management',
        description: 'Manage all employee records and operations',
        subItems: [
          {
            label: 'Employee Sub-Roles',
            href: '/superadmin/role-management/employee-subroles',
            icon: UserCog,
            description: 'Configure employee role permissions',
          },
          {
            label: 'Onboarding Management',
            href: '/superadmin/hr/onboarding-management',
            icon: Briefcase,
            description: 'Manage new employee onboarding',
          },
          {
            label: 'Resignation Requests',
            href: '/superadmin/hr/resignations',
            icon: FileX,
            description: 'Process resignation applications',
          },
          {
            label: 'Final Settlement',
            href: '/superadmin/hr/final-settlement',
            icon: DollarSign,
            description: 'Handle exit settlements and payouts',
          },
          {
            label: 'PIP Management',
            href: '/superadmin/hr/pip',
            icon: TrendingDown,
            description: 'Performance Improvement Plans',
          },
          {
            label: 'HR Analytics',
            href: '/superadmin/hr/analytics',
            icon: BarChart3,
            description: 'View HR metrics and insights',
          },
          {
            label: 'Attendance',
            href: '/superadmin/hr/attendance',
            icon: Calendar,
            description: 'Track employee attendance records',
          },
          {
            label: 'Leave Management',
            href: '/superadmin/hr/leaves',
            icon: Clock,
            description: 'Manage leave requests and balances',
          },
          {
            label: 'Payroll Processing',
            href: '/superadmin/hr/payroll',
            icon: Wallet,
            description: 'Process monthly payroll',
          },
          {
            label: 'HR Reports',
            href: '/superadmin/hr/reports',
            icon: FileText,
            description: 'Generate HR reports and analytics',
          },
          {
            label: 'Target Assignment',
            href: '/superadmin/incentives-management/assign-targets',
            icon: Target,
            description: 'Set employee performance targets',
          },
          {
            label: 'Incentives Management',
            href: '/superadmin/incentives-management',
            icon: Award,
            description: 'Manage employee incentive programs',
          },
          {
            label: 'CRO Performance',
            href: '/superadmin/cro-performance',
            icon: BarChart3,
            description: 'Track CRO performance metrics',
          },
          {
            label: 'CRO Management',
            href: '/superadmin/cro-management',
            icon: Users,
            description: 'Manage CRO skills, capacity & assignments',
          },
        ],
      },
      {
        icon: Shield,
        label: 'Admin Management',
        href: '/superadmin/admin-management',
        description: 'Manage system administrators',
      },
      {
        icon: Building2,
        label: 'Property Management',
        href: '/superadmin/property-management',
        description: 'Manage property assets and records',
      },
      {
        icon: Handshake,
        label: 'Partner Management',
        href: '/superadmin/partner-management',
        description: 'Manage business partners and associates',
        subItems: [
          {
            label: 'Partner Sub-Roles',
            href: '/superadmin/role-management/partner-subroles',
            icon: UserCog,
            description: 'Configure partner role permissions',
          },
          {
            label: 'Analytics',
            href: '/superadmin/partner-management/analytics',
            icon: BarChart3,
            description: 'View partner performance analytics',
          },
          {
            label: 'Performance',
            href: '/superadmin/partner-management/performance',
            icon: TrendingDown,
            description: 'Track partner performance metrics',
          },
          {
            label: 'Contests & Leaderboard',
            href: '/superadmin/partner-management/contests',
            icon: Trophy,
            description: 'View contest standings and rankings',
          },
          {
            label: 'Contest Management',
            href: '/superadmin/contest-management',
            icon: Award,
            description: 'Create and manage partner contests',
          },
          {
            label: 'Support Tickets Analytics',
            href: '/superadmin/partner-support-analytics',
            icon: Ticket,
            description: 'Analyze partner support requests',
          },
        ],
      },
      {
        icon: UserCheck,
        label: 'Customer Management',
        href: '/superadmin/customer-management',
        description: 'Manage customer accounts and data',
        subItems: [
          // CONFIGURATION SECTION
          {
            label: 'Income Categories',
            href: '/superadmin/customer-management/income-categories',
            icon: Layers,
            description: 'Manage 13 income categories for customer classification',
          },
          {
            label: 'Income Profiles',
            href: '/superadmin/customer-management/income-profiles',
            icon: User,
            description: 'Manage 218+ income profiles under each category',
          },
          {
            label: 'Entity Types',
            href: '/superadmin/customer-management/entity-types',
            icon: Building2,
            description: 'Manage 20+ entity types with roles and permissions',
          },
          {
            label: 'Entity Forms',
            href: '/superadmin/customer-management/entity-forms',
            icon: FileText,
            description: 'Preview and configure entity data collection forms',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Profile Entity Settings',
            href: '/superadmin/customer-management/profile-entity-settings',
            icon: Settings,
            description: 'Enable/disable entity types per income profile',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Profile Fields',
            href: '/superadmin/customer-management/profile-fields',
            icon: FileCode,
            description: 'Configure dynamic profile fields for individuals and entities',
          },
          {
            label: 'Document Requirements',
            href: '/superadmin/customer-management/document-requirements',
            icon: FileKey,
            description: 'Manage KYC document requirements per profile/entity type',
            badge: 'New',
            badgeVariant: 'success',
          },
          // CUSTOMER DATA SECTION
          {
            label: 'All Individuals',
            href: '/superadmin/customer-management/individuals',
            icon: Users,
            description: 'View and manage all registered individuals',
          },
          {
            label: 'All Entities',
            href: '/superadmin/customer-management/entities',
            icon: Building,
            description: 'View and manage all registered entities',
          },
          {
            label: 'Onboarding Pipeline',
            href: '/superadmin/customer-management/onboarding-pipeline',
            icon: GitBranch,
            description: 'Track customer journey from registration to completion',
            badge: 'New',
            badgeVariant: 'success',
          },
          // LOAN CUSTOMERS SECTION (REMARKETING)
          {
            label: 'Loan Customers',
            href: '/superadmin/customer-management/loan-customers',
            icon: Banknote,
            description: 'Customers who have availed loans - remarketing database',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Customer Segments',
            href: '/superadmin/customer-management/segments',
            icon: UsersRound,
            description: 'Create dynamic segments for targeted marketing campaigns',
            badge: 'New',
            badgeVariant: 'success',
          },
          // ANALYTICS SECTION
          {
            label: 'Source Analytics',
            href: '/superadmin/customer-management/source-analytics',
            icon: TrendingUp,
            description: 'Track customer acquisition sources and attribution',
          },
          {
            label: 'Customer Analytics',
            href: '/superadmin/customer-management/analytics',
            icon: LineChart,
            description: 'View customer analytics, conversion funnel and insights',
          },
          // AUDIT & SETTINGS
          {
            label: 'Configuration Audit Log',
            href: '/superadmin/customer-management/audit-log',
            icon: ClipboardCheck,
            description: 'Track all configuration changes made by admins',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Feature Config',
            href: '/superadmin/customer-management/feature-config',
            icon: ToggleLeft,
            description: 'Toggle customer-facing features on/off per portal',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Offers to Customers',
            href: '/superadmin/offers-to-customers',
            icon: Tag,
            description: 'Manage promotional offers',
          },
          {
            label: 'Support Tickets Analytics',
            href: '/superadmin/customer-support-analytics',
            icon: Ticket,
            description: 'Analyze customer support requests',
          },
        ],
      },
      {
        icon: Store,
        label: 'Vendor Management',
        href: '/superadmin/vendor-management',
        description: 'Manage vendors and banking partners',
        subItems: [
          {
            label: 'Vendor Sub-Roles',
            href: '/superadmin/role-management/vendor-subroles',
            icon: UserCog,
            description: 'Configure vendor role permissions',
          },
          {
            label: 'Banks & NBFCs',
            href: '/superadmin/banks',
            icon: Building,
            description: 'Manage banking and NBFC partners',
          },
        ],
      },
    ],
  },
  // FINANCE
  {
    title: 'FINANCE',
    items: [
      {
        icon: CreditCard,
        label: 'Payout Management',
        href: '/superadmin/payout-management',
        description: 'Manage commissions and payouts',
        dynamicBadge: true,
        subItems: [
          {
            label: 'Dashboard & Analytics',
            href: '/superadmin/payout-management/analytics',
            icon: BarChart3,
            description: 'Real-time payout analytics, trends, and insights',
          },
          {
            label: 'Payout Approval',
            href: '/superadmin/payout-management/partner-payout-approval',
            icon: CheckSquare,
            description: 'Approve or reject verified BA/BP/CP payout applications',
            badgeVariant: 'warning',
          },
          {
            label: 'Commission Batches',
            href: '/superadmin/payout-management/commission-batches',
            icon: Wallet,
            description: 'Create and manage commission payout batches',
          },
          {
            label: 'Payout Grid & Conditions',
            href: '/superadmin/payout-management/payout-grid',
            icon: Settings,
            description: 'Configure commission rates, rules, and payout conditions',
          },
          {
            label: 'Payout Details',
            href: '/superadmin/payout-management/payout-details',
            icon: FileText,
            description: 'View all payout records across BA, BP, and CP partners',
          },
          {
            label: 'Bank Sheet Reconciliation',
            href: '/superadmin/payout-management/bank-sheets',
            icon: Upload,
            description: 'Upload and reconcile bank disbursement payout sheets (BA/BP)',
          },
          {
            label: 'Pipeline Tracker',
            href: '/superadmin/payout-management/payout-tracker',
            icon: Kanban,
            description: 'Stage-wise payout pipeline visualization and analytics',
          },
        ],
      },
    ],
  },
  // SUPPORT
  {
    title: 'SUPPORT',
    items: [
      {
        icon: Ticket,
        label: 'Support Ticket Management',
        href: '/superadmin/support-tickets',
        description: 'Handle support tickets and requests',
        subItems: [
          {
            label: 'All Tickets',
            href: '/superadmin/support-tickets',
            icon: Ticket,
            description: 'View and manage all support tickets',
          },
          {
            label: 'SLA Management',
            href: '/superadmin/sla-management',
            icon: Clock,
            description: 'Configure and monitor SLA policies',
          },
          {
            label: 'Escalation Management',
            href: '/superadmin/escalation-management',
            icon: AlertTriangle,
            description: 'Manage escalation rules and workflows',
          },
        ],
      },
    ],
  },
  // MARKETING & PROMOTIONS
  {
    title: 'MARKETING & PROMOTIONS',
    items: [
      {
        icon: Image,
        label: 'Banner Management',
        href: '/superadmin/banners',
        description: 'Manage promotional banners',
        subItems: [
          {
            label: 'All Banners',
            href: '/superadmin/banners',
            icon: Image,
            description: 'View and manage all banners',
          },
          {
            label: 'Templates',
            href: '/superadmin/banners/templates',
            icon: Layout,
            description: 'Pre-designed banner templates',
          },
          {
            label: 'Analytics',
            href: '/superadmin/banners/analytics',
            icon: BarChart3,
            description: 'Banner performance metrics',
          },
          {
            label: 'A/B Testing',
            href: '/superadmin/banners/ab-testing',
            icon: TestTube,
            description: 'Test banner variations',
          },
          {
            label: 'History',
            href: '/superadmin/banners/history',
            icon: History,
            description: 'View banner change history',
          },
        ],
      },
      {
        icon: Trophy,
        label: 'Contest Management',
        href: '/superadmin/contest-management',
        description: 'Create and manage contests',
      },
      {
        icon: Tag,
        label: 'Offers to Customers',
        href: '/superadmin/offers-to-customers',
        description: 'Manage customer offers and promotions',
      },
      {
        icon: Database,
        label: 'Database Management',
        href: '/superadmin/database-management',
        description: 'Master database for email and phone contacts',
        subItems: [
          {
            label: 'Dashboard',
            href: '/superadmin/database-management',
            icon: Layout,
            description: 'Database overview and storage analytics',
          },
          {
            label: 'Email Drive',
            href: '/superadmin/database-management/email/drive',
            icon: Mail,
            description: 'Browse and manage email contacts',
            badge: 'New',
            badgeVariant: 'success'
          },
          {
            label: 'SMS Database',
            href: '/superadmin/database-management/sms',
            icon: MessageSquare,
            description: 'Manage mobile contact database',
            badge: 'Complete',
            badgeVariant: 'success'
          },
          {
            label: 'Google Maps Data',
            href: '/superadmin/database-management/google-maps',
            icon: MapPin,
            description: 'Scrape business data from Google Maps',
            badge: 'New',
            badgeVariant: 'success'
          },
          {
            label: 'Import Emails',
            href: '/superadmin/database-management/email/import',
            icon: Upload,
            description: 'Import email contacts with advanced mapping',
          },
          {
            label: 'Email Trash',
            href: '/superadmin/database-management/email/trash',
            icon: Trash2,
            description: 'Restore or permanently delete emails',
          },
          {
            label: 'Phone Drive',
            href: '/superadmin/database-management/phone/drive',
            icon: Phone,
            description: 'Browse and manage phone contacts with DND',
            badge: 'New',
            badgeVariant: 'success'
          },
          {
            label: 'Import Phones',
            href: '/superadmin/database-management/phone/import',
            icon: Upload,
            description: 'Import phone contacts with DND checking',
          },
          {
            label: 'Phone Trash',
            href: '/superadmin/database-management/phone/trash',
            icon: Trash2,
            description: 'Restore or permanently delete phones',
          },
          {
            label: 'Import History',
            href: '/superadmin/database-management/shared/import-history',
            icon: History,
            description: 'View all past import operations',
          },
          {
            label: 'Storage Analytics',
            href: '/superadmin/database-management/shared/storage-analytics',
            icon: HardDrive,
            description: 'Monitor storage usage and trends',
          },
          {
            label: 'Activity Log',
            href: '/superadmin/database-management/shared/activity-log',
            icon: Activity,
            description: 'Track all database operations',
          },
        ],
      },
      {
        icon: Send,
        label: 'Marketing Management',
        href: '/superadmin/marketing-management',
        description: 'Execute and automate marketing campaigns',
        badge: 'New',
        badgeVariant: 'success',
        subItems: [
          {
            label: 'Dashboard',
            href: '/superadmin/marketing-management',
            icon: Layout,
            description: 'Marketing overview and analytics',
          },
          {
            label: 'Email Templates',
            href: '/superadmin/marketing-management/email-templates',
            icon: Mail,
            description: 'Create and manage email templates',
          },
          {
            label: 'Email Campaigns',
            href: '/superadmin/marketing-management/email-campaigns',
            icon: Send,
            description: 'Launch and track email campaigns',
          },
          {
            label: 'SMS Templates',
            href: '/superadmin/marketing-management/sms-templates',
            icon: MessageSquare,
            description: 'Create and manage SMS templates',
          },
          {
            label: 'SMS Campaigns',
            href: '/superadmin/marketing-management/sms-campaigns',
            icon: Send,
            description: 'Launch and track SMS campaigns',
          },
          {
            label: 'Workflows',
            href: '/superadmin/marketing-management/workflows',
            icon: Workflow,
            description: 'Build automated marketing workflows',
          },
          {
            label: 'Drip Campaigns',
            href: '/superadmin/marketing-management/drip-campaigns',
            icon: Timer,
            description: 'Sequential automated campaigns',
          },
          {
            label: 'Segmentation',
            href: '/superadmin/marketing-management/segments',
            icon: Filter,
            description: 'Create dynamic contact segments',
          },
          {
            label: 'A/B Testing',
            href: '/superadmin/marketing-management/ab-testing',
            icon: FlaskConical,
            description: 'Test and optimize campaigns',
          },
          {
            label: 'WhatsApp Marketing',
            href: '/superadmin/marketing-management/whatsapp',
            icon: Phone,
            description: 'WhatsApp Business API campaigns',
          },
          {
            label: 'Landing Pages',
            href: '/superadmin/marketing-management/landing-pages',
            icon: Layout,
            description: 'Build high-converting landing pages',
          },
          {
            label: 'Analytics',
            href: '/superadmin/marketing-management/analytics',
            icon: BarChart3,
            description: 'Campaign performance analytics',
          },
          {
            label: 'Compliance',
            href: '/superadmin/marketing-management/compliance',
            icon: Shield,
            description: 'Marketing compliance & reporting',
          },
          {
            label: 'AI Templates',
            href: '/superadmin/marketing-management/ai-templates',
            icon: Sparkles,
            description: 'AI-powered email template generation',
          },
          {
            label: 'Video Marketing',
            href: '/superadmin/marketing-management/video-marketing',
            icon: Video,
            description: 'Video library and campaigns',
          },
        ],
      },
    ],
  },
  // COMMUNICATION
  {
    title: 'COMMUNICATION',
    items: [
      {
        icon: Bell,
        label: 'Notification Center',
        href: '/superadmin/notification-center',
        description: 'Manage push notifications',
        subItems: [
          {
            label: 'Dashboard',
            href: '/superadmin/notification-center',
            icon: Layout,
            description: 'Notification overview and stats',
          },
          {
            label: 'Send Notification',
            href: '/superadmin/notification-center/send',
            icon: Send,
            description: 'Send new push notifications',
          },
          {
            label: 'History',
            href: '/superadmin/notification-center/history',
            icon: History,
            description: 'View sent notification history',
          },
          {
            label: 'Templates',
            href: '/superadmin/notification-center/templates',
            icon: ScrollText,
            description: 'Manage notification templates',
          },
          {
            label: 'Analytics',
            href: '/superadmin/notification-center/analytics',
            icon: BarChart3,
            description: 'Notification performance metrics',
          },
          {
            label: 'Failed Notifications',
            href: '/superadmin/notification-center/failed',
            icon: XCircle,
            description: 'View and retry failed notifications',
          },
          {
            label: 'A/B Testing',
            href: '/superadmin/notification-center/ab-testing',
            icon: TestTube,
            description: 'Test notification variations',
          },
          {
            label: 'Unsubscribe & GDPR',
            href: '/superadmin/notification-center/unsubscribe',
            icon: ShieldAlert,
            description: 'Manage user preferences and compliance',
          },
        ],
      },
      {
        icon: Mail,
        label: 'Mail Box Management',
        href: '/superadmin/email-management',
        description: 'Manage email accounts and settings',
        subItems: [
          {
            label: 'Dashboard',
            href: '/superadmin/email-management',
            icon: Layout,
            description: 'Email system overview',
          },
          {
            label: 'Accounts',
            href: '/superadmin/email-management/accounts',
            icon: MailPlus,
            description: 'Manage email accounts',
          },
          {
            label: 'Provider Config',
            href: '/superadmin/email-management/config',
            icon: Cog,
            description: 'Configure email providers',
          },
          {
            label: 'Signatures',
            href: '/superadmin/email-management/signatures',
            icon: Signature,
            description: 'Manage email signatures',
          },
          {
            label: 'Settings',
            href: '/superadmin/email-management/settings',
            icon: Settings,
            description: 'Email system settings',
          },
          {
            label: 'Activity Logs',
            href: '/superadmin/email-management/logs',
            icon: Logs,
            description: 'View email activity logs',
          },
        ],
      },
      {
        icon: Bot,
        label: 'Chatbot Management',
        href: '/superadmin/chatbot-management',
        description: 'Configure chatbot settings',
      },
    ],
  },
  // INTEGRATIONS
  {
    title: 'INTEGRATIONS',
    items: [
      {
        icon: Zap,
        label: 'Integration Hub',
        href: '/superadmin/integrations',
        description: 'Manage third-party integrations and APIs',
        subItems: [
          {
            label: 'Dashboard',
            href: '/superadmin/integrations',
            icon: Layout,
            description: 'Integration overview and health status',
          },
          {
            label: 'Analytics & BI',
            href: '/superadmin/integrations/analytics',
            icon: LineChart,
            description: 'Google Analytics, Mixpanel, Segment integrations',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Document Management',
            href: '/superadmin/integrations/documents',
            icon: FileText,
            description: 'DigiLocker, DocuSign, Adobe Sign integrations',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Compliance & Regulatory',
            href: '/superadmin/integrations/compliance',
            icon: Shield,
            description: 'RBI, CERSAI, GST, PAN verification APIs',
            badge: 'New',
            badgeVariant: 'success',
          },
          {
            label: 'Payment Gateways',
            href: '/superadmin/integrations/payments',
            icon: CreditCard,
            description: 'Razorpay, PayU, Cashfree integrations',
          },
          {
            label: 'CRM Integrations',
            href: '/superadmin/integrations/crm',
            icon: Users,
            description: 'Salesforce, Zoho, HubSpot integrations',
          },
          {
            label: 'Webhooks',
            href: '/superadmin/integrations/webhooks',
            icon: Globe,
            description: 'Configure outbound webhooks',
          },
          {
            label: 'API Keys',
            href: '/superadmin/integrations/api-keys',
            icon: Code,
            description: 'Manage API keys and credentials',
          },
          {
            label: 'Logs & Monitoring',
            href: '/superadmin/integrations/logs',
            icon: Activity,
            description: 'Integration logs and monitoring',
          },
          {
            label: 'OCEN (Bank APIs)',
            href: '/superadmin/integrations/ocen',
            icon: Landmark,
            description: 'Open Credit Enablement Network - bank loan matching & disbursement',
            badge: 'Planned',
            badgeVariant: 'warning',
          },
          {
            label: 'Account Aggregator',
            href: '/superadmin/integrations/account-aggregator',
            icon: Database,
            description: 'Finvu/Setu consent-based financial data (FIP/FIU)',
            badge: 'Planned',
            badgeVariant: 'warning',
          },
          {
            label: 'eSign & eStamp',
            href: '/superadmin/integrations/esign',
            icon: Signature,
            description: 'Digio/Setu digital agreement signing & stamping',
            badge: 'Planned',
            badgeVariant: 'warning',
          },
          {
            label: 'eNACH & UPI AutoPay',
            href: '/superadmin/integrations/enach',
            icon: RefreshCw,
            description: 'Automated EMI collection via eNACH mandates & UPI',
            badge: 'Planned',
            badgeVariant: 'warning',
          },
          {
            label: 'WhatsApp Business',
            href: '/superadmin/integrations/whatsapp',
            icon: MessageCircle,
            description: 'WhatsApp Business API for customer communication',
            badge: 'Planned',
            badgeVariant: 'warning',
          },
          {
            label: 'Video KYC',
            href: '/superadmin/integrations/video-kyc',
            icon: Video,
            description: 'Live video verification for instant KYC processing',
            badge: 'Planned',
            badgeVariant: 'warning',
          },
          {
            label: 'ONDC Credit',
            href: '/superadmin/integrations/ondc',
            icon: Globe,
            description: 'ONDC credit marketplace for customer acquisition',
            badge: 'Planned',
            badgeVariant: 'warning',
          },
          {
            label: 'Bharat Connect B2B',
            href: '/superadmin/integrations/bharat-connect',
            icon: Banknote,
            description: 'NPCI B2B payments & TReDS invoice financing',
            badge: 'Planned',
            badgeVariant: 'warning',
          },
        ],
      },
      {
        icon: MessageSquare,
        label: 'SMS & Email Management',
        href: '/superadmin/sms-email-management',
        description: 'Manage SMS and email communications',
        subItems: [
          {
            label: 'Dashboard',
            href: '/superadmin/sms-email-management',
            icon: Layout,
            description: 'SMS & Email overview and analytics',
          },
          {
            label: 'SMS Templates',
            href: '/superadmin/sms-email-management/sms-templates',
            icon: MessageSquare,
            description: 'Manage SMS message templates',
          },
          {
            label: 'Email Templates',
            href: '/superadmin/sms-email-management/email-templates',
            icon: Mail,
            description: 'Manage email templates',
          },
          {
            label: 'Providers',
            href: '/superadmin/sms-email-management/providers',
            icon: Building,
            description: 'Configure SMS/email providers & API keys',
          },
          {
            label: 'Delivery Logs',
            href: '/superadmin/sms-email-management/delivery-logs',
            icon: Activity,
            description: 'View message delivery status',
          },
        ],
      },
    ],
  },
  // SYSTEM
  {
    title: 'SYSTEM',
    items: [
      {
        icon: ToggleLeft,
        label: 'Feature Flags',
        href: '/superadmin/feature-flags',
        description: 'Toggle features on/off across all portals',
        badge: 'New',
        badgeVariant: 'success',
      },
      {
        icon: ListChecks,
        label: 'Go-Live Checklist',
        href: '/superadmin/go-live-checklist',
        description: 'Pre-launch readiness checklist and verification',
        badge: 'New',
        badgeVariant: 'warning',
      },
      {
        icon: Activity,
        label: 'Real-Time Activity Feed',
        href: '/superadmin/realtime-feed',
        description: 'Monitor system activities in real-time',
      },
      {
        icon: HardDrive,
        label: 'WorkDrive',
        href: '/superadmin/workdrive',
        description: 'Cloud storage and file management',
      },
      {
        icon: User,
        label: 'My Profile',
        href: '/superadmin/my-profile',
        description: 'Manage your account settings',
      },
    ],
  },
]

// Helper function to get menu item by href
export function getMenuItemByHref(href: string): MenuItem | undefined {
  for (const section of menuSections) {
    for (const item of section.items) {
      if (item.href === href) {
        return item
      }
    }
  }
  return undefined
}

// Helper function to get menu section by item href
export function getMenuSectionByItemHref(href: string): MenuSection | undefined {
  for (const section of menuSections) {
    for (const item of section.items) {
      if (item.href === href) {
        return section
      }
    }
  }
  return undefined
}

// Flatten all menu items for sidebar active state detection
export const allMenuItems = menuSections.flatMap((section) => section.items)
