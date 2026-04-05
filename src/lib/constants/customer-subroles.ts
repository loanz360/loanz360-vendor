/**
 * Customer Subroles and Profile Definitions
 * 20 Subroles with 396 Profiles total
 * Based on RBI/Banking norms for loan applicant categorization
 * Used for customer portal registration and navigation
 */

import {
  User,
  Briefcase,
  UserCircle,
  Factory,
  Wheat,
  Clock,
  Globe,
  Heart,
  GraduationCap,
  Laptop,
  Landmark,
  Star,
  Store,
  Wrench,
  Sunset,
  Rocket,
  Building,
  ShoppingBag,
  Palette,
  UserCheck,
  type LucideIcon
} from 'lucide-react'

// =====================================================
// INTERFACES
// =====================================================

export interface CustomerSubrole {
  key: string
  name: string
  description: string
  icon: LucideIcon
  color: string
  route: string
  displayOrder: number
  isActive: boolean
  showEntityProfile: boolean
}

export interface CustomerProfile {
  key: string
  name: string
  description: string
  icon: string
  displayOrder: number
  isActive: boolean
  isOther?: boolean  // Flag to identify "Others" profile that requires custom input
}

export interface CustomerSubroleWithProfiles extends CustomerSubrole {
  profiles: CustomerProfile[]
}

// =====================================================
// CUSTOMER SUBROLES (20)
// =====================================================

export const CUSTOMER_SUBROLES: CustomerSubrole[] = [
  {
    key: 'INDIVIDUAL',
    name: 'Individual',
    description: 'Individual customers without specific category',
    icon: User,
    color: '#6B7280',
    route: 'individual',
    displayOrder: 1,
    isActive: true,
    showEntityProfile: false
  },
  {
    key: 'SALARIED',
    name: 'Salaried',
    description: 'Individuals with fixed salary income from employment',
    icon: Briefcase,
    color: '#3B82F6',
    route: 'salaried',
    displayOrder: 2,
    isActive: true,
    showEntityProfile: false
  },
  {
    key: 'PROFESSIONAL',
    name: 'Self-Employed Professional',
    description: 'Doctors, CA, CS, CMA, Architects with own practice',
    icon: UserCircle,
    color: '#8B5CF6',
    route: 'professional',
    displayOrder: 3,
    isActive: true,
    showEntityProfile: true
  },
  {
    key: 'SERVICE',
    name: 'Self-Employed Service',
    description: 'Service business owners and non-professional consultants',
    icon: Wrench,
    color: '#6366F1',
    route: 'service',
    displayOrder: 4,
    isActive: true,
    showEntityProfile: true
  },
  {
    key: 'MANUFACTURER',
    name: 'Self-Employed Manufacturer',
    description: 'Manufacturing business owners',
    icon: Factory,
    color: '#10B981',
    route: 'manufacturer',
    displayOrder: 5,
    isActive: true,
    showEntityProfile: true
  },
  {
    key: 'TRADER',
    name: 'Self-Employed Trader',
    description: 'Trading and retail business owners',
    icon: Store,
    color: '#F59E0B',
    route: 'trader',
    displayOrder: 6,
    isActive: true,
    showEntityProfile: true
  },
  {
    key: 'AGRICULTURE',
    name: 'Agriculture & Allied',
    description: 'Farmers and agricultural activities',
    icon: Wheat,
    color: '#84CC16',
    route: 'agriculture',
    displayOrder: 7,
    isActive: true,
    showEntityProfile: true
  },
  {
    key: 'PENSIONER',
    name: 'Pensioner',
    description: 'Retired individuals receiving regular pension',
    icon: Clock,
    color: '#8B5CF6',
    route: 'pensioner',
    displayOrder: 8,
    isActive: true,
    showEntityProfile: false
  },
  {
    key: 'RETIRED',
    name: 'Retired',
    description: 'Retired individuals without regular pension',
    icon: Sunset,
    color: '#F97316',
    route: 'retired',
    displayOrder: 9,
    isActive: true,
    showEntityProfile: false
  },
  {
    key: 'NRI',
    name: 'NRI',
    description: 'Non-Resident Indians',
    icon: Globe,
    color: '#14B8A6',
    route: 'nri',
    displayOrder: 10,
    isActive: true,
    showEntityProfile: false
  },
  {
    key: 'WOMEN',
    name: 'Women-Specific',
    description: 'Women entrepreneurs and professionals',
    icon: Heart,
    color: '#EC4899',
    route: 'women',
    displayOrder: 11,
    isActive: true,
    showEntityProfile: true
  },
  {
    key: 'STUDENT',
    name: 'Student',
    description: 'Students pursuing education',
    icon: GraduationCap,
    color: '#22C55E',
    route: 'student',
    displayOrder: 12,
    isActive: true,
    showEntityProfile: false
  },
  {
    key: 'GIG_ECONOMY',
    name: 'Gig Economy & Freelancer',
    description: 'Freelancers and gig workers',
    icon: Laptop,
    color: '#06B6D4',
    route: 'gig-economy',
    displayOrder: 13,
    isActive: true,
    showEntityProfile: false
  },
  {
    key: 'INSTITUTIONAL',
    name: 'Institutional',
    description: 'Schools, hospitals, NGOs, trusts',
    icon: Landmark,
    color: '#A855F7',
    route: 'institutional',
    displayOrder: 14,
    isActive: true,
    showEntityProfile: true
  },
  {
    key: 'SPECIAL',
    name: 'Special Categories',
    description: 'Rental income, senior citizens, reserved categories',
    icon: Star,
    color: '#EF4444',
    route: 'special',
    displayOrder: 15,
    isActive: true,
    showEntityProfile: false
  },
  {
    key: 'STARTUP',
    name: 'Startup',
    description: 'DPIIT registered and funded startups',
    icon: Rocket,
    color: '#F43F5E',
    route: 'startup',
    displayOrder: 16,
    isActive: true,
    showEntityProfile: true
  },
  {
    key: 'REAL_ESTATE',
    name: 'Real Estate',
    description: 'Real estate developers, brokers and contractors',
    icon: Building,
    color: '#0891B2',
    route: 'real-estate',
    displayOrder: 17,
    isActive: true,
    showEntityProfile: true
  },
  {
    key: 'MICRO_ENTERPRISE',
    name: 'Micro Enterprise',
    description: 'Street vendors, hawkers, small vendors',
    icon: ShoppingBag,
    color: '#D97706',
    route: 'micro-enterprise',
    displayOrder: 18,
    isActive: true,
    showEntityProfile: true
  },
  {
    key: 'ARTISAN_CRAFTSMEN',
    name: 'Artisan & Craftsmen',
    description: 'Traditional artisans, weavers, craftsmen',
    icon: Palette,
    color: '#7C3AED',
    route: 'artisan-craftsmen',
    displayOrder: 19,
    isActive: true,
    showEntityProfile: true
  },
  {
    key: 'AGENT',
    name: 'Agent',
    description: 'Insurance agents, commission agents, intermediaries',
    icon: UserCheck,
    color: '#059669',
    route: 'agent',
    displayOrder: 20,
    isActive: true,
    showEntityProfile: true
  },
  {
    key: 'MSME',
    name: 'MSME',
    description: 'Micro, Small and Medium Enterprises',
    icon: Landmark,
    color: '#0EA5E9',
    route: 'msme',
    displayOrder: 21,
    isActive: false, // Disabled - covered by Manufacturer/Trader/Service
    showEntityProfile: true
  }
]

// =====================================================
// CUSTOMER PROFILES BY SUBROLE (396 Total)
// =====================================================

export const CUSTOMER_PROFILES: Record<string, CustomerProfile[]> = {
  // =====================================================
  // INDIVIDUAL Profiles (3)
  // =====================================================
  INDIVIDUAL: [
    { key: 'INDIVIDUAL_GENERAL', name: 'General Individual', description: 'Individual without specific income category', icon: 'user', displayOrder: 1, isActive: true },
    { key: 'INDIVIDUAL_HOMEMAKER', name: 'Homemaker', description: 'Non-earning household manager', icon: 'home', displayOrder: 2, isActive: true },
    { key: 'INDIVIDUAL_DEPENDENT', name: 'Dependent', description: 'Financially dependent individual', icon: 'users', displayOrder: 3, isActive: true },
    { key: 'INDIVIDUAL_OTHER', name: 'Others', description: 'Other individual profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // SALARIED Profiles (30)
  // Employees with fixed salary from employer
  // =====================================================
  SALARIED: [
    // Government Employees
    { key: 'SALARIED_CENTRAL_GOVT', name: 'Central Government', description: 'Central govt ministry/department employee', icon: 'landmark', displayOrder: 1, isActive: true },
    { key: 'SALARIED_STATE_GOVT', name: 'State Government', description: 'State govt department employee', icon: 'building-columns', displayOrder: 2, isActive: true },
    { key: 'SALARIED_PSU', name: 'PSU Employee', description: 'Public Sector Undertaking employee', icon: 'building-2', displayOrder: 3, isActive: true },
    { key: 'SALARIED_DEFENCE', name: 'Defence Personnel', description: 'Army/Navy/Air Force serving personnel', icon: 'shield', displayOrder: 4, isActive: true },
    { key: 'SALARIED_PARAMILITARY', name: 'Paramilitary/Police', description: 'CRPF/BSF/CISF/Police personnel', icon: 'shield-check', displayOrder: 5, isActive: true },
    { key: 'SALARIED_RAILWAYS', name: 'Railways Employee', description: 'Indian Railways employee', icon: 'train', displayOrder: 6, isActive: true },
    { key: 'SALARIED_JUDICIARY', name: 'Judiciary Employee', description: 'Courts/legal system employee', icon: 'scale', displayOrder: 7, isActive: true },
    { key: 'SALARIED_MUNICIPAL', name: 'Municipal/Local Body', description: 'Corporation/panchayat employee', icon: 'building', displayOrder: 8, isActive: true },
    // Banking & Insurance
    { key: 'SALARIED_BANK_PUBLIC', name: 'Bank (Public)', description: 'Public sector bank employee', icon: 'landmark', displayOrder: 9, isActive: true },
    { key: 'SALARIED_BANK_PRIVATE', name: 'Bank (Private)', description: 'Private sector bank employee', icon: 'landmark', displayOrder: 10, isActive: true },
    { key: 'SALARIED_INSURANCE', name: 'Insurance Employee', description: 'LIC/GIC/Private insurance employee', icon: 'shield', displayOrder: 11, isActive: true },
    // Private Sector
    { key: 'SALARIED_PRIVATE_LARGE', name: 'Private (Large Corp)', description: 'Fortune 500/Top 100 company employee', icon: 'building-office', displayOrder: 12, isActive: true },
    { key: 'SALARIED_PRIVATE_MNC', name: 'MNC Employee', description: 'Multinational company employee', icon: 'globe-2', displayOrder: 13, isActive: true },
    { key: 'SALARIED_PRIVATE_SME', name: 'Private (SME)', description: 'Small/medium company employee', icon: 'building-office', displayOrder: 14, isActive: true },
    { key: 'SALARIED_IT_TECH', name: 'IT/Technology', description: 'Software/IT company employee', icon: 'laptop', displayOrder: 15, isActive: true },
    // Education & Healthcare
    { key: 'SALARIED_TEACHER_GOVT', name: 'Teacher (Government)', description: 'Govt school/college teacher', icon: 'graduation-cap', displayOrder: 16, isActive: true },
    { key: 'SALARIED_TEACHER_PRIVATE', name: 'Teacher (Private)', description: 'Private institution teacher', icon: 'graduation-cap', displayOrder: 17, isActive: true },
    { key: 'SALARIED_NURSE', name: 'Nursing Staff', description: 'Hospital/clinic nurse', icon: 'heart-pulse', displayOrder: 18, isActive: true },
    { key: 'SALARIED_PARAMEDICAL', name: 'Paramedical Staff', description: 'Lab tech/X-ray tech/other paramedic', icon: 'stethoscope', displayOrder: 19, isActive: true },
    // Employed Professionals (also can be in SEP if practicing)
    { key: 'SALARIED_DOCTOR', name: 'Doctor (Employed)', description: 'Hospital employed doctor', icon: 'stethoscope', displayOrder: 20, isActive: true },
    { key: 'SALARIED_DENTIST', name: 'Dentist (Employed)', description: 'Hospital/clinic employed dentist', icon: 'tooth', displayOrder: 21, isActive: true },
    { key: 'SALARIED_CA', name: 'CA (Employed)', description: 'Employed CA in company/firm', icon: 'calculator', displayOrder: 22, isActive: true },
    { key: 'SALARIED_CS', name: 'CS (Employed)', description: 'Employed CS in company', icon: 'file-text', displayOrder: 23, isActive: true },
    { key: 'SALARIED_CMA', name: 'CMA (Employed)', description: 'Employed Cost Accountant', icon: 'calculator', displayOrder: 24, isActive: true },
    { key: 'SALARIED_ARCHITECT', name: 'Architect (Employed)', description: 'Employed in architecture firm', icon: 'ruler', displayOrder: 25, isActive: true },
    { key: 'SALARIED_LAWYER', name: 'Lawyer (Employed)', description: 'Corporate legal counsel', icon: 'scale', displayOrder: 26, isActive: true },
    { key: 'SALARIED_ENGINEER', name: 'Engineer (Employed)', description: 'Employed engineer', icon: 'settings', displayOrder: 27, isActive: true },
    { key: 'SALARIED_PHARMACIST', name: 'Pharmacist (Employed)', description: 'Hospital/chain pharmacy pharmacist', icon: 'pill', displayOrder: 28, isActive: true },
    // Employment Type
    { key: 'SALARIED_CONTRACT', name: 'Contract Employee', description: 'Fixed-term contract worker', icon: 'file-signature', displayOrder: 29, isActive: true },
    { key: 'SALARIED_PROBATION', name: 'Probationary Employee', description: 'On probation period', icon: 'clock', displayOrder: 30, isActive: true },
    { key: 'SALARIED_OTHER', name: 'Others', description: 'Other salaried profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // PROFESSIONAL (SEP) Profiles (12)
  // Self-Employed Professional as per RBI norms:
  // Only Doctors, Dentists, CA, CS, CMA, Architects
  // =====================================================
  PROFESSIONAL: [
    // Medical Professionals
    { key: 'SEP_DOCTOR_ALLOPATHY', name: 'Doctor (Allopathy)', description: 'MBBS/MD - Own practice/clinic', icon: 'stethoscope', displayOrder: 1, isActive: true },
    { key: 'SEP_DOCTOR_SPECIALIST', name: 'Doctor (Specialist)', description: 'Cardiologist/Surgeon/Gynecologist etc.', icon: 'stethoscope', displayOrder: 2, isActive: true },
    { key: 'SEP_DENTIST', name: 'Dentist', description: 'BDS/MDS - Own dental clinic', icon: 'tooth', displayOrder: 3, isActive: true },
    { key: 'SEP_AYURVEDA', name: 'Ayurvedic Doctor', description: 'BAMS - Ayurveda practice', icon: 'leaf', displayOrder: 4, isActive: true },
    { key: 'SEP_HOMEOPATH', name: 'Homeopath', description: 'BHMS - Homeopathy practice', icon: 'droplet', displayOrder: 5, isActive: true },
    { key: 'SEP_UNANI', name: 'Unani Doctor', description: 'BUMS - Unani practice', icon: 'heart-pulse', displayOrder: 6, isActive: true },
    { key: 'SEP_SIDDHA', name: 'Siddha Doctor', description: 'BSMS - Siddha practice', icon: 'heart-pulse', displayOrder: 7, isActive: true },
    { key: 'SEP_NATUROPATH', name: 'Naturopath', description: 'BNYS - Naturopathy practice', icon: 'sun', displayOrder: 8, isActive: true },
    // Architecture
    { key: 'SEP_ARCHITECT', name: 'Architect', description: 'Council of Architecture registered', icon: 'ruler', displayOrder: 9, isActive: true },
    // Financial Professionals
    { key: 'SEP_CA', name: 'Chartered Accountant', description: 'ICAI registered, practicing CA', icon: 'calculator', displayOrder: 10, isActive: true },
    { key: 'SEP_CS', name: 'Company Secretary', description: 'ICSI registered, practicing CS', icon: 'file-text', displayOrder: 11, isActive: true },
    { key: 'SEP_CMA', name: 'Cost Accountant', description: 'ICMAI registered, practicing CMA', icon: 'calculator', displayOrder: 12, isActive: true },
    { key: 'PROFESSIONAL_OTHER', name: 'Others', description: 'Other professional profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // SERVICE (SENP) Profiles (52)
  // Self-Employed Non-Professional - Service providers
  // =====================================================
  SERVICE: [
    // Legal & Consulting (NOT SEP)
    { key: 'SERVICE_LAWYER', name: 'Lawyer/Advocate', description: 'Practicing advocate', icon: 'scale', displayOrder: 1, isActive: true },
    { key: 'SERVICE_ENGINEER_CIVIL', name: 'Civil Engineer (Consultant)', description: 'Civil engineering consultant', icon: 'hard-hat', displayOrder: 2, isActive: true },
    { key: 'SERVICE_ENGINEER_STRUCTURAL', name: 'Structural Engineer', description: 'Structural consultant', icon: 'building', displayOrder: 3, isActive: true },
    { key: 'SERVICE_ENGINEER_ELECTRICAL', name: 'Electrical Engineer', description: 'Electrical consultant', icon: 'zap', displayOrder: 4, isActive: true },
    { key: 'SERVICE_ENGINEER_MECHANICAL', name: 'Mechanical Engineer', description: 'Mechanical consultant', icon: 'settings', displayOrder: 5, isActive: true },
    { key: 'SERVICE_TAX_CONSULTANT', name: 'Tax Consultant', description: 'Tax advisory practice', icon: 'receipt', displayOrder: 6, isActive: true },
    { key: 'SERVICE_MANAGEMENT_CONSULTANT', name: 'Management Consultant', description: 'Business consulting services', icon: 'user-tie', displayOrder: 7, isActive: true },
    { key: 'SERVICE_FINANCIAL_ADVISOR', name: 'Financial Advisor (RIA)', description: 'SEBI registered RIA', icon: 'trending-up', displayOrder: 8, isActive: true },
    { key: 'SERVICE_INSURANCE_AGENT', name: 'Insurance Agent', description: 'IRDAI licensed agent', icon: 'shield', displayOrder: 9, isActive: true },
    { key: 'SERVICE_STOCKBROKER', name: 'Stock Broker', description: 'SEBI registered broker', icon: 'trending-up', displayOrder: 10, isActive: true },
    { key: 'SERVICE_VALUATOR', name: 'Registered Valuator', description: 'Property/asset valuator', icon: 'badge-check', displayOrder: 11, isActive: true },
    { key: 'SERVICE_SURVEYOR', name: 'Licensed Surveyor', description: 'Survey business', icon: 'map', displayOrder: 12, isActive: true },
    // Healthcare Services
    { key: 'SERVICE_VETERINARIAN', name: 'Veterinarian', description: 'Animal clinic owner', icon: 'paw-print', displayOrder: 13, isActive: true },
    { key: 'SERVICE_PHYSIOTHERAPIST', name: 'Physiotherapist', description: 'Physio clinic owner', icon: 'activity', displayOrder: 14, isActive: true },
    { key: 'SERVICE_PATHOLOGY_LAB', name: 'Pathology Lab Owner', description: 'Diagnostic lab owner', icon: 'microscope', displayOrder: 15, isActive: true },
    { key: 'SERVICE_RADIOLOGY_CENTER', name: 'Radiology/Imaging Center', description: 'X-ray/MRI/CT center', icon: 'scan', displayOrder: 16, isActive: true },
    { key: 'SERVICE_CLINIC_OWNER', name: 'Clinic/Polyclinic Owner', description: 'Healthcare facility owner', icon: 'hospital', displayOrder: 17, isActive: true },
    { key: 'SERVICE_NURSING_HOME', name: 'Nursing Home Owner', description: 'Nursing home business', icon: 'hospital', displayOrder: 18, isActive: true },
    { key: 'SERVICE_HOSPITAL_OWNER', name: 'Hospital Owner', description: 'Hospital business owner', icon: 'hospital', displayOrder: 19, isActive: true },
    // Food & Hospitality
    { key: 'SERVICE_RESTAURANT', name: 'Restaurant/Dhaba', description: 'Food service business', icon: 'utensils', displayOrder: 20, isActive: true },
    { key: 'SERVICE_HOTEL_LODGE', name: 'Hotel/Lodge', description: 'Accommodation business', icon: 'bed', displayOrder: 21, isActive: true },
    { key: 'SERVICE_CATERING', name: 'Catering Service', description: 'Event food catering', icon: 'utensils', displayOrder: 22, isActive: true },
    // Travel & Transport
    { key: 'SERVICE_TRAVEL_AGENT', name: 'Travel Agent', description: 'Tour & travel services', icon: 'plane', displayOrder: 23, isActive: true },
    { key: 'SERVICE_TRANSPORT_FLEET', name: 'Transport/Fleet Owner', description: 'Truck/bus fleet owner', icon: 'truck', displayOrder: 24, isActive: true },
    { key: 'SERVICE_TAXI_BUSINESS', name: 'Taxi/Cab Business', description: 'Multi-taxi service owner', icon: 'car', displayOrder: 25, isActive: true },
    { key: 'SERVICE_COURIER_LOGISTICS', name: 'Courier/Logistics', description: 'Delivery services', icon: 'package', displayOrder: 26, isActive: true },
    { key: 'SERVICE_WAREHOUSE', name: 'Warehousing', description: 'Storage services', icon: 'warehouse', displayOrder: 27, isActive: true },
    // Education & Training
    { key: 'SERVICE_COACHING_CENTER', name: 'Coaching/Tuition Center', description: 'Coaching classes owner', icon: 'book-open', displayOrder: 28, isActive: true },
    { key: 'SERVICE_SCHOOL_OWNER', name: 'School Owner', description: 'Private school owner', icon: 'school', displayOrder: 29, isActive: true },
    { key: 'SERVICE_TRAINING_INSTITUTE', name: 'Training Institute', description: 'Skill training center', icon: 'graduation-cap', displayOrder: 30, isActive: true },
    { key: 'SERVICE_DAYCARE', name: 'Daycare/Creche', description: 'Childcare services', icon: 'baby', displayOrder: 31, isActive: true },
    // Beauty & Wellness
    { key: 'SERVICE_GYM_FITNESS', name: 'Gym/Fitness Center', description: 'Fitness services', icon: 'dumbbell', displayOrder: 32, isActive: true },
    { key: 'SERVICE_SALON_BEAUTY', name: 'Salon/Beauty Parlour', description: 'Beauty services', icon: 'scissors', displayOrder: 33, isActive: true },
    { key: 'SERVICE_SPA_WELLNESS', name: 'Spa/Wellness Center', description: 'Wellness services', icon: 'sparkles', displayOrder: 34, isActive: true },
    // Cleaning & Maintenance
    { key: 'SERVICE_LAUNDRY', name: 'Laundry/Dry Cleaning', description: 'Cleaning services', icon: 'shirt', displayOrder: 35, isActive: true },
    { key: 'SERVICE_HOUSEKEEPING', name: 'Housekeeping/FM', description: 'Facility management', icon: 'home', displayOrder: 36, isActive: true },
    { key: 'SERVICE_PEST_CONTROL', name: 'Pest Control', description: 'Pest management services', icon: 'bug', displayOrder: 37, isActive: true },
    // Events & Media
    { key: 'SERVICE_EVENT_MANAGEMENT', name: 'Event Management', description: 'Event planning services', icon: 'calendar', displayOrder: 38, isActive: true },
    { key: 'SERVICE_PHOTOGRAPHY', name: 'Photography/Studio', description: 'Photo/video services', icon: 'camera', displayOrder: 39, isActive: true },
    { key: 'SERVICE_PRINTING_PRESS', name: 'Printing Press', description: 'Printing services', icon: 'printer', displayOrder: 40, isActive: true },
    { key: 'SERVICE_ADVERTISING', name: 'Advertising Agency', description: 'Marketing services', icon: 'megaphone', displayOrder: 41, isActive: true },
    // Security & Staffing
    { key: 'SERVICE_SECURITY_AGENCY', name: 'Security Agency', description: 'Security services', icon: 'shield', displayOrder: 42, isActive: true },
    { key: 'SERVICE_MANPOWER_STAFFING', name: 'Manpower/Staffing', description: 'HR services', icon: 'users', displayOrder: 43, isActive: true },
    // IT & Tech Services
    { key: 'SERVICE_IT_SOFTWARE', name: 'IT/Software Services', description: 'Tech services company', icon: 'laptop', displayOrder: 44, isActive: true },
    { key: 'SERVICE_BPO_CALL_CENTER', name: 'BPO/Call Center', description: 'Business process services', icon: 'headphones', displayOrder: 45, isActive: true },
    // Repair Services
    { key: 'SERVICE_REPAIR_ELECTRONICS', name: 'Electronics Repair', description: 'Electronics repair services', icon: 'wrench', displayOrder: 46, isActive: true },
    { key: 'SERVICE_REPAIR_AUTOMOBILE', name: 'Automobile Repair', description: 'Vehicle service center', icon: 'car', displayOrder: 47, isActive: true },
    // Rental Services
    { key: 'SERVICE_RENTAL_EQUIPMENT', name: 'Equipment Rental', description: 'Equipment rental business', icon: 'tool', displayOrder: 48, isActive: true },
    { key: 'SERVICE_RENTAL_VEHICLE', name: 'Vehicle Rental', description: 'Car/bike rental services', icon: 'car', displayOrder: 49, isActive: true },
    // Design Services
    { key: 'SERVICE_INTERIOR_DESIGNER', name: 'Interior Designer', description: 'Interior design services', icon: 'palette', displayOrder: 50, isActive: true },
    { key: 'SERVICE_FASHION_DESIGNER', name: 'Fashion Designer', description: 'Fashion design services', icon: 'shirt', displayOrder: 51, isActive: true },
    { key: 'SERVICE_GENERAL', name: 'General Service Provider', description: 'Other service business', icon: 'briefcase', displayOrder: 52, isActive: true },
    { key: 'SERVICE_OTHER', name: 'Others', description: 'Other service profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // MANUFACTURER Profiles (22)
  // Manufacturing business owners
  // =====================================================
  MANUFACTURER: [
    // By Scale
    { key: 'MANUFACTURER_MICRO', name: 'Micro Manufacturer', description: 'Investment < ₹1 Crore', icon: 'factory', displayOrder: 1, isActive: true },
    { key: 'MANUFACTURER_SMALL', name: 'Small Manufacturer', description: 'Investment ₹1-10 Crore', icon: 'factory', displayOrder: 2, isActive: true },
    { key: 'MANUFACTURER_MEDIUM', name: 'Medium Manufacturer', description: 'Investment ₹10-50 Crore', icon: 'factory', displayOrder: 3, isActive: true },
    { key: 'MANUFACTURER_LARGE', name: 'Large Manufacturer', description: 'Investment > ₹50 Crore', icon: 'factory', displayOrder: 4, isActive: true },
    // By Industry
    { key: 'MANUFACTURER_FOOD_PROCESSING', name: 'Food Processing', description: 'Food & beverage manufacturing', icon: 'utensils', displayOrder: 5, isActive: true },
    { key: 'MANUFACTURER_TEXTILE_GARMENT', name: 'Textile/Garment', description: 'Fabric & clothing manufacturing', icon: 'shirt', displayOrder: 6, isActive: true },
    { key: 'MANUFACTURER_LEATHER', name: 'Leather Products', description: 'Footwear, bags manufacturing', icon: 'briefcase', displayOrder: 7, isActive: true },
    { key: 'MANUFACTURER_PHARMA', name: 'Pharmaceutical', description: 'Medicine manufacturing', icon: 'pill', displayOrder: 8, isActive: true },
    { key: 'MANUFACTURER_CHEMICAL', name: 'Chemical/Paint', description: 'Chemical products manufacturing', icon: 'flask', displayOrder: 9, isActive: true },
    { key: 'MANUFACTURER_PLASTIC_RUBBER', name: 'Plastic/Rubber', description: 'Plastic goods manufacturing', icon: 'package', displayOrder: 10, isActive: true },
    { key: 'MANUFACTURER_PAPER_PACKAGING', name: 'Paper/Packaging', description: 'Paper & cartons manufacturing', icon: 'file', displayOrder: 11, isActive: true },
    { key: 'MANUFACTURER_STEEL_METAL', name: 'Steel/Metal', description: 'Metal fabrication', icon: 'hammer', displayOrder: 12, isActive: true },
    { key: 'MANUFACTURER_AUTO_PARTS', name: 'Auto Components', description: 'Vehicle parts manufacturing', icon: 'settings', displayOrder: 13, isActive: true },
    { key: 'MANUFACTURER_ELECTRONICS', name: 'Electronics/Electrical', description: 'Electronic goods manufacturing', icon: 'cpu', displayOrder: 14, isActive: true },
    { key: 'MANUFACTURER_FURNITURE', name: 'Furniture', description: 'Furniture manufacturing', icon: 'armchair', displayOrder: 15, isActive: true },
    { key: 'MANUFACTURER_CEMENT_BUILDING', name: 'Cement/Building Material', description: 'Construction material manufacturing', icon: 'building', displayOrder: 16, isActive: true },
    { key: 'MANUFACTURER_GLASS_CERAMIC', name: 'Glass/Ceramics', description: 'Glass products manufacturing', icon: 'cup', displayOrder: 17, isActive: true },
    { key: 'MANUFACTURER_JEWELLERY', name: 'Jewellery Manufacturing', description: 'Gold/silver manufacturing', icon: 'gem', displayOrder: 18, isActive: true },
    { key: 'MANUFACTURER_TOYS_SPORTS', name: 'Toys/Sports Goods', description: 'Recreation products manufacturing', icon: 'gamepad', displayOrder: 19, isActive: true },
    { key: 'MANUFACTURER_MACHINERY', name: 'Machinery/Equipment', description: 'Industrial machinery manufacturing', icon: 'cog', displayOrder: 20, isActive: true },
    { key: 'MANUFACTURER_WORKSHOP', name: 'Workshop/Job Work', description: 'Fabrication/machining workshop', icon: 'wrench', displayOrder: 21, isActive: true },
    { key: 'MANUFACTURER_GENERAL', name: 'General Manufacturing', description: 'Other manufacturing business', icon: 'factory', displayOrder: 22, isActive: true },
    { key: 'MANUFACTURER_OTHER', name: 'Others', description: 'Other manufacturing profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // TRADER Profiles (29)
  // Trading and retail business owners
  // =====================================================
  TRADER: [
    // Retail by Type
    { key: 'TRADER_RETAILER_GENERAL', name: 'Retail Shop', description: 'General retail store', icon: 'store', displayOrder: 1, isActive: true },
    { key: 'TRADER_RETAILER_GROCERY', name: 'Grocery/Kirana', description: 'Grocery store owner', icon: 'shopping-cart', displayOrder: 2, isActive: true },
    { key: 'TRADER_RETAILER_CLOTHING', name: 'Clothing/Textile', description: 'Garment shop owner', icon: 'shirt', displayOrder: 3, isActive: true },
    { key: 'TRADER_RETAILER_ELECTRONICS', name: 'Electronics Shop', description: 'Mobile/electronics shop', icon: 'smartphone', displayOrder: 4, isActive: true },
    { key: 'TRADER_RETAILER_JEWELLERY', name: 'Jewellery Shop', description: 'Gold/silver retail', icon: 'gem', displayOrder: 5, isActive: true },
    { key: 'TRADER_RETAILER_MEDICAL', name: 'Medical/Pharmacy', description: 'Medicine retail store', icon: 'pill', displayOrder: 6, isActive: true },
    { key: 'TRADER_RETAILER_HARDWARE', name: 'Hardware/Tools', description: 'Hardware store owner', icon: 'wrench', displayOrder: 7, isActive: true },
    { key: 'TRADER_RETAILER_FOOTWEAR', name: 'Footwear Shop', description: 'Shoe store owner', icon: 'footprints', displayOrder: 8, isActive: true },
    { key: 'TRADER_RETAILER_STATIONERY', name: 'Stationery/Books', description: 'Books & stationery shop', icon: 'book', displayOrder: 9, isActive: true },
    { key: 'TRADER_RETAILER_OPTICAL', name: 'Optical Shop', description: 'Spectacles/lenses shop', icon: 'eye', displayOrder: 10, isActive: true },
    // Wholesale & Distribution
    { key: 'TRADER_WHOLESALER', name: 'Wholesaler', description: 'Bulk/wholesale trading', icon: 'warehouse', displayOrder: 11, isActive: true },
    { key: 'TRADER_DISTRIBUTOR', name: 'Distributor', description: 'Product distribution business', icon: 'truck', displayOrder: 12, isActive: true },
    { key: 'TRADER_STOCKIST', name: 'Stockist/Super Stockist', description: 'Stock holding business', icon: 'package', displayOrder: 13, isActive: true },
    { key: 'TRADER_COMMISSION_AGENT', name: 'Commission Agent/Arhatiya', description: 'Commission-based trading', icon: 'handshake', displayOrder: 14, isActive: true },
    { key: 'TRADER_MANDI_TRADER', name: 'Mandi Trader', description: 'Agricultural produce trading', icon: 'wheat', displayOrder: 15, isActive: true },
    // Import/Export
    { key: 'TRADER_IMPORTER', name: 'Importer', description: 'Import business', icon: 'ship', displayOrder: 16, isActive: true },
    { key: 'TRADER_EXPORTER', name: 'Exporter', description: 'Export business', icon: 'plane', displayOrder: 17, isActive: true },
    { key: 'TRADER_IMPORT_EXPORT', name: 'Import-Export', description: 'Both import & export', icon: 'globe', displayOrder: 18, isActive: true },
    // Specialized Trading
    { key: 'TRADER_FRANCHISE', name: 'Franchise Owner', description: 'Franchise business owner', icon: 'store', displayOrder: 19, isActive: true },
    { key: 'TRADER_ECOMMERCE', name: 'E-Commerce Seller', description: 'Online marketplace seller', icon: 'shopping-bag', displayOrder: 20, isActive: true },
    { key: 'TRADER_AUTO_DEALER', name: 'Automobile Dealer', description: 'Vehicle dealership', icon: 'car', displayOrder: 21, isActive: true },
    { key: 'TRADER_FUEL_DEALER', name: 'Petrol Pump/Gas Agency', description: 'Fuel retail business', icon: 'fuel', displayOrder: 22, isActive: true },
    { key: 'TRADER_FERTILIZER', name: 'Fertilizer/Pesticide Dealer', description: 'Agri-input dealer', icon: 'leaf', displayOrder: 23, isActive: true },
    { key: 'TRADER_BUILDING_MATERIAL', name: 'Building Material Dealer', description: 'Cement/steel/sand dealer', icon: 'building', displayOrder: 24, isActive: true },
    { key: 'TRADER_TIMBER', name: 'Timber/Plywood Dealer', description: 'Wood trading business', icon: 'tree', displayOrder: 25, isActive: true },
    { key: 'TRADER_SCRAP', name: 'Scrap Dealer', description: 'Recycling/scrap business', icon: 'recycle', displayOrder: 26, isActive: true },
    { key: 'TRADER_FMCG', name: 'FMCG Distributor', description: 'Consumer goods distribution', icon: 'package', displayOrder: 27, isActive: true },
    { key: 'TRADER_LIQUOR', name: 'Liquor Retail/Wholesale', description: 'Licensed liquor business', icon: 'wine', displayOrder: 28, isActive: true },
    { key: 'TRADER_GENERAL', name: 'General Trader', description: 'Other trading business', icon: 'shopping-cart', displayOrder: 29, isActive: true },
    { key: 'TRADER_OTHER', name: 'Others', description: 'Other trading profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // AGRICULTURE Profiles (30)
  // Farmers and agricultural activities
  // =====================================================
  AGRICULTURE: [
    // By Land Holding
    { key: 'AGRI_MARGINAL_FARMER', name: 'Marginal Farmer', description: 'Land < 1 hectare', icon: 'wheat', displayOrder: 1, isActive: true },
    { key: 'AGRI_SMALL_FARMER', name: 'Small Farmer', description: 'Land 1-2 hectares', icon: 'wheat', displayOrder: 2, isActive: true },
    { key: 'AGRI_MEDIUM_FARMER', name: 'Medium Farmer', description: 'Land 2-10 hectares', icon: 'wheat', displayOrder: 3, isActive: true },
    { key: 'AGRI_LARGE_FARMER', name: 'Large Farmer', description: 'Land > 10 hectares', icon: 'wheat', displayOrder: 4, isActive: true },
    { key: 'AGRI_TENANT_FARMER', name: 'Tenant Farmer', description: 'Leased/sharecrop farming', icon: 'home', displayOrder: 5, isActive: true },
    { key: 'AGRI_LANDLESS_LABOURER', name: 'Agricultural Labourer', description: 'Landless farm worker', icon: 'user', displayOrder: 6, isActive: true },
    // Animal Husbandry
    { key: 'AGRI_DAIRY', name: 'Dairy Farmer', description: 'Milk/cattle farming', icon: 'milk', displayOrder: 7, isActive: true },
    { key: 'AGRI_POULTRY', name: 'Poultry Farmer', description: 'Chicken/egg production', icon: 'egg', displayOrder: 8, isActive: true },
    { key: 'AGRI_GOAT_SHEEP', name: 'Goat/Sheep Rearing', description: 'Livestock farming', icon: 'paw-print', displayOrder: 9, isActive: true },
    { key: 'AGRI_PIG', name: 'Piggery', description: 'Pig farming', icon: 'paw-print', displayOrder: 10, isActive: true },
    // Fisheries
    { key: 'AGRI_FISHERY_INLAND', name: 'Fishery (Inland)', description: 'Pond/tank fishing', icon: 'fish', displayOrder: 11, isActive: true },
    { key: 'AGRI_FISHERY_MARINE', name: 'Fishery (Marine)', description: 'Sea fishing', icon: 'ship', displayOrder: 12, isActive: true },
    { key: 'AGRI_AQUACULTURE', name: 'Aquaculture', description: 'Fish/prawn farming', icon: 'fish', displayOrder: 13, isActive: true },
    // Horticulture & Allied
    { key: 'AGRI_HORTICULTURE', name: 'Horticulture', description: 'Fruits/vegetables cultivation', icon: 'apple', displayOrder: 14, isActive: true },
    { key: 'AGRI_FLORICULTURE', name: 'Floriculture', description: 'Flower cultivation', icon: 'flower', displayOrder: 15, isActive: true },
    { key: 'AGRI_SERICULTURE', name: 'Sericulture', description: 'Silk farming', icon: 'bug', displayOrder: 16, isActive: true },
    { key: 'AGRI_BEEKEEPING', name: 'Beekeeping/Apiculture', description: 'Honey production', icon: 'hexagon', displayOrder: 17, isActive: true },
    { key: 'AGRI_MUSHROOM', name: 'Mushroom Cultivation', description: 'Mushroom farming', icon: 'cloud', displayOrder: 18, isActive: true },
    // Specialized Farming
    { key: 'AGRI_ORGANIC', name: 'Organic Farmer', description: 'Certified organic farming', icon: 'leaf', displayOrder: 19, isActive: true },
    { key: 'AGRI_PLANTATION', name: 'Plantation', description: 'Tea/coffee/rubber plantation', icon: 'tree', displayOrder: 20, isActive: true },
    { key: 'AGRI_SPICES', name: 'Spice Cultivation', description: 'Spices farming', icon: 'flame', displayOrder: 21, isActive: true },
    { key: 'AGRI_MEDICINAL_HERBS', name: 'Medicinal/Aromatic Plants', description: 'Herbs farming', icon: 'leaf', displayOrder: 22, isActive: true },
    { key: 'AGRI_NURSERY', name: 'Plant Nursery', description: 'Saplings business', icon: 'sprout', displayOrder: 23, isActive: true },
    // Agri Business
    { key: 'AGRI_CONTRACT_FARMER', name: 'Contract Farmer', description: 'Corporate contract farming', icon: 'file-signature', displayOrder: 24, isActive: true },
    { key: 'AGRI_FPO_MEMBER', name: 'FPO Member', description: 'Farmer Producer Organization member', icon: 'users', displayOrder: 25, isActive: true },
    { key: 'AGRI_COLD_STORAGE', name: 'Cold Storage Owner', description: 'Agri cold storage business', icon: 'snowflake', displayOrder: 26, isActive: true },
    { key: 'AGRI_WAREHOUSE', name: 'Agri Warehouse', description: 'Grain storage business', icon: 'warehouse', displayOrder: 27, isActive: true },
    { key: 'AGRI_TRACTOR_OWNER', name: 'Tractor/Equipment Owner', description: 'Farm machinery services', icon: 'tractor', displayOrder: 28, isActive: true },
    { key: 'AGRI_VETERINARIAN', name: 'Veterinarian', description: 'Animal healthcare services', icon: 'paw-print', displayOrder: 29, isActive: true },
    { key: 'AGRI_AGRI_BUSINESS', name: 'Agri Business', description: 'Agro processing/trading', icon: 'factory', displayOrder: 30, isActive: true },
    { key: 'AGRICULTURE_OTHER', name: 'Others', description: 'Other agriculture profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // PENSIONER Profiles (18)
  // Retired individuals receiving regular pension
  // =====================================================
  PENSIONER: [
    // Government Pensioners
    { key: 'PENSIONER_CENTRAL_GOVT', name: 'Central Government', description: 'Retired central govt employee', icon: 'landmark', displayOrder: 1, isActive: true },
    { key: 'PENSIONER_STATE_GOVT', name: 'State Government', description: 'Retired state govt employee', icon: 'building-columns', displayOrder: 2, isActive: true },
    // Defence Pensioners
    { key: 'PENSIONER_DEFENCE_ARMY', name: 'Defence (Army)', description: 'Retired army personnel', icon: 'shield', displayOrder: 3, isActive: true },
    { key: 'PENSIONER_DEFENCE_NAVY', name: 'Defence (Navy)', description: 'Retired navy personnel', icon: 'anchor', displayOrder: 4, isActive: true },
    { key: 'PENSIONER_DEFENCE_AIRFORCE', name: 'Defence (Air Force)', description: 'Retired air force personnel', icon: 'plane', displayOrder: 5, isActive: true },
    { key: 'PENSIONER_PARAMILITARY', name: 'Paramilitary', description: 'Retired CRPF/BSF/CISF', icon: 'shield-check', displayOrder: 6, isActive: true },
    { key: 'PENSIONER_POLICE', name: 'Police', description: 'Retired police personnel', icon: 'badge', displayOrder: 7, isActive: true },
    // Other Government
    { key: 'PENSIONER_RAILWAYS', name: 'Railways', description: 'Retired railways employee', icon: 'train', displayOrder: 8, isActive: true },
    { key: 'PENSIONER_PSU', name: 'PSU', description: 'Retired PSU employee', icon: 'building-2', displayOrder: 9, isActive: true },
    { key: 'PENSIONER_JUDICIARY', name: 'Judiciary', description: 'Retired judge/court staff', icon: 'scale', displayOrder: 10, isActive: true },
    { key: 'PENSIONER_TEACHER', name: 'Teacher/Professor', description: 'Retired government educator', icon: 'graduation-cap', displayOrder: 11, isActive: true },
    // Banking & Insurance
    { key: 'PENSIONER_BANK_PUBLIC', name: 'Bank (Public)', description: 'Retired public bank employee', icon: 'landmark', displayOrder: 12, isActive: true },
    { key: 'PENSIONER_BANK_PRIVATE', name: 'Bank (Private)', description: 'Retired private bank employee', icon: 'landmark', displayOrder: 13, isActive: true },
    { key: 'PENSIONER_INSURANCE', name: 'Insurance', description: 'Retired LIC/GIC employee', icon: 'shield', displayOrder: 14, isActive: true },
    // Special Pensioners
    { key: 'PENSIONER_FAMILY', name: 'Family Pension', description: 'Spouse/dependent pension recipient', icon: 'users', displayOrder: 15, isActive: true },
    { key: 'PENSIONER_DISABILITY', name: 'Disability Pension', description: 'Disability pension recipient', icon: 'accessibility', displayOrder: 16, isActive: true },
    { key: 'PENSIONER_FREEDOM_FIGHTER', name: 'Freedom Fighter', description: 'Freedom fighter pension', icon: 'flag', displayOrder: 17, isActive: true },
    { key: 'PENSIONER_POLITICAL', name: 'Political Pension', description: 'Ex-MLA/MP pension', icon: 'building-columns', displayOrder: 18, isActive: true },
    { key: 'PENSIONER_OTHER', name: 'Others', description: 'Other pensioner profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // RETIRED Profiles (9)
  // Retired individuals without regular pension
  // =====================================================
  RETIRED: [
    { key: 'RETIRED_PRIVATE_EMPLOYEE', name: 'Private Sector', description: 'Retired from private company', icon: 'building-office', displayOrder: 1, isActive: true },
    { key: 'RETIRED_PROFESSIONAL', name: 'Retired Professional', description: 'Retired doctor/CA/lawyer/architect', icon: 'user-tie', displayOrder: 2, isActive: true },
    { key: 'RETIRED_BUSINESSMAN', name: 'Retired Businessman', description: 'Retired business owner', icon: 'store', displayOrder: 3, isActive: true },
    { key: 'RETIRED_SHOPKEEPER', name: 'Retired Shopkeeper', description: 'Retired shop owner', icon: 'store', displayOrder: 4, isActive: true },
    { key: 'RETIRED_VRS', name: 'VRS/Early Retirement', description: 'Voluntary retirement scheme', icon: 'clock', displayOrder: 5, isActive: true },
    { key: 'RETIRED_NRI_RETURNED', name: 'Returned NRI', description: 'NRI who returned and retired', icon: 'globe', displayOrder: 6, isActive: true },
    { key: 'RETIRED_GRATUITY_HOLDER', name: 'Gratuity/PF Holder', description: 'One-time retirement corpus', icon: 'wallet', displayOrder: 7, isActive: true },
    { key: 'RETIRED_INVESTMENT_INCOME', name: 'Investment Income', description: 'Living on investments', icon: 'trending-up', displayOrder: 8, isActive: true },
    { key: 'RETIRED_GENERAL', name: 'General Retired', description: 'Other retired individuals', icon: 'sunset', displayOrder: 9, isActive: true },
    { key: 'RETIRED_OTHER', name: 'Others', description: 'Other retired profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // NRI Profiles (16)
  // Non-Resident Indians
  // =====================================================
  NRI: [
    // By Region - Salaried
    { key: 'NRI_SALARIED_GULF', name: 'Salaried (Gulf)', description: 'UAE/Saudi/Qatar/Oman/Kuwait/Bahrain', icon: 'globe', displayOrder: 1, isActive: true },
    { key: 'NRI_SALARIED_USA', name: 'Salaried (USA)', description: 'United States employment', icon: 'globe', displayOrder: 2, isActive: true },
    { key: 'NRI_SALARIED_UK_EUROPE', name: 'Salaried (UK/Europe)', description: 'UK and European countries', icon: 'globe', displayOrder: 3, isActive: true },
    { key: 'NRI_SALARIED_CANADA', name: 'Salaried (Canada)', description: 'Canada employment', icon: 'globe', displayOrder: 4, isActive: true },
    { key: 'NRI_SALARIED_AUSTRALIA', name: 'Salaried (Australia/NZ)', description: 'Australia/New Zealand', icon: 'globe', displayOrder: 5, isActive: true },
    { key: 'NRI_SALARIED_SINGAPORE', name: 'Salaried (Singapore/SE Asia)', description: 'Singapore/Malaysia/Thailand', icon: 'globe', displayOrder: 6, isActive: true },
    { key: 'NRI_SALARIED_AFRICA', name: 'Salaried (Africa)', description: 'African countries', icon: 'globe', displayOrder: 7, isActive: true },
    { key: 'NRI_SALARIED_OTHER', name: 'Salaried (Other)', description: 'Other countries', icon: 'globe', displayOrder: 8, isActive: true },
    // Professionals & Business
    { key: 'NRI_DOCTOR', name: 'Doctor (NRI)', description: 'Doctor practicing abroad', icon: 'stethoscope', displayOrder: 9, isActive: true },
    { key: 'NRI_CA_CS', name: 'CA/CS (NRI)', description: 'CA/CS working abroad', icon: 'calculator', displayOrder: 10, isActive: true },
    { key: 'NRI_PROFESSIONAL', name: 'Other Professional (NRI)', description: 'Engineer/lawyer abroad', icon: 'user-tie', displayOrder: 11, isActive: true },
    { key: 'NRI_BUSINESSMAN', name: 'Businessman (NRI)', description: 'Business owner abroad', icon: 'briefcase', displayOrder: 12, isActive: true },
    // Specialized NRI
    { key: 'NRI_SEAFARER', name: 'Seafarer/Merchant Navy', description: 'Shipping/cruise employment', icon: 'ship', displayOrder: 13, isActive: true },
    { key: 'NRI_AIRLINE_CREW', name: 'Airline Crew', description: 'Pilots/cabin crew', icon: 'plane', displayOrder: 14, isActive: true },
    // PIO/OCI
    { key: 'NRI_PIO', name: 'Person of Indian Origin', description: 'PIO card holder', icon: 'id-card', displayOrder: 15, isActive: true },
    { key: 'NRI_OCI', name: 'OCI Card Holder', description: 'Overseas Citizen of India', icon: 'id-card', displayOrder: 16, isActive: true },
    { key: 'NRI_OTHER', name: 'Others', description: 'Other NRI profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // WOMEN Profiles (13)
  // Women-specific schemes and profiles
  // =====================================================
  WOMEN: [
    { key: 'WOMEN_ENTREPRENEUR', name: 'Women Entrepreneur', description: 'Women-owned business (51%+ ownership)', icon: 'store', displayOrder: 1, isActive: true },
    { key: 'WOMEN_PROFESSIONAL', name: 'Women Professional', description: 'Self-employed doctor/CA/architect', icon: 'user-tie', displayOrder: 2, isActive: true },
    { key: 'WOMEN_SALARIED', name: 'Working Woman', description: 'Employed woman', icon: 'briefcase', displayOrder: 3, isActive: true },
    { key: 'WOMEN_FARMER', name: 'Women Farmer', description: 'Female agriculturist', icon: 'wheat', displayOrder: 4, isActive: true },
    { key: 'WOMEN_SHG_MEMBER', name: 'SHG Member', description: 'Self Help Group member', icon: 'users', displayOrder: 5, isActive: true },
    { key: 'WOMEN_SHG_LEADER', name: 'SHG Leader', description: 'SHG office bearer/secretary', icon: 'crown', displayOrder: 6, isActive: true },
    { key: 'WOMEN_ARTISAN', name: 'Women Artisan', description: 'Female craftsperson', icon: 'palette', displayOrder: 7, isActive: true },
    { key: 'WOMEN_SINGLE', name: 'Single Woman', description: 'Unmarried woman', icon: 'user', displayOrder: 8, isActive: true },
    { key: 'WOMEN_WIDOW', name: 'Widow', description: 'Widowed woman', icon: 'user', displayOrder: 9, isActive: true },
    { key: 'WOMEN_DIVORCEE', name: 'Divorcee', description: 'Divorced woman', icon: 'user', displayOrder: 10, isActive: true },
    { key: 'WOMEN_DESERTED', name: 'Deserted Woman', description: 'Deserted by spouse', icon: 'user', displayOrder: 11, isActive: true },
    { key: 'WOMEN_HOMEMAKER', name: 'Homemaker', description: 'Homemaker seeking loan', icon: 'home', displayOrder: 12, isActive: true },
    { key: 'WOMEN_MUDRA', name: 'Mudra Beneficiary', description: 'Women Mudra loan applicant', icon: 'wallet', displayOrder: 13, isActive: true },
    { key: 'WOMEN_OTHER', name: 'Others', description: 'Other women profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // STUDENT Profiles (17)
  // Students seeking education loans
  // =====================================================
  STUDENT: [
    // India Studies
    { key: 'STUDENT_UG_INDIA', name: 'UG (India)', description: "Bachelor's degree in India", icon: 'book', displayOrder: 1, isActive: true },
    { key: 'STUDENT_PG_INDIA', name: 'PG (India)', description: "Master's degree in India", icon: 'book-open', displayOrder: 2, isActive: true },
    { key: 'STUDENT_PHD_INDIA', name: 'PhD (India)', description: 'Doctorate in India', icon: 'graduation-cap', displayOrder: 3, isActive: true },
    // Study Abroad
    { key: 'STUDENT_UG_ABROAD', name: 'UG (Abroad)', description: "Bachelor's degree overseas", icon: 'globe', displayOrder: 4, isActive: true },
    { key: 'STUDENT_PG_ABROAD', name: 'PG (Abroad)', description: "Master's degree overseas", icon: 'globe', displayOrder: 5, isActive: true },
    { key: 'STUDENT_PHD_ABROAD', name: 'PhD (Abroad)', description: 'Doctorate overseas', icon: 'globe', displayOrder: 6, isActive: true },
    // Professional Courses
    { key: 'STUDENT_MEDICAL', name: 'Medical (MBBS/BDS)', description: 'Medical education', icon: 'stethoscope', displayOrder: 7, isActive: true },
    { key: 'STUDENT_ENGINEERING', name: 'Engineering (B.Tech/BE)', description: 'Engineering education', icon: 'settings', displayOrder: 8, isActive: true },
    { key: 'STUDENT_MBA', name: 'MBA/PGDM', description: 'Management education', icon: 'briefcase', displayOrder: 9, isActive: true },
    { key: 'STUDENT_LAW', name: 'Law (LLB/LLM)', description: 'Legal education', icon: 'scale', displayOrder: 10, isActive: true },
    { key: 'STUDENT_CA_CS_CMA', name: 'CA/CS/CMA', description: 'Professional accounting/company secretary', icon: 'calculator', displayOrder: 11, isActive: true },
    { key: 'STUDENT_NURSING', name: 'Nursing/Paramedical', description: 'Healthcare education', icon: 'heart-pulse', displayOrder: 12, isActive: true },
    // Vocational & Others
    { key: 'STUDENT_DIPLOMA_ITI', name: 'Diploma/ITI', description: 'Technical diploma/ITI', icon: 'wrench', displayOrder: 13, isActive: true },
    { key: 'STUDENT_VOCATIONAL', name: 'Vocational Training', description: 'Skill development course', icon: 'tool', displayOrder: 14, isActive: true },
    { key: 'STUDENT_COMPETITIVE', name: 'Competitive Exam Prep', description: 'UPSC/SSC/Banking exam preparation', icon: 'target', displayOrder: 15, isActive: true },
    { key: 'STUDENT_DISTANCE', name: 'Distance/Online', description: 'Correspondence/online course', icon: 'laptop', displayOrder: 16, isActive: true },
    { key: 'STUDENT_WORKING', name: 'Working Professional', description: 'Part-time student (employed)', icon: 'briefcase', displayOrder: 17, isActive: true },
    { key: 'STUDENT_OTHER', name: 'Others', description: 'Other student profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // GIG_ECONOMY Profiles (23)
  // Freelancers and gig workers
  // =====================================================
  GIG_ECONOMY: [
    // IT & Tech Freelancers
    { key: 'GIG_FREELANCER_IT', name: 'Software Developer', description: 'Freelance developer/programmer', icon: 'laptop', displayOrder: 1, isActive: true },
    { key: 'GIG_FREELANCER_DESIGN', name: 'Graphic/UI Designer', description: 'Freelance designer', icon: 'palette', displayOrder: 2, isActive: true },
    { key: 'GIG_FREELANCER_WRITER', name: 'Content Writer', description: 'Freelance writer/blogger', icon: 'pen', displayOrder: 3, isActive: true },
    { key: 'GIG_FREELANCER_MARKETING', name: 'Digital Marketer', description: 'Freelance SEO/social media', icon: 'trending-up', displayOrder: 4, isActive: true },
    { key: 'GIG_FREELANCER_DATA', name: 'Data Analyst', description: 'Freelance data/analytics', icon: 'bar-chart', displayOrder: 5, isActive: true },
    { key: 'GIG_FREELANCER_FINANCE', name: 'Finance/Accounting', description: 'Freelance bookkeeping', icon: 'calculator', displayOrder: 6, isActive: true },
    { key: 'GIG_FREELANCER_LEGAL', name: 'Legal Freelancer', description: 'Legal documentation work', icon: 'file-text', displayOrder: 7, isActive: true },
    { key: 'GIG_FREELANCER_TRANSLATOR', name: 'Translator', description: 'Language translation services', icon: 'languages', displayOrder: 8, isActive: true },
    // Content Creators
    { key: 'GIG_CONTENT_YOUTUBER', name: 'YouTuber', description: 'YouTube content creator', icon: 'video', displayOrder: 9, isActive: true },
    { key: 'GIG_CONTENT_INFLUENCER', name: 'Social Media Influencer', description: 'Instagram/Facebook influencer', icon: 'instagram', displayOrder: 10, isActive: true },
    { key: 'GIG_CONTENT_BLOGGER', name: 'Blogger/Vlogger', description: 'Blog/vlog creator', icon: 'pen', displayOrder: 11, isActive: true },
    { key: 'GIG_CONTENT_PODCASTER', name: 'Podcaster', description: 'Podcast creator', icon: 'mic', displayOrder: 12, isActive: true },
    // App-Based Delivery
    { key: 'GIG_DELIVERY_FOOD', name: 'Food Delivery Partner', description: 'Zomato/Swiggy delivery', icon: 'utensils', displayOrder: 13, isActive: true },
    { key: 'GIG_DELIVERY_ECOMMERCE', name: 'E-commerce Delivery', description: 'Amazon/Flipkart delivery', icon: 'package', displayOrder: 14, isActive: true },
    // App-Based Transport
    { key: 'GIG_DRIVER_CAB', name: 'Cab Driver', description: 'Ola/Uber driver', icon: 'car', displayOrder: 15, isActive: true },
    { key: 'GIG_DRIVER_BIKE_TAXI', name: 'Bike Taxi', description: 'Rapido/Uber Moto driver', icon: 'bike', displayOrder: 16, isActive: true },
    // Home Services
    { key: 'GIG_SERVICE_URBAN_COMPANY', name: 'Home Services Partner', description: 'Urban Company/similar partner', icon: 'home', displayOrder: 17, isActive: true },
    // Education & Creative
    { key: 'GIG_TUTOR_ONLINE', name: 'Online Tutor', description: 'E-learning/online teaching', icon: 'graduation-cap', displayOrder: 18, isActive: true },
    { key: 'GIG_PHOTOGRAPHER', name: 'Freelance Photographer', description: 'Photography services', icon: 'camera', displayOrder: 19, isActive: true },
    { key: 'GIG_ARTIST_MUSICIAN', name: 'Musician/Artist', description: 'Performing artist', icon: 'music', displayOrder: 20, isActive: true },
    // Professional Gig
    { key: 'GIG_CONSULTANT', name: 'Independent Consultant', description: 'Project-based consulting', icon: 'user-tie', displayOrder: 21, isActive: true },
    { key: 'GIG_VIRTUAL_ASSISTANT', name: 'Virtual Assistant', description: 'Remote assistance services', icon: 'headphones', displayOrder: 22, isActive: true },
    { key: 'GIG_GENERAL', name: 'General Gig Worker', description: 'Other gig economy work', icon: 'briefcase', displayOrder: 23, isActive: true },
    { key: 'GIG_ECONOMY_OTHER', name: 'Others', description: 'Other gig economy profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // INSTITUTIONAL Profiles (15)
  // Organizations and institutions
  // =====================================================
  INSTITUTIONAL: [
    // Educational
    { key: 'INST_SCHOOL', name: 'School', description: 'K-12 educational institution', icon: 'school', displayOrder: 1, isActive: true },
    { key: 'INST_COLLEGE', name: 'College', description: 'Higher education institution', icon: 'graduation-cap', displayOrder: 2, isActive: true },
    { key: 'INST_UNIVERSITY', name: 'University', description: 'Deemed/private university', icon: 'landmark', displayOrder: 3, isActive: true },
    // Healthcare
    { key: 'INST_HOSPITAL', name: 'Hospital', description: 'Healthcare facility', icon: 'hospital', displayOrder: 4, isActive: true },
    { key: 'INST_CLINIC_CHAIN', name: 'Clinic Chain', description: 'Multi-location clinic', icon: 'hospital', displayOrder: 5, isActive: true },
    { key: 'INST_DIAGNOSTIC', name: 'Diagnostic Center', description: 'Lab/imaging center', icon: 'microscope', displayOrder: 6, isActive: true },
    // Non-Profit
    { key: 'INST_NGO', name: 'NGO', description: 'Non-governmental organization', icon: 'heart', displayOrder: 7, isActive: true },
    { key: 'INST_TRUST', name: 'Trust', description: 'Charitable/public trust', icon: 'heart-handshake', displayOrder: 8, isActive: true },
    { key: 'INST_SOCIETY', name: 'Society', description: 'Registered society', icon: 'users', displayOrder: 9, isActive: true },
    // Religious & Community
    { key: 'INST_RELIGIOUS', name: 'Religious Institution', description: 'Temple/church/mosque/gurudwara', icon: 'church', displayOrder: 10, isActive: true },
    { key: 'INST_HOUSING_SOCIETY', name: 'Housing Society', description: 'RWA/apartment society', icon: 'home', displayOrder: 11, isActive: true },
    { key: 'INST_COOPERATIVE', name: 'Co-operative Society', description: 'Registered co-operative', icon: 'users', displayOrder: 12, isActive: true },
    // Clubs & Associations
    { key: 'INST_CLUB', name: 'Club/Association', description: 'Social/sports club', icon: 'award', displayOrder: 13, isActive: true },
    { key: 'INST_PROFESSIONAL_BODY', name: 'Professional Association', description: 'Industry body/chamber', icon: 'landmark', displayOrder: 14, isActive: true },
    // Agricultural
    { key: 'INST_FPO', name: 'Farmer Producer Org', description: 'FPO/FPC organization', icon: 'wheat', displayOrder: 15, isActive: true },
    { key: 'INSTITUTIONAL_OTHER', name: 'Others', description: 'Other institutional profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // SPECIAL Profiles (18)
  // Special eligibility categories
  // =====================================================
  SPECIAL: [
    // Income Based
    { key: 'SPECIAL_RENTAL_INCOME', name: 'Pure Rental Income', description: 'Only rental income, no other source', icon: 'key', displayOrder: 1, isActive: true },
    { key: 'SPECIAL_DIVIDEND_INCOME', name: 'Dividend/Interest Income', description: 'Investment income only', icon: 'trending-up', displayOrder: 2, isActive: true },
    { key: 'SPECIAL_ROYALTY_INCOME', name: 'Royalty Income', description: 'Intellectual property income', icon: 'award', displayOrder: 3, isActive: true },
    // Age Based
    { key: 'SPECIAL_SENIOR_CITIZEN', name: 'Senior Citizen (60+)', description: 'Age 60+ without pension', icon: 'user', displayOrder: 4, isActive: true },
    { key: 'SPECIAL_SUPER_SENIOR', name: 'Super Senior (80+)', description: 'Age 80+ citizen', icon: 'user', displayOrder: 5, isActive: true },
    // Credit History
    { key: 'SPECIAL_FIRST_TIME_BORROWER', name: 'First Time Borrower', description: 'No credit history', icon: 'user-plus', displayOrder: 6, isActive: true },
    // Reserved Categories
    { key: 'SPECIAL_EX_SERVICEMEN', name: 'Ex-Servicemen', description: 'Former defence (not pensioner)', icon: 'medal', displayOrder: 7, isActive: true },
    { key: 'SPECIAL_DIFFERENTLY_ABLED', name: 'Differently Abled', description: 'Persons with disabilities (PwD)', icon: 'accessibility', displayOrder: 8, isActive: true },
    { key: 'SPECIAL_SC', name: 'Scheduled Caste', description: 'SC category certificate holder', icon: 'users', displayOrder: 9, isActive: true },
    { key: 'SPECIAL_ST', name: 'Scheduled Tribe', description: 'ST category certificate holder', icon: 'users', displayOrder: 10, isActive: true },
    { key: 'SPECIAL_OBC', name: 'OBC', description: 'Other Backward Class certificate', icon: 'users', displayOrder: 11, isActive: true },
    { key: 'SPECIAL_MINORITY', name: 'Minority', description: 'Religious minority community', icon: 'users', displayOrder: 12, isActive: true },
    { key: 'SPECIAL_EWS', name: 'Economically Weaker Section', description: 'EWS certificate holder', icon: 'wallet', displayOrder: 13, isActive: true },
    { key: 'SPECIAL_BPL', name: 'Below Poverty Line', description: 'BPL card holder', icon: 'wallet', displayOrder: 14, isActive: true },
    { key: 'SPECIAL_TRANSGENDER', name: 'Transgender', description: 'Third gender', icon: 'user', displayOrder: 15, isActive: true },
    // Special Circumstances
    { key: 'SPECIAL_WIDOW', name: 'Widow', description: 'Widowed person', icon: 'user', displayOrder: 16, isActive: true },
    { key: 'SPECIAL_DESERTED', name: 'Deserted Spouse', description: 'Deserted by spouse', icon: 'user', displayOrder: 17, isActive: true },
    { key: 'SPECIAL_DISASTER_AFFECTED', name: 'Disaster Affected', description: 'Natural disaster affected', icon: 'alert-triangle', displayOrder: 18, isActive: true },
    { key: 'SPECIAL_OTHER', name: 'Others', description: 'Other special profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // STARTUP Profiles (22)
  // Startups and new ventures
  // =====================================================
  STARTUP: [
    // By Registration
    { key: 'STARTUP_DPIIT', name: 'DPIIT Registered', description: 'Startup India recognized', icon: 'badge-check', displayOrder: 1, isActive: true },
    { key: 'STARTUP_MSME_UDYAM', name: 'MSME Udyam Registered', description: 'Udyam registration holder', icon: 'badge', displayOrder: 2, isActive: true },
    // By Funding Stage
    { key: 'STARTUP_BOOTSTRAPPED', name: 'Bootstrapped', description: 'Self-funded startup', icon: 'wallet', displayOrder: 3, isActive: true },
    { key: 'STARTUP_FAMILY_FUNDED', name: 'Friends & Family', description: 'F&F funding round', icon: 'users', displayOrder: 4, isActive: true },
    { key: 'STARTUP_ANGEL_FUNDED', name: 'Angel Funded', description: 'Angel investor backed', icon: 'star', displayOrder: 5, isActive: true },
    { key: 'STARTUP_SEED_FUNDED', name: 'Seed Funded', description: 'Seed round completed', icon: 'sprout', displayOrder: 6, isActive: true },
    { key: 'STARTUP_VC_FUNDED', name: 'VC Funded', description: 'Venture capital backed (Series A/B/C)', icon: 'trending-up', displayOrder: 7, isActive: true },
    { key: 'STARTUP_GOVT_GRANT', name: 'Government Grant', description: 'Govt grant recipient', icon: 'landmark', displayOrder: 8, isActive: true },
    // By Support
    { key: 'STARTUP_INCUBATOR', name: 'Incubator Backed', description: 'Incubator supported startup', icon: 'rocket', displayOrder: 9, isActive: true },
    { key: 'STARTUP_ACCELERATOR', name: 'Accelerator Backed', description: 'Accelerator program graduate', icon: 'zap', displayOrder: 10, isActive: true },
    // By Sector
    { key: 'STARTUP_TECH_IT', name: 'Tech/SaaS Startup', description: 'Software/SaaS business', icon: 'laptop', displayOrder: 11, isActive: true },
    { key: 'STARTUP_FINTECH', name: 'Fintech Startup', description: 'Financial technology', icon: 'credit-card', displayOrder: 12, isActive: true },
    { key: 'STARTUP_EDTECH', name: 'Edtech Startup', description: 'Education technology', icon: 'graduation-cap', displayOrder: 13, isActive: true },
    { key: 'STARTUP_HEALTHTECH', name: 'Healthtech Startup', description: 'Healthcare technology', icon: 'heart-pulse', displayOrder: 14, isActive: true },
    { key: 'STARTUP_AGRITECH', name: 'Agritech Startup', description: 'Agriculture technology', icon: 'wheat', displayOrder: 15, isActive: true },
    { key: 'STARTUP_ECOMMERCE', name: 'E-commerce Startup', description: 'Online marketplace', icon: 'shopping-cart', displayOrder: 16, isActive: true },
    { key: 'STARTUP_D2C', name: 'D2C Brand', description: 'Direct-to-consumer brand', icon: 'package', displayOrder: 17, isActive: true },
    { key: 'STARTUP_LOGISTICS', name: 'Logistics Startup', description: 'Supply chain/delivery tech', icon: 'truck', displayOrder: 18, isActive: true },
    { key: 'STARTUP_FOODTECH', name: 'Foodtech Startup', description: 'Food delivery/cloud kitchen', icon: 'utensils', displayOrder: 19, isActive: true },
    { key: 'STARTUP_SOCIAL', name: 'Social Enterprise', description: 'Impact-focused startup', icon: 'heart', displayOrder: 20, isActive: true },
    { key: 'STARTUP_HARDWARE', name: 'Hardware/IoT Startup', description: 'Device/product startup', icon: 'cpu', displayOrder: 21, isActive: true },
    { key: 'STARTUP_CLEANTECH', name: 'Cleantech/Greentech', description: 'Clean energy/environment', icon: 'leaf', displayOrder: 22, isActive: true },
    { key: 'STARTUP_OTHER', name: 'Others', description: 'Other startup profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // REAL_ESTATE Profiles (17)
  // Real estate professionals and businesses
  // =====================================================
  REAL_ESTATE: [
    // Developers
    { key: 'REALESTATE_DEVELOPER_SMALL', name: 'Developer (Small)', description: 'Less than 5 projects', icon: 'building', displayOrder: 1, isActive: true },
    { key: 'REALESTATE_DEVELOPER_MEDIUM', name: 'Developer (Medium)', description: '5-20 projects', icon: 'building', displayOrder: 2, isActive: true },
    { key: 'REALESTATE_DEVELOPER_LARGE', name: 'Developer (Large)', description: 'More than 20 projects', icon: 'building', displayOrder: 3, isActive: true },
    { key: 'REALESTATE_BUILDER', name: 'Builder', description: 'Construction business', icon: 'hard-hat', displayOrder: 4, isActive: true },
    // Contractors
    { key: 'REALESTATE_CIVIL_CONTRACTOR', name: 'Civil Contractor', description: 'Civil construction contractor', icon: 'hard-hat', displayOrder: 5, isActive: true },
    { key: 'REALESTATE_INTERIOR_CONTRACTOR', name: 'Interior Contractor', description: 'Interior fit-out contractor', icon: 'palette', displayOrder: 6, isActive: true },
    { key: 'REALESTATE_ELECTRICAL_CONTRACTOR', name: 'Electrical Contractor', description: 'Electrical work contractor', icon: 'zap', displayOrder: 7, isActive: true },
    { key: 'REALESTATE_PLUMBING_CONTRACTOR', name: 'Plumbing Contractor', description: 'Plumbing work contractor', icon: 'droplet', displayOrder: 8, isActive: true },
    { key: 'REALESTATE_PAINTING_CONTRACTOR', name: 'Painting Contractor', description: 'Painting work contractor', icon: 'brush', displayOrder: 9, isActive: true },
    // Brokers & Dealers
    { key: 'REALESTATE_BROKER_RERA', name: 'RERA Registered Agent', description: 'RERA registered broker', icon: 'key', displayOrder: 10, isActive: true },
    { key: 'REALESTATE_BROKER_GENERAL', name: 'Property Broker', description: 'Property broker/agent', icon: 'key', displayOrder: 11, isActive: true },
    { key: 'REALESTATE_PROPERTY_DEALER', name: 'Property Dealer', description: 'Buy/sell property business', icon: 'home', displayOrder: 12, isActive: true },
    // Land Development
    { key: 'REALESTATE_LAND_DEVELOPER', name: 'Land Developer', description: 'Land development business', icon: 'map', displayOrder: 13, isActive: true },
    { key: 'REALESTATE_LAYOUT_DEVELOPER', name: 'Layout Developer', description: 'Plot/layout development', icon: 'grid', displayOrder: 14, isActive: true },
    // Services
    { key: 'REALESTATE_PROPERTY_MANAGER', name: 'Property Manager', description: 'Property maintenance services', icon: 'building', displayOrder: 15, isActive: true },
    { key: 'REALESTATE_ARCHITECT_FIRM', name: 'Architecture Firm', description: 'Architectural design firm', icon: 'ruler', displayOrder: 16, isActive: true },
    { key: 'REALESTATE_BUILDING_MATERIAL', name: 'Building Material Supplier', description: 'Construction material supply', icon: 'package', displayOrder: 17, isActive: true },
    { key: 'REAL_ESTATE_OTHER', name: 'Others', description: 'Other real estate profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // MICRO_ENTERPRISE Profiles (23)
  // Street vendors and micro businesses
  // =====================================================
  MICRO_ENTERPRISE: [
    // Street Vendors
    { key: 'MICRO_SVANIDHI', name: 'PM SVANidhi Vendor', description: 'Street vendor (SVANidhi eligible)', icon: 'store', displayOrder: 1, isActive: true },
    { key: 'MICRO_HAWKER_MOBILE', name: 'Mobile Hawker', description: 'Moving vendor', icon: 'shopping-bag', displayOrder: 2, isActive: true },
    { key: 'MICRO_HAWKER_STATIONARY', name: 'Stationary Hawker', description: 'Fixed location vendor', icon: 'store', displayOrder: 3, isActive: true },
    { key: 'MICRO_KIOSK', name: 'Kiosk Owner', description: 'Small stall/kiosk', icon: 'store', displayOrder: 4, isActive: true },
    // Small Shops
    { key: 'MICRO_PAN_SHOP', name: 'Pan/Cigarette Shop', description: 'Paan shop owner', icon: 'store', displayOrder: 5, isActive: true },
    { key: 'MICRO_TEA_STALL', name: 'Tea Stall', description: 'Chai shop owner', icon: 'coffee', displayOrder: 6, isActive: true },
    { key: 'MICRO_FOOD_CART', name: 'Food Cart', description: 'Mobile food cart', icon: 'utensils', displayOrder: 7, isActive: true },
    { key: 'MICRO_FRUIT_VEGETABLE', name: 'Fruit/Vegetable Vendor', description: 'Fresh produce seller', icon: 'apple', displayOrder: 8, isActive: true },
    { key: 'MICRO_FLOWER_VENDOR', name: 'Flower Vendor', description: 'Flower seller', icon: 'flower', displayOrder: 9, isActive: true },
    { key: 'MICRO_NEWSPAPER', name: 'Newspaper/Magazine Vendor', description: 'Print media vendor', icon: 'newspaper', displayOrder: 10, isActive: true },
    { key: 'MICRO_MOBILE_RECHARGE', name: 'Mobile Accessories', description: 'Mobile/recharge shop', icon: 'smartphone', displayOrder: 11, isActive: true },
    // Home-Based
    { key: 'MICRO_HOME_BUSINESS', name: 'Home-based Business', description: 'Work from home business', icon: 'home', displayOrder: 12, isActive: true },
    { key: 'MICRO_TIFFIN_SERVICE', name: 'Tiffin/Dabba Service', description: 'Home food delivery', icon: 'utensils', displayOrder: 13, isActive: true },
    { key: 'MICRO_PAPAD_PICKLE', name: 'Papad/Pickle Making', description: 'Homemade food products', icon: 'utensils', displayOrder: 14, isActive: true },
    { key: 'MICRO_TAILORING', name: 'Tailoring (Small)', description: 'Home tailoring business', icon: 'scissors', displayOrder: 15, isActive: true },
    // Repair Services
    { key: 'MICRO_CYCLE_REPAIR', name: 'Cycle/Bike Repair', description: 'Two-wheeler repair', icon: 'bike', displayOrder: 16, isActive: true },
    { key: 'MICRO_COBBLER', name: 'Cobbler/Shoe Repair', description: 'Footwear repair', icon: 'footprints', displayOrder: 17, isActive: true },
    { key: 'MICRO_LAUNDRY_PRESS', name: 'Laundry/Ironing', description: 'Clothes pressing', icon: 'shirt', displayOrder: 18, isActive: true },
    // Transport
    { key: 'MICRO_AUTO_RICKSHAW', name: 'Auto Rickshaw Owner', description: 'Auto owner-driver', icon: 'car', displayOrder: 19, isActive: true },
    { key: 'MICRO_E_RICKSHAW', name: 'E-Rickshaw Owner', description: 'E-rickshaw owner-driver', icon: 'car', displayOrder: 20, isActive: true },
    { key: 'MICRO_TAXI_OWNER', name: 'Taxi Owner', description: 'Single taxi owner', icon: 'car', displayOrder: 21, isActive: true },
    // Others
    { key: 'MICRO_XEROX_CYBER', name: 'Xerox/Cyber Cafe', description: 'Xerox/internet cafe', icon: 'printer', displayOrder: 22, isActive: true },
    { key: 'MICRO_GENERAL', name: 'General Small Vendor', description: 'Other micro business', icon: 'store', displayOrder: 23, isActive: true },
    { key: 'MICRO_ENTERPRISE_OTHER', name: 'Others', description: 'Other micro enterprise profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // ARTISAN_CRAFTSMEN Profiles (30)
  // Traditional artisans and craftsmen
  // =====================================================
  ARTISAN_CRAFTSMEN: [
    // Textile & Weaving
    { key: 'ARTISAN_HANDICRAFT', name: 'Handicraft Artisan', description: 'General handicrafts', icon: 'palette', displayOrder: 1, isActive: true },
    { key: 'ARTISAN_HANDLOOM', name: 'Handloom Weaver', description: 'Traditional handloom weaving', icon: 'shirt', displayOrder: 2, isActive: true },
    { key: 'ARTISAN_POWERLOOM', name: 'Powerloom Weaver', description: 'Power loom operator', icon: 'shirt', displayOrder: 3, isActive: true },
    { key: 'ARTISAN_KHADI', name: 'Khadi Worker', description: 'Khadi & village industry', icon: 'shirt', displayOrder: 4, isActive: true },
    { key: 'ARTISAN_EMBROIDERY', name: 'Embroidery/Zari Worker', description: 'Zari/chikan/phulkari work', icon: 'scissors', displayOrder: 5, isActive: true },
    { key: 'ARTISAN_BLOCK_PRINTER', name: 'Block Printer', description: 'Fabric block printing', icon: 'stamp', displayOrder: 6, isActive: true },
    { key: 'ARTISAN_BATIK', name: 'Batik/Tie-Dye', description: 'Fabric dyeing artisan', icon: 'droplet', displayOrder: 7, isActive: true },
    // Pottery & Clay
    { key: 'ARTISAN_POTTER', name: 'Potter (Kumhar)', description: 'Pottery & ceramics', icon: 'circle', displayOrder: 8, isActive: true },
    { key: 'ARTISAN_TERRACOTTA', name: 'Terracotta Artist', description: 'Clay/terracotta art', icon: 'circle', displayOrder: 9, isActive: true },
    // Wood Work
    { key: 'ARTISAN_CARPENTER', name: 'Carpenter (Suthar)', description: 'Traditional wood craft', icon: 'hammer', displayOrder: 10, isActive: true },
    { key: 'ARTISAN_FURNITURE', name: 'Furniture Maker', description: 'Traditional furniture', icon: 'armchair', displayOrder: 11, isActive: true },
    { key: 'ARTISAN_WOOD_CARVER', name: 'Wood Carver', description: 'Wood carving artisan', icon: 'tree', displayOrder: 12, isActive: true },
    // Metal Work
    { key: 'ARTISAN_BLACKSMITH', name: 'Blacksmith (Lohar)', description: 'Metal forging', icon: 'hammer', displayOrder: 13, isActive: true },
    { key: 'ARTISAN_BRASS_WORKER', name: 'Brass/Bell Metal Worker', description: 'Brass utensils maker', icon: 'circle', displayOrder: 14, isActive: true },
    { key: 'ARTISAN_GOLDSMITH', name: 'Goldsmith (Sonar)', description: 'Traditional gold jewelry', icon: 'gem', displayOrder: 15, isActive: true },
    { key: 'ARTISAN_SILVERSMITH', name: 'Silversmith', description: 'Silver jewelry maker', icon: 'gem', displayOrder: 16, isActive: true },
    // Stone Work
    { key: 'ARTISAN_STONE_CARVER', name: 'Stone Carver', description: 'Stone sculpture/carving', icon: 'mountain', displayOrder: 17, isActive: true },
    { key: 'ARTISAN_MARBLE_INLAY', name: 'Marble/Inlay Worker', description: 'Pietra dura/marble inlay', icon: 'gem', displayOrder: 18, isActive: true },
    // Natural Fiber
    { key: 'ARTISAN_BAMBOO_CANE', name: 'Bamboo/Cane Worker', description: 'Bamboo craft artisan', icon: 'tree', displayOrder: 19, isActive: true },
    { key: 'ARTISAN_BASKET_WEAVER', name: 'Basket/Mat Weaver', description: 'Natural fiber weaving', icon: 'box', displayOrder: 20, isActive: true },
    // Leather & Paper
    { key: 'ARTISAN_LEATHER', name: 'Leather Worker (Mochi)', description: 'Leather craft artisan', icon: 'briefcase', displayOrder: 21, isActive: true },
    { key: 'ARTISAN_PAPIER_MACHE', name: 'Papier-mâché Artist', description: 'Paper craft (Kashmir)', icon: 'box', displayOrder: 22, isActive: true },
    // Traditional Crafts
    { key: 'ARTISAN_DHOKRA', name: 'Dhokra/Lost Wax Artist', description: 'Tribal metal craft', icon: 'circle', displayOrder: 23, isActive: true },
    { key: 'ARTISAN_KALAMKARI', name: 'Kalamkari Artist', description: 'Hand-painted fabric', icon: 'pen', displayOrder: 24, isActive: true },
    { key: 'ARTISAN_BIDRI', name: 'Bidri Worker', description: 'Bidri metal craft', icon: 'circle', displayOrder: 25, isActive: true },
    { key: 'ARTISAN_MEENAKARI', name: 'Meenakari Worker', description: 'Enamel work artisan', icon: 'palette', displayOrder: 26, isActive: true },
    // Specialty Items
    { key: 'ARTISAN_TOY_MAKER', name: 'Traditional Toy Maker', description: 'Wooden/cloth toys', icon: 'gamepad', displayOrder: 27, isActive: true },
    { key: 'ARTISAN_MUSICAL_INSTRUMENT', name: 'Instrument Maker', description: 'Traditional musical instruments', icon: 'music', displayOrder: 28, isActive: true },
    { key: 'ARTISAN_BIDI_AGARBATTI', name: 'Bidi/Agarbatti Worker', description: 'Tobacco/incense making', icon: 'flame', displayOrder: 29, isActive: true },
    { key: 'ARTISAN_GENERAL', name: 'Other Traditional Artisan', description: 'Other traditional crafts', icon: 'palette', displayOrder: 30, isActive: true },
    { key: 'ARTISAN_CRAFTSMEN_OTHER', name: 'Others', description: 'Other artisan/craftsmen profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // =====================================================
  // AGENT Profiles (30)
  // Insurance agents, commission agents, intermediaries
  // =====================================================
  AGENT: [
    // Insurance Agents - Life
    { key: 'AGENT_LIC', name: 'LIC Agent', description: 'Life Insurance Corporation agent', icon: 'shield', displayOrder: 1, isActive: true },
    { key: 'AGENT_LIFE_INSURANCE', name: 'Life Insurance Agent', description: 'Private life insurance agent', icon: 'shield', displayOrder: 2, isActive: true },
    { key: 'AGENT_TERM_INSURANCE', name: 'Term Insurance Agent', description: 'Term life insurance specialist', icon: 'shield', displayOrder: 3, isActive: true },
    // Insurance Agents - Health
    { key: 'AGENT_HEALTH_INSURANCE', name: 'Health Insurance Agent', description: 'Health/medical insurance agent', icon: 'heart-pulse', displayOrder: 4, isActive: true },
    { key: 'AGENT_MEDICLAIM', name: 'Mediclaim Agent', description: 'Mediclaim policy specialist', icon: 'heart-pulse', displayOrder: 5, isActive: true },
    // Insurance Agents - General
    { key: 'AGENT_GENERAL_INSURANCE', name: 'General Insurance Agent', description: 'Non-life insurance agent', icon: 'shield', displayOrder: 6, isActive: true },
    { key: 'AGENT_MOTOR_INSURANCE', name: 'Motor Insurance Agent', description: 'Vehicle insurance specialist', icon: 'car', displayOrder: 7, isActive: true },
    { key: 'AGENT_FIRE_INSURANCE', name: 'Fire Insurance Agent', description: 'Property/fire insurance agent', icon: 'flame', displayOrder: 8, isActive: true },
    { key: 'AGENT_MARINE_INSURANCE', name: 'Marine Insurance Agent', description: 'Cargo/shipping insurance agent', icon: 'ship', displayOrder: 9, isActive: true },
    { key: 'AGENT_CROP_INSURANCE', name: 'Crop Insurance Agent', description: 'Agricultural crop insurance agent', icon: 'wheat', displayOrder: 10, isActive: true },
    // Insurance - Corporate & Specialized
    { key: 'AGENT_CORPORATE_INSURANCE', name: 'Corporate Insurance Agent', description: 'Business/corporate insurance agent', icon: 'building', displayOrder: 11, isActive: true },
    { key: 'AGENT_RURAL_INSURANCE', name: 'Rural Insurance Agent', description: 'Rural/micro insurance agent', icon: 'home', displayOrder: 12, isActive: true },
    { key: 'AGENT_POSP', name: 'POSP Agent', description: 'Point of Sale Person (IRDAI)', icon: 'user-check', displayOrder: 13, isActive: true },
    { key: 'AGENT_INSURANCE_BROKER', name: 'Insurance Broker', description: 'IRDAI licensed insurance broker', icon: 'badge', displayOrder: 14, isActive: true },
    { key: 'AGENT_COMPOSITE_INSURANCE', name: 'Composite Insurance Agent', description: 'Multi-product insurance agent', icon: 'layers', displayOrder: 15, isActive: true },
    // Financial Agents
    { key: 'AGENT_MUTUAL_FUND', name: 'Mutual Fund Agent', description: 'AMFI registered MF distributor', icon: 'trending-up', displayOrder: 16, isActive: true },
    { key: 'AGENT_STOCK_BROKER_SUB', name: 'Stock Sub-Broker', description: 'Stock exchange sub-broker', icon: 'bar-chart', displayOrder: 17, isActive: true },
    { key: 'AGENT_LOAN_DSA', name: 'Loan DSA Agent', description: 'Direct Selling Agent for loans', icon: 'wallet', displayOrder: 18, isActive: true },
    { key: 'AGENT_BC_AGENT', name: 'Banking Correspondent', description: 'BC/Business Facilitator agent', icon: 'landmark', displayOrder: 19, isActive: true },
    // Commission Agents - Trade
    { key: 'AGENT_COMMISSION_GENERAL', name: 'Commission Agent', description: 'General commission-based agent', icon: 'handshake', displayOrder: 20, isActive: true },
    { key: 'AGENT_COMMISSION_AGRI', name: 'Agri Commission Agent', description: 'Agricultural produce arhatiya/dalal', icon: 'wheat', displayOrder: 21, isActive: true },
    { key: 'AGENT_COMMISSION_TEXTILE', name: 'Textile Commission Agent', description: 'Fabric/garment commission agent', icon: 'shirt', displayOrder: 22, isActive: true },
    { key: 'AGENT_COMMISSION_METAL', name: 'Metal/Scrap Agent', description: 'Metal/scrap trading commission agent', icon: 'recycle', displayOrder: 23, isActive: true },
    { key: 'AGENT_COMMISSION_FOOD', name: 'Food/Grain Agent', description: 'Food grains commission agent', icon: 'utensils', displayOrder: 24, isActive: true },
    // Logistics & Trade Agents
    { key: 'AGENT_CHA', name: 'Customs House Agent', description: 'Licensed CHA for import/export', icon: 'package', displayOrder: 25, isActive: true },
    { key: 'AGENT_CFA', name: 'C&F Agent', description: 'Clearing & Forwarding agent', icon: 'truck', displayOrder: 26, isActive: true },
    { key: 'AGENT_FREIGHT', name: 'Freight Agent', description: 'Freight forwarding agent', icon: 'ship', displayOrder: 27, isActive: true },
    { key: 'AGENT_TRANSPORT', name: 'Transport Agent', description: 'Transport booking agent', icon: 'truck', displayOrder: 28, isActive: true },
    // Service Agents
    { key: 'AGENT_REAL_ESTATE', name: 'Real Estate Agent', description: 'Property dealing agent', icon: 'home', displayOrder: 29, isActive: true },
    { key: 'AGENT_TRAVEL', name: 'Travel Agent', description: 'Travel booking/tour agent', icon: 'plane', displayOrder: 30, isActive: true },
    { key: 'AGENT_RECRUITMENT', name: 'Recruitment Agent', description: 'Manpower/placement agent', icon: 'users', displayOrder: 31, isActive: true },
    { key: 'AGENT_ADVERTISING', name: 'Advertising Agent', description: 'Media/advertisement agent', icon: 'megaphone', displayOrder: 32, isActive: true },
    { key: 'AGENT_FRANCHISE', name: 'Franchise Agent', description: 'Franchise sales agent', icon: 'store', displayOrder: 33, isActive: true },
    { key: 'AGENT_OTHER', name: 'Others', description: 'Other agent profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: true, isOther: true }
  ],

  // MSME (Disabled - covered by Manufacturer/Trader/Service)
  MSME: [
    { key: 'MSME_MICRO', name: 'Micro Enterprise', description: 'Investment < 1 Cr, Turnover < 5 Cr', icon: 'zap', displayOrder: 1, isActive: false },
    { key: 'MSME_SMALL', name: 'Small Enterprise', description: 'Investment < 10 Cr, Turnover < 50 Cr', icon: 'bar-chart-2', displayOrder: 2, isActive: false },
    { key: 'MSME_MEDIUM', name: 'Medium Enterprise', description: 'Investment < 50 Cr, Turnover < 250 Cr', icon: 'bar-chart-3', displayOrder: 3, isActive: false },
    { key: 'MSME_OTHER', name: 'Others', description: 'Other MSME profile not listed above', icon: 'plus-circle', displayOrder: 999, isActive: false, isOther: true }
  ]
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get all active customer subroles
 */
export function getActiveSubroles(): CustomerSubrole[] {
  return CUSTOMER_SUBROLES.filter(s => s.isActive).sort((a, b) => a.displayOrder - b.displayOrder)
}

/**
 * Get a specific subrole by key
 */
export function getSubroleByKey(key: string): CustomerSubrole | undefined {
  return CUSTOMER_SUBROLES.find(s => s.key === key)
}

/**
 * Get subrole by route
 */
export function getSubroleByRoute(route: string): CustomerSubrole | undefined {
  return CUSTOMER_SUBROLES.find(s => s.route === route)
}

/**
 * Get all profiles for a subrole
 */
export function getProfilesBySubrole(subroleKey: string): CustomerProfile[] {
  const profiles = CUSTOMER_PROFILES[subroleKey]
  if (!profiles) return []
  return profiles.filter(p => p.isActive).sort((a, b) => a.displayOrder - b.displayOrder)
}

/**
 * Get a specific profile by key
 */
export function getProfileByKey(profileKey: string): CustomerProfile | undefined {
  for (const subroleKey of Object.keys(CUSTOMER_PROFILES)) {
    const profile = CUSTOMER_PROFILES[subroleKey].find(p => p.key === profileKey)
    if (profile) return profile
  }
  return undefined
}

/**
 * Get subrole key from profile key
 */
export function getSubroleKeyFromProfile(profileKey: string): string | undefined {
  for (const subroleKey of Object.keys(CUSTOMER_PROFILES)) {
    const profile = CUSTOMER_PROFILES[subroleKey].find(p => p.key === profileKey)
    if (profile) return subroleKey
  }
  return undefined
}

/**
 * Get subrole with all its profiles
 */
export function getSubroleWithProfiles(subroleKey: string): CustomerSubroleWithProfiles | undefined {
  const subrole = getSubroleByKey(subroleKey)
  if (!subrole) return undefined

  return {
    ...subrole,
    profiles: getProfilesBySubrole(subroleKey)
  }
}

/**
 * Get all subroles with their profiles
 */
export function getAllSubrolesWithProfiles(): CustomerSubroleWithProfiles[] {
  return getActiveSubroles().map(subrole => ({
    ...subrole,
    profiles: getProfilesBySubrole(subrole.key)
  }))
}

/**
 * Check if a subrole shows entity profile
 */
export function shouldShowEntityProfile(subroleKey: string): boolean {
  const subrole = getSubroleByKey(subroleKey)
  return subrole?.showEntityProfile ?? false
}

/**
 * Get route for a subrole
 */
export function getSubroleRoute(subroleKey: string): string {
  const subrole = getSubroleByKey(subroleKey)
  return subrole?.route ?? subroleKey.toLowerCase().replace(/_/g, '-')
}

/**
 * Validate subrole key
 */
export function isValidSubrole(key: string): boolean {
  return CUSTOMER_SUBROLES.some(s => s.key === key && s.isActive)
}

/**
 * Validate profile key
 */
export function isValidProfile(profileKey: string): boolean {
  return getProfileByKey(profileKey) !== undefined
}

/**
 * Get total profile count
 */
export function getTotalProfileCount(): number {
  return Object.values(CUSTOMER_PROFILES).reduce((sum, profiles) =>
    sum + profiles.filter(p => p.isActive).length, 0
  )
}

/**
 * Get total active category count
 */
export function getTotalCategoryCount(): number {
  return CUSTOMER_SUBROLES.filter(s => s.isActive).length
}

// =====================================================
// ROUTE MAPPING
// =====================================================

export const SUBROLE_ROUTE_MAP: Record<string, string> = {
  'INDIVIDUAL': 'individual',
  'SALARIED': 'salaried',
  'PROFESSIONAL': 'professional',
  'SERVICE': 'service',
  'MANUFACTURER': 'manufacturer',
  'TRADER': 'trader',
  'AGRICULTURE': 'agriculture',
  'PENSIONER': 'pensioner',
  'RETIRED': 'retired',
  'NRI': 'nri',
  'WOMEN': 'women',
  'STUDENT': 'student',
  'GIG_ECONOMY': 'gig-economy',
  'INSTITUTIONAL': 'institutional',
  'SPECIAL': 'special',
  'STARTUP': 'startup',
  'REAL_ESTATE': 'real-estate',
  'MICRO_ENTERPRISE': 'micro-enterprise',
  'ARTISAN_CRAFTSMEN': 'artisan-craftsmen',
  'MSME': 'msme'
}

export const ROUTE_TO_SUBROLE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SUBROLE_ROUTE_MAP).map(([k, v]) => [v, k])
)

// =====================================================
// OLD TO NEW MAPPING (For Migration)
// =====================================================

export const OLD_PROFILE_TO_NEW_MAPPING: Record<string, { subrole: string; profile: string }> = {
  // Old profiles -> New subrole + profile
  'INDIVIDUAL': { subrole: 'INDIVIDUAL', profile: 'INDIVIDUAL_GENERAL' },
  'SALARIED': { subrole: 'SALARIED', profile: 'SALARIED_PRIVATE_SME' },
  'DOCTOR': { subrole: 'PROFESSIONAL', profile: 'SEP_DOCTOR_ALLOPATHY' },
  'LAWYER': { subrole: 'SERVICE', profile: 'SERVICE_LAWYER' },
  'CHARTERED_ACCOUNTANT': { subrole: 'PROFESSIONAL', profile: 'SEP_CA' },
  'COMPANY_SECRETARY': { subrole: 'PROFESSIONAL', profile: 'SEP_CS' },
  'PROPRIETOR': { subrole: 'TRADER', profile: 'TRADER_GENERAL' },
  'PARTNERSHIP': { subrole: 'TRADER', profile: 'TRADER_GENERAL' },
  'PRIVATE_LIMITED_COMPANY': { subrole: 'MANUFACTURER', profile: 'MANUFACTURER_GENERAL' },
  'PUBLIC_LIMITED_COMPANY': { subrole: 'MANUFACTURER', profile: 'MANUFACTURER_LARGE' },
  'LLP': { subrole: 'SERVICE', profile: 'SERVICE_GENERAL' },
  'HUF': { subrole: 'TRADER', profile: 'TRADER_GENERAL' },
  'MANUFACTURER': { subrole: 'MANUFACTURER', profile: 'MANUFACTURER_GENERAL' },
  'TRADER': { subrole: 'TRADER', profile: 'TRADER_GENERAL' },
  'SERVICE_PROVIDER': { subrole: 'SERVICE', profile: 'SERVICE_GENERAL' },
  'AGRICULTURE': { subrole: 'AGRICULTURE', profile: 'AGRI_MEDIUM_FARMER' },
  'NRI': { subrole: 'NRI', profile: 'NRI_SALARIED_GULF' },
  'PURE_RENTAL': { subrole: 'SPECIAL', profile: 'SPECIAL_RENTAL_INCOME' },
  'RETIRED': { subrole: 'RETIRED', profile: 'RETIRED_GENERAL' }
}
