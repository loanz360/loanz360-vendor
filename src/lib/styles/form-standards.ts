/**
 * LOANZ 360 - Form Standards
 *
 * Global style constants for forms across the customer portal.
 * These standards ensure visual consistency with the LOANZ 360 brand identity.
 *
 * Brand Colors: Black (#000000), Orange (#FF6700), White (#FFFFFF)
 *
 * Reference: globals.css Master Card System
 */

// =============================================================================
// FORM CONTAINER STYLES
// =============================================================================

/**
 * Form Container - Constrains form width for optimal readability
 * Use this wrapper around all data entry forms (not selection grids)
 */
export const FORM_CONTAINER = 'max-w-4xl mx-auto'

/**
 * Form Card - Main container for form sections
 * Matches .content-card from globals.css
 */
export const FORM_CARD = 'bg-[#111827] rounded-2xl border border-gray-800 p-6 sm:p-8'

/**
 * Form Card with hover effect (for clickable cards)
 */
export const FORM_CARD_INTERACTIVE = 'bg-[#111827] rounded-2xl border border-gray-800 p-6 sm:p-8 transition-all hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10'

// =============================================================================
// FORM GRID LAYOUTS
// =============================================================================

/**
 * Standard Form Grid - 2 columns on medium screens and above
 * Optimal for form fields - provides good readability
 */
export const FORM_GRID = 'grid grid-cols-1 md:grid-cols-2 gap-6'

/**
 * Full Width Field - Spans both columns
 * Use for: Address lines, descriptions, long text fields
 */
export const FORM_FIELD_FULL_WIDTH = 'md:col-span-2'

/**
 * Section Spacing - Space between form sections
 */
export const FORM_SECTION_SPACING = 'space-y-6'

// =============================================================================
// INPUT FIELD STYLES
// =============================================================================

/**
 * Base Input - Standard text input styling
 * Matches LOANZ 360 brand: black background with gray border
 */
export const INPUT_BASE = 'w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors'

/**
 * Input with Icon - Add padding for icon prefix
 * Icon should be positioned at: absolute left-3 top-1/2 -translate-y-1/2
 */
export const INPUT_WITH_ICON = 'w-full pl-10 pr-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors'

/**
 * Input Error State - Red border and focus ring
 */
export const INPUT_ERROR = 'border-red-500 focus:ring-red-500/50 focus:border-red-500'

/**
 * Input Disabled State
 */
export const INPUT_DISABLED = 'bg-gray-900 opacity-60 cursor-not-allowed'

/**
 * Input Icon - Positioning for icons inside inputs
 */
export const INPUT_ICON = 'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500'

// =============================================================================
// SELECT FIELD STYLES
// =============================================================================

/**
 * Select Base - Dropdown styling
 */
export const SELECT_BASE = 'w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors'

/**
 * Select with Icon
 */
export const SELECT_WITH_ICON = 'w-full pl-10 pr-4 py-3 bg-black border border-gray-700 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors'

// =============================================================================
// TEXTAREA STYLES
// =============================================================================

/**
 * Textarea Base
 */
export const TEXTAREA_BASE = 'w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors resize-none min-h-[80px]'

// =============================================================================
// SECTION STYLES
// =============================================================================

/**
 * Section Header - Title with icon
 */
export const SECTION_HEADER = 'text-xl font-semibold text-white flex items-center gap-2'

/**
 * Section Header Icon - Orange accent
 */
export const SECTION_HEADER_ICON = 'w-5 h-5 text-orange-500'

/**
 * Section Description
 */
export const SECTION_DESCRIPTION = 'text-gray-400 text-sm mt-1'

/**
 * Section Divider - Horizontal line between sections
 */
export const SECTION_DIVIDER = 'md:col-span-2 border-t border-gray-800 my-2'

/**
 * Nested Section - For grouped fields like addresses
 * Matches .card-item from globals.css
 */
export const NESTED_SECTION = 'p-5 bg-gray-800/50 rounded-xl border border-gray-700'

/**
 * Nested Section Header
 */
export const NESTED_SECTION_HEADER = 'text-lg font-medium text-white flex items-center gap-2 mb-4'

// =============================================================================
// LABEL STYLES
// =============================================================================

/**
 * Label Base
 */
export const LABEL_BASE = 'block text-sm font-medium text-gray-300 mb-2'

/**
 * Optional Field Indicator
 */
export const LABEL_OPTIONAL = 'text-gray-500 font-normal'

/**
 * Required Field Indicator (hidden during development)
 */
export const LABEL_REQUIRED = 'text-red-400 ml-1'

/**
 * Required for Loan Indicator
 */
export const LABEL_REQUIRED_FOR_LOAN = 'text-orange-400 ml-1'

// =============================================================================
// BUTTON STYLES
// =============================================================================

/**
 * Primary Button - Orange, main actions
 */
export const BUTTON_PRIMARY = 'flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed'

/**
 * Secondary Button - Gray, back/cancel actions
 */
export const BUTTON_SECONDARY = 'flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors'

/**
 * Outline Button - Bordered, save draft
 */
export const BUTTON_OUTLINE = 'flex items-center gap-2 px-4 py-3 border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-white rounded-lg transition-colors'

/**
 * Success Button - Green, complete/confirm
 */
export const BUTTON_SUCCESS = 'flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium'

// =============================================================================
// STEP INDICATOR STYLES
// =============================================================================

/**
 * Step Circle - Base size for all step indicators
 */
export const STEP_CIRCLE = 'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all'

/**
 * Step Circle - Active state (current step)
 */
export const STEP_ACTIVE = 'bg-orange-500 border-orange-500 text-white ring-4 ring-orange-500/30'

/**
 * Step Circle - Completed state
 */
export const STEP_COMPLETED = 'bg-green-500 border-green-500 text-white'

/**
 * Step Circle - Pending state (future steps)
 */
export const STEP_PENDING = 'bg-gray-800 border-gray-600 text-gray-400'

/**
 * Step Label - Active
 */
export const STEP_LABEL_ACTIVE = 'mt-2 text-xs font-medium text-center text-orange-400'

/**
 * Step Label - Completed
 */
export const STEP_LABEL_COMPLETED = 'mt-2 text-xs font-medium text-center text-green-400'

/**
 * Step Label - Pending
 */
export const STEP_LABEL_PENDING = 'mt-2 text-xs font-medium text-center text-gray-500'

/**
 * Step Connector Line
 */
export const STEP_CONNECTOR = 'h-1 flex-1 mx-2 rounded transition-colors'

/**
 * Step Connector - Completed
 */
export const STEP_CONNECTOR_COMPLETED = 'bg-green-500'

/**
 * Step Connector - Pending
 */
export const STEP_CONNECTOR_PENDING = 'bg-gray-700'

// =============================================================================
// ERROR DISPLAY STYLES
// =============================================================================

/**
 * Field Error Message
 */
export const ERROR_MESSAGE = 'mt-1 text-sm text-red-400'

/**
 * Error Summary Box - For multiple errors
 */
export const ERROR_SUMMARY = 'p-4 bg-red-500/10 border border-red-500/30 rounded-lg'

/**
 * Error Summary Icon
 */
export const ERROR_ICON = 'w-5 h-5 text-red-400 flex-shrink-0'

// =============================================================================
// UPLOAD STYLES
// =============================================================================

/**
 * Upload Zone - Dashed border upload area
 */
export const UPLOAD_ZONE = 'flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-700 rounded-lg bg-gray-800/50 hover:bg-gray-800 hover:border-orange-500 cursor-pointer transition-colors'

/**
 * Upload Zone - Uploading state
 */
export const UPLOAD_ZONE_UPLOADING = 'flex flex-col items-center justify-center p-6 border-2 border-dashed border-orange-500 rounded-lg bg-orange-500/10'

/**
 * Upload Zone - Success state
 */
export const UPLOAD_ZONE_SUCCESS = 'flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg'

/**
 * Upload Zone - Error state
 */
export const UPLOAD_ZONE_ERROR = 'flex flex-col items-center justify-center p-6 border-2 border-dashed border-red-500 rounded-lg bg-red-500/10'

// =============================================================================
// CHECKBOX & RADIO STYLES
// =============================================================================

/**
 * Checkbox Base
 */
export const CHECKBOX_BASE = 'w-5 h-5 rounded border-gray-600 bg-black text-orange-500 focus:ring-orange-500/50'

/**
 * Radio Base
 */
export const RADIO_BASE = 'w-4 h-4 text-orange-500 bg-black border-gray-600 focus:ring-orange-500'

/**
 * Toggle Button Group - For gender, marital status, etc.
 */
export const TOGGLE_BUTTON_BASE = 'flex-1 py-3 px-4 rounded-lg border transition-all'

/**
 * Toggle Button - Selected
 */
export const TOGGLE_BUTTON_SELECTED = 'bg-orange-500/20 border-orange-500 text-orange-400'

/**
 * Toggle Button - Unselected
 */
export const TOGGLE_BUTTON_UNSELECTED = 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'

// =============================================================================
// VERIFICATION STATUS STYLES
// =============================================================================

/**
 * Verify Button
 */
export const VERIFY_BUTTON = 'shrink-0 px-4 py-3 rounded-lg font-medium text-sm transition-all bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20'

/**
 * Verify Button - Verified state
 */
export const VERIFY_BUTTON_VERIFIED = 'shrink-0 px-4 py-3 rounded-lg font-medium text-sm bg-green-500/10 text-green-400 border border-green-500/30'

/**
 * Verification Status - Success message
 */
export const VERIFY_STATUS_SUCCESS = 'text-xs text-green-400 flex items-center gap-1'

/**
 * Verification Status - Error message
 */
export const VERIFY_STATUS_ERROR = 'text-xs text-red-400 flex items-center gap-1'

// =============================================================================
// INFO & ALERT STYLES
// =============================================================================

/**
 * Info Alert - Orange bordered
 */
export const ALERT_INFO = 'flex items-center gap-4 p-4 bg-orange-500/10 rounded-xl border border-orange-500/30'

/**
 * Info Alert Icon
 */
export const ALERT_INFO_ICON = 'w-5 h-5 text-orange-400 flex-shrink-0'

/**
 * Info Alert Text
 */
export const ALERT_INFO_TEXT = 'text-sm text-orange-300'

/**
 * Warning Alert
 */
export const ALERT_WARNING = 'flex items-center gap-4 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30'

/**
 * Success Alert
 */
export const ALERT_SUCCESS = 'flex items-center gap-4 p-4 bg-green-500/10 rounded-xl border border-green-500/30'

// =============================================================================
// NAVIGATION FOOTER STYLES
// =============================================================================

/**
 * Form Navigation Container
 */
export const NAV_CONTAINER = 'flex items-center justify-between mt-8 pt-6 border-t border-gray-800'

/**
 * Navigation Left Side (Previous, Save Draft)
 */
export const NAV_LEFT = 'flex items-center gap-3'

/**
 * Navigation Right Side (Continue, Submit)
 */
export const NAV_RIGHT = 'flex items-center gap-3'

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Combine input classes with error state
 */
export const getInputClasses = (hasError: boolean, hasIcon: boolean = false): string => {
  const base = hasIcon ? INPUT_WITH_ICON : INPUT_BASE
  return hasError ? `${base} ${INPUT_ERROR}` : base
}

/**
 * Combine select classes with error state
 */
export const getSelectClasses = (hasError: boolean, hasIcon: boolean = false): string => {
  const base = hasIcon ? SELECT_WITH_ICON : SELECT_BASE
  return hasError ? `${base} ${INPUT_ERROR}` : base
}

/**
 * Get step circle classes based on state
 */
export const getStepClasses = (
  isActive: boolean,
  isCompleted: boolean
): string => {
  if (isActive) return `${STEP_CIRCLE} ${STEP_ACTIVE}`
  if (isCompleted) return `${STEP_CIRCLE} ${STEP_COMPLETED}`
  return `${STEP_CIRCLE} ${STEP_PENDING}`
}

/**
 * Get step label classes based on state
 */
export const getStepLabelClasses = (
  isActive: boolean,
  isCompleted: boolean
): string => {
  if (isActive) return STEP_LABEL_ACTIVE
  if (isCompleted) return STEP_LABEL_COMPLETED
  return STEP_LABEL_PENDING
}

/**
 * Get toggle button classes based on selection state
 */
export const getToggleButtonClasses = (isSelected: boolean): string => {
  return `${TOGGLE_BUTTON_BASE} ${isSelected ? TOGGLE_BUTTON_SELECTED : TOGGLE_BUTTON_UNSELECTED}`
}
