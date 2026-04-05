/**
 * Profile Configuration for Customer Portal
 *
 * Defines which profiles require entity selection, applicable entity types,
 * required documents, and form field definitions for each profile type.
 *
 * Comprehensive configuration for Indian market requirements.
 */

// ============================================================================
// PROFILE TO ENTITY MAPPING
// ============================================================================

export interface ProfileEntityMapping {
  profileKey: string
  requiresEntity: boolean
  applicableEntityTypes: string[]  // Empty array = no entity required
  defaultEntityType?: string
}

/**
 * Profiles that REQUIRE entity selection
 * These are business/self-employed profiles where the applicant can operate
 * through various legal structures
 *
 * Updated: Comprehensive mappings for all 400+ profiles based on Indian market norms
 */
export const PROFILES_REQUIRING_ENTITY: ProfileEntityMapping[] = [
  // =====================================================
  // PROFESSIONAL (SEP) Profiles - All need entity (12 profiles)
  // Self-Employed Professional as per RBI norms
  // All SEP profiles have: Sole Proprietorship, Partnership, LLP, Private Limited, OPC
  // =====================================================
  { profileKey: 'SEP_DOCTOR_ALLOPATHY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SEP_DOCTOR_SPECIALIST', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SEP_DENTIST', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SEP_AYURVEDA', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SEP_HOMEOPATH', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SEP_UNANI', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SEP_SIDDHA', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SEP_NATUROPATH', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SEP_ARCHITECT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SEP_CA', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SEP_CS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SEP_CMA', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'PROFESSIONAL_OTHER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },

  // =====================================================
  // SERVICE (SENP) Profiles - All need entity (52 profiles)
  // Self-Employed Non-Professional - Service providers
  // =====================================================
  // Legal & Consulting
  { profileKey: 'SERVICE_LAWYER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_ENGINEER_CIVIL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_ENGINEER_STRUCTURAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_ENGINEER_ELECTRICAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_ENGINEER_MECHANICAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_TAX_CONSULTANT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_MANAGEMENT_CONSULTANT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'LLP' },
  { profileKey: 'SERVICE_FINANCIAL_ADVISOR', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_INSURANCE_AGENT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_STOCKBROKER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'LLP' },
  { profileKey: 'SERVICE_VALUATOR', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_SURVEYOR', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP'], defaultEntityType: 'PROPRIETORSHIP' },
  // Healthcare Services
  { profileKey: 'SERVICE_VETERINARIAN', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_PHYSIOTHERAPIST', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_PATHOLOGY_LAB', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_RADIOLOGY_CENTER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'SERVICE_CLINIC_OWNER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_NURSING_HOME', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'TRUST'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'SERVICE_HOSPITAL_OWNER', requiresEntity: true, applicableEntityTypes: ['PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'TRUST'], defaultEntityType: 'PRIVATE_LIMITED' },
  // Food & Hospitality
  { profileKey: 'SERVICE_RESTAURANT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_HOTEL_LODGE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_CATERING', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  // Travel & Transport
  { profileKey: 'SERVICE_TRAVEL_AGENT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_TRANSPORT_FLEET', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_TAXI_BUSINESS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_COURIER_LOGISTICS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_WAREHOUSE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  // Education & Training
  { profileKey: 'SERVICE_COACHING_CENTER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'TRUST', 'SOCIETY'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_SCHOOL_OWNER', requiresEntity: true, applicableEntityTypes: ['TRUST', 'SOCIETY', 'PRIVATE_LIMITED'], defaultEntityType: 'TRUST' },
  { profileKey: 'SERVICE_TRAINING_INSTITUTE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'TRUST'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_DAYCARE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  // Beauty & Wellness
  { profileKey: 'SERVICE_GYM_FITNESS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_SALON_BEAUTY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_SPA_WELLNESS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  // Cleaning & Maintenance
  { profileKey: 'SERVICE_LAUNDRY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_HOUSEKEEPING', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_PEST_CONTROL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  // Events & Media
  { profileKey: 'SERVICE_EVENT_MANAGEMENT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_PHOTOGRAPHY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_PRINTING_PRESS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_ADVERTISING', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'LLP' },
  // Security & Staffing
  { profileKey: 'SERVICE_SECURITY_AGENCY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'SERVICE_MANPOWER_STAFFING', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  // IT & Tech Services
  { profileKey: 'SERVICE_IT_SOFTWARE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'LLP' },
  { profileKey: 'SERVICE_BPO_CALL_CENTER', requiresEntity: true, applicableEntityTypes: ['PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  // Repair Services
  { profileKey: 'SERVICE_REPAIR_ELECTRONICS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_REPAIR_AUTOMOBILE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  // Rental Services
  { profileKey: 'SERVICE_RENTAL_EQUIPMENT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_RENTAL_VEHICLE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  // Design Services
  { profileKey: 'SERVICE_INTERIOR_DESIGNER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_FASHION_DESIGNER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_GENERAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'SERVICE_OTHER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },

  // =====================================================
  // MANUFACTURER Profiles - All need entity (22 profiles)
  // =====================================================
  // By Scale
  { profileKey: 'MANUFACTURER_MICRO', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MANUFACTURER_SMALL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MANUFACTURER_MEDIUM', requiresEntity: true, applicableEntityTypes: ['PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED_UNLISTED', 'PUBLIC_LIMITED_LISTED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'MANUFACTURER_LARGE', requiresEntity: true, applicableEntityTypes: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED_UNLISTED', 'PUBLIC_LIMITED_LISTED','LLP'], defaultEntityType: 'PRIVATE_LIMITED' },
  // By Industry
  { profileKey: 'MANUFACTURER_FOOD_PROCESSING', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MANUFACTURER_TEXTILE_GARMENT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MANUFACTURER_LEATHER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MANUFACTURER_PHARMA', requiresEntity: true, applicableEntityTypes: ['PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED_UNLISTED', 'PUBLIC_LIMITED_LISTED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'MANUFACTURER_CHEMICAL', requiresEntity: true, applicableEntityTypes: ['PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED_UNLISTED', 'PUBLIC_LIMITED_LISTED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'MANUFACTURER_PLASTIC_RUBBER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MANUFACTURER_PAPER_PACKAGING', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MANUFACTURER_STEEL_METAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MANUFACTURER_AUTO_PARTS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'MANUFACTURER_ELECTRONICS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'MANUFACTURER_FURNITURE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MANUFACTURER_CEMENT_BUILDING', requiresEntity: true, applicableEntityTypes: ['PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED_UNLISTED', 'PUBLIC_LIMITED_LISTED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'MANUFACTURER_GLASS_CERAMIC', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MANUFACTURER_JEWELLERY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MANUFACTURER_TOYS_SPORTS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MANUFACTURER_MACHINERY', requiresEntity: true, applicableEntityTypes: ['PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED_UNLISTED', 'PUBLIC_LIMITED_LISTED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'MANUFACTURER_WORKSHOP', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MANUFACTURER_GENERAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MANUFACTURER_OTHER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },

  // =====================================================
  // TRADER Profiles - All need entity (29 profiles)
  // =====================================================
  // Retail by Type
  { profileKey: 'TRADER_RETAILER_GENERAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_RETAILER_GROCERY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_RETAILER_CLOTHING', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_RETAILER_ELECTRONICS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_RETAILER_JEWELLERY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_RETAILER_MEDICAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_RETAILER_HARDWARE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_RETAILER_FOOTWEAR', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_RETAILER_STATIONERY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_RETAILER_OPTICAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP'], defaultEntityType: 'PROPRIETORSHIP' },
  // Wholesale & Distribution
  { profileKey: 'TRADER_WHOLESALER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_DISTRIBUTOR', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_STOCKIST', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_COMMISSION_AGENT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_MANDI_TRADER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Import/Export
  { profileKey: 'TRADER_IMPORTER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED_UNLISTED', 'PUBLIC_LIMITED_LISTED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'TRADER_EXPORTER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED_UNLISTED', 'PUBLIC_LIMITED_LISTED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'TRADER_IMPORT_EXPORT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED_UNLISTED', 'PUBLIC_LIMITED_LISTED'], defaultEntityType: 'PRIVATE_LIMITED' },
  // Specialized Trading
  { profileKey: 'TRADER_FRANCHISE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_ECOMMERCE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_AUTO_DEALER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'TRADER_FUEL_DEALER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_FERTILIZER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_BUILDING_MATERIAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_TIMBER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_SCRAP', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_FMCG', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_LIQUOR', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'TRADER_GENERAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'TRADER_OTHER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },

  // =====================================================
  // AGRICULTURE Profiles - All need entity (30 profiles)
  // Farmers and agricultural activities
  // =====================================================
  // By Land Holding
  { profileKey: 'AGRI_MARGINAL_FARMER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_SMALL_FARMER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_MEDIUM_FARMER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_LARGE_FARMER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_TENANT_FARMER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_LANDLESS_LABOURER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  // Animal Husbandry
  { profileKey: 'AGRI_DAIRY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_POULTRY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_GOAT_SHEEP', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_PIG', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Fisheries
  { profileKey: 'AGRI_FISHERY_INLAND', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_FISHERY_MARINE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_AQUACULTURE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Horticulture & Allied
  { profileKey: 'AGRI_HORTICULTURE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_FLORICULTURE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_SERICULTURE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_BEEKEEPING', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_MUSHROOM', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  // Specialized Farming
  { profileKey: 'AGRI_ORGANIC', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_PLANTATION', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'AGRI_SPICES', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_MEDICINAL_HERBS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_NURSERY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  // Agri Business
  { profileKey: 'AGRI_CONTRACT_FARMER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_FPO_MEMBER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_COLD_STORAGE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'AGRI_WAREHOUSE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_TRACTOR_OWNER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_VETERINARIAN', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRI_AGRI_BUSINESS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGRICULTURE_OTHER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },

  // =====================================================
  // WOMEN Profiles - Only entrepreneurs need entity
  // =====================================================
  { profileKey: 'WOMEN_ENTREPRENEUR', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },

  // =====================================================
  // NRI Profiles - Only businessman needs entity
  // =====================================================
  { profileKey: 'NRI_BUSINESSMAN', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },

  // =====================================================
  // INSTITUTIONAL Profiles - All are entities (15 profiles)
  // =====================================================
  { profileKey: 'INST_SCHOOL', requiresEntity: true, applicableEntityTypes: ['TRUST', 'SOCIETY', 'PRIVATE_LIMITED'], defaultEntityType: 'TRUST' },
  { profileKey: 'INST_COLLEGE', requiresEntity: true, applicableEntityTypes: ['TRUST', 'SOCIETY', 'PRIVATE_LIMITED'], defaultEntityType: 'TRUST' },
  { profileKey: 'INST_UNIVERSITY', requiresEntity: true, applicableEntityTypes: ['TRUST', 'SOCIETY', 'PRIVATE_LIMITED'], defaultEntityType: 'TRUST' },
  { profileKey: 'INST_HOSPITAL', requiresEntity: true, applicableEntityTypes: ['TRUST', 'SOCIETY', 'PRIVATE_LIMITED', 'LLP'], defaultEntityType: 'TRUST' },
  { profileKey: 'INST_CLINIC_CHAIN', requiresEntity: true, applicableEntityTypes: ['PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'INST_DIAGNOSTIC', requiresEntity: true, applicableEntityTypes: ['PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'INST_NGO', requiresEntity: true, applicableEntityTypes: ['TRUST', 'SOCIETY'], defaultEntityType: 'TRUST' },
  { profileKey: 'INST_TRUST', requiresEntity: true, applicableEntityTypes: ['TRUST'], defaultEntityType: 'TRUST' },
  { profileKey: 'INST_SOCIETY', requiresEntity: true, applicableEntityTypes: ['SOCIETY'], defaultEntityType: 'SOCIETY' },
  { profileKey: 'INST_RELIGIOUS', requiresEntity: true, applicableEntityTypes: ['TRUST', 'SOCIETY'], defaultEntityType: 'TRUST' },
  { profileKey: 'INST_HOUSING_SOCIETY', requiresEntity: true, applicableEntityTypes: ['SOCIETY'], defaultEntityType: 'SOCIETY' },
  { profileKey: 'INST_COOPERATIVE', requiresEntity: true, applicableEntityTypes: ['SOCIETY'], defaultEntityType: 'SOCIETY' },
  { profileKey: 'INST_CLUB', requiresEntity: true, applicableEntityTypes: ['TRUST', 'SOCIETY'], defaultEntityType: 'SOCIETY' },
  { profileKey: 'INST_PROFESSIONAL_BODY', requiresEntity: true, applicableEntityTypes: ['TRUST', 'SOCIETY'], defaultEntityType: 'SOCIETY' },
  { profileKey: 'INST_FPO', requiresEntity: true, applicableEntityTypes: ['PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'INSTITUTIONAL_OTHER', requiresEntity: true, applicableEntityTypes: ['TRUST', 'SOCIETY', 'PRIVATE_LIMITED'], defaultEntityType: 'TRUST' },

  // =====================================================
  // STARTUP Profiles - All need entity (22 profiles)
  // =====================================================
  // By Registration
  { profileKey: 'STARTUP_DPIIT', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_MSME_UDYAM', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PRIVATE_LIMITED' },
  // By Funding Stage
  { profileKey: 'STARTUP_BOOTSTRAPPED', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'LLP' },
  { profileKey: 'STARTUP_FAMILY_FUNDED', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_ANGEL_FUNDED', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_SEED_FUNDED', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_VC_FUNDED', requiresEntity: true, applicableEntityTypes: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED_UNLISTED', 'PUBLIC_LIMITED_LISTED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_GOVT_GRANT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PRIVATE_LIMITED' },
  // By Support
  { profileKey: 'STARTUP_INCUBATOR', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_ACCELERATOR', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  // By Sector
  { profileKey: 'STARTUP_TECH_IT', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_FINTECH', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_EDTECH', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_HEALTHTECH', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_AGRITECH', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_ECOMMERCE', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_D2C', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_LOGISTICS', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_FOODTECH', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_SOCIAL', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED', 'TRUST', 'SOCIETY'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_HARDWARE', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_CLEANTECH', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'STARTUP_OTHER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PRIVATE_LIMITED' },

  // =====================================================
  // REAL_ESTATE Profiles - All need entity (17 profiles)
  // =====================================================
  // Developers
  { profileKey: 'REALESTATE_DEVELOPER_SMALL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'REALESTATE_DEVELOPER_MEDIUM', requiresEntity: true, applicableEntityTypes: ['PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED_UNLISTED', 'PUBLIC_LIMITED_LISTED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'REALESTATE_DEVELOPER_LARGE', requiresEntity: true, applicableEntityTypes: ['LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED_UNLISTED', 'PUBLIC_LIMITED_LISTED'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'REALESTATE_BUILDER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  // Contractors
  { profileKey: 'REALESTATE_CIVIL_CONTRACTOR', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'REALESTATE_INTERIOR_CONTRACTOR', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'REALESTATE_ELECTRICAL_CONTRACTOR', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'REALESTATE_PLUMBING_CONTRACTOR', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'REALESTATE_PAINTING_CONTRACTOR', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED'], defaultEntityType: 'PROPRIETORSHIP' },
  // Brokers & Dealers
  { profileKey: 'REALESTATE_BROKER_RERA', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'REALESTATE_BROKER_GENERAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'REALESTATE_PROPERTY_DEALER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Land Development
  { profileKey: 'REALESTATE_LAND_DEVELOPER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PRIVATE_LIMITED' },
  { profileKey: 'REALESTATE_LAYOUT_DEVELOPER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PRIVATE_LIMITED' },
  // Services
  { profileKey: 'REALESTATE_PROPERTY_MANAGER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'REALESTATE_ARCHITECT_FIRM', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'LLP' },
  { profileKey: 'REALESTATE_BUILDING_MATERIAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'REAL_ESTATE_OTHER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },

  // =====================================================
  // AGENT Profiles - All need entity (34 profiles)
  // Insurance agents, commission agents, intermediaries
  // Entity types: All except SOCIETY and TRUST
  // =====================================================
  // Insurance Agents - Life
  { profileKey: 'AGENT_LIC', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_LIFE_INSURANCE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_TERM_INSURANCE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Insurance Agents - Health
  { profileKey: 'AGENT_HEALTH_INSURANCE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_MEDICLAIM', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Insurance Agents - General
  { profileKey: 'AGENT_GENERAL_INSURANCE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_MOTOR_INSURANCE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_FIRE_INSURANCE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_MARINE_INSURANCE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_CROP_INSURANCE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Insurance - Corporate & Specialized
  { profileKey: 'AGENT_CORPORATE_INSURANCE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'LLP' },
  { profileKey: 'AGENT_RURAL_INSURANCE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_POSP', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_INSURANCE_BROKER', requiresEntity: true, applicableEntityTypes: ['PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'LLP' },
  { profileKey: 'AGENT_COMPOSITE_INSURANCE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Financial Agents
  { profileKey: 'AGENT_MUTUAL_FUND', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_STOCK_BROKER_SUB', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_LOAN_DSA', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_BC_AGENT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  // Commission Agents - Trade
  { profileKey: 'AGENT_COMMISSION_GENERAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_COMMISSION_AGRI', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_COMMISSION_TEXTILE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_COMMISSION_METAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_COMMISSION_FOOD', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Logistics & Trade Agents
  { profileKey: 'AGENT_CHA', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_CFA', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_FREIGHT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_TRANSPORT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Service Agents
  { profileKey: 'AGENT_REAL_ESTATE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_TRAVEL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_RECRUITMENT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_ADVERTISING', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'LLP' },
  { profileKey: 'AGENT_FRANCHISE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'AGENT_OTHER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED_UNLISTED', 'PUBLIC_LIMITED_LISTED','OPC', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },

  // =====================================================
  // MICRO_ENTERPRISE Profiles - All need entity (23 profiles)
  // Street vendors and micro businesses
  // =====================================================
  { profileKey: 'MICRO_SVANIDHI', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_HAWKER_MOBILE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_HAWKER_STATIONARY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_KIOSK', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_PAN_SHOP', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_TEA_STALL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_FOOD_CART', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_FRUIT_VEGETABLE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_FLOWER_VENDOR', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_NEWSPAPER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_MOBILE_RECHARGE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_HOME_BUSINESS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_TIFFIN_SERVICE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_PAPAD_PICKLE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_TAILORING', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_CYCLE_REPAIR', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_COBBLER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_LAUNDRY_PRESS', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_AUTO_RICKSHAW', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_E_RICKSHAW', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_TAXI_OWNER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_XEROX_CYBER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_GENERAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'MICRO_ENTERPRISE_OTHER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },

  // =====================================================
  // ARTISAN_CRAFTSMEN Profiles - All need entity (30 profiles)
  // Traditional artisans and craftsmen
  // =====================================================
  // Textile & Weaving
  { profileKey: 'ARTISAN_HANDICRAFT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_HANDLOOM', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_POWERLOOM', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_KHADI', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_EMBROIDERY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_BLOCK_PRINTER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_BATIK', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Pottery & Clay
  { profileKey: 'ARTISAN_POTTER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_TERRACOTTA', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Wood Work
  { profileKey: 'ARTISAN_CARPENTER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_FURNITURE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','LLP', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_WOOD_CARVER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Metal Work
  { profileKey: 'ARTISAN_BLACKSMITH', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_BRASS_WORKER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_GOLDSMITH', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_SILVERSMITH', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Stone Work
  { profileKey: 'ARTISAN_STONE_CARVER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_MARBLE_INLAY', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Natural Fiber
  { profileKey: 'ARTISAN_BAMBOO_CANE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_BASKET_WEAVER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  // Leather & Paper
  { profileKey: 'ARTISAN_LEATHER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_PAPIER_MACHE', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Traditional Crafts
  { profileKey: 'ARTISAN_DHOKRA', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_KALAMKARI', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_BIDRI', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_MEENAKARI', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  // Specialty Items
  { profileKey: 'ARTISAN_TOY_MAKER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_MUSICAL_INSTRUMENT', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_BIDI_AGARBATTI', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_GENERAL', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'ARTISAN_CRAFTSMEN_OTHER', requiresEntity: true, applicableEntityTypes: ['PROPRIETORSHIP', 'PARTNERSHIP_REGISTERED', 'PARTNERSHIP_UNREGISTERED','HUF'], defaultEntityType: 'PROPRIETORSHIP' },
]

/**
 * Profiles that do NOT require entity selection
 * These are individual/salaried/non-business profiles
 *
 * Updated: Comprehensive list for all 400+ profiles
 */
export const PROFILES_WITHOUT_ENTITY = [
  // =====================================================
  // INDIVIDUAL Profiles (3)
  // =====================================================
  'INDIVIDUAL_GENERAL', 'INDIVIDUAL_HOMEMAKER', 'INDIVIDUAL_DEPENDENT', 'INDIVIDUAL_OTHER',

  // =====================================================
  // SALARIED Profiles (30) - All don't need entity
  // Employees with fixed salary from employer
  // =====================================================
  // Government Employees
  'SALARIED_CENTRAL_GOVT', 'SALARIED_STATE_GOVT', 'SALARIED_PSU', 'SALARIED_DEFENCE',
  'SALARIED_PARAMILITARY', 'SALARIED_RAILWAYS', 'SALARIED_JUDICIARY', 'SALARIED_MUNICIPAL',
  // Banking & Insurance
  'SALARIED_BANK_PUBLIC', 'SALARIED_BANK_PRIVATE', 'SALARIED_INSURANCE',
  // Private Sector
  'SALARIED_PRIVATE_LARGE', 'SALARIED_PRIVATE_MNC', 'SALARIED_PRIVATE_SME', 'SALARIED_IT_TECH',
  // Education & Healthcare
  'SALARIED_TEACHER_GOVT', 'SALARIED_TEACHER_PRIVATE', 'SALARIED_NURSE', 'SALARIED_PARAMEDICAL',
  // Employed Professionals
  'SALARIED_DOCTOR', 'SALARIED_DENTIST', 'SALARIED_CA', 'SALARIED_CS', 'SALARIED_CMA',
  'SALARIED_ARCHITECT', 'SALARIED_LAWYER', 'SALARIED_ENGINEER', 'SALARIED_PHARMACIST',
  // Employment Type
  'SALARIED_CONTRACT', 'SALARIED_PROBATION', 'SALARIED_OTHER',

  // =====================================================
  // PENSIONER Profiles (18) - All don't need entity
  // =====================================================
  'PENSIONER_CENTRAL_GOVT', 'PENSIONER_STATE_GOVT',
  'PENSIONER_DEFENCE_ARMY', 'PENSIONER_DEFENCE_NAVY', 'PENSIONER_DEFENCE_AIRFORCE',
  'PENSIONER_PARAMILITARY', 'PENSIONER_POLICE',
  'PENSIONER_RAILWAYS', 'PENSIONER_PSU', 'PENSIONER_JUDICIARY', 'PENSIONER_TEACHER',
  'PENSIONER_BANK_PUBLIC', 'PENSIONER_BANK_PRIVATE', 'PENSIONER_INSURANCE',
  'PENSIONER_FAMILY', 'PENSIONER_DISABILITY', 'PENSIONER_FREEDOM_FIGHTER', 'PENSIONER_POLITICAL',
  'PENSIONER_OTHER',

  // =====================================================
  // RETIRED Profiles (9) - All don't need entity
  // =====================================================
  'RETIRED_PRIVATE_EMPLOYEE', 'RETIRED_PROFESSIONAL', 'RETIRED_BUSINESSMAN',
  'RETIRED_SHOPKEEPER', 'RETIRED_VRS', 'RETIRED_NRI_RETURNED',
  'RETIRED_GRATUITY_HOLDER', 'RETIRED_INVESTMENT_INCOME', 'RETIRED_GENERAL', 'RETIRED_OTHER',

  // =====================================================
  // NRI Profiles (16) - Most don't need entity (except NRI_BUSINESSMAN)
  // =====================================================
  // Salaried NRIs
  'NRI_SALARIED_GULF', 'NRI_SALARIED_USA', 'NRI_SALARIED_UK_EUROPE', 'NRI_SALARIED_CANADA',
  'NRI_SALARIED_AUSTRALIA', 'NRI_SALARIED_SINGAPORE', 'NRI_SALARIED_AFRICA', 'NRI_SALARIED_OTHER',
  // Professionals
  'NRI_DOCTOR', 'NRI_CA_CS', 'NRI_PROFESSIONAL',
  // Specialized NRI
  'NRI_SEAFARER', 'NRI_AIRLINE_CREW',
  // PIO/OCI
  'NRI_PIO', 'NRI_OCI', 'NRI_OTHER',

  // =====================================================
  // WOMEN Profiles (12) - Most don't need entity (except WOMEN_ENTREPRENEUR)
  // =====================================================
  'WOMEN_PROFESSIONAL', 'WOMEN_SALARIED', 'WOMEN_FARMER',
  'WOMEN_SHG_MEMBER', 'WOMEN_SHG_LEADER', 'WOMEN_ARTISAN',
  'WOMEN_SINGLE', 'WOMEN_WIDOW', 'WOMEN_DIVORCEE', 'WOMEN_DESERTED',
  'WOMEN_HOMEMAKER', 'WOMEN_MUDRA', 'WOMEN_OTHER',

  // =====================================================
  // STUDENT Profiles (17) - All don't need entity
  // =====================================================
  // India Studies
  'STUDENT_UG_INDIA', 'STUDENT_PG_INDIA', 'STUDENT_PHD_INDIA',
  // Study Abroad
  'STUDENT_UG_ABROAD', 'STUDENT_PG_ABROAD', 'STUDENT_PHD_ABROAD',
  // Professional Courses
  'STUDENT_MEDICAL', 'STUDENT_ENGINEERING', 'STUDENT_MBA', 'STUDENT_LAW',
  'STUDENT_CA_CS_CMA', 'STUDENT_NURSING',
  // Vocational & Others
  'STUDENT_DIPLOMA_ITI', 'STUDENT_VOCATIONAL', 'STUDENT_COMPETITIVE',
  'STUDENT_DISTANCE', 'STUDENT_WORKING', 'STUDENT_OTHER',

  // =====================================================
  // SPECIAL Profiles (18) - All don't need entity
  // =====================================================
  // Income Based
  'SPECIAL_RENTAL_INCOME', 'SPECIAL_DIVIDEND_INCOME', 'SPECIAL_ROYALTY_INCOME',
  // Age Based
  'SPECIAL_SENIOR_CITIZEN', 'SPECIAL_SUPER_SENIOR',
  // Credit History
  'SPECIAL_FIRST_TIME_BORROWER',
  // Reserved Categories
  'SPECIAL_EX_SERVICEMEN', 'SPECIAL_DIFFERENTLY_ABLED',
  'SPECIAL_SC', 'SPECIAL_ST', 'SPECIAL_OBC', 'SPECIAL_MINORITY',
  'SPECIAL_EWS', 'SPECIAL_BPL', 'SPECIAL_TRANSGENDER',
  // Special Circumstances
  'SPECIAL_WIDOW', 'SPECIAL_DESERTED', 'SPECIAL_DISASTER_AFFECTED', 'SPECIAL_OTHER',
]

/**
 * GIG_ECONOMY profiles with OPTIONAL entity selection
 * These profiles can optionally select an entity (for those who have registered business)
 * but can also proceed as 'Individual' without formal entity
 *
 * Flow: Show entity selection with an additional 'Individual (No Entity)' option
 */
export const GIG_ECONOMY_ENTITY_OPTIONAL: ProfileEntityMapping[] = [
  // IT & Tech Freelancers
  { profileKey: 'GIG_FREELANCER_IT', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_FREELANCER_DESIGN', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_FREELANCER_WRITER', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_FREELANCER_MARKETING', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_FREELANCER_DATA', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_FREELANCER_FINANCE', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_FREELANCER_LEGAL', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_FREELANCER_TRANSLATOR', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  // Content Creators
  { profileKey: 'GIG_CONTENT_YOUTUBER', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP', 'OPC', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_CONTENT_INFLUENCER', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP', 'OPC', 'PRIVATE_LIMITED'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_CONTENT_BLOGGER', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_CONTENT_PODCASTER', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  // App-Based Delivery
  { profileKey: 'GIG_DELIVERY_FOOD', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_DELIVERY_ECOMMERCE', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  // App-Based Transport
  { profileKey: 'GIG_DRIVER_CAB', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_DRIVER_BIKE_TAXI', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  // Home Services
  { profileKey: 'GIG_SERVICE_URBAN_COMPANY', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP'], defaultEntityType: 'PROPRIETORSHIP' },
  // Education & Creative
  { profileKey: 'GIG_TUTOR_ONLINE', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_PHOTOGRAPHER', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_ARTIST_MUSICIAN', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  // Professional Gig
  { profileKey: 'GIG_CONSULTANT', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_VIRTUAL_ASSISTANT', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_GENERAL', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
  { profileKey: 'GIG_ECONOMY_OTHER', requiresEntity: false, applicableEntityTypes: ['PROPRIETORSHIP', 'LLP', 'OPC'], defaultEntityType: 'PROPRIETORSHIP' },
]

// NRI profiles that can optionally have entity (kept for backward compatibility)
export const NRI_ENTITY_OPTIONAL = ['NRI_BUSINESSMAN']

// ============================================================================
// DOCUMENT REQUIREMENTS BY PROFILE TYPE
// ============================================================================

export interface DocumentRequirement {
  key: string
  name: string
  description: string
  isRequired: boolean
  isRequiredForLoan: boolean
  acceptedFormats: string[]
  maxSizeMB: number
}

export const COMMON_INDIVIDUAL_DOCUMENTS: DocumentRequirement[] = [
  { key: 'PAN_CARD', name: 'PAN Card', description: 'Permanent Account Number card', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: 'AADHAR_CARD', name: 'Aadhaar Card', description: 'UID/Aadhaar card (front & back)', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: 'PHOTO', name: 'Passport Photo', description: 'Recent passport size photograph', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['jpg', 'jpeg', 'png'], maxSizeMB: 2 },
  { key: 'SIGNATURE', name: 'Signature', description: 'Digital signature on white paper', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['jpg', 'jpeg', 'png'], maxSizeMB: 1 },
]

export const SALARIED_DOCUMENTS: DocumentRequirement[] = [
  ...COMMON_INDIVIDUAL_DOCUMENTS,
  { key: 'SALARY_SLIP', name: 'Salary Slips', description: 'Last 3 months salary slips', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 10 },
  { key: 'FORM_16', name: 'Form 16', description: 'Latest Form 16 from employer', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 10 },
  { key: 'BANK_STATEMENT', name: 'Bank Statement', description: 'Last 6 months bank statement (salary account)', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 20 },
  { key: 'EMPLOYMENT_LETTER', name: 'Employment Letter', description: 'Current employment/offer letter', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: 'ID_CARD', name: 'Employee ID Card', description: 'Current employer ID card', isRequired: false, isRequiredForLoan: false, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 2 },
]

export const SELF_EMPLOYED_INDIVIDUAL_DOCUMENTS: DocumentRequirement[] = [
  ...COMMON_INDIVIDUAL_DOCUMENTS,
  { key: 'ITR', name: 'Income Tax Returns', description: 'Last 2-3 years ITR with computation', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 20 },
  { key: 'BANK_STATEMENT', name: 'Bank Statement', description: 'Last 12 months bank statement', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 20 },
  { key: 'GST_RETURNS', name: 'GST Returns', description: 'Last 12 months GST returns (if applicable)', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 20 },
  { key: 'PROFESSIONAL_CERT', name: 'Professional Certificate', description: 'Degree/License/Registration certificate', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
]

export const BUSINESS_ENTITY_DOCUMENTS: DocumentRequirement[] = [
  { key: 'ENTITY_PAN', name: 'Entity PAN Card', description: 'PAN card of the business entity', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: 'GST_CERTIFICATE', name: 'GST Certificate', description: 'GST registration certificate', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: 'SHOP_ACT', name: 'Shop & Establishment', description: 'Shop act license / Gumasta', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: 'UDYAM_CERT', name: 'Udyam Certificate', description: 'MSME/Udyam registration certificate', isRequired: false, isRequiredForLoan: false, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: 'ITR_ENTITY', name: 'Entity ITR', description: 'Last 2-3 years ITR of entity', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 20 },
  { key: 'BANK_STATEMENT_ENTITY', name: 'Entity Bank Statement', description: 'Last 12 months bank statement of entity', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 20 },
  { key: 'BALANCE_SHEET', name: 'Balance Sheet', description: 'Audited balance sheet (if applicable)', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 20 },
  { key: 'PROFIT_LOSS', name: 'Profit & Loss Statement', description: 'Audited P&L statement', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 20 },
]

// Entity-specific documents
export const PARTNERSHIP_DOCUMENTS: DocumentRequirement[] = [
  { key: 'PARTNERSHIP_DEED', name: 'Partnership Deed', description: 'Registered partnership deed', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 10 },
  { key: 'FIRM_REGISTRATION', name: 'Firm Registration', description: 'Registrar of Firms certificate (if registered)', isRequired: false, isRequiredForLoan: false, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
]

export const COMPANY_DOCUMENTS: DocumentRequirement[] = [
  { key: 'MOA_AOA', name: 'MOA & AOA', description: 'Memorandum and Articles of Association', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 20 },
  { key: 'INCORPORATION_CERT', name: 'Certificate of Incorporation', description: 'Company incorporation certificate', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: 'BOARD_RESOLUTION', name: 'Board Resolution', description: 'Board resolution for loan application', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 5 },
  { key: 'AUDITED_FINANCIALS', name: 'Audited Financials', description: 'Last 2-3 years audited financial statements', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 30 },
]

export const LLP_DOCUMENTS: DocumentRequirement[] = [
  { key: 'LLP_AGREEMENT', name: 'LLP Agreement', description: 'LLP agreement document', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 20 },
  { key: 'LLP_INCORPORATION', name: 'Certificate of Incorporation', description: 'LLP incorporation certificate', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
]

export const TRUST_DOCUMENTS: DocumentRequirement[] = [
  { key: 'TRUST_DEED', name: 'Trust Deed', description: 'Registered trust deed', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 20 },
  { key: 'TRUST_REGISTRATION', name: 'Trust Registration', description: 'Registration certificate', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: '12A_80G', name: '12A/80G Certificate', description: '12A and 80G certificates (if applicable)', isRequired: false, isRequiredForLoan: false, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
]

export const AGRICULTURE_DOCUMENTS: DocumentRequirement[] = [
  ...COMMON_INDIVIDUAL_DOCUMENTS,
  { key: 'LAND_RECORDS', name: 'Land Records', description: '7/12 extract, RTC, Patta, Khatauni', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 10 },
  { key: 'KISAN_CREDIT', name: 'Kisan Credit Card', description: 'Existing KCC details (if any)', isRequired: false, isRequiredForLoan: false, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: 'CROP_INSURANCE', name: 'Crop Insurance', description: 'PMFBY or other crop insurance documents', isRequired: false, isRequiredForLoan: false, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
]

export const NRI_DOCUMENTS: DocumentRequirement[] = [
  ...COMMON_INDIVIDUAL_DOCUMENTS,
  { key: 'PASSPORT', name: 'Passport', description: 'Valid passport with visa pages', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 10 },
  { key: 'VISA', name: 'Visa / Work Permit', description: 'Valid visa or work permit', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: 'OVERSEAS_ADDRESS', name: 'Overseas Address Proof', description: 'Utility bill or bank statement from overseas', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: 'OVERSEAS_EMPLOYMENT', name: 'Employment Proof', description: 'Employment letter/contract from overseas employer', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: 'NRE_NRO_STATEMENT', name: 'NRE/NRO Account Statement', description: 'Last 6 months NRE/NRO account statement', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf'], maxSizeMB: 20 },
]

export const STUDENT_DOCUMENTS: DocumentRequirement[] = [
  ...COMMON_INDIVIDUAL_DOCUMENTS,
  { key: 'ADMISSION_LETTER', name: 'Admission Letter', description: 'Admission/offer letter from institution', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: 'FEE_STRUCTURE', name: 'Fee Structure', description: 'Course fee structure/estimate', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 5 },
  { key: 'PREVIOUS_MARKSHEET', name: 'Previous Marksheets', description: 'Latest educational qualification marksheets', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 10 },
  { key: 'CO_APPLICANT_DOCS', name: 'Co-Applicant Documents', description: 'Parent/Guardian KYC and income documents', isRequired: false, isRequiredForLoan: true, acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeMB: 20 },
]

// ============================================================================
// FORM FIELD SECTIONS
// ============================================================================

export interface FormFieldDefinition {
  key: string
  label: string
  type: 'text' | 'email' | 'phone' | 'number' | 'date' | 'select' | 'textarea' | 'radio' | 'checkbox' | 'file' | 'currency'
  placeholder?: string
  helpText?: string
  isRequired: boolean
  isRequiredForLoan: boolean
  validationRules?: {
    minLength?: number
    maxLength?: number
    pattern?: string
    min?: number
    max?: number
  }
  options?: Array<{ value: string; label: string }>
  dependsOn?: { field: string; value: string | string[] }
}

export interface FormSection {
  key: string
  title: string
  description: string
  icon: string
  fields: FormFieldDefinition[]
}

// Personal Information Section (common to all individuals)
export const PERSONAL_INFO_SECTION: FormSection = {
  key: 'personal',
  title: 'Personal Information',
  description: 'Basic personal details',
  icon: 'User',
  fields: [
    { key: 'full_name', label: 'Full Name (as per PAN)', type: 'text', placeholder: 'Enter full name', isRequired: false, isRequiredForLoan: true, validationRules: { minLength: 2, maxLength: 100 } },
    { key: 'father_name', label: "Father's Name", type: 'text', placeholder: "Enter father's name", isRequired: false, isRequiredForLoan: true },
    { key: 'mother_name', label: "Mother's Name", type: 'text', placeholder: "Enter mother's name", isRequired: false, isRequiredForLoan: false },
    { key: 'date_of_birth', label: 'Date of Birth', type: 'date', isRequired: false, isRequiredForLoan: true },
    { key: 'gender', label: 'Gender', type: 'select', isRequired: false, isRequiredForLoan: true, options: [
      { value: 'MALE', label: 'Male' },
      { value: 'FEMALE', label: 'Female' },
      { value: 'OTHER', label: 'Other' }
    ]},
    { key: 'marital_status', label: 'Marital Status', type: 'select', isRequired: false, isRequiredForLoan: true, options: [
      { value: 'SINGLE', label: 'Single' },
      { value: 'MARRIED', label: 'Married' },
      { value: 'DIVORCED', label: 'Divorced' },
      { value: 'WIDOWED', label: 'Widowed' }
    ]},
    { key: 'spouse_name', label: 'Spouse Name', type: 'text', placeholder: 'Enter spouse name', isRequired: false, isRequiredForLoan: false, dependsOn: { field: 'marital_status', value: 'MARRIED' } },
    { key: 'education', label: 'Highest Education', type: 'select', isRequired: false, isRequiredForLoan: true, options: [
      { value: 'BELOW_10TH', label: 'Below 10th' },
      { value: '10TH', label: '10th Pass' },
      { value: '12TH', label: '12th Pass' },
      { value: 'GRADUATE', label: 'Graduate' },
      { value: 'POST_GRADUATE', label: 'Post Graduate' },
      { value: 'PROFESSIONAL', label: 'Professional Degree' },
      { value: 'DOCTORATE', label: 'Doctorate' }
    ]},
  ]
}

// Contact Information Section
export const CONTACT_INFO_SECTION: FormSection = {
  key: 'contact',
  title: 'Contact Information',
  description: 'Phone, email and communication preferences',
  icon: 'Phone',
  fields: [
    { key: 'mobile_primary', label: 'Primary Mobile Number', type: 'phone', placeholder: '10-digit mobile number', isRequired: false, isRequiredForLoan: true, validationRules: { pattern: '^[6-9]\\d{9}$' } },
    { key: 'mobile_alternate', label: 'Alternate Mobile Number', type: 'phone', placeholder: '10-digit mobile number', isRequired: false, isRequiredForLoan: false },
    { key: 'email', label: 'Email Address', type: 'email', placeholder: 'Enter email address', isRequired: false, isRequiredForLoan: true },
    { key: 'whatsapp_number', label: 'WhatsApp Number', type: 'phone', placeholder: 'WhatsApp number (if different)', isRequired: false, isRequiredForLoan: false },
  ]
}

// Current Address Section
export const CURRENT_ADDRESS_SECTION: FormSection = {
  key: 'current_address',
  title: 'Current Address',
  description: 'Where you currently reside',
  icon: 'MapPin',
  fields: [
    { key: 'current_address_line1', label: 'Address Line 1', type: 'text', placeholder: 'House/Flat No., Building Name', isRequired: false, isRequiredForLoan: true },
    { key: 'current_address_line2', label: 'Address Line 2', type: 'text', placeholder: 'Street, Area, Landmark', isRequired: false, isRequiredForLoan: false },
    { key: 'current_city', label: 'City', type: 'text', placeholder: 'City name', isRequired: false, isRequiredForLoan: true },
    { key: 'current_district', label: 'District', type: 'text', placeholder: 'District name', isRequired: false, isRequiredForLoan: true },
    { key: 'current_state', label: 'State', type: 'select', isRequired: false, isRequiredForLoan: true, options: [] }, // Will be populated dynamically
    { key: 'current_pincode', label: 'PIN Code', type: 'text', placeholder: '6-digit PIN code', isRequired: false, isRequiredForLoan: true, validationRules: { pattern: '^[1-9]\\d{5}$' } },
    { key: 'current_residence_type', label: 'Residence Type', type: 'select', isRequired: false, isRequiredForLoan: true, options: [
      { value: 'OWNED', label: 'Owned' },
      { value: 'RENTED', label: 'Rented' },
      { value: 'COMPANY_PROVIDED', label: 'Company Provided' },
      { value: 'PARENTAL', label: 'Parental' },
      { value: 'PG_HOSTEL', label: 'PG/Hostel' }
    ]},
    { key: 'current_residence_since', label: 'Residing Since', type: 'date', helpText: 'When did you start living here?', isRequired: false, isRequiredForLoan: true },
  ]
}

// Permanent Address Section
export const PERMANENT_ADDRESS_SECTION: FormSection = {
  key: 'permanent_address',
  title: 'Permanent Address',
  description: 'Your permanent/native address',
  icon: 'Home',
  fields: [
    { key: 'same_as_current', label: 'Same as Current Address', type: 'checkbox', isRequired: false, isRequiredForLoan: false },
    { key: 'permanent_address_line1', label: 'Address Line 1', type: 'text', placeholder: 'House/Flat No., Building Name', isRequired: false, isRequiredForLoan: true, dependsOn: { field: 'same_as_current', value: ['false', ''] } },
    { key: 'permanent_address_line2', label: 'Address Line 2', type: 'text', placeholder: 'Street, Area, Landmark', isRequired: false, isRequiredForLoan: false, dependsOn: { field: 'same_as_current', value: ['false', ''] } },
    { key: 'permanent_city', label: 'City', type: 'text', placeholder: 'City name', isRequired: false, isRequiredForLoan: true, dependsOn: { field: 'same_as_current', value: ['false', ''] } },
    { key: 'permanent_district', label: 'District', type: 'text', placeholder: 'District name', isRequired: false, isRequiredForLoan: true, dependsOn: { field: 'same_as_current', value: ['false', ''] } },
    { key: 'permanent_state', label: 'State', type: 'select', isRequired: false, isRequiredForLoan: true, options: [], dependsOn: { field: 'same_as_current', value: ['false', ''] } },
    { key: 'permanent_pincode', label: 'PIN Code', type: 'text', placeholder: '6-digit PIN code', isRequired: false, isRequiredForLoan: true, validationRules: { pattern: '^[1-9]\\d{5}$' }, dependsOn: { field: 'same_as_current', value: ['false', ''] } },
  ]
}

// KYC Section
export const KYC_SECTION: FormSection = {
  key: 'kyc',
  title: 'KYC Details',
  description: 'Identity and verification documents',
  icon: 'FileCheck',
  fields: [
    { key: 'pan_number', label: 'PAN Number', type: 'text', placeholder: 'ABCDE1234F', isRequired: false, isRequiredForLoan: true, validationRules: { pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$' } },
    { key: 'aadhar_number', label: 'Aadhaar Number', type: 'text', placeholder: '12-digit Aadhaar number', isRequired: false, isRequiredForLoan: true, validationRules: { pattern: '^[2-9]\\d{11}$' } },
    { key: 'voter_id', label: 'Voter ID', type: 'text', placeholder: 'Voter ID number (optional)', isRequired: false, isRequiredForLoan: false },
    { key: 'driving_license', label: 'Driving License', type: 'text', placeholder: 'DL number (optional)', isRequired: false, isRequiredForLoan: false },
    { key: 'passport_number', label: 'Passport Number', type: 'text', placeholder: 'Passport number (optional)', isRequired: false, isRequiredForLoan: false },
  ]
}

// Employment Section (for salaried)
export const EMPLOYMENT_SECTION: FormSection = {
  key: 'employment',
  title: 'Employment Details',
  description: 'Current employment information',
  icon: 'Briefcase',
  fields: [
    { key: 'employer_name', label: 'Employer Name', type: 'text', placeholder: 'Company/Organization name', isRequired: false, isRequiredForLoan: true },
    { key: 'employer_type', label: 'Employer Type', type: 'select', isRequired: false, isRequiredForLoan: true, options: [
      { value: 'CENTRAL_GOVT', label: 'Central Government' },
      { value: 'STATE_GOVT', label: 'State Government' },
      { value: 'PSU', label: 'PSU' },
      { value: 'PRIVATE', label: 'Private Company' },
      { value: 'MNC', label: 'MNC' },
      { value: 'BANK', label: 'Bank/NBFC' },
      { value: 'DEFENCE', label: 'Defence' },
      { value: 'OTHER', label: 'Other' }
    ]},
    { key: 'designation', label: 'Designation', type: 'text', placeholder: 'Current job title', isRequired: false, isRequiredForLoan: true },
    { key: 'department', label: 'Department', type: 'text', placeholder: 'Department name', isRequired: false, isRequiredForLoan: false },
    { key: 'employee_id', label: 'Employee ID', type: 'text', placeholder: 'Employee ID/Staff No.', isRequired: false, isRequiredForLoan: false },
    { key: 'employment_type', label: 'Employment Type', type: 'select', isRequired: false, isRequiredForLoan: true, options: [
      { value: 'PERMANENT', label: 'Permanent' },
      { value: 'CONTRACT', label: 'Contract' },
      { value: 'PROBATION', label: 'Probation' },
      { value: 'TEMPORARY', label: 'Temporary' }
    ]},
    { key: 'date_of_joining', label: 'Date of Joining', type: 'date', isRequired: false, isRequiredForLoan: true },
    { key: 'total_experience_years', label: 'Total Experience (Years)', type: 'number', placeholder: 'Total work experience', isRequired: false, isRequiredForLoan: true, validationRules: { min: 0, max: 60 } },
    { key: 'office_address', label: 'Office Address', type: 'textarea', placeholder: 'Complete office address', isRequired: false, isRequiredForLoan: true },
    { key: 'office_pincode', label: 'Office PIN Code', type: 'text', placeholder: '6-digit PIN code', isRequired: false, isRequiredForLoan: true, validationRules: { pattern: '^[1-9]\\d{5}$' } },
  ]
}

// Income Section
export const INCOME_SECTION: FormSection = {
  key: 'income',
  title: 'Income Details',
  description: 'Monthly income and other earnings',
  icon: 'IndianRupee',
  fields: [
    { key: 'gross_monthly_salary', label: 'Gross Monthly Salary', type: 'currency', placeholder: 'Monthly salary before deductions', isRequired: false, isRequiredForLoan: true },
    { key: 'net_monthly_salary', label: 'Net Monthly Salary', type: 'currency', placeholder: 'Take-home salary', isRequired: false, isRequiredForLoan: true },
    { key: 'other_income', label: 'Other Monthly Income', type: 'currency', placeholder: 'Rental, investment, etc.', isRequired: false, isRequiredForLoan: false },
    { key: 'other_income_source', label: 'Source of Other Income', type: 'text', placeholder: 'Describe other income sources', isRequired: false, isRequiredForLoan: false, dependsOn: { field: 'other_income', value: [] } }, // Show if other_income > 0
  ]
}

// Bank Details Section
export const BANK_DETAILS_SECTION: FormSection = {
  key: 'bank_details',
  title: 'Bank Account Details',
  description: 'Primary bank account for loan disbursement',
  icon: 'Landmark',
  fields: [
    { key: 'bank_name', label: 'Bank Name', type: 'text', placeholder: 'Bank name', isRequired: false, isRequiredForLoan: true },
    { key: 'branch_name', label: 'Branch Name', type: 'text', placeholder: 'Branch name', isRequired: false, isRequiredForLoan: true },
    { key: 'account_number', label: 'Account Number', type: 'text', placeholder: 'Bank account number', isRequired: false, isRequiredForLoan: true },
    { key: 'ifsc_code', label: 'IFSC Code', type: 'text', placeholder: 'IFSC code', isRequired: false, isRequiredForLoan: true, validationRules: { pattern: '^[A-Z]{4}0[A-Z0-9]{6}$' } },
    { key: 'account_type', label: 'Account Type', type: 'select', isRequired: false, isRequiredForLoan: true, options: [
      { value: 'SAVINGS', label: 'Savings' },
      { value: 'CURRENT', label: 'Current' },
      { value: 'SALARY', label: 'Salary Account' },
      { value: 'NRE', label: 'NRE Account' },
      { value: 'NRO', label: 'NRO Account' }
    ]},
    { key: 'account_holder_name', label: 'Account Holder Name', type: 'text', placeholder: 'Name as per bank records', isRequired: false, isRequiredForLoan: true },
  ]
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a profile requires entity selection
 */
export function doesProfileRequireEntity(profileKey: string): boolean {
  const mapping = PROFILES_REQUIRING_ENTITY.find(m => m.profileKey === profileKey)
  return mapping?.requiresEntity ?? false
}

/**
 * Check if a profile has OPTIONAL entity selection (GIG_ECONOMY)
 * These profiles can choose to have an entity or proceed as individual
 */
export function isEntityOptionalForProfile(profileKey: string): boolean {
  const mapping = GIG_ECONOMY_ENTITY_OPTIONAL.find(m => m.profileKey === profileKey)
  return mapping !== undefined
}

/**
 * Get the entity requirement status for a profile
 * Returns: 'required' | 'optional' | 'not_required'
 */
export function getEntityRequirementStatus(profileKey: string): 'required' | 'optional' | 'not_required' {
  if (doesProfileRequireEntity(profileKey)) {
    return 'required'
  }
  if (isEntityOptionalForProfile(profileKey)) {
    return 'optional'
  }
  return 'not_required'
}

/**
 * Get applicable entity types for a profile
 * Checks both required and optional entity arrays
 */
export function getApplicableEntityTypes(profileKey: string): string[] {
  // Check required entity profiles first
  const requiredMapping = PROFILES_REQUIRING_ENTITY.find(m => m.profileKey === profileKey)
  if (requiredMapping) {
    return requiredMapping.applicableEntityTypes
  }

  // Check optional entity profiles (GIG_ECONOMY)
  const optionalMapping = GIG_ECONOMY_ENTITY_OPTIONAL.find(m => m.profileKey === profileKey)
  if (optionalMapping) {
    return optionalMapping.applicableEntityTypes
  }

  return []
}

/**
 * Get default entity type for a profile
 * Checks both required and optional entity arrays
 */
export function getDefaultEntityType(profileKey: string): string | undefined {
  // Check required entity profiles first
  const requiredMapping = PROFILES_REQUIRING_ENTITY.find(m => m.profileKey === profileKey)
  if (requiredMapping) {
    return requiredMapping.defaultEntityType
  }

  // Check optional entity profiles (GIG_ECONOMY)
  const optionalMapping = GIG_ECONOMY_ENTITY_OPTIONAL.find(m => m.profileKey === profileKey)
  if (optionalMapping) {
    return optionalMapping.defaultEntityType
  }

  return undefined
}

/**
 * Check if a profile is in the no-entity list
 */
export function isNoEntityProfile(profileKey: string): boolean {
  return PROFILES_WITHOUT_ENTITY.includes(profileKey)
}

/**
 * Get documents required for a profile category
 */
export function getDocumentsForCategory(categoryKey: string): DocumentRequirement[] {
  switch (categoryKey) {
    case 'SALARIED':
      return SALARIED_DOCUMENTS
    case 'PROFESSIONAL':
    case 'MANUFACTURER':
    case 'TRADER':
    case 'SERVICE':
      return SELF_EMPLOYED_INDIVIDUAL_DOCUMENTS
    case 'AGRICULTURE':
      return AGRICULTURE_DOCUMENTS
    case 'NRI':
      return NRI_DOCUMENTS
    case 'STUDENT':
      return STUDENT_DOCUMENTS
    default:
      return COMMON_INDIVIDUAL_DOCUMENTS
  }
}

/**
 * Get documents required for an entity type
 */
export function getDocumentsForEntityType(entityType: string): DocumentRequirement[] {
  const baseDocuments = [...BUSINESS_ENTITY_DOCUMENTS]

  switch (entityType) {
    case 'PARTNERSHIP':
    case 'PARTNERSHIP_REGISTERED':
    case 'PARTNERSHIP_UNREGISTERED':
      return [...baseDocuments, ...PARTNERSHIP_DOCUMENTS]
    case 'PRIVATE_LIMITED':
    case 'PUBLIC_LIMITED':
    case 'PUBLIC_LIMITED_UNLISTED':
    case 'PUBLIC_LIMITED_LISTED':
    case 'OPC':
      return [...baseDocuments, ...COMPANY_DOCUMENTS]
    case 'LLP':
      return [...baseDocuments, ...LLP_DOCUMENTS]
    case 'TRUST':
      return [...baseDocuments, ...TRUST_DOCUMENTS]
    default:
      return baseDocuments
  }
}

/**
 * Get form sections for a profile
 */
export function getFormSectionsForProfile(categoryKey: string, hasEntity: boolean): FormSection[] {
  const sections: FormSection[] = [
    PERSONAL_INFO_SECTION,
    CONTACT_INFO_SECTION,
    CURRENT_ADDRESS_SECTION,
    PERMANENT_ADDRESS_SECTION,
    KYC_SECTION,
  ]

  // Add employment section for salaried
  if (categoryKey === 'SALARIED') {
    sections.push(EMPLOYMENT_SECTION)
  }

  // Add income section
  sections.push(INCOME_SECTION)

  // Add bank details section
  sections.push(BANK_DETAILS_SECTION)

  return sections
}

// Indian states list for address dropdowns
export const INDIAN_STATES = [
  { value: 'AN', label: 'Andaman and Nicobar Islands' },
  { value: 'AP', label: 'Andhra Pradesh' },
  { value: 'AR', label: 'Arunachal Pradesh' },
  { value: 'AS', label: 'Assam' },
  { value: 'BR', label: 'Bihar' },
  { value: 'CH', label: 'Chandigarh' },
  { value: 'CT', label: 'Chhattisgarh' },
  { value: 'DN', label: 'Dadra and Nagar Haveli' },
  { value: 'DD', label: 'Daman and Diu' },
  { value: 'DL', label: 'Delhi' },
  { value: 'GA', label: 'Goa' },
  { value: 'GJ', label: 'Gujarat' },
  { value: 'HR', label: 'Haryana' },
  { value: 'HP', label: 'Himachal Pradesh' },
  { value: 'JK', label: 'Jammu and Kashmir' },
  { value: 'JH', label: 'Jharkhand' },
  { value: 'KA', label: 'Karnataka' },
  { value: 'KL', label: 'Kerala' },
  { value: 'LA', label: 'Ladakh' },
  { value: 'LD', label: 'Lakshadweep' },
  { value: 'MP', label: 'Madhya Pradesh' },
  { value: 'MH', label: 'Maharashtra' },
  { value: 'MN', label: 'Manipur' },
  { value: 'ML', label: 'Meghalaya' },
  { value: 'MZ', label: 'Mizoram' },
  { value: 'NL', label: 'Nagaland' },
  { value: 'OR', label: 'Odisha' },
  { value: 'PY', label: 'Puducherry' },
  { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' },
  { value: 'SK', label: 'Sikkim' },
  { value: 'TN', label: 'Tamil Nadu' },
  { value: 'TG', label: 'Telangana' },
  { value: 'TR', label: 'Tripura' },
  { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UK', label: 'Uttarakhand' },
  { value: 'WB', label: 'West Bengal' },
]
