/**
 * Entity Forms Types - Central Export
 */

// Shared utilities
export * from './shared'

// Sole Proprietorship
export * from './sole-proprietorship'

// Partnership Firm
export * from './partnership'

// Limited Liability Partnership (LLP)
export * from './llp'

// Private Limited Company
export * from './private-limited'

// Public Limited Company
export * from './public-limited'

// One Person Company (OPC)
export * from './opc'

// Trust
export * from './trust'

// Society
export * from './society'

// Hindu Undivided Family (HUF)
export * from './huf'

// Cooperative Society
export * from './cooperative'

// Common constants shared across entities
export const NATURE_OF_BUSINESS_OPTIONS = [
  { value: 'RETAIL', label: 'Retail Trade' },
  { value: 'WHOLESALE', label: 'Wholesale Trade' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'SERVICES', label: 'Services' },
  { value: 'FOOD_BEVERAGE', label: 'Food & Beverage' },
  { value: 'HEALTHCARE', label: 'Healthcare' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'IT_CONSULTING', label: 'IT & Consulting' },
  { value: 'CONSTRUCTION', label: 'Construction' },
  { value: 'TRANSPORT', label: 'Transport & Logistics' },
  { value: 'AGRICULTURE', label: 'Agriculture & Allied' },
  { value: 'FINANCE', label: 'Finance & Banking' },
  { value: 'REAL_ESTATE', label: 'Real Estate' },
  { value: 'HOSPITALITY', label: 'Hospitality & Tourism' },
  { value: 'OTHER', label: 'Other' }
]

export const BUSINESS_CATEGORY_OPTIONS = [
  { value: 'MICRO', label: 'Micro Enterprise (< ₹1 Cr)' },
  { value: 'SMALL', label: 'Small Enterprise (₹1-10 Cr)' },
  { value: 'MEDIUM', label: 'Medium Enterprise (₹10-50 Cr)' },
  { value: 'LARGE', label: 'Large Enterprise (> ₹50 Cr)' }
]

export const GST_STATUS_OPTIONS = [
  { value: 'REGISTERED', label: 'GST Registered' },
  { value: 'NOT_REGISTERED', label: 'Not Registered' },
  { value: 'COMPOSITION', label: 'Composition Scheme' }
]

export const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' }
]

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
  'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Lakshadweep'
]

export const ANNUAL_TURNOVER_OPTIONS = [
  { value: 'BELOW_40L', label: 'Below ₹40 Lakhs' },
  { value: '40L_TO_1CR', label: '₹40 Lakhs - 1 Crore' },
  { value: '1CR_TO_5CR', label: '₹1 - 5 Crore' },
  { value: '5CR_TO_10CR', label: '₹5 - 10 Crore' },
  { value: '10CR_TO_50CR', label: '₹10 - 50 Crore' },
  { value: '50CR_TO_100CR', label: '₹50 - 100 Crore' },
  { value: 'ABOVE_100CR', label: 'Above ₹100 Crore' }
]

export const ROC_OFFICES = [
  'ROC Mumbai', 'ROC Delhi', 'ROC Chennai', 'ROC Kolkata', 'ROC Bangalore',
  'ROC Hyderabad', 'ROC Ahmedabad', 'ROC Pune', 'ROC Jaipur', 'ROC Kanpur',
  'ROC Guwahati', 'ROC Patna', 'ROC Coimbatore', 'ROC Ernakulam', 'ROC Cuttack',
  'ROC Shimla', 'ROC Jammu', 'ROC Shillong', 'ROC Panaji', 'ROC Pondicherry'
]
